"use client";

import React from "react";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cartItems, handleUpdateCart, handleDirectSend } = useSourcing();

  const handleQtyChange = (itemId: string, currentQty: number, delta: number) => {
    const updated = cartItems.map((item) => {
      if (item.id === itemId) {
        const nextQty = Math.max(1, currentQty + delta);
        return { ...item, quantity: nextQty };
      }
      return item;
    });
    handleUpdateCart(updated);
  };

  const handleRemove = (itemId: string) => {
    const updated = cartItems.filter((item) => item.id !== itemId);
    handleUpdateCart(updated);
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    onClose();
    handleDirectSend("checkout cart");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        {/* Sliding Panel */}
        <div className="w-screen max-w-md transform transition-all duration-300 ease-in-out bg-white/90 backdrop-blur-xl border-l border-white/20 shadow-2xl flex flex-col h-full rounded-l-3xl animate-slideLeft">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#402970]/10 flex items-center justify-center text-[#402970]">
                <ShoppingBag size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Active Session Cart</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer outline-none"
              title="Close cart"
            >
              <X size={20} />
            </button>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-300">
                  <ShoppingBag size={32} />
                </div>
                <p className="text-sm font-semibold text-slate-500">Your cart is empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Add products from the sourcing search to place a combined order.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-3 rounded-2xl bg-white border border-slate-100 hover:border-[#402970]/15 hover:shadow-md hover:shadow-purple-500/2 transition-all duration-200 group"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <ShoppingBag size={20} className="text-slate-300" />
                    )}
                  </div>

                  {/* Detail details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 truncate leading-snug group-hover:text-[#402970] transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs font-bold text-[#402970]/80 mt-1">
                        Rs. {item.price.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Qty Selector */}
                      <div className="flex items-center border border-slate-150 rounded-lg bg-slate-50/50 p-0.5">
                        <button
                          onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                          className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 hover:shadow-sm transition-all cursor-pointer"
                          title="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                          className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 hover:shadow-sm transition-all cursor-pointer"
                          title="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Trash button */}
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Subtotal & Action */}
          {cartItems.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                <span>Subtotal</span>
                <span className="text-[#402970] text-base font-extrabold">
                  Rs. {calculateSubtotal().toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Standard delivery estimates and import duties are updated during checkout step in the chat session.
              </p>
              <button
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 bg-[#402970] hover:bg-[#402970]/95 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-xl active:scale-[0.98] transition-all cursor-pointer outline-none group"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
