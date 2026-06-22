"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import type { InlineProduct, Message, HistoryItem, DeliveryResult, TrackingResult, ServiceListing, CheckoutLink, OrderFlowStepData, CartItem, ProductGroup, UserAddress } from "@/types/sourcing";


interface SourcingContextType {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChatting: boolean;
  setIsChatting: React.Dispatch<React.SetStateAction<boolean>>;
  activeHistoryId: string | undefined;
  setActiveHistoryId: React.Dispatch<React.SetStateAction<string | undefined>>;
  activeQueryText: string;
  setActiveQueryText: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  history: HistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  activeUserId: string;
  isSharedReadOnly: boolean;
  fetchHistory: () => Promise<void>;
  fetchSessionAndHydrate: (id: string) => Promise<void>;
  handleResetLocal: () => void;
  handleReset: () => void;
  handleSelectHistory: (id: string) => void;
  handleStopGeneration: () => void;
  handleSendMessage: (text: string, files: File[], editMessageId?: string) => Promise<void>;
  handleBuyProduct: (product: InlineProduct) => void;
  handleOrderCart: (products: InlineProduct[]) => void;
  handleSuggestionClick: (suggestion?: string) => void;
  handleDirectSend: (text: string) => void;
  country: string;
  setCountry: (country: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  selectedProducts: InlineProduct[];
  setSelectedProducts: React.Dispatch<React.SetStateAction<InlineProduct[]>>;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  isViewingCart: boolean;
  setIsViewingCart: React.Dispatch<React.SetStateAction<boolean>>;
  handleUpdateCart: (newCart: CartItem[]) => Promise<void>;
  handleAddToCart: (products: InlineProduct[]) => Promise<void>;
  /** Transient toast shown after a silent Add-to-Cart action. Null when no toast is active. */
  cartToast: string | null;
  clearCartToast: () => void;
  /** Saved delivery addresses for the logged-in user */
  userAddresses: UserAddress[];
  setUserAddresses: React.Dispatch<React.SetStateAction<UserAddress[]>>;
}

const SourcingContext = createContext<SourcingContextType | undefined>(undefined);

export function SourcingProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [activeSessionOwnerId, setActiveSessionOwnerId] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined);
  const [activeQueryText, setActiveQueryText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const { user, openAuthModal } = useAuth();
  const [guestId, setGuestId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("kapruka_guest_uuid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("kapruka_guest_uuid", id);
    }
    setGuestId(id);
  }, []);

  const activeUserId = user?.id || guestId || "guest-pending";
  const isSharedReadOnly = activeSessionOwnerId !== null && activeSessionOwnerId !== activeUserId && activeUserId !== "guest-pending";

  const [country, setCountryState] = useState(() =>
    (typeof window !== "undefined" && localStorage.getItem("kapruka_country")) || "LK"
  );
  const [currency, setCurrencyState] = useState(() =>
    (typeof window !== "undefined" && localStorage.getItem("kapruka_currency")) || "LKR"
  );
  const setCountry = useCallback((c: string) => {
    setCountryState(c);
    if (typeof window !== "undefined") localStorage.setItem("kapruka_country", c);
  }, []);
  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    if (typeof window !== "undefined") localStorage.setItem("kapruka_currency", c);
  }, []);
  const [selectedProducts, setSelectedProducts] = useState<InlineProduct[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isViewingCart, setIsViewingCart] = useState<boolean>(false);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userAddresses, setUserAddresses] = useState<UserAddress[]>([]);

  const showCartToast = useCallback((msg: string) => {
    setCartToast(msg);
    if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current);
    cartToastTimerRef.current = setTimeout(() => setCartToast(null), 3000);
  }, []);

  const clearCartToast = useCallback(() => {
    setCartToast(null);
    if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current);
  }, []);

  // Load user's saved addresses when they log in
  useEffect(() => {
    if (!user?.id) {
      setUserAddresses([]);
      return;
    }
    fetch(`/api/user/profile?userId=${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.addresses && Array.isArray(data.addresses)) {
          setUserAddresses(data.addresses as UserAddress[]);
        }
      })
      .catch(err => console.warn("Failed to load user addresses:", err));
  }, [user?.id]);

  // Currency and country are now persisted to localStorage via the wrapped setters above.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const persistedCountry = localStorage.getItem("kapruka_country");
      const persistedCurrency = localStorage.getItem("kapruka_currency");

      if (!persistedCountry && !persistedCurrency) {
        const detectLocation = async () => {
          let countryCode: string | null = null;

          try {
            const res = await fetch("https://ipapi.co/json/");
            if (res.ok) {
              const data = await res.json();
              if (data.country_code) {
                countryCode = data.country_code.toUpperCase();
              }
            }
          } catch (err) {
            console.warn("Location detection failed.", err);
          }

          // Set location and currency based on detected country code
          if (countryCode) {
            setCountry(countryCode);
            if (countryCode === "LK") {
              setCurrency("LKR");
            } else {
              setCurrency("USD");
            }
          } else {
            // Default baseline if failed
            setCountry("LK");
            setCurrency("LKR");
          }
        };
        detectLocation();
      }
    }
  }, [setCountry, setCurrency]);

  // Hydrate user cart when user switches or session changes
  useEffect(() => {
    const loadCart = async () => {
      if (!activeUserId) return;
      // If there is no active session yet, the cart starts empty for this new chat.
      if (!activeHistoryId) {
        setCartItems([]);
        return;
      }
      try {
        const res = await fetch(`/api/session?cartOnly=true&userId=${activeUserId}&sessionId=${activeHistoryId}&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setCartItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load user session cart:", err);
      }
    };
    loadCart();
  }, [activeUserId, activeHistoryId]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/session?userId=${activeUserId}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.map((session: { id: string; title: string; createdAt: string }) => ({
          id: session.id,
          query: session.title,
          date: new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
          queryType: "product",
          messages: []
        }));
        setHistory(items);
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    }
  }, [activeUserId]);

  const fetchSessionAndHydrate = useCallback(async (id: string) => {
    try {
      setMessages([]);
      setIsChatting(true);

      // Find if we already loaded it in memory history list
      const cachedItem = history.find((h) => h.id === id && h.messages.length > 0);
      if (cachedItem) {
        setMessages(cachedItem.messages);
        setActiveQueryText(cachedItem.query);
        setActiveSessionOwnerId(null);
        window.history.replaceState(null, "", `/c/${id}`);
        return;
      }

      const res = await fetch(`/api/session?id=${id}&userId=${activeUserId}&_t=${Date.now()}`);
      if (res.ok) {
        const sessionData = await res.json();
        
        // Cart is loaded globally, skipping session-isolated load
        // Mapped messages parsing continues below

        const mappedMessages: Message[] = sessionData.messages.map((m: { id: string; role: string; content: string; createdAt: string; products?: unknown; thoughtProcess?: unknown }) => {
          let inlineProducts: InlineProduct[] = [];
          let productGroups: ProductGroup[] = [];
          if (m.products) {
            try {
              const parsedProducts = typeof m.products === "string" ? JSON.parse(m.products) : m.products;
              if (Array.isArray(parsedProducts)) {
                if (parsedProducts.length > 0 && typeof parsedProducts[0] === "object" && parsedProducts[0] !== null && "title" in parsedProducts[0] && "products" in parsedProducts[0]) {
                  productGroups = parsedProducts as ProductGroup[];
                  inlineProducts = productGroups.flatMap(g => g.products);
                } else {
                  inlineProducts = parsedProducts as InlineProduct[];
                }
              }
            } catch (e) {
              console.error("Error parsing product data:", e);
            }
          }
          let thinkingSteps: { step: string; status: "running" | "completed"; content: string; durationMs?: number }[] = [];
          let followUpSamples: string[] = [];
          let groundingSources: Array<{ title: string; uri: string }> = [];
          let checkoutFormProduct: InlineProduct | undefined = undefined;
          let checkoutLinks: CheckoutLink[] | undefined = undefined;
          let orderFlowProduct: InlineProduct | undefined = undefined;
          let orderFlowStockStatus: "in_stock" | "out_of_stock" | "limited" | undefined = undefined;
          let orderFlowStockQty: number | undefined = undefined;
          let orderFlowStep: OrderFlowStepData | undefined = undefined;
          let isComparison = false;
          if (m.thoughtProcess) {
            try {
              const parsedProcess = typeof m.thoughtProcess === "string" ? JSON.parse(m.thoughtProcess) : m.thoughtProcess;
              if (parsedProcess && (parsedProcess as Record<string, unknown>).steps) {
                thinkingSteps = (parsedProcess as { steps: typeof thinkingSteps }).steps;
                followUpSamples = (parsedProcess as { followUpQuestions?: string[] }).followUpQuestions || [];
                groundingSources = (parsedProcess as { groundingSources?: typeof groundingSources }).groundingSources || [];
                checkoutFormProduct = (parsedProcess as { checkoutFormProduct?: InlineProduct }).checkoutFormProduct;
                checkoutLinks = (parsedProcess as { checkoutLinks?: CheckoutLink[] }).checkoutLinks;
                orderFlowProduct = (parsedProcess as { orderFlowProduct?: InlineProduct }).orderFlowProduct;
                orderFlowStockStatus = (parsedProcess as { orderFlowStockStatus?: "in_stock" | "out_of_stock" | "limited" }).orderFlowStockStatus;
                orderFlowStockQty = (parsedProcess as { orderFlowStockQty?: number }).orderFlowStockQty;
                orderFlowStep = (parsedProcess as { orderFlowStep?: OrderFlowStepData }).orderFlowStep;
                isComparison = !!parsedProcess.isComparison;
              } else if (Array.isArray(parsedProcess)) {
                thinkingSteps = parsedProcess;
              }
            } catch (e) {
              console.error("Error parsing thought process data:", e);
            }
          }
          return {
            id: m.id,
            sender: m.role === "user" ? "user" : "ai",
            text: m.content,
            timestamp: new Date(m.createdAt),
            thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
            inlineProductsHeader: inlineProducts.length > 0 
              ? (isComparison ? "Compared Products" : "Matched Sourcing Products") 
              : undefined,
            inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
            productGroups: productGroups.length > 0 ? productGroups : undefined,
            showViewProductsButton: inlineProducts.length > 0,
            groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
            checkoutFormProduct,
            checkoutLinks,
            orderFlowProduct,
            orderFlowStockStatus,
            orderFlowStockQty,
            orderFlowStep,
            followUpText: followUpSamples.length > 0 
              ? "Based on this session, you can continue with:" 
              : inlineProducts.length > 0 
                ? "Based on these options, you can continue with:" 
                : undefined,
            followUpSamples: followUpSamples.length > 0 
              ? followUpSamples 
              : inlineProducts.length > 0 
                ? [
                    "Filter by lower MOQ (e.g., < 10 pieces)",
                    "Find specific styles like moon chairs or heavy-duty options",
                    "Request customized logo printing for these models"
                  ] 
                : undefined
          };
        });

        setMessages(mappedMessages);
        setActiveQueryText(sessionData.title);
        setIsChatting(true);
        
        setActiveSessionOwnerId(sessionData.userId);
        window.history.replaceState(null, "", `/c/${id}`);

        setHistory(prev => {
          const exists = prev.some((h) => h.id === id);
          if (exists) {
            return prev.map((h) => (h.id === id ? { ...h, messages: mappedMessages } : h));
          } else {
            return [
              {
                id: sessionData.id,
                query: sessionData.title,
                date: new Date(sessionData.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
                queryType: "product",
                messages: mappedMessages
              },
              ...prev
            ];
          }
        });
      } else {
        console.warn(`Session ${id} not found on server, redirecting to root.`);
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to load session details:", err);
    }
  }, [history, router]);

  const handleResetLocal = useCallback(() => {
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setActiveQueryText("");
    setIsGenerating(false);
    setSelectedProducts([]);
    setCartItems([]);
    setIsViewingCart(false);
    setActiveSessionOwnerId(null);
  }, []);

  // Synchronize state when browser Back/Forward navigation occurs
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/c/")) {
        const id = path.split("/c/")[1];
        if (id) {
          setActiveHistoryId(id);
          setIsChatting(true);
          fetchSessionAndHydrate(id);
        }
      } else {
        handleResetLocal();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [fetchSessionAndHydrate, handleResetLocal]);

  const handleReset = () => {
    setIsMobileSidebarOpen(false);
    setSelectedProducts([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Update path without unmounting the dashboard component tree
    window.history.pushState(null, "", "/");
    handleResetLocal();
  };

  const handleSelectHistory = (id: string) => {
    setIsMobileSidebarOpen(false);
    setSelectedProducts([]);
    // Update path without unmounting the dashboard component tree
    window.history.pushState(null, "", `/`);
    setActiveHistoryId(id);
    fetchSessionAndHydrate(id);
  };


  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleSendMessage = async (text: string, files: File[], editMessageId?: string) => {
    if (!user) {
      const userMessageCount = messages.filter(m => m.sender === "user").length;
      if (userMessageCount >= 9) {
        openAuthModal("message_limit");
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    let aiMessageId = "";

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessageId = `msg-${Date.now()}`;
    const timestamp = new Date();

    let userMessageIdToUpdate = userMessageId;
    const isEdit = !!editMessageId;
    let historyMessages: Message[] = [];

    if (isEdit) {
      const targetIndex = messages.findIndex(m => m.id === editMessageId);
      if (targetIndex !== -1) {
        const targetUserMsg = messages[targetIndex];
        const updatedUserMsg: Message = {
          ...targetUserMsg,
          text: text,
          status: "sending" as const,
        };
        userMessageIdToUpdate = editMessageId;
        const truncated = messages.slice(0, targetIndex);
        historyMessages = [...truncated, updatedUserMsg];
        setMessages(historyMessages);
      }
    } else {
      const newUserMessage: Message = {
        id: userMessageId,
        sender: "user",
        text: text || `Attached ${files.length} document(s) for review`,
        timestamp,
        status: "sending",
        inlineProducts: selectedProducts.length > 0 ? [...selectedProducts] : undefined
      };
      historyMessages = [...messages, newUserMessage];
      setMessages(historyMessages);
    }

    const selectedProductIds = selectedProducts.map(p => p.id);
    const isComparisonQuery = selectedProductIds.length > 0;
    setSelectedProducts([]);
    setIsChatting(true);
    setIsGenerating(true);
    setActiveQueryText(text || "Uploaded design request");

    try {
      let currentSessionId: string = activeHistoryId || "";
      if (!currentSessionId) {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text || "New Sourcing Task", userId: activeUserId })
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          setActiveHistoryId(currentSessionId);
          window.history.pushState(null, "", `/c/${currentSessionId}`);
          
          const newHistoryItem: HistoryItem = {
            id: currentSessionId,
            query: text || "New Sourcing Task",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: []
          };
          setHistory(prev => [newHistoryItem, ...prev]);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
        }
      }

      aiMessageId = `ai-msg-${Date.now()}`;
      const newAiMessage: Message = {
        id: aiMessageId,
        sender: "ai",
        text: "",
        timestamp: new Date(),
        thinkingSteps: [],
        activeToolCall: null,
        activeToolCalls: [],
      };

      setMessages(prev => {
        const updated = prev.map(m => m.id === userMessageIdToUpdate ? { ...m, status: "sent" as const } : m);
        return [...updated, newAiMessage];
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: text || "Uploaded design request",
          userId: activeUserId,
          country,
          currency,
          selectedProductIds,
          editMessageId: isEdit ? editMessageId : undefined
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error("Failed to post message to chat api");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error("No stream reader available");
      }

      let buffer = "";
      let fullResponseText = "";
      let inlineProducts: InlineProduct[] = [];
      let followUpQuestions: string[] = [];
      let deliveryResult: DeliveryResult | undefined;
      let trackingResult: TrackingResult | undefined;

      let serviceListing: ServiceListing | undefined;
      let groundingSources: Array<{ title: string; uri: string }> = [];
      let accumulatedSteps: Array<{ step: string; status: "running" | "completed"; content: string; durationMs?: number }> = [];
      let checkoutFormProduct: InlineProduct | undefined = undefined;
      let orderFlowProduct: InlineProduct | undefined = undefined;
      let orderFlowStockStatus: "in_stock" | "out_of_stock" | "limited" | undefined = undefined;
      let orderFlowStockQty: number | undefined = undefined;
      let orderFlowStep: OrderFlowStepData | undefined = undefined;
      let productGroups: ProductGroup[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;

          if (cleaned.startsWith("data:")) {
            const dataStr = cleaned.replace("data:", "").trim();
            try {
              const packet = JSON.parse(dataStr);

              if (packet.type === "thought") {
                // Per-pipeline steps carry a "term" field; use step+term as the unique key
                const stepKey = packet.term ? `${packet.step}__${packet.term}` : packet.step;
                const existingIdx = accumulatedSteps.findIndex(s => {
                  const key = (s as any)._key;
                  return key ? key === stepKey : s.step === packet.step && !(s as any)._key;
                });
                const stepObj = {
                  _key: stepKey,
                  step: packet.step,
                  status: packet.status as "running" | "completed",
                  content: packet.content,
                  durationMs: packet.durationMs,
                  terms: packet.terms as string[] | undefined,
                  term: packet.term as string | undefined,
                };
                if (existingIdx !== -1) {
                  accumulatedSteps[existingIdx] = stepObj;
                } else {
                  accumulatedSteps.push(stepObj);
                }
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, thinkingSteps: [...accumulatedSteps] } : m
                ));

              } else if (packet.type === "tool_call") {
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        activeToolCall: { name: packet.name, args: packet.args },
                        // Accumulate all parallel tool calls (deduplicated by name+query)
                        activeToolCalls: [
                          ...(m.activeToolCalls || []).filter(c =>
                            !(c.name === packet.name && (c.args as Record<string, unknown>)?.query === (packet.args as Record<string, unknown>)?.query)
                          ),
                          { name: packet.name, args: packet.args }
                        ],
                      }
                    : m
                ));

              } else if (packet.type === "tool_result") {
                if (packet.result?.products) {
                  inlineProducts = packet.result.products;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId
                      ? { 
                          ...m, 
                          activeToolCall: null,
                          activeToolCalls: [], // clear all parallel calls on result
                          inlineProductsHeader: isComparisonQuery ? "Compared Products" : "Kapruka Products", 
                          inlineProducts, 
                          showViewProductsButton: true 
                        }
                      : m
                  ));
                }

              } else if (packet.type === "group_ready") {
                // Incremental update: merge this validated group into productGroups immediately
                // This fires as soon as each pipeline finishes — no waiting for other pipelines
                const newGroupTitle = (packet.term as string).replace(/\b\w/g, (c: string) => c.toUpperCase());
                const newGroup: ProductGroup = {
                  title: newGroupTitle,
                  products: packet.products as InlineProduct[],
                };
                productGroups = [
                  ...productGroups.filter(g => g.title.toLowerCase() !== newGroupTitle.toLowerCase()),
                  newGroup,
                ];
                inlineProducts = productGroups.flatMap(g => g.products);

                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId
                    ? {
                        ...m,
                        productGroups: [...productGroups],
                        inlineProducts: [...inlineProducts],
                        inlineProductsHeader: "Kapruka Products",
                        showViewProductsButton: inlineProducts.length > 0,
                        // Clear active tool calls for this term
                        activeToolCalls: (m.activeToolCalls || []).filter(c =>
                          (c.args as Record<string, unknown>)?.query !== packet.term
                        ),
                      }
                    : m
                ));

              } else if (packet.type === "product_groups") {
                // Final aggregated groups (after all pipelines complete) — ensures consistency
                productGroups = packet.groups as ProductGroup[];
                inlineProducts = productGroups.flatMap(g => g.products);
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId
                    ? { ...m, productGroups: [...productGroups], inlineProducts: [...inlineProducts] }
                    : m
                ));

              } else if (packet.type === "delivery_result") {
                deliveryResult = packet.result as DeliveryResult;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, deliveryResult } : m
                ));

              } else if (packet.type === "tracking_result") {
                trackingResult = packet.result as TrackingResult;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, trackingResult } : m
                ));


              } else if (packet.type === "service_listing") {
                serviceListing = packet.result as ServiceListing;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, serviceListing } : m
                ));

              } else if (packet.type === "text") {
                fullResponseText += packet.content;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m));

              } else if (packet.type === "grounding_sources") {
                if (packet.result) {
                  groundingSources = packet.result;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId ? { ...m, groundingSources } : m
                  ));
                }

              } else if (packet.type === "checkout_form") {
                checkoutFormProduct = packet.product as InlineProduct;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, checkoutFormProduct } : m
                ));
              } else if (packet.type === "order_flow") {
                orderFlowProduct = packet.product as InlineProduct;
                orderFlowStockStatus = packet.stockStatus as "in_stock" | "out_of_stock" | "limited" | undefined;
                orderFlowStockQty = packet.stockQty as number | undefined;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId
                    ? { ...m, activeToolCall: null, orderFlowProduct, orderFlowStockStatus, orderFlowStockQty }
                    : m
                ));
              } else if (packet.type === "order_flow_step") {
                // New conversational phase-driven order flow
                orderFlowStep = {
                  phase: packet.phase,
                  product: packet.product,
                  cartItems: packet.cartItems,
                  stockStatus: packet.stockStatus,
                  stockQty: packet.stockQty,
                  savedAddress: packet.savedAddress,
                  savedAddresses: packet.savedAddresses,
                  geocodedLocation: packet.geocodedLocation,
                  confirmedQuantity: packet.confirmedQuantity,
                  confirmedAddress: packet.confirmedAddress,
                  paymentMethod: packet.paymentMethod,
                  checkoutUrl: packet.checkoutUrl,
                  orderId: packet.orderId,
                  errorMessage: packet.errorMessage,
                } as OrderFlowStepData;

                if (packet.cartItems && Array.isArray(packet.cartItems)) {
                  setCartItems(packet.cartItems);
                }

                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId
                    ? { ...m, activeToolCall: null, orderFlowStep }
                    : m
                ));
              } else if (packet.type === "follow_ups") {
                if (packet.questions) {
                  followUpQuestions = packet.questions;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId
                      ? { ...m, followUpText: "Continue with:", followUpSamples: followUpQuestions }
                      : m
                  ));
                }
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e, dataStr);
            }
          }
        }
      }

      setIsGenerating(false);

      if (currentSessionId && !window.location.pathname.startsWith(`/`)) {
        // Keeping URL to just /
      }

      const finalMappedAi: Message = {
        id: aiMessageId,
        sender: "ai",
        text: fullResponseText,
        timestamp: new Date(),
        thinkingSteps: accumulatedSteps,
        inlineProductsHeader: inlineProducts.length > 0 ? "Kapruka Products" : undefined,
        inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
        productGroups: productGroups.length > 0 ? productGroups : undefined,
        showViewProductsButton: inlineProducts.length > 0,
        deliveryResult,
        trackingResult,

        serviceListing,
        groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
        followUpText: followUpQuestions.length > 0 ? "Continue with:" : undefined,
        followUpSamples: followUpQuestions.length > 0 ? followUpQuestions : undefined,
        checkoutFormProduct,
        orderFlowStep,
        orderFlowProduct,
        orderFlowStockStatus,
        orderFlowStockQty,
      };

      setMessages(prev => prev.map(m => m.id === aiMessageId ? finalMappedAi : m));

      setHistory(prev => prev.map(h => {
        if (h.id === currentSessionId) {
          return {
            ...h,
            messages: [...historyMessages.map(um => um.id === userMessageIdToUpdate ? { ...um, status: "sent" as const } : um), finalMappedAi]
          };
        }
        return h;
      }));

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Generation aborted");
      } else {
        console.error("Failed to stream message response:", err);
        setIsGenerating(false);
        if (aiMessageId) {
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId
              ? {
                  ...m,
                  text: "Sorry, I encountered an error while processing your request. Please check your connection and try again."
                }
              : m
          ));
        }
      }
    }
  };

  const handleSuggestionClick = (suggestion?: string) => {
    setIsChatting(true);
    setActiveQueryText("");

    const initialPrompt: Message = {
      id: "initial-prompt",
      sender: "ai",
      text: "",
      timestamp: new Date(),
      isInitialPrompt: true,
      samples: [
        "Show me birthday cakes under Rs. 3,000",
        "Can you deliver flowers to Kandy this Saturday?",

        "My air conditioner is broken, find a technician in Colombo",
        "Show me handmade gifts from local Sri Lankan artisans",
      ],
    };

    setMessages([initialPrompt]);

    if (suggestion) {
      setTimeout(() => handleSendMessage(suggestion, []), 100);
    }
  };

  const handleDirectSend = useCallback((text: string) => {
    if (text.trim()) {
      handleSendMessage(text, []);
    }
  }, [handleSendMessage]);

  /**
   * "Order" button handler for a SINGLE product.
   * Step 1: silently add the product to the cart (DB + local state).
   * Step 2: set it as the selected product so route.ts receives selectedProductIds.
   * Step 3: send "checkout cart" to trigger checkout_start.
   * The LLM never sees an "add to cart" message — only the checkout trigger.
   */
  const handleBuyProduct = useCallback(async (product: InlineProduct) => {
    if (!user) {
      openAuthModal("checkout");
      return;
    }
    // --- Step 1: Ensure we have a session ---
    let currentSessionId = activeHistoryId;
    if (!currentSessionId) {
      try {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: product.title || product.name || "Order", userId: activeUserId }),
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          setActiveHistoryId(currentSessionId);
          setHistory(prev => [{
            id: currentSessionId!,
            query: product.title || product.name || "Order",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: []
          }, ...prev]);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
        }
      } catch {
        currentSessionId = `session-${Date.now()}`;
        setActiveHistoryId(currentSessionId);
      }
    }

    // --- Step 2: Add product to cart (silent — no LLM) ---
    const updatedCart = [...cartItems];
    const existingIdx = updatedCart.findIndex(item => item.id === product.id);
    if (existingIdx > -1) {
      updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
    } else {
      updatedCart.push({
        id: product.id,
        name: product.title || product.name || "Kapruka Product",
        price: product.price || 0,
        quantity: 1,
        imageUrl: product.imageUrl || product.image,
        inStock: product.inStock !== false,
      });
    }
    setCartItems(updatedCart);
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {
      console.error("[handleBuyProduct] Failed to persist cart:", e);
    }

    // --- Step 3: Pass product id so route.ts gets it as selectedProductIds, then trigger checkout ---
    setSelectedProducts([product]);
    setTimeout(() => {
      handleSendMessage("checkout cart", []);
    }, 50);
  }, [activeHistoryId, activeUserId, cartItems, handleSendMessage]);

  const handleUpdateCart = useCallback(async (newCart: CartItem[]) => {
    setCartItems(newCart);

    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: activeHistoryId, cart: newCart }),
      });

      setMessages((prevMessages) => {
        const targetIdx = [...prevMessages].reverse().findIndex(m => m.sender === "ai" && m.orderFlowStep);
        if (targetIdx === -1) return prevMessages;

        const actualIdx = prevMessages.length - 1 - targetIdx;
        const targetMsg = prevMessages[actualIdx];

        if (targetMsg.orderFlowStep) {
          const updatedMessages = [...prevMessages];
          updatedMessages[actualIdx] = {
            ...targetMsg,
            orderFlowStep: {
              ...targetMsg.orderFlowStep,
              cartItems: newCart
            }
          };
          return updatedMessages;
        }

        return prevMessages;
      });
    } catch (err) {
      console.error("Failed to update cart:", err);
    }
  }, [activeUserId]);

  /**
   * "Add to Cart" handler — SILENT, no LLM involved.
   * Merges products into the local cart state, persists to DB, and shows a toast.
   * The agent never sees this action — it is a pure UI/DB operation.
   */
  const handleAddToCart = useCallback(async (products: InlineProduct[]) => {
    if (!user) {
      openAuthModal("checkout");
      return;
    }

    if (products.length === 0) return;

    // --- Ensure a session exists (needed to key the cart in DB) ---
    let currentSessionId = activeHistoryId;
    if (!currentSessionId) {
      try {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: products[0].title || products[0].name || "Cart Session", userId: activeUserId }),
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          setActiveHistoryId(currentSessionId);
          const newHistoryItem: HistoryItem = {
            id: currentSessionId!,
            query: products[0].title || products[0].name || "Cart Session",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: [],
          };
          setHistory(prev => [newHistoryItem, ...prev]);
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
        }
      } catch (err) {
        console.error("[handleAddToCart] Failed to auto-create session:", err);
        currentSessionId = `session-${Date.now()}`;
        setActiveHistoryId(currentSessionId);
      }
    }

    // --- Merge products into cart (deduplicated by id) ---
    const updatedCart = [...cartItems];
    for (const prod of products) {
      const existingIdx = updatedCart.findIndex(item => item.id === prod.id);
      if (existingIdx > -1) {
        updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
      } else {
        updatedCart.push({
          id: prod.id,
          name: prod.title || prod.name || "Kapruka Product",
          price: prod.price || 0,
          quantity: 1,
          imageUrl: prod.imageUrl || prod.image,
          inStock: prod.inStock !== false,
        });
      }
    }
    setCartItems(updatedCart);

    // --- Persist to DB (User.cart[sessionId]) ---
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {
      console.error("[handleAddToCart] Failed to persist cart to DB:", e);
    }

    // --- Show a toast (no LLM, no message sent) ---
    const itemNames = products.map(p => p.title || p.name || "item");
    const toastMsg = itemNames.length === 1
      ? `✓ "${itemNames[0].substring(0, 40)}" added to cart`
      : `✓ ${itemNames.length} items added to cart`;
    showCartToast(toastMsg);
  }, [activeHistoryId, activeUserId, cartItems, showCartToast, user, openAuthModal]);

  /**
   * Adds all selected products to cart silently, then triggers checkout_start.
   */
  const handleOrderCart = useCallback(async (products: InlineProduct[]) => {
    if (!user) {
      openAuthModal("checkout");
      return;
    }

    if (products.length === 0) return;

    // --- Ensure session ---
    let currentSessionId = activeHistoryId;
    if (!currentSessionId) {
      try {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Order", userId: activeUserId }),
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          setActiveHistoryId(currentSessionId);
          setHistory(prev => [{
            id: currentSessionId!,
            query: "Order",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: [],
          }, ...prev]);
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
        }
      } catch {
        currentSessionId = `session-${Date.now()}`;
        setActiveHistoryId(currentSessionId);
      }
    }

    // --- Merge all products into cart silently ---
    const updatedCart = [...cartItems];
    for (const prod of products) {
      const existingIdx = updatedCart.findIndex(item => item.id === prod.id);
      if (existingIdx > -1) {
        updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
      } else {
        updatedCart.push({
          id: prod.id,
          name: prod.title || prod.name || "Kapruka Product",
          price: prod.price || 0,
          quantity: 1,
          imageUrl: prod.imageUrl || prod.image,
          inStock: prod.inStock !== false,
        });
      }
    }
    setCartItems(updatedCart);
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {
      console.error("[handleOrderCart] Failed to persist cart:", e);
    }

    // --- Set selected products so route.ts gets their ids, then trigger checkout ---
    setSelectedProducts(products);
    setTimeout(() => {
      handleSendMessage("checkout cart", []);
    }, 50);
  }, [activeHistoryId, activeUserId, cartItems, handleSendMessage]);

  return (
    <SourcingContext.Provider
      value={{
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isChatting,
        setIsChatting,
        activeHistoryId,
        setActiveHistoryId,
        activeQueryText,
        setActiveQueryText,
        isGenerating,
        setIsGenerating,
        messages,
        setMessages,
        history,
        setHistory,
        activeUserId,
        isSharedReadOnly,
        fetchHistory,
        fetchSessionAndHydrate,
        handleResetLocal,
        handleReset,
        handleSelectHistory,
        handleStopGeneration,
        handleSendMessage,
        handleBuyProduct,
        handleOrderCart,
        handleSuggestionClick,
        handleDirectSend,
        country,
        setCountry,
        currency,
        setCurrency,
        selectedProducts,
        setSelectedProducts,

        cartItems,
        setCartItems,
        isViewingCart,
        setIsViewingCart,
        handleUpdateCart,
        handleAddToCart,
        cartToast,
        clearCartToast,
        userAddresses,
        setUserAddresses,
      }}
    >
      {children}
    </SourcingContext.Provider>
  );
}

export function useSourcing() {
  const context = useContext(SourcingContext);
  if (context === undefined) {
    throw new Error("useSourcing must be used within a SourcingProvider");
  }
  return context;
}
