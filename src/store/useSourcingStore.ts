import { create } from "zustand";
import Cookies from "js-cookie";
import type { 
  InlineProduct, 
  Message, 
  HistoryItem, 
  DeliveryResult, 
  TrackingResult, 
  ServiceListing, 
  CheckoutLink, 
  OrderFlowStepData, 
  CartItem, 
  ProductGroup, 
  UserAddress 
} from "@/types/sourcing";

export interface SourcingState {
  // UI State
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  isViewingCart: boolean;
  setIsViewingCart: (val: boolean | ((prev: boolean) => boolean)) => void;

  // Session & Chat State
  isChatting: boolean;
  setIsChatting: (val: boolean | ((prev: boolean) => boolean)) => void;
  activeSessionOwnerId: string | null;
  setActiveSessionOwnerId: (val: string | null) => void;
  activeHistoryId: string | undefined;
  setActiveHistoryId: (id: string | undefined) => void;
  activeQueryText: string;
  setActiveQueryText: (text: string) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  history: HistoryItem[];
  setHistory: (history: HistoryItem[] | ((prev: HistoryItem[]) => HistoryItem[])) => void;
  abortController: AbortController | null;
  setAbortController: (ac: AbortController | null) => void;

  // Settings
  country: string;
  setCountry: (country: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;

  // Products & Cart
  selectedProducts: InlineProduct[];
  setSelectedProducts: (products: InlineProduct[] | ((prev: InlineProduct[]) => InlineProduct[])) => void;
  cartItems: CartItem[];
  setCartItems: (items: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  cartToast: string | null;
  showCartToast: (msg: string) => void;
  clearCartToast: () => void;
  userAddresses: UserAddress[];
  setUserAddresses: (addresses: UserAddress[] | ((prev: UserAddress[]) => UserAddress[])) => void;
  isAgeVerificationRequired: boolean;
  setIsAgeVerificationRequired: (val: boolean) => void;

  // Complex Actions
  fetchHistory: (activeUserId: string) => Promise<void>;
  fetchSessionAndHydrate: (id: string, activeUserId: string, router: any) => Promise<void>;
  handleDeleteHistory: (id: string, activeUserId: string, router: any) => Promise<void>;
  handleResetLocal: () => void;
  handleReset: (router?: any) => void;
  handleSelectHistory: (id: string, activeUserId: string, router: any) => void;
  handleStopGeneration: () => void;
  handleSendMessage: (
    text: string, 
    activeUserId: string, 
    user: any, 
    openAuthModal: any,
    editMessageId?: string
  ) => Promise<void>;
  handleSuggestionClick: (
    suggestion: string | undefined, 
    activeUserId: string, 
    user: any, 
    openAuthModal: any
  ) => void;
  handleBuyProduct: (product: InlineProduct, activeUserId: string, user: any, openAuthModal: any) => void;
  handleOrderCart: (products: InlineProduct[], activeUserId: string, user: any, openAuthModal: any) => void;
  handleUpdateCart: (newCart: CartItem[], activeUserId: string) => Promise<void>;
  handleAddToCart: (products: InlineProduct[], activeUserId: string, user: any, openAuthModal: any) => Promise<void>;
}

let cartToastTimerRef: ReturnType<typeof setTimeout> | null = null;

export const useSourcingStore = create<SourcingState>((set, get) => ({
  // --- UI State ---
  isSidebarCollapsed: true,
  setIsSidebarCollapsed: (val) => set((state) => ({ isSidebarCollapsed: typeof val === 'function' ? val(state.isSidebarCollapsed) : val })),
  isMobileSidebarOpen: false,
  setIsMobileSidebarOpen: (val) => set((state) => ({ isMobileSidebarOpen: typeof val === 'function' ? val(state.isMobileSidebarOpen) : val })),
  isViewingCart: false,
  setIsViewingCart: (val) => set((state) => ({ isViewingCart: typeof val === 'function' ? val(state.isViewingCart) : val })),

  // --- Session & Chat State ---
  isChatting: false,
  setIsChatting: (val) => set((state) => ({ isChatting: typeof val === 'function' ? val(state.isChatting) : val })),
  activeSessionOwnerId: null,
  setActiveSessionOwnerId: (val) => set({ activeSessionOwnerId: val }),
  activeHistoryId: undefined,
  setActiveHistoryId: (id) => set({ activeHistoryId: id }),
  activeQueryText: "",
  setActiveQueryText: (text) => set({ activeQueryText: text }),
  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),
  messages: [],
  setMessages: (val) => set((state) => ({ messages: typeof val === 'function' ? val(state.messages) : val })),
  history: [],
  setHistory: (val) => set((state) => ({ history: typeof val === 'function' ? val(state.history) : val })),
  abortController: null,
  setAbortController: (ac) => set({ abortController: ac }),

  // --- Settings ---
  country: "LK",
  setCountry: (c: string) => {
    set({ country: c });
    if (typeof window !== "undefined") Cookies.set("kapruka_country", c, { expires: 365 });
  },
  currency: "LKR",
  setCurrency: (c: string) => {
    set({ currency: c });
    if (typeof window !== "undefined") Cookies.set("kapruka_currency", c, { expires: 365 });
  },

  // --- Products & Cart ---
  selectedProducts: [],
  setSelectedProducts: (val) => set((state) => ({ selectedProducts: typeof val === 'function' ? val(state.selectedProducts) : val })),
  cartItems: [],
  setCartItems: (val) => set((state) => ({ cartItems: typeof val === 'function' ? val(state.cartItems) : val })),
  cartToast: null,
  showCartToast: (msg: string) => {
    set({ cartToast: msg });
    if (cartToastTimerRef) clearTimeout(cartToastTimerRef);
    cartToastTimerRef = setTimeout(() => {
      set({ cartToast: null });
    }, 3000);
  },
  clearCartToast: () => {
    set({ cartToast: null });
    if (cartToastTimerRef) clearTimeout(cartToastTimerRef);
  },
  userAddresses: [],
  setUserAddresses: (val) => set((state) => ({ userAddresses: typeof val === 'function' ? val(state.userAddresses) : val })),
  isAgeVerificationRequired: false,
  setIsAgeVerificationRequired: (val) => set({ isAgeVerificationRequired: val }),

  // --- Actions ---
  fetchHistory: async (activeUserId) => {
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
        set({ history: items });
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    }
  },

  fetchSessionAndHydrate: async (id, activeUserId, router) => {
    const state = get();
    try {
      set({ messages: [], isChatting: true });

      const cachedItem = state.history.find((h) => h.id === id && h.messages.length > 0);
      if (cachedItem) {
        set({
          messages: cachedItem.messages,
          activeQueryText: cachedItem.query,
          activeSessionOwnerId: null
        });
        window.history.replaceState(null, "", `/c/${id}`);
        return;
      }

      const res = await fetch(`/api/session?id=${id}&userId=${activeUserId}&_t=${Date.now()}`);
      if (res.ok) {
        const sessionData = await res.json();

        const mappedMessages: Message[] = sessionData.messages.map((m: any) => {
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
          let thinkingSteps: any[] = [];
          let followUpSamples: string[] = [];
          let groundingSources: any[] = [];
          let checkoutFormProduct: InlineProduct | undefined = undefined;
          let checkoutLinks: CheckoutLink[] | undefined = undefined;
          let orderFlowProduct: InlineProduct | undefined = undefined;
          let orderFlowStockStatus: "in_stock" | "out_of_stock" | "limited" | undefined = undefined;
          let orderFlowStockQty: number | undefined = undefined;
          let orderFlowStep: OrderFlowStepData | undefined = undefined;
          let trackingResult: TrackingResult | undefined = undefined;
          let isComparison = false;

          if (m.thoughtProcess) {
            try {
              const parsedProcess = typeof m.thoughtProcess === "string" ? JSON.parse(m.thoughtProcess) : m.thoughtProcess;
              if (parsedProcess && parsedProcess.steps) {
                thinkingSteps = parsedProcess.steps;
                followUpSamples = parsedProcess.followUpQuestions || [];
                groundingSources = parsedProcess.groundingSources || [];
                checkoutFormProduct = parsedProcess.checkoutFormProduct;
                checkoutLinks = parsedProcess.checkoutLinks;
                orderFlowProduct = parsedProcess.orderFlowProduct;
                orderFlowStockStatus = parsedProcess.orderFlowStockStatus;
                orderFlowStockQty = parsedProcess.orderFlowStockQty;
                orderFlowStep = parsedProcess.orderFlowStep;
                trackingResult = parsedProcess.trackingResult;
                isComparison = !!parsedProcess.isComparison;
              } else if (Array.isArray(parsedProcess)) {
                thinkingSteps = parsedProcess;
              }
            } catch (e) {}
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
            trackingResult,
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

        set({
          messages: mappedMessages,
          activeQueryText: sessionData.title,
          isChatting: true,
          activeSessionOwnerId: sessionData.userId
        });
        window.history.replaceState(null, "", `/c/${id}`);

        const currentHistory = get().history;
        const exists = currentHistory.some((h) => h.id === id);
        if (exists) {
          set({ history: currentHistory.map((h) => (h.id === id ? { ...h, messages: mappedMessages } : h)) });
        } else {
          set({
            history: [
              {
                id: sessionData.id,
                query: sessionData.title,
                date: new Date(sessionData.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
                queryType: "product",
                messages: mappedMessages
              },
              ...currentHistory
            ]
          });
        }
      } else {
        router?.push("/");
      }
    } catch (err) {
      console.error("Failed to load session details:", err);
    }
  },

  handleResetLocal: () => {
    set({
      isChatting: false,
      messages: [],
      activeHistoryId: undefined,
      activeQueryText: "",
      isGenerating: false,
      selectedProducts: [],
      cartItems: [],
      isViewingCart: false,
      activeSessionOwnerId: null
    });
  },

  handleReset: () => {
    set({ isMobileSidebarOpen: false, selectedProducts: [] });
    const ac = get().abortController;
    if (ac) {
      ac.abort();
      set({ abortController: null });
    }
    window.history.pushState(null, "", "/");
    get().handleResetLocal();
  },

  handleSelectHistory: (id, activeUserId, router) => {
    set({ isMobileSidebarOpen: false, selectedProducts: [], activeHistoryId: id });
    window.history.pushState(null, "", `/`);
    get().fetchSessionAndHydrate(id, activeUserId, router);
  },

  handleDeleteHistory: async (id, activeUserId, router) => {
    try {
      const res = await fetch(`/api/session?id=${id}&userId=${activeUserId}`, { method: "DELETE" });
      if (res.ok) {
        set((state) => ({ history: state.history.filter((item) => item.id !== id) }));
        if (id === get().activeHistoryId) {
          get().handleReset(router);
        }
      }
    } catch (err) {}
  },

  handleStopGeneration: () => {
    const ac = get().abortController;
    if (ac) {
      ac.abort();
      set({ abortController: null });
    }
    set({ isGenerating: false });
  },

  handleSendMessage: async (text, activeUserId, user, openAuthModal, editMessageId) => {
    const state = get();
    if (!user) {
      const userMessageCount = state.messages.filter(m => m.sender === "user").length;
      if (userMessageCount >= 9) {
        openAuthModal("message_limit");
        return;
      }
    }

    if (state.abortController) {
      state.abortController.abort();
    }

    const abortController = new AbortController();
    set({ abortController });

    const userMessageId = `msg-${Date.now()}`;
    const timestamp = new Date();

    let userMessageIdToUpdate = userMessageId;
    const isEdit = !!editMessageId;
    let historyMessages: Message[] = [];

    if (isEdit) {
      const targetIndex = state.messages.findIndex(m => m.id === editMessageId);
      if (targetIndex !== -1) {
        const targetUserMsg = state.messages[targetIndex];
        const updatedUserMsg: Message = { ...targetUserMsg, text: text, status: "sending" };
        userMessageIdToUpdate = editMessageId!;
        const truncated = state.messages.slice(0, targetIndex);
        historyMessages = [...truncated, updatedUserMsg];
      }
    } else {
      const newUserMessage: Message = {
        id: userMessageId,
        sender: "user",
        text: text,
        timestamp,
        status: "sending",
        inlineProducts: state.selectedProducts.length > 0 ? [...state.selectedProducts] : undefined
      };
      historyMessages = [...state.messages, newUserMessage];
    }

    set({ messages: historyMessages });

    const selectedProductIds = state.selectedProducts.map(p => p.id);
    const isComparisonQuery = selectedProductIds.length > 0;
    
    set({
      selectedProducts: [],
      isChatting: true,
      isGenerating: true,
      activeQueryText: text
    });

    try {
      let currentSessionId = state.activeHistoryId || "";
      if (!currentSessionId) {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text || "New Sourcing Task", userId: activeUserId })
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          set({ activeHistoryId: currentSessionId });
          window.history.pushState(null, "", `/c/${currentSessionId}`);
          
          const newHistoryItem: HistoryItem = {
            id: currentSessionId,
            query: text || "New Sourcing Task",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: []
          };
          set((s) => ({ history: [newHistoryItem, ...s.history] }));
        } else {
          currentSessionId = `session-${Date.now()}`;
          set({ activeHistoryId: currentSessionId });
        }
      }

      const aiMessageId = `ai-msg-${Date.now()}`;
      const newAiMessage: Message = {
        id: aiMessageId,
        sender: "ai",
        text: "",
        timestamp: new Date(),
        thinkingSteps: [],
        activeToolCall: null,
        activeToolCalls: [],
      };

      set((s) => ({
        messages: [...s.messages.map(m => m.id === userMessageIdToUpdate ? { ...m, status: "sent" as const } : m), newAiMessage]
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: text,
          userId: activeUserId,
          country: get().country,
          currency: get().currency,
          selectedProductIds,
          editMessageId: isEdit ? editMessageId : undefined
        }),
        signal: abortController.signal
      });

      if (!res.ok) throw new Error("Failed to post message to chat api");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream reader available");

      let buffer = "";
      let fullResponseText = "";
      let inlineProducts: InlineProduct[] = [];
      let followUpQuestions: string[] = [];
      let deliveryResult: DeliveryResult | undefined;
      let trackingResult: TrackingResult | undefined;
      let serviceListing: ServiceListing | undefined;
      let groundingSources: Array<{ title: string; uri: string }> = [];
      let accumulatedSteps: Array<any> = [];
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
                const stepKey = packet.term ? `${packet.step}__${packet.term}` : packet.step;
                const existingIdx = accumulatedSteps.findIndex(s => s._key ? s._key === stepKey : s.step === packet.step && !s._key);
                const stepObj = {
                  _key: stepKey,
                  step: packet.step,
                  status: packet.status as "running" | "completed",
                  content: packet.content,
                  durationMs: packet.durationMs,
                  terms: packet.terms,
                  term: packet.term,
                };
                if (existingIdx !== -1) accumulatedSteps[existingIdx] = stepObj;
                else accumulatedSteps.push(stepObj);

                set((s) => ({
                  messages: s.messages.map(m => m.id === aiMessageId ? { ...m, thinkingSteps: [...accumulatedSteps] } : m)
                }));
              } else if (packet.type === "tool_call") {
                set((s) => ({
                  messages: s.messages.map(m => m.id === aiMessageId ? {
                    ...m,
                    activeToolCall: { name: packet.name, args: packet.args },
                    activeToolCalls: [
                      ...(m.activeToolCalls || []).filter(c => !(c.name === packet.name && (c.args as any)?.query === (packet.args as any)?.query)),
                      { name: packet.name, args: packet.args }
                    ],
                  } : m)
                }));
              } else if (packet.type === "tool_result") {
                if (packet.result?.products) {
                  inlineProducts = packet.result.products;
                  set((s) => ({
                    messages: s.messages.map(m => m.id === aiMessageId ? { 
                      ...m, 
                      activeToolCall: null,
                      activeToolCalls: [],
                      inlineProductsHeader: isComparisonQuery ? "Compared Products" : "Kapruka Products", 
                      inlineProducts, 
                      showViewProductsButton: true 
                    } : m)
                  }));
                }
              } else if (packet.type === "group_ready") {
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

                set((s) => ({
                  messages: s.messages.map(m => m.id === aiMessageId ? {
                    ...m,
                    productGroups: [...productGroups],
                    inlineProducts: [...inlineProducts],
                    inlineProductsHeader: "Kapruka Products",
                    showViewProductsButton: inlineProducts.length > 0,
                    activeToolCalls: (m.activeToolCalls || []).filter(c => (c.args as any)?.query !== packet.term),
                  } : m)
                }));
              } else if (packet.type === "product_groups") {
                productGroups = packet.groups as ProductGroup[];
                inlineProducts = productGroups.flatMap(g => g.products);
                set((s) => ({
                  messages: s.messages.map(m => m.id === aiMessageId ? { ...m, productGroups: [...productGroups], inlineProducts: [...inlineProducts] } : m)
                }));
              } else if (packet.type === "delivery_result") {
                deliveryResult = packet.result;
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, activeToolCall: null, deliveryResult } : m) }));
              } else if (packet.type === "tracking_result") {
                trackingResult = packet.result;
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, activeToolCall: null, trackingResult } : m) }));
              } else if (packet.type === "age_verification_required") {
                set({ isAgeVerificationRequired: true });
              } else if (packet.type === "service_listing") {
                serviceListing = packet.result;
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, activeToolCall: null, serviceListing } : m) }));
              } else if (packet.type === "text") {
                fullResponseText += packet.content;
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m) }));
              } else if (packet.type === "grounding_sources") {
                if (packet.result) {
                  groundingSources = packet.result;
                  set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, groundingSources } : m) }));
                }
              } else if (packet.type === "checkout_form") {
                checkoutFormProduct = packet.product;
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, activeToolCall: null, checkoutFormProduct } : m) }));
              } else if (packet.type === "order_flow") {
                orderFlowProduct = packet.product;
                orderFlowStockStatus = packet.stockStatus;
                orderFlowStockQty = packet.stockQty;
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, activeToolCall: null, orderFlowProduct, orderFlowStockStatus, orderFlowStockQty } : m) }));
              } else if (packet.type === "order_flow_step") {
                orderFlowStep = { ...packet } as OrderFlowStepData;
                if (packet.savedAddresses && Array.isArray(packet.savedAddresses)) {
                  set({ userAddresses: packet.savedAddresses });
                }
                if (packet.cartItems && Array.isArray(packet.cartItems)) {
                  if (packet.phase === "confirmed" && packet.orderId && !packet.errorMessage) {
                    set({ cartItems: [] });
                  } else {
                    set({ cartItems: packet.cartItems });
                  }
                }
                set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, activeToolCall: null, orderFlowStep } : m) }));
              } else if (packet.type === "follow_ups") {
                if (packet.questions) {
                  followUpQuestions = packet.questions;
                  set((s) => ({ messages: s.messages.map(m => m.id === aiMessageId ? { ...m, followUpText: "Continue with:", followUpSamples: followUpQuestions } : m) }));
                }
              }
            } catch (e) {}
          }
        }
      }

      set({ isGenerating: false });

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

      set((s) => ({
        messages: s.messages.map(m => m.id === aiMessageId ? finalMappedAi : m),
        history: s.history.map(h => h.id === currentSessionId ? {
          ...h,
          messages: [...historyMessages.map(um => um.id === userMessageIdToUpdate ? { ...um, status: "sent" as const } : um), finalMappedAi]
        } : h)
      }));

    } catch (err: any) {
      if (err.name !== "AbortError") {
        set({ isGenerating: false });
        set((s) => ({
          messages: s.messages.map(m => m.sender === "ai" && m.text === "" ? {
            ...m,
            text: "Sorry, I encountered an error while processing your request. Please check your connection and try again."
          } : m)
        }));
      }
    }
  },

  handleSuggestionClick: (suggestion, activeUserId, user, openAuthModal) => {
    set({ isChatting: true, activeQueryText: "" });
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
    set({ messages: [initialPrompt] });
    if (suggestion) {
      setTimeout(() => get().handleSendMessage(suggestion, activeUserId, user, openAuthModal), 100);
    }
  },

  handleBuyProduct: async (product, activeUserId, user, openAuthModal) => {
    if (!user) {
      localStorage.setItem("pending_order_products", JSON.stringify([product]));
      openAuthModal("checkout");
      return;
    }
    let currentSessionId = get().activeHistoryId;
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
          set({ activeHistoryId: currentSessionId });
          set((s) => ({ history: [{
            id: currentSessionId!,
            query: product.title || product.name || "Order",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: []
          }, ...s.history] }));
        } else {
          currentSessionId = `session-${Date.now()}`;
          set({ activeHistoryId: currentSessionId });
        }
      } catch {
        currentSessionId = `session-${Date.now()}`;
        set({ activeHistoryId: currentSessionId });
      }
    }

    const updatedCart = [...get().cartItems];
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
    set({ cartItems: updatedCart });
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {}

    set({ selectedProducts: [product] });
    setTimeout(() => {
      get().handleSendMessage("checkout cart", activeUserId, user, openAuthModal);
    }, 50);
  },

  handleUpdateCart: async (newCart, activeUserId) => {
    set({ cartItems: newCart });
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: get().activeHistoryId, cart: newCart }),
      });
      set((s) => {
        const prevMessages = s.messages;
        const targetIdx = [...prevMessages].reverse().findIndex(m => m.sender === "ai" && m.orderFlowStep);
        if (targetIdx === -1) return { messages: prevMessages };

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
          return { messages: updatedMessages };
        }
        return { messages: prevMessages };
      });
    } catch (err) {}
  },

  handleAddToCart: async (products, activeUserId, user, openAuthModal) => {
    if (!user) {
      openAuthModal("checkout");
      return;
    }
    if (products.length === 0) return;

    let currentSessionId = get().activeHistoryId;
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
          set({ activeHistoryId: currentSessionId });
          const newHistoryItem: HistoryItem = {
            id: currentSessionId!,
            query: products[0].title || products[0].name || "Cart Session",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: [],
          };
          set((s) => ({ history: [newHistoryItem, ...s.history] }));
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        } else {
          currentSessionId = `session-${Date.now()}`;
          set({ activeHistoryId: currentSessionId });
        }
      } catch (err) {
        currentSessionId = `session-${Date.now()}`;
        set({ activeHistoryId: currentSessionId });
      }
    }

    const updatedCart = [...get().cartItems];
    for (const prod of products) {
      const existingIdx = updatedCart.findIndex(item => String(item.id) === String(prod.id));
      if (existingIdx > -1) {
        updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
      } else {
        updatedCart.push({
          id: String(prod.id),
          name: prod.title || prod.name || "Kapruka Product",
          price: prod.price || 0,
          quantity: 1,
          imageUrl: prod.imageUrl || prod.image,
          inStock: prod.inStock !== false,
        });
      }
    }
    set({ cartItems: updatedCart });

    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {}

    const itemNames = products.map(p => p.title || p.name || "item");
    const toastMsg = itemNames.length === 1
      ? `✓ "${itemNames[0].substring(0, 40)}" added to cart`
      : `✓ ${itemNames.length} items added to cart`;
    get().showCartToast(toastMsg);
  },

  handleOrderCart: async (products, activeUserId, user, openAuthModal) => {
    if (!user) {
      localStorage.setItem("pending_order_products", JSON.stringify(products));
      openAuthModal("checkout");
      return;
    }
    if (products.length === 0) return;

    let currentSessionId = get().activeHistoryId;
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
          set({ activeHistoryId: currentSessionId });
          set((s) => ({ history: [{
            id: currentSessionId!,
            query: "Order",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: [],
          }, ...s.history] }));
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        } else {
          currentSessionId = `session-${Date.now()}`;
          set({ activeHistoryId: currentSessionId });
        }
      } catch {
        currentSessionId = `session-${Date.now()}`;
        set({ activeHistoryId: currentSessionId });
      }
    }

    const updatedCart = [...get().cartItems];
    for (const prod of products) {
      const existingIdx = updatedCart.findIndex(item => String(item.id) === String(prod.id));
      if (existingIdx > -1) {
        updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + 1 };
      } else {
        updatedCart.push({
          id: String(prod.id),
          name: prod.title || prod.name || "Kapruka Product",
          price: prod.price || 0,
          quantity: 1,
          imageUrl: prod.imageUrl || prod.image,
          inStock: prod.inStock !== false,
        });
      }
    }
    set({ cartItems: updatedCart });
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {}

    set({ selectedProducts: products });
    setTimeout(() => {
      get().handleSendMessage("checkout cart", activeUserId, user, openAuthModal);
    }, 50);
  }
}));

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function useSourcingActions() {
  const store = useSourcingStore();
  const { user, openAuthModal } = useAuth();
  const router = useRouter();

  const [guestId, setGuestId] = useState("");
  useEffect(() => {
    if (!user) {
      let id = localStorage.getItem("kapruka_guest_uuid");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("kapruka_guest_uuid", id);
      }
      setGuestId(id);
    }
  }, [user]);

  const activeUserId = user?.id || guestId || "guest-pending";

  return {
    activeUserId,
    isSharedReadOnly: store.activeSessionOwnerId !== null && store.activeSessionOwnerId !== activeUserId && activeUserId !== "guest-pending",
    fetchHistory: () => store.fetchHistory(activeUserId),
    fetchSessionAndHydrate: (id: string) => store.fetchSessionAndHydrate(id, activeUserId, router),
    handleDeleteHistory: (id: string) => store.handleDeleteHistory(id, activeUserId, router),
    handleReset: () => store.handleReset(router),
    handleResetLocal: () => store.handleResetLocal(),
    handleSelectHistory: (id: string) => store.handleSelectHistory(id, activeUserId, router),
    handleStopGeneration: () => store.handleStopGeneration(),
    handleSendMessage: (text: string, editMessageId?: string) => store.handleSendMessage(text, activeUserId, user, openAuthModal, editMessageId),
    handleBuyProduct: (product: any) => store.handleBuyProduct(product, activeUserId, user, openAuthModal),
    handleOrderCart: (products: any[]) => store.handleOrderCart(products, activeUserId, user, openAuthModal),
    handleSuggestionClick: (suggestion?: string) => store.handleSuggestionClick(suggestion, activeUserId, user, openAuthModal),
    handleUpdateCart: (newCart: any[]) => store.handleUpdateCart(newCart, activeUserId),
    handleAddToCart: (products: any[]) => store.handleAddToCart(products, activeUserId, user, openAuthModal),
  };
}
