import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { clearCheckoutState, getCheckoutState, saveCheckoutState, CheckoutState } from "@/lib/checkoutContext";
import { loadUserCart, saveUserCart } from "../session";
import { saveOrderMessage } from "../streamContext";
import { KAPRUKA_CITIES_SET } from "@/constants/cities";
import { placeOrderInternally } from "@/lib/orderService";
import { cartModifierAgent, type CartModification } from "@/lib/agents/cartModifierAgent";
import { orderAgent } from "@/lib/agents/orderAgent";
import {
  pillar1_createOrderLink,
  pillar1_getProductDetails,
  pillar2_checkDelivery
} from "@/lib/tools";
import { ChatHandlerContext } from "./types";
import { InlineProduct, UserAddress } from "@/types/sourcing";

// Re-implementing mapToSavedAddress since it's local in route.ts
const mapToSavedAddress = (addr: any) => {
  if (!addr) return undefined;
  return {
    name: addr.recipientName || addr.name || addr.label || "Customer",
    phone: addr.phone || "",
    address: addr.addressLine || addr.address || "",
    city: addr.city || ""
  };
};

export async function handleCheckoutFlow(action: string, ctx: ChatHandlerContext): Promise<boolean> {
  let {
    sessionId, userId, message, checkoutState, allUserAddresses, savedAddr, ai,
    fetchedSelectedProducts, availableProducts, streamContext
  } = ctx;
  let intent = ctx.intent; // For checkout_pause mutation
  
  const send = streamContext.send.bind(streamContext);
  const streamWords = streamContext.streamWords.bind(streamContext);
  const createMcpContext = streamContext.createMcpContext.bind(streamContext);
  const controller = streamContext; // allows controller.close()
  
  // To satisfy savedAddressLabels
  const savedAddressLabels = allUserAddresses.map((a) => a.label || a.type);

// ── Action: checkout_cancel ────────────────────────────────────────
        if (action === "checkout_cancel") {
          send({ type: "thought", step: "order_agent", status: "running", content: "Cancelling checkout..." });
          await clearCheckoutState(sessionId);
          await saveUserCart(sessionId, userId, []);

          const ofs = { phase: "cancelled", cartItems: [] };
          send({ type: "order_flow_step", ...ofs });
          send({ type: "thought", step: "order_agent", status: "completed", content: "Checkout cancelled.", durationMs: 0 });

          const t = "No problem! I've cancelled your checkout and cleared your cart. Let me know whenever you'd like to search for something!";
          await streamWords(t);
          await saveOrderMessage(sessionId, t, ofs);
          controller.close();
          return true;
        }

        // ── Action: checkout_start ─────────────────────────────────────────
        if (action === "checkout_start") {
          let currentCart = await loadUserCart(sessionId, userId);

          // Merge selected products from UI buttons
          if (fetchedSelectedProducts.length > 0) {
            for (const p of fetchedSelectedProducts as InlineProduct[]) {
              const existingIdx = currentCart.findIndex((item) =>
                String(item.id).trim().toLowerCase() === String(p.id).trim().toLowerCase() ||
                String(item.name).trim().toLowerCase() === String(p.name).trim().toLowerCase()
              );
              if (existingIdx === -1) {
                currentCart.push({
                  id: String(p.id),
                  name: p.name || p.title || "Kapruka Product",
                  price: p.price || 0,
                  quantity: 1,
                  imageUrl: p.imageUrl || p.image,
                  inStock: p.inStock !== false,
                });
              }
            }
            await saveUserCart(sessionId, userId, currentCart);
          }

          if (currentCart.length === 0) {
            const ofs = { phase: "qty_ask", cartItems: [] };
            send({ type: "order_flow_step", ...ofs });
            const t = "Your cart is currently empty. Please select products from the search results and click 'Add to Cart' first!";
            await streamWords(t);
            await saveOrderMessage(sessionId, t, ofs);
            controller.close();
            return true;
          }

          // Stock check
          send({ type: "thought", step: "checking_stock", status: "running", content: `Checking stock for ${currentCart.length} item(s)...` });
          const freshCart = await Promise.all(
            currentCart.map(async (item) => {
              const fresh = await pillar1_getProductDetails(item.id).catch(() => null as any);
              return {
                ...item,
                inStock: fresh ? fresh.inStock !== false : item.inStock,
                stockQty: fresh ? (fresh.stockCount ?? undefined) : undefined,
              };
            })
          );
          currentCart = freshCart;
          await saveUserCart(sessionId, userId, currentCart);
          send({ type: "thought", step: "checking_stock", status: "completed", content: "Stock check complete.", durationMs: 0 });

          const outOfStockItems = currentCart.filter((item) => !item.inStock);
          if (outOfStockItems.length > 0) {
            const names = outOfStockItems.map((i) => `**${i.name}**`).join(", ");
            const ofs = { phase: "out_of_stock", cartItems: currentCart };
            send({ type: "order_flow_step", ...ofs });
            const t = `Sorry, some items are currently out of stock: ${names}. Please remove them or choose different products!`;
            await streamWords(t);
            await saveOrderMessage(sessionId, t, ofs);
            controller.close();
            return true;
          }

          // Save checkout session state
          const existingCheckoutState = await getCheckoutState(sessionId);
          const newCheckoutState: CheckoutState = {
            phase: "qty_ask",
            cartItems: currentCart,
            savedAddress: mapToSavedAddress(savedAddr),
            confirmedAddress: existingCheckoutState?.confirmedAddress,
            deliveryDate: existingCheckoutState?.deliveryDate,
            personalMessage: existingCheckoutState?.personalMessage,
          };
          await saveCheckoutState(sessionId, newCheckoutState);

          const total = currentCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const ofs = { phase: "qty_ask", cartItems: currentCart, savedAddress: savedAddr };
          send({ type: "order_flow_step", ...ofs });
          const t = `I've loaded your cart for checkout 📦 You have **${currentCart.length} item(s)** (Subtotal: Rs. ${total.toLocaleString()}). Please confirm the quantities and click next when ready.`;
          await streamWords(t);
          await saveOrderMessage(sessionId, t, ofs);
          controller.close();
          return true;
        }

        // ── Action: checkout_start_with_address ────────────────────────────
        if (action === "checkout_start_with_address") {
          let currentCart = await loadUserCart(sessionId, userId);

          // Merge selected products
          if (fetchedSelectedProducts.length > 0) {
            for (const p of fetchedSelectedProducts as InlineProduct[]) {
              const existingIdx = currentCart.findIndex((item) =>
                String(item.id).trim().toLowerCase() === String(p.id).trim().toLowerCase() ||
                String(item.name).trim().toLowerCase() === String(p.name).trim().toLowerCase()
              );
              if (existingIdx === -1) {
                currentCart.push({
                  id: String(p.id),
                  name: p.name || p.title || "Kapruka Product",
                  price: p.price || 0,
                  quantity: 1, // Skip qty_ask, use 1 by default
                  imageUrl: p.imageUrl || p.image,
                  inStock: p.inStock !== false,
                });
              }
            }
            await saveUserCart(sessionId, userId, currentCart);
          }

          if (currentCart.length === 0) {
            const ofs = { phase: "qty_ask", cartItems: [] };
            send({ type: "order_flow_step", ...ofs });
            const t = "Your cart is currently empty. Please select products from the search results first!";
            await streamWords(t);
            await saveOrderMessage(sessionId, t, ofs);
            controller.close();
            return true;
          }

          // Extract label and quantities from the prompt via LLM
          send({ type: "thought", step: "intent_routing", status: "running", content: "Extracting delivery address and quantities..." });

          let matchedAddress = savedAddr;
          if (ai) {
            const cartContext = currentCart.map((item: any) => `- ID: ${item.id}, Name: ${item.name}`).join("\n");
            const extractPrompt = `You are extracting information from a user's fast-checkout request.
User message: "${message}"

Current Cart Items:
${cartContext}

Task:
1. Extract the address label mentioned in the message and match it against one of these known labels: [${savedAddressLabels.map((l: string) => `"${l}"`).join(", ")}]. If none matches, set "label" to "NOT FOUND".
2. If the user specifies quantities for any of the items, extract them as a map of "item_id": quantity. For example, if they say "2 of the cakes" and the cake ID is 123, return { "123": 2 }.

Respond ONLY with valid JSON matching this schema:
{
  "label": "string",
  "quantities": { "string_item_id": number }
}`;
            try {
              const res = await ai.models.generateContent({
                model: config.gemini.fastModel,
                contents: extractPrompt,
                config: { responseMimeType: "application/json" }
              });
              const rawText = (res.text || "{}").trim();
              const parsed = JSON.parse(rawText);

              if (parsed.label && parsed.label !== "NOT FOUND") {
                const found = allUserAddresses.find((a: any) => (a.label || a.type).toLowerCase() === parsed.label.toLowerCase());
                if (found) matchedAddress = found;
              }

              // Apply extracted quantities to the cart
              if (parsed.quantities && typeof parsed.quantities === "object") {
                currentCart = currentCart.map((item) => {
                  const newQty = parsed.quantities[item.id];
                  if (typeof newQty === "number" && newQty > 0) {
                    return { ...item, quantity: newQty };
                  }
                  return item;
                });
                await saveUserCart(sessionId, userId, currentCart);
              }
            } catch (err) {
              console.warn("Failed to extract address label and quantities", err);
            }
          }

          send({ type: "thought", step: "intent_routing", status: "completed", content: `Matched address: ${matchedAddress ? (matchedAddress as any).label || (matchedAddress as any).type : "Default"}`, durationMs: 0 });

          // Validate that the matched address has a valid Kapruka delivery city
          const isCityValid = matchedAddress && matchedAddress.city && KAPRUKA_CITIES_SET.has(matchedAddress.city);

          if (isCityValid) {
            // Fast-track to delivery_date_ask (skips delivery_ask, user already confirmed address)
            const existingCheckoutState = await getCheckoutState(sessionId);
            const newCheckoutState: CheckoutState = {
              phase: "delivery_date_ask",
              cartItems: currentCart,
              savedAddress: mapToSavedAddress(savedAddr),
              confirmedAddress: mapToSavedAddress(matchedAddress) as any,
              deliveryDate: existingCheckoutState?.deliveryDate,
              personalMessage: existingCheckoutState?.personalMessage,
              confirmedQty: currentCart.reduce((sum, item) => sum + item.quantity, 0),
            };
            await saveCheckoutState(sessionId, newCheckoutState);

            const ofs = { phase: "delivery_date_ask", cartItems: currentCart, savedAddress: savedAddr, confirmedAddress: mapToSavedAddress(matchedAddress) };
            send({ type: "order_flow_step", ...ofs });

            const t = `Got it! I've added the item(s) to your cart and set the delivery to your **${(matchedAddress as any)?.label || (matchedAddress as any)?.type || "saved address"}**. When would you like it delivered? Pick a date below, and feel free to add a personal message!`;
            await streamWords(t);
            await saveOrderMessage(sessionId, t, ofs);
            controller.close();
            return true;
          } else {
            // Force delivery_ask phase to let user select/configure a valid address
            const newCheckoutState: CheckoutState = {
              phase: "delivery_ask",
              cartItems: currentCart,
              savedAddress: mapToSavedAddress(savedAddr),
              confirmedQty: currentCart.reduce((sum, item) => sum + item.quantity, 0),
            };
            await saveCheckoutState(sessionId, newCheckoutState);

            const ofs = { phase: "delivery_ask", cartItems: currentCart, savedAddress: savedAddr, savedAddresses: allUserAddresses };
            send({ type: "order_flow_step", ...ofs });

            const t = `I've added the item(s) to your cart, but I noticed your address does not have a verified Kapruka delivery city. Please confirm or select your delivery address below:`;
            await streamWords(t);
            await saveOrderMessage(sessionId, t, ofs);
            controller.close();
            return true;
          }
        }

        // ── Action: cart_modify ────────────────────────────────────────────
        if (action === "cart_modify" && checkoutState) {
          send({ type: "thought", step: "cart_agent", status: "running", content: "Cart Modifier Agent: understanding your request..." });

          const currentCart = await loadUserCart(sessionId, userId);

          let modification: CartModification = {
            type: "remove" as any,
            itemId: null,
            itemName: null,
            newQty: null,
            itemsToAdd: null,
            responseText: "Your cart has been updated.",
            updatedCart: currentCart,
          };

          if (ai) {
            modification = await cartModifierAgent(message, currentCart, availableProducts, ai, config.gemini.fastModel);
          }

          send({ type: "thought", step: "cart_agent", status: "completed", content: `Cart: ${modification.type} ${modification.type === "add" ? `${modification.itemsToAdd?.length ?? 0} item(s)` : `"${modification.itemName}"`}`, durationMs: 0 });

          // Fallback: If user tried to add items but none were matched in availableProducts,
          // it means they want to add a new product not currently loaded.
          // Pause checkout and perform a product search instead of failing the cart modification.
          if (modification.type === "add" && (!modification.itemsToAdd || modification.itemsToAdd.length === 0)) {
            console.log("[route.ts] cart_modify 'add' returned 0 items. Overriding to checkout_pause to search for the product.");
            action = "checkout_pause";
            intent = "product";
          } else {
            // Apply and persist
            await saveUserCart(sessionId, userId, modification.updatedCart);

            // Update the checkout session's cartItems too
            if (checkoutState) {
              let nextPhase = checkoutState.phase;
              let resetConfirmedQty = checkoutState.confirmedQty;

              // Reset checkout phase to qty_ask for all cart modifications so user can verify
              if (modification.type === "add" || modification.type === "remove" || modification.type === "update_qty") {
                nextPhase = "qty_ask";
                resetConfirmedQty = undefined;
              }

              const updatedState: CheckoutState = {
                ...checkoutState,
                cartItems: modification.updatedCart,
                phase: nextPhase,
                confirmedQty: resetConfirmedQty,
              };

              if (modification.updatedCart.length === 0) {
                // Cart is now empty — cancel checkout
                await clearCheckoutState(sessionId);
                const ofs = { phase: "cancelled", cartItems: [] };
                send({ type: "order_flow_step", ...ofs });
                await streamWords("Your cart is now empty. Checkout has been cancelled. Feel free to search for more products!");
                await saveOrderMessage(sessionId, "Your cart is now empty. Checkout has been cancelled. Feel free to search for more products!", ofs);
                controller.close();
                return true;
              } else {
                await saveCheckoutState(sessionId, updatedState);
                // Update the UI checkout card with new cart
                const ofs = {
                  phase: updatedState.phase,
                  cartItems: modification.updatedCart,
                  savedAddress: updatedState.savedAddress,
                  confirmedQuantity: updatedState.confirmedQty,
                  confirmedAddress: updatedState.confirmedAddress,
                  geocodedLocation: updatedState.geocodedLocation,
                  paymentMethod: updatedState.paymentMethod,
                };
                send({ type: "order_flow_step", ...ofs });
              }
            }

            await streamWords(modification.responseText);
            await prisma.chatMessage.create({
              data: {
                sessionId,
                role: "assistant",
                content: modification.responseText,
                thoughtProcess: JSON.stringify({
                  steps: [{ step: "cart_agent", status: "completed", content: `Cart modified: ${modification.type}`, durationMs: 0 }],
                  intent: "product",
                  orderFlowStep: checkoutState
                    ? {
                        phase: (modification.type === "add" || modification.type === "remove" || modification.type === "update_qty") ? "qty_ask" : checkoutState.phase,
                        cartItems: modification.updatedCart,
                        savedAddress: checkoutState.savedAddress,
                        confirmedQuantity: (modification.type === "add" || modification.type === "remove" || modification.type === "update_qty") ? undefined : checkoutState.confirmedQty,
                        confirmedAddress: checkoutState.confirmedAddress,
                        geocodedLocation: checkoutState.geocodedLocation,
                        paymentMethod: checkoutState.paymentMethod,
                      }
                    : undefined,
                }),
              },
            });
            controller.close();
            return true;
          }
        }

        // ── Action: checkout_continue ──────────────────────────────────────
        if (action === "checkout_continue" && checkoutState) {
          send({ type: "thought", step: "order_agent", status: "running", content: `Order Agent: processing phase "${checkoutState.phase}"...` });

          // ── Phase 3: Sync live cart into checkoutState before every agent call ──
          // Silent Add-to-Cart actions (or deletions) done from the UI write to
          // User.cart[sessionId] directly. Re-read it here so the orderAgent always sees
          // the latest cart, not a stale snapshot.
          const liveCart = await loadUserCart(sessionId, userId);
          const liveCartStr = JSON.stringify(liveCart);
          const checkoutCartStr = JSON.stringify(checkoutState.cartItems);
          if (liveCartStr !== checkoutCartStr) {
            // Cart changed — update the CheckoutSession snapshot and re-save.
            checkoutState = { ...checkoutState, cartItems: liveCart };
            await saveCheckoutState(sessionId, checkoutState);
          }

          let agentOutput = {
            nextPhase: "stay" as any,
            stay: true,
            extractedData: {} as any,
            responseText: "I didn't quite catch that. Could you please clarify?",
            requiresGeocode: false,
            requiresOrderPlace: false,
            requiresDeliveryCheck: false,
          };

          let bypassedAI = false;
          if (checkoutState.phase === "delivery_ask" && / address selected$/i.test(message.trim())) {
            const labelMatch = message.match(/^(.+) address selected$/i);
            if (labelMatch) {
               const label = labelMatch[1].trim();
               const found = allUserAddresses.find((a: any) =>
                 (a.label?.toLowerCase() === label.toLowerCase()) ||
                 (a.type?.toLowerCase() === label.toLowerCase()) ||
                 (a.recipientName?.toLowerCase() === label.toLowerCase()) ||
                 ((a as any).name?.toLowerCase() === label.toLowerCase())
               );
               if (found) {
                 bypassedAI = true;
                 agentOutput = {
                   nextPhase: "delivery_date_ask",
                   stay: false,
                   extractedData: { usesSavedAddress: true, selectedAddressId: found.id },
                   responseText: "When would you like your order delivered? Pick a date below, and feel free to add a personal message!",
                   requiresGeocode: false,
                   requiresOrderPlace: false,
                   requiresDeliveryCheck: false,
                 };
               }
            }
          }

          if (checkoutState.phase === "payment_ask") {
            if (message.trim() === "I'll pay cash on delivery") {
              bypassedAI = true;
              agentOutput = {
                nextPhase: "confirmed",
                stay: false,
                extractedData: { paymentMethod: "cod" },
                responseText: "Placing your order...",
                requiresGeocode: false,
                requiresOrderPlace: true,
                requiresDeliveryCheck: false,
              };
            } else if (message.trim() === "I want to pay by card online") {
              bypassedAI = true;
              agentOutput = {
                nextPhase: "confirmed",
                stay: false,
                extractedData: { paymentMethod: "card" },
                responseText: "Placing your order...",
                requiresGeocode: false,
                requiresOrderPlace: true,
                requiresDeliveryCheck: false,
              };
            }
          }

          if (ai && !bypassedAI) {
            agentOutput = await orderAgent(message, checkoutState, ai, config.gemini.fastModel);
          }


          send({ type: "thought", step: "order_agent", status: "completed", content: `Phase transition: ${checkoutState.phase} → ${agentOutput.nextPhase}`, durationMs: 0 });

          // Apply extracted data to checkout state
          let updatedState: CheckoutState = { ...checkoutState };

          const { extractedData } = agentOutput;

          if (extractedData.quantity) {
            updatedState.confirmedQty = extractedData.quantity;
          }
          if (extractedData.updatedCartItems) {
            updatedState.cartItems = extractedData.updatedCartItems;
            await saveUserCart(sessionId, userId, extractedData.updatedCartItems);
          }

          if (extractedData.usesSavedAddress === true && savedAddr) {
            updatedState.confirmedAddress = mapToSavedAddress(savedAddr);
          }
          if (extractedData.selectedAddressId) {
            const found = allUserAddresses.find((a: any) => a.id === extractedData.selectedAddressId);
            if (found) updatedState.confirmedAddress = mapToSavedAddress(found);
          }
          if (extractedData.paymentMethod) {
            updatedState.paymentMethod = extractedData.paymentMethod;
          }
          // Persist delivery date + personal message from delivery_date_ask phase
          if (extractedData.deliveryDate) {
            updatedState.deliveryDate = extractedData.deliveryDate;
          }
          if (extractedData.personalMessage !== undefined && extractedData.personalMessage !== null) {
            updatedState.personalMessage = extractedData.personalMessage || undefined;
          }

          // Determine the actual next phase
          let nextPhase = agentOutput.stay ? checkoutState.phase : agentOutput.nextPhase;

          // Fast-track checkout transition when adding items to an active session
          if (!agentOutput.stay && checkoutState.phase === "qty_ask" && nextPhase === "delivery_ask" && updatedState.confirmedAddress) {
            if (updatedState.deliveryDate) {
              nextPhase = "payment_ask";
              (agentOutput as any).requiresDeliveryCheck = true;
            } else {
              nextPhase = "delivery_date_ask";
              agentOutput.responseText = "Quantities confirmed! Since I already have your delivery address, when would you like this delivered? Please select a date below, and feel free to add a personal message.";
            }
          }

          updatedState.phase = nextPhase;

          // Handle map_open confirmation (LEGACY fallback)
          if (checkoutState.phase === "map_open" && /^confirm location:/i.test(message.trim())) {
            const locationMatch = message.match(/confirm location:\s*(.+),\s*([^,]+)$/i);
            if (locationMatch) {
              const mappedSaved = mapToSavedAddress(savedAddr);
              updatedState.confirmedAddress = {
                name: mappedSaved?.name || "Customer",
                phone: mappedSaved?.phone || "",
                address: locationMatch[1].trim(),
                city: locationMatch[2].trim(),
              };
            }
          }

          // Handle new_address_form confirmation
          if (checkoutState.phase === "new_address_form" && /^new address confirmed:/i.test(message.trim())) {
            const parts = message.replace(/^new address confirmed:\s*/i, "").split("|");
            if (parts.length >= 4) {
              const name = parts[0].trim();
              const phone = parts[1].trim();
              const address = parts[2].trim();
              const city = parts[3].trim();

              updatedState.confirmedAddress = {
                name,
                phone,
                address,
                city,
              };

              // Automatically save this new address to the user's profile
              const currentUserId = userId || "guest";
              try {
                const userRec = await prisma.user.findUnique({ where: { id: currentUserId }, select: { addresses: true } });
                let existingAddrs: UserAddress[] = [];
                if (userRec?.addresses) {
                  existingAddrs = typeof userRec.addresses === "string" ? JSON.parse(userRec.addresses) : (userRec.addresses as unknown as UserAddress[]);
                  if (!Array.isArray(existingAddrs)) existingAddrs = [];
                }

                const newAddrId = crypto.randomUUID();
                const newAddr: UserAddress = {
                  id: newAddrId,
                  type: "custom",
                  label: name.split(" ")[0] + "'s Address", // custom label based on recipient
                  recipientName: name,
                  phone: phone,
                  addressLine: address,
                  city: city,
                  isDefault: existingAddrs.length === 0,
                };

                existingAddrs.push(newAddr);

                await prisma.user.update({
                  where: { id: currentUserId },
                  data: { addresses: JSON.parse(JSON.stringify(existingAddrs)) },
                });

                // Update local array so it gets passed down to the client in the SSE packet
                allUserAddresses = existingAddrs;
              } catch (err) {
                console.error("Failed to auto-save new address:", err);
              }
            }
          }

          // Fast-track after new address confirmation if delivery date is already set
          if (checkoutState.phase === "new_address_form" && updatedState.phase === "delivery_date_ask" && updatedState.confirmedAddress && updatedState.deliveryDate) {
            updatedState.phase = "payment_ask";
            (agentOutput as any).requiresDeliveryCheck = true;
          }

          // ── Handle delivery date check (delivery_date_ask → payment_ask) ──────────
          if ((agentOutput as any).requiresDeliveryCheck && updatedState.confirmedAddress?.city && updatedState.deliveryDate) {
            const city = updatedState.confirmedAddress.city;
            const date = updatedState.deliveryDate;

            let totalFee = 0;
            let deliveryCheck = null;
            let canDeliverAll = true;
            let nextAvail = null;
            let exactCityName = city;

            const itemsToCheck = updatedState.cartItems && updatedState.cartItems.length > 0
                ? updatedState.cartItems.map(i => i.id)
                : updatedState.product ? [updatedState.product.id] : [];

            send({ type: "thought", step: "checking_delivery", status: "running", content: `Checking delivery to ${city} on ${date} for ${itemsToCheck.length} item(s)...` });

            for (const pid of itemsToCheck) {
                send({ type: "tool_call", name: "kapruka_check_delivery", args: { city: city, date: date, product_id: pid } });
                const check = await pillar2_checkDelivery(city, date, pid, createMcpContext("checking_delivery"));
                if (!check) {
                    canDeliverAll = false;
                    break;
                }
                if (!check.canDeliver) {
                    canDeliverAll = false;
                    nextAvail = check.deliveryDate;
                    break;
                }
                totalFee += (check.flatRateLKR || 0);
                deliveryCheck = check;
                exactCityName = check.city;
            }

            if (exactCityName) {
                updatedState.confirmedAddress.city = exactCityName;
            }

            send({ type: "thought", step: "checking_delivery", status: "completed", content: canDeliverAll ? `Delivery ✓ available in ${exactCityName}` : "Delivery not available on requested date", durationMs: 0 });

            if (!canDeliverAll || !deliveryCheck) {
              // Delivery NOT available — stay in delivery_date_ask with error message
              const nextAvailDate = nextAvail || deliveryCheck?.deliveryDate || "a later date";
              updatedState.phase = "delivery_date_ask";
              const errorOfs = {
                phase: "delivery_date_ask" as const,
                cartItems: updatedState.cartItems,
                confirmedAddress: updatedState.confirmedAddress,
                errorMessage: `Delivery to ${updatedState.confirmedAddress.city} is not available on ${updatedState.deliveryDate}. Next available: ${nextAvailDate}.`,
                deliveryCheckResult: {
                  city: updatedState.confirmedAddress.city,
                  canDeliver: false,
                  nextAvailableDate: nextAvailDate,
                },
              };
              await saveCheckoutState(sessionId, updatedState);
              send({ type: "order_flow_step", ...errorOfs });
              const errText = `Sorry, Grasshoppers can't deliver to **${updatedState.confirmedAddress.city}** on **${updatedState.deliveryDate}**. The next available date is **${nextAvailDate}**. Please pick a different date!`;
              await streamWords(errText);
              await saveOrderMessage(sessionId, errText, errorOfs);
              controller.close();
              return true;
            }

            // Pre-generate the checkout link
            send({ type: "thought", step: "placing_order", status: "running", content: "Pre-generating checkout link..." });
            try {
              const orderResult = await pillar1_createOrderLink(
                updatedState.cartItems.map((i: any) => ({ productId: i.id, quantity: i.quantity })),
                updatedState.confirmedAddress as any,
                undefined,
                updatedState.deliveryDate,
                updatedState.personalMessage,
                createMcpContext("creating_order")
              );
              if (orderResult && orderResult.checkoutUrl && orderResult.orderId) {
                updatedState.checkoutUrl = orderResult.checkoutUrl;
                updatedState.orderId = orderResult.orderId;
                send({ type: "thought", step: "placing_order", status: "completed", content: "Generated secure checkout link", durationMs: 0 });
              } else {
                send({ type: "thought", step: "placing_order", status: "completed", content: "Failed to generate checkout link", durationMs: 0 });
              }
            } catch (err) {
              console.error("Pre-generation failed:", err);
              send({ type: "thought", step: "placing_order", status: "completed", content: "Pre-generation failed", durationMs: 0 });
            }

            // Delivery IS available — build OFS with delivery check result and advance to payment_ask
            updatedState.phase = "payment_ask";
            deliveryCheck.flatRateLKR = totalFee; // override with summed total fee
            updatedState.deliveryFeeLKR = deliveryCheck.flatRateLKR;
            const deliveryOfs = {
              phase: "payment_ask" as const,
              cartItems: updatedState.cartItems,
              confirmedAddress: updatedState.confirmedAddress,
              deliveryDate: updatedState.deliveryDate,
              personalMessage: updatedState.personalMessage,
              checkoutUrl: updatedState.checkoutUrl,
              orderId: updatedState.orderId,
              deliveryCheckResult: {
                city: deliveryCheck.city,
                canDeliver: true,
                flatRateLKR: deliveryCheck.flatRateLKR,
                nextAvailableDate: deliveryCheck.deliveryDate,
              },
              savedAddress: updatedState.savedAddress,
              paymentMethod: updatedState.paymentMethod,
            };
            await saveCheckoutState(sessionId, updatedState);
            send({ type: "order_flow_step", ...deliveryOfs });
            const feeText = deliveryCheck.flatRateLKR
              ? `Rs. ${deliveryCheck.flatRateLKR.toLocaleString()}`
              : "standard rate";
            const confirmText = `Delivery to **${deliveryCheck.city}** on **${updatedState.deliveryDate}** is confirmed (${feeText})! 🎉 How would you like to pay — **Cash on Delivery** or **Card Payment**?`;
            await streamWords(confirmText);
            await saveOrderMessage(sessionId, confirmText, deliveryOfs);
            controller.close();
            return true;
          }


          if (agentOutput.requiresOrderPlace) {
            send({ type: "thought", step: "placing_order", status: "running", content: "Placing order via Kapruka..." });

            let checkoutUrl: string | undefined;
            let orderId: string | undefined;
            let orderFailed = false;

            try {
              const cartItems = updatedState.cartItems || [];
              const confirmedAddress = updatedState.confirmedAddress;
              const paymentMethod = updatedState.paymentMethod || "cod";

              const orderItems = cartItems.map((i: any) => ({
                productId: i.id,
                productName: i.name,
                quantity: i.quantity,
                priceLKR: i.price,
                imageUrl: i.imageUrl,
              }));

              const od = await placeOrderInternally({
                items: orderItems,
                recipient: confirmedAddress as any,
                sessionId,
                userId: userId || undefined,
                paymentMethod: paymentMethod as "cod" | "card",
                deliveryDate: updatedState.deliveryDate || undefined,
                personalMessage: updatedState.personalMessage || undefined,
                deliveryFeeLKR: updatedState.deliveryFeeLKR || undefined,
                checkoutUrl: updatedState.checkoutUrl || undefined,
                orderId: updatedState.orderId || undefined,
              });

              checkoutUrl = od.checkoutLink?.checkoutUrl;
              orderId = od.orderResult?.orderId || `ord-${Date.now()}`;

              // Clear cart and checkout session on success
              await saveUserCart(sessionId, userId, []);
              await clearCheckoutState(sessionId);
            } catch (err: any) {
              console.error("[OrderAgent] place order failed:", err);
              orderFailed = true;
            }

            send({ type: "thought", step: "placing_order", status: "completed", content: orderFailed ? "Order placement failed ❌" : "Order placed ✓", durationMs: 0 });

            const cartItems = updatedState.cartItems || [];
            const subtotalLKR = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
            const totalLKR = subtotalLKR + (updatedState.deliveryFeeLKR || 0);
            const itemsListStr = cartItems.map((i: any) => `${i.quantity}x **${i.name}**`).join(", ");

            let confirmationText = "";
            if (orderFailed) {
              confirmationText = `We encountered an issue placing your order for ${itemsListStr}. Please try again later.`;
            } else if (updatedState.paymentMethod === "cod") {
              confirmationText = `Your order for ${itemsListStr} is confirmed! 🎉 Our courier will deliver and collect **Rs. ${totalLKR.toLocaleString()}** in cash on arrival.`;
            } else {
              confirmationText = `Your order for ${itemsListStr} is confirmed! 🎉`;
            }

            const cs = {
              phase: "confirmed" as const,
              cartItems,
              confirmedAddress: updatedState.confirmedAddress,
              paymentMethod: updatedState.paymentMethod,
              checkoutUrl,
              orderId: orderFailed ? null : orderId, // Ensure it's null on failure
              deliveryDate: updatedState.deliveryDate,
              personalMessage: updatedState.personalMessage,
              deliveryCheckResult: updatedState.deliveryFeeLKR ? {
                city: updatedState.confirmedAddress?.city || "",
                canDeliver: true,
                flatRateLKR: updatedState.deliveryFeeLKR,
              } : undefined,
            };
            send({ type: "order_flow_step", ...cs });
            await streamWords(confirmationText);
            await saveOrderMessage(sessionId, confirmationText, cs);
            controller.close();
            return true;
          }

          // Save updated state (phase advanced)
          if (!agentOutput.requiresOrderPlace) {
            await saveCheckoutState(sessionId, updatedState);
          }

          // Build the SSE order_flow_step packet for the UI
          const ofs: Record<string, unknown> = {
            phase: updatedState.phase,
            cartItems: updatedState.cartItems,
            savedAddress: updatedState.savedAddress,
            savedAddresses: allUserAddresses, // NEW: pass full list for delivery_ask
            confirmedQuantity: updatedState.confirmedQty,
            confirmedAddress: updatedState.confirmedAddress,
            geocodedLocation: updatedState.geocodedLocation,
            paymentMethod: updatedState.paymentMethod,
            deliveryDate: updatedState.deliveryDate,
            personalMessage: updatedState.personalMessage,
            deliveryCheckResult: updatedState.deliveryFeeLKR ? {
              city: updatedState.confirmedAddress?.city || "",
              canDeliver: true,
              flatRateLKR: updatedState.deliveryFeeLKR,
            } : undefined,
          };
          if (updatedState.product) ofs.product = updatedState.product;
          send({ type: "order_flow_step", ...ofs });

          await streamWords(agentOutput.responseText);
          await saveOrderMessage(sessionId, agentOutput.responseText, ofs);
          controller.close();
          return true;
        }

        
  return false; // Not a checkout action
}
