"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Package,
  MessageSquare,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";
import { cleanProductTitle } from "@/lib/product";
import type { CartItem, InlineProduct } from "@/types/sourcing";

interface GroupedCartItem {
  sessionId: string;
  sessionTitle: string;
  items: CartItem[];
}

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGlobal: boolean;
}

export default function CartModal({ isOpen, onClose, isGlobal }: CartModalProps) {
  const {
    cartItems,
    handleUpdateCart,
    handleDirectSend,
    activeUserId,
    activeHistoryId,
    handleSelectHistory,
    setCartItems,
    setSelectedProducts,
  } = useSourcing();

  const [globalGroups, setGlobalGroups] = useState<GroupedCartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all sessions' carts when in Global mode
  const fetchGlobalCart = useCallback(async () => {
    if (!activeUserId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/session?cartOnly=true&global=true&userId=${activeUserId}&_t=${Date.now()}`
      );
      if (res.ok) {
        const data = await res.json();
        setGlobalGroups(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch global cart:", err);
    } finally {
      setLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (isOpen && isGlobal) {
      fetchGlobalCart();
    }
  }, [isOpen, isGlobal, fetchGlobalCart]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // --- Active Session Cart Helpers ---
  const handleQtyChangeLocal = (itemId: string, currentQty: number, delta: number) => {
    const updated = cartItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, quantity: Math.max(1, currentQty + delta) };
      }
      return item;
    });
    handleUpdateCart(updated);
  };

  const handleRemoveLocal = (itemId: string) => {
    const updated = cartItems.filter((item) => item.id !== itemId);
    handleUpdateCart(updated);
  };

  const calculateSubtotalLocal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckoutLocal = () => {
    onClose();
    const productsToCheckout: InlineProduct[] = cartItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      inStock: item.inStock
    }));
    setSelectedProducts(productsToCheckout);
    setTimeout(() => {
      handleDirectSend("checkout cart");
    }, 50);
  };

  // --- Global Cart Helpers ---
  const handleQtyChangeGlobal = async (
    sid: string,
    itemId: string,
    currentQty: number,
    delta: number
  ) => {
    const nextQty = Math.max(1, currentQty + delta);
    let targetGroupItems: CartItem[] = [];

    const updatedGroups = globalGroups.map((group) => {
      if (group.sessionId === sid) {
        const newItems = group.items.map((item) => {
          if (item.id === itemId) {
            return { ...item, quantity: nextQty };
          }
          return item;
        });
        targetGroupItems = newItems;
        return { ...group, items: newItems };
      }
      return group;
    });

    setGlobalGroups(updatedGroups);

    // Persist to DB for that specific session
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: sid, cart: targetGroupItems }),
      });
      // Synchronize in-memory active cart if it matches the edited session
      if (sid === activeHistoryId) {
        setCartItems(targetGroupItems);
      }
    } catch (err) {
      console.error("Failed to update global cart qty in DB:", err);
    }
  };

  const handleRemoveGlobal = async (sid: string, itemId: string) => {
    let targetGroupItems: CartItem[] = [];

    const updatedGroups = globalGroups
      .map((group) => {
        if (group.sessionId === sid) {
          const newItems = group.items.filter((item) => item.id !== itemId);
          targetGroupItems = newItems;
          return { ...group, items: newItems };
        }
        return group;
      })
      .filter((group) => group.items.length > 0);

    setGlobalGroups(updatedGroups);

    // Persist to DB for that specific session
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId, sessionId: sid, cart: targetGroupItems }),
      });
      // Synchronize in-memory active cart if it matches the edited session
      if (sid === activeHistoryId) {
        setCartItems(targetGroupItems);
      }
    } catch (err) {
      console.error("Failed to delete global cart item in DB:", err);
    }
  };

  const calculateSubtotalGlobal = () => {
    return globalGroups.reduce((total, group) => {
      return total + group.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }, 0);
  };

  const handleCheckoutGlobal = () => {
    onClose();
    const allItems = globalGroups.flatMap((group) => group.items);
    const productsToCheckout: InlineProduct[] = allItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      inStock: item.inStock
    }));
    setSelectedProducts(productsToCheckout);
    setTimeout(() => {
      handleDirectSend("checkout cart");
    }, 50);
  };

  const handleRedirectToSession = (sid: string) => {
    onClose();
    handleSelectHistory(sid);
  };

  if (!isOpen) return null;

  const hasItems = isGlobal ? globalGroups.length > 0 : cartItems.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-end sm:items-center justify-end sm:justify-center animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close cart"
      />

      {/* Modal Container */}
      <div className="relative w-full sm:max-w-4xl sm:mx-4 max-h-[90vh] sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp sm:animate-fadeInScale border border-slate-100/80">
        
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9.5 h-9.5 rounded-xl bg-[#402970]/8 flex items-center justify-center border border-[#402970]/15 text-[#402970]">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight">
                {isGlobal ? "Global Shopping Cart" : "Active Session Cart"}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                {isGlobal
                  ? `Total items: ${globalGroups.reduce((acc, g) => acc + g.items.reduce((s, i) => s + i.quantity, 0), 0)} across ${globalGroups.length} sessions`
                  : `Items: ${cartItems.reduce((acc, i) => acc + i.quantity, 0)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isGlobal && (
              <button
                onClick={fetchGlobalCart}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-[#402970] hover:bg-slate-50 rounded-xl transition-all cursor-pointer outline-none border-none bg-transparent"
                title="Refresh Global Cart"
              >
                <RefreshCw size={16} className={loading ? "animate-spin text-[#402970]" : ""} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer outline-none border-none bg-transparent"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Content View Area ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-none">
          
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 select-none">
              <RefreshCw size={24} className="animate-spin text-[#402970]" />
              <p className="text-xs font-semibold">Loading global cart items...</p>
            </div>
          ) : !hasItems ? (
            <div className="h-64 flex flex-col items-center justify-center max-w-sm mx-auto text-center px-4 select-none animate-fadeIn">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100/60 flex items-center justify-center text-slate-355 shadow-xs mb-5 animate-pulse">
                <ShoppingBag size={26} className="text-slate-300" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">Your Cart is Empty</h4>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Add products from your sourcing chats. Once added, you can modify, update quantities, or proceed to checkout.
              </p>
              <button
                onClick={onClose}
                className="mt-6 inline-flex items-center gap-2 bg-[#402970] hover:bg-[#301e54] text-white text-[11px] font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                Close & Settle Sourcing
              </button>
            </div>
          ) : isGlobal ? (
            /* Grouped Sessions Mode (Global Cart) */
            <div className="space-y-6">
              {globalGroups.map((group) => (
                <div
                  key={group.sessionId}
                  className="bg-white border border-slate-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] overflow-hidden"
                >
                  {/* Group Header - Chat Session link */}
                  <div 
                    onClick={() => handleRedirectToSession(group.sessionId)}
                    className="px-4.5 py-3 border-b border-slate-100 bg-[#402970]/3 hover:bg-[#402970]/7 cursor-pointer flex items-center justify-between group transition-colors select-none"
                    title={`Click to open chat: "${group.sessionTitle}"`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare size={14} className="text-[#402970] shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate pr-4">
                        Chat Session: <span className="text-[#402970] font-black">{group.sessionTitle}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#402970] font-bold text-[10px] uppercase tracking-wider shrink-0 select-none">
                      <span>Go to Chat</span>
                      <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Group Products List */}
                  <div className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Thumbnail */}
                          <div className="w-13 h-13 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <Package size={18} className="text-slate-355" />
                            )}
                          </div>

                          {/* Detail */}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-800 leading-snug truncate pr-6 max-w-[200px] sm:max-w-[320px]">
                              {cleanProductTitle(item.name)}
                            </h4>
                            <p className="text-[10px] font-bold text-[#402970]/80 mt-1">
                              Rs. {item.price.toLocaleString()} each
                            </p>
                          </div>
                        </div>

                        {/* Controls & Price summary */}
                        <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto shrink-0 border-t sm:border-0 border-slate-100 pt-3.5 sm:pt-0">
                          <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 shadow-xs">
                            <button
                              onClick={() =>
                                handleQtyChangeGlobal(group.sessionId, item.id, item.quantity, -1)
                              }
                              className="p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                              title="Decrease quantity"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-6.5 text-center text-xs font-bold text-slate-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleQtyChangeGlobal(group.sessionId, item.id, item.quantity, 1)
                              }
                              className="p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                              title="Increase quantity"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          {/* Total */}
                          <div className="text-right min-w-[70px]">
                            <p className="text-xs font-black text-[#402970]">
                              Rs. {(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleRemoveGlobal(group.sessionId, item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                            title="Delete item"
                          >
                            <Trash2 size={14.5} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Single Session mode (Active Chat Session Cart) */
            <div className="divide-y divide-slate-100 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] overflow-hidden">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Thumbnail */}
                    <div className="w-13 h-13 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Package size={18} className="text-slate-350" />
                      )}
                    </div>

                    {/* Detail */}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 leading-snug truncate pr-6 max-w-[200px] sm:max-w-[320px]">
                        {cleanProductTitle(item.name)}
                      </h4>
                      <p className="text-[10px] font-bold text-[#402970]/80 mt-1">
                        Rs. {item.price.toLocaleString()} each
                      </p>
                    </div>
                  </div>

                  {/* Controls & Price summary */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto shrink-0 border-t sm:border-0 border-slate-100 pt-3.5 sm:pt-0">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 shadow-xs">
                      <button
                        onClick={() => handleQtyChangeLocal(item.id, item.quantity, -1)}
                        className="p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-6.5 text-center text-xs font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQtyChangeLocal(item.id, item.quantity, 1)}
                        className="p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Total */}
                    <div className="text-right min-w-[70px]">
                      <p className="text-xs font-black text-[#402970]">
                        Rs. {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => handleRemoveLocal(item.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                      title="Delete item"
                    >
                      <Trash2 size={14.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Summary & Action Footer ── */}
        {hasItems && (
          <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 z-10 select-none">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Subtotal Summary</p>
              <h4 className="text-lg font-black text-[#402970] mt-0.5">
                Rs.{" "}
                {isGlobal
                  ? calculateSubtotalGlobal().toLocaleString()
                  : calculateSubtotalLocal().toLocaleString()}
              </h4>
            </div>

            <button
              onClick={isGlobal ? handleCheckoutGlobal : handleCheckoutLocal}
              className="flex items-center justify-center gap-2.5 bg-[#402970] hover:bg-[#322055] text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-purple-500/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer outline-none group text-xs shrink-0"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
