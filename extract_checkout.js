const fs = require('fs');

const content = fs.readFileSync('src/app/api/chat/route.ts', 'utf-8');

const startMarker = '// ── Action: checkout_cancel';
const endMarker = '// ── Action: checkout_pause';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Markers not found!");
    process.exit(1);
}

let block = content.substring(startIdx, endIdx);
block = block.replace(/return\s*;/g, 'return true;');

const header = `import { config } from "@/lib/config";
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

`;

const footer = `
  return false; // Not a checkout action
}
`;

fs.writeFileSync('src/lib/chat/handlers/checkout.ts', header + block + footer);
console.log("Checkout extraction done!");
