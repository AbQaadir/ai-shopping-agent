"use client";
import React from "react";
import { ShoppingBag, ArrowRight, Trash2, ArrowLeft, Plus, Minus, Package } from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";

export default function GlobalCartWorkspace() {
  const { cartItems, setIsViewingCart, handleUpdateCart, handleDirectSend } = useSourcing();

  const handleQtyChange = (itemId: string, currentQty: number, delta: number) => {
    const updated = cartItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, quantity: Math.max(1, currentQty + delta) };
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
    setIsViewingCart(false);
    handleDirectSend("checkout cart");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden animate-fadeIn">
      {/* Top Header */}
      <div className="h-16 shrink-0 bg-white border-b border-slate-100 px-6 flex items-center justify-between z-10">
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
            <h1 className="text-base font-bold text-slate-800 tracking-tight">Shopping Cart</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Manage your global sourcing items</p>
          </div>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-lg shadow-slate-100 text-slate-300 mb-5 animate-pulse">
              <ShoppingBag size={28} />
            </div>
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Your Cart is Empty</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Search for products in the sourcing workspace, check selection boxes, and click "Add to Cart" to start building your order list.
            </p>
            <button
              onClick={() => setIsViewingCart(false)}
              className="mt-6 inline-flex items-center gap-2 bg-[#402970] hover:bg-[#301e54] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Start Sourcing
            </button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start pb-10">
            {/* Products List (Left Side) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Cart Items ({cartItems.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/20 transition-colors group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Product Image */}
                        <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <Package size={20} className="text-slate-350" />
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 leading-snug truncate pr-6 max-w-[240px] sm:max-w-[340px]">
                            {item.name}
                          </h4>
                          <p className="text-[10px] font-bold text-[#402970]/80 mt-1">
                            Rs. {item.price.toLocaleString()} each
                          </p>
                        </div>
                      </div>

                      {/* Controls and Price */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto shrink-0 border-t sm:border-0 border-slate-100 pt-3 sm:pt-0">
                        {/* Qty Adjustment */}
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 shadow-xs">
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                            disabled={item.quantity <= 1}
                            className="p-1 hover:bg-slate-50 rounded text-slate-500 disabled:opacity-30 transition-all cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                            className="p-1 hover:bg-slate-50 rounded text-slate-500 transition-all cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        {/* Item Total */}
                        <div className="text-right min-w-[70px]">
                          <p className="text-xs font-black text-[#402970]">
                            Rs. {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                          title="Delete item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Checkout Summary Card (Right Side) */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-xs p-6 space-y-5">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight pb-3 border-b border-slate-150">Order Summary</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Subtotal</span>
                  <span className="text-slate-800 font-semibold">Rs. {calculateSubtotal().toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Estimated Delivery</span>
                  <span className="text-emerald-600 font-semibold">Calculated in checkout</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>Total</span>
                  <span className="text-[#402970] text-base font-black">Rs. {calculateSubtotal().toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 bg-[#402970] hover:bg-[#301e54] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer group"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-normal">
                By proceeding, you will be redirected to the sourcing chat workspace to complete payment and delivery instructions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
