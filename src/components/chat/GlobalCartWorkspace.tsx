"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ShoppingBag, ArrowRight, Trash2, ArrowLeft, MessageSquare } from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";
import type { CartItem } from "@/types/sourcing";

interface SessionWithCart {
  id: string;
  title: string;
  cart: CartItem[] | string;
  createdAt: string;
}

interface GlobalCartWorkspaceProps {
  onSelectHistory: (id: string) => void;
}

export default function GlobalCartWorkspace({ onSelectHistory }: GlobalCartWorkspaceProps) {
  const { activeUserId, setIsViewingCart, handleUpdateCart, activeHistoryId } = useSourcing();
  const [sessions, setSessions] = useState<SessionWithCart[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessionCarts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/session?cartOnly=true&userId=${activeUserId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to load global cart sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    fetchSessionCarts();
  }, [fetchSessionCarts]);

  const handleDeleteItem = async (sessionId: string, itemId: string) => {
    // Find current session cart
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    let parsedCart: CartItem[] = [];
    try {
      parsedCart = typeof session.cart === "string" ? JSON.parse(session.cart) : (session.cart as CartItem[]);
    } catch (e) {
      console.error(e);
    }

    const updatedCart = parsedCart.filter((item) => item.id !== itemId);

    // Save to server
    try {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, cart: updatedCart }),
      });

      // Update state
      setSessions((prev) =>
        prev
          .map((s) => {
            if (s.id === sessionId) {
              return { ...s, cart: updatedCart };
            }
            return s;
          })
          .filter((s) => {
            // Remove the session block completely if its cart is now empty
            const cartItemsCount = Array.isArray(s.cart) ? s.cart.length : 0;
            return s.id === sessionId ? updatedCart.length > 0 : cartItemsCount > 0;
          })
      );

      // If this is the active session in our context, synchronize the context cart state as well
      if (sessionId === activeHistoryId) {
        handleUpdateCart(updatedCart);
      }
    } catch (e) {
      console.error("Failed to delete item from global cart:", e);
    }
  };

  const handleOpenThread = (sessionId: string) => {
    setIsViewingCart(false);
    onSelectHistory(sessionId);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden animate-fadeIn">
      {/* Top Header */}
      <div className="h-16 shrink-0 bg-white border-b border-slate-100 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsViewingCart(false)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors mr-1 cursor-pointer outline-none"
            title="Go back to workspace"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#402970]/10 flex items-center justify-center text-[#402970]">
            <ShoppingBag size={16} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 tracking-tight">Global Sourcing Cart</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Manage cart products across all discussions</p>
          </div>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-[#402970]/20 border-t-[#402970] animate-spin" />
              <span className="text-xs font-semibold text-slate-400">Loading cart sessions...</span>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-lg shadow-slate-100 text-slate-350 mb-5 animate-pulse">
              <ShoppingBag size={28} />
            </div>
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight">No Active Session Carts</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              When sourcing products inside your chats, add matches to your cart. Carts are isolated by thread and collected here.
            </p>
            <button
              onClick={() => setIsViewingCart(false)}
              className="mt-6 inline-flex items-center gap-2 bg-[#402970] hover:bg-[#402970]/95 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              Start Sourcing
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {sessions.map((session) => {
              let cart: CartItem[] = [];
              try {
                cart = typeof session.cart === "string" ? JSON.parse(session.cart) : (session.cart as CartItem[]);
              } catch (e) {
                console.error("Cart parsing error:", e);
              }

              if (cart.length === 0) return null;

              return (
                <div
                  key={session.id}
                  className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  {/* Session Header Card */}
                  <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <MessageSquare size={14} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-800 truncate">
                          {session.title || "Untitled Sourcing Thread"}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          Started on {new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" })}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenThread(session.id)}
                      className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 text-[#402970] text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors shadow-sm cursor-pointer"
                    >
                      <span>Resume Sourcing Thread</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Product Rows */}
                  <div className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/30 transition-colors group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Product Image */}
                          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <ShoppingBag size={16} className="text-slate-350" />
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-700 leading-snug truncate pr-6">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-slate-400 font-bold">
                              <span>Rs. {item.price.toLocaleString()}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span>Qty: {item.quantity}</span>
                            </div>
                          </div>
                        </div>

                        {/* Price & Trash Delete */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto shrink-0 border-t sm:border-0 border-slate-100 pt-3 sm:pt-0">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold">Item Total</p>
                            <p className="text-xs font-extrabold text-[#402970] mt-0.5">
                              Rs. {(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>

                          <button
                            onClick={() => handleDeleteItem(session.id, item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            title="Delete item from cart"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
