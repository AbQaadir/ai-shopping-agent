"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InlineProduct, Message, HistoryItem, DeliveryResult, TrackingResult, ImportEstimate, ServiceListing, CheckoutLink, OrderFlowStepData, CartItem } from "@/types/sourcing";


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
  handleSwitchUser: (userId: string) => void;
  fetchHistory: () => Promise<void>;
  fetchSessionAndHydrate: (id: string) => Promise<void>;
  handleResetLocal: () => void;
  handleReset: () => void;
  handleSelectHistory: (id: string) => void;
  handleStopGeneration: () => void;
  handleSendMessage: (text: string, files: File[]) => Promise<void>;
  handleBuyProduct: (product: InlineProduct) => void;
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
}

const SourcingContext = createContext<SourcingContextType | undefined>(undefined);

export function SourcingProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined);
  const [activeQueryText, setActiveQueryText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("e17d0577-c93d-4c3e-9080-60b6bbfdf071"); // Kamal Silva default
  const [country, setCountry] = useState("LK");
  const [currency, setCurrency] = useState("USD");
  const [selectedProducts, setSelectedProducts] = useState<InlineProduct[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isViewingCart, setIsViewingCart] = useState<boolean>(false);

  useEffect(() => {
    const detectLocation = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
          const data = await res.json();
          if (data.country_code) {
            setCountry(data.country_code);
          }
          if (data.currency) {
            setCurrency(data.currency);
          }
        }
      } catch (err) {
        console.warn("Could not auto-detect location/currency by IP:", err);
      }
    };
    detectLocation();
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/session?userId=${activeUserId}`);
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

  const handleSwitchUser = useCallback((userId: string) => {
    setActiveUserId(userId);
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setActiveQueryText("");
    setIsGenerating(false);
    setSelectedProducts([]);
    setCartItems([]);
    setIsViewingCart(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    window.history.pushState(null, "", "/");
  }, []);

  const fetchSessionAndHydrate = useCallback(async (id: string) => {
    try {
      setMessages([]);
      setIsChatting(true);

      // Find if we already loaded it in memory history list
      const cachedItem = history.find((h) => h.id === id && h.messages.length > 0);
      if (cachedItem) {
        setMessages(cachedItem.messages);
        setActiveQueryText(cachedItem.query);
        return;
      }

      const res = await fetch(`/api/session?id=${id}&userId=${activeUserId}`);
      if (res.ok) {
        const sessionData = await res.json();
        
        let sessionCart: CartItem[] = [];
        if (sessionData.cart) {
          try {
            sessionCart = typeof sessionData.cart === "string" ? JSON.parse(sessionData.cart) : (sessionData.cart as CartItem[]);
          } catch (e) {
            console.error("Error parsing cart data:", e);
          }
        }
        setCartItems(sessionCart);

        const mappedMessages: Message[] = sessionData.messages.map((m: { id: string; role: string; content: string; createdAt: string; products?: unknown; thoughtProcess?: unknown }) => {
          let inlineProducts: InlineProduct[] = [];
          if (m.products) {
            try {
              inlineProducts = typeof m.products === "string" ? JSON.parse(m.products) : (m.products as InlineProduct[]);
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
    window.history.pushState(null, "", `/c/${id}`);
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

  const handleSendMessage = async (text: string, files: File[]) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    let aiMessageId = "";

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessageId = `msg-${Date.now()}`;
    const timestamp = new Date();

    const newUserMessage: Message = {
      id: userMessageId,
      sender: "user",
      text: text || `Attached ${files.length} document(s) for review`,
      timestamp,
      status: "sending",
      inlineProducts: selectedProducts.length > 0 ? [...selectedProducts] : undefined
    };

    const selectedProductIds = selectedProducts.map(p => p.id);
    const isComparisonQuery = selectedProductIds.length > 0;
    setSelectedProducts([]);

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
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
      };

      setMessages(prev => {
        const updated = prev.map(m => m.id === userMessageId ? { ...m, status: "sent" as const } : m);
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
          selectedProductIds
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
      let importEstimate: ImportEstimate | undefined;
      let serviceListing: ServiceListing | undefined;
      let groundingSources: Array<{ title: string; uri: string }> = [];
      let accumulatedSteps: Array<{ step: string; status: "running" | "completed"; content: string; durationMs?: number }> = [];
      let checkoutFormProduct: InlineProduct | undefined = undefined;
      let orderFlowProduct: InlineProduct | undefined = undefined;
      let orderFlowStockStatus: "in_stock" | "out_of_stock" | "limited" | undefined = undefined;
      let orderFlowStockQty: number | undefined = undefined;
      let orderFlowStep: OrderFlowStepData | undefined = undefined;

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
                const existingIdx = accumulatedSteps.findIndex(s => s.step === packet.step);
                const stepObj = {
                  step: packet.step,
                  status: packet.status as "running" | "completed",
                  content: packet.content,
                  durationMs: packet.durationMs
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
                  m.id === aiMessageId ? { ...m, activeToolCall: { name: packet.name, args: packet.args } } : m
                ));

              } else if (packet.type === "tool_result") {
                if (packet.result?.products) {
                  inlineProducts = packet.result.products;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId
                      ? { 
                          ...m, 
                          activeToolCall: null, 
                          inlineProductsHeader: isComparisonQuery ? "Compared Products" : "Kapruka Products", 
                          inlineProducts, 
                          showViewProductsButton: true 
                        }
                      : m
                  ));
                }

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

              } else if (packet.type === "import_estimate") {
                importEstimate = packet.result as ImportEstimate;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, importEstimate } : m
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
                  geocodedLocation: packet.geocodedLocation,
                  confirmedQuantity: packet.confirmedQuantity,
                  confirmedAddress: packet.confirmedAddress,
                  paymentMethod: packet.paymentMethod,
                  checkoutUrl: packet.checkoutUrl,
                  orderId: packet.orderId,
                  errorMessage: packet.errorMessage,
                } as OrderFlowStepData;
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

      if (currentSessionId && !window.location.pathname.startsWith(`/c/${currentSessionId}`)) {
        window.history.replaceState(null, "", `/c/${currentSessionId}`);
      }

      const finalMappedAi: Message = {
        id: aiMessageId,
        sender: "ai",
        text: fullResponseText,
        timestamp: new Date(),
        thinkingSteps: accumulatedSteps,
        inlineProductsHeader: inlineProducts.length > 0 ? "Kapruka Products" : undefined,
        inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
        showViewProductsButton: inlineProducts.length > 0,
        deliveryResult,
        trackingResult,
        importEstimate,
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
            messages: [...updatedMessages.map(um => um.id === userMessageId ? { ...um, status: "sent" as const } : um), finalMappedAi]
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
        "https://amazon.com/dp/B0EXAMPLE — how much in Sri Lanka?",
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

  const handleBuyProduct = useCallback((product: InlineProduct) => {
    setSelectedProducts([product]);
    setTimeout(() => {
      handleSendMessage("order this", []);
    }, 50);
  }, [handleSendMessage]);

  const handleUpdateCart = useCallback(async (newCart: CartItem[]) => {
    setCartItems(newCart);
    if (!activeHistoryId) return;

    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeHistoryId, cart: newCart }),
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
  }, [activeHistoryId]);

  const handleAddToCart = useCallback(async (products: InlineProduct[]) => {
    if (products.length === 0) return;

    let currentSessionId = activeHistoryId;
    if (!currentSessionId) {
      try {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: products[0].title || products[0].name || "Cart Sourcing Session", userId: activeUserId })
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          setActiveHistoryId(currentSessionId);
          
          const newHistoryItem: HistoryItem = {
            id: currentSessionId!,
            query: products[0].title || products[0].name || "Cart Sourcing Session",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: []
          };
          setHistory(prev => [newHistoryItem, ...prev]);
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
        }
      } catch (err) {
        console.error("Failed to auto-create session for cart:", err);
        currentSessionId = `session-${Date.now()}`;
        setActiveHistoryId(currentSessionId);
      }
    }

    const updatedCart = [...cartItems];
    for (const prod of products) {
      const existingItemIdx = updatedCart.findIndex(item => item.id === prod.id);
      if (existingItemIdx > -1) {
        updatedCart[existingItemIdx].quantity += 1;
      } else {
        updatedCart.push({
          id: prod.id,
          name: prod.title || prod.name || "Kapruka Product",
          price: prod.price || 0,
          quantity: 1,
          imageUrl: prod.imageUrl || prod.image,
          inStock: prod.inStock !== false
        });
      }
    }

    setCartItems(updatedCart);
    
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, cart: updatedCart }),
      });
    } catch (e) {
      console.error("Failed to sync cart add to db:", e);
    }

    const itemsListStr = products.map((p) => p.title || p.name || "product").join(", ");
    await handleSendMessage(`add selected products to cart: ${itemsListStr}`, []);
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
        handleSwitchUser,

        fetchHistory,
        fetchSessionAndHydrate,
        handleResetLocal,
        handleReset,
        handleSelectHistory,
        handleStopGeneration,
        handleSendMessage,
        handleBuyProduct,
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
        handleAddToCart
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
