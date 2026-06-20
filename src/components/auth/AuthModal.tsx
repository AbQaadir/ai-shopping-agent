"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { X } from "lucide-react";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    <path fill="none" d="M1 1h22v22H1z" />
  </svg>
);

const CONTENT = {
  message_limit: {
    icon: "💬",
    iconBg: "from-blue-500/20 to-indigo-500/20",
    title: "You've reached the guest limit",
    subtitle: "You've used your 3 free messages. Sign in to keep chatting — it's free and takes just a second.",
  },
  checkout: {
    icon: "🛒",
    iconBg: "from-emerald-500/20 to-teal-500/20",
    title: "Ready to place your order?",
    subtitle: "Sign in to add items to your cart, place orders, and track your deliveries from anywhere.",
  },
  login: {
    icon: "✨",
    iconBg: "from-[#402970]/20 to-purple-500/20",
    title: "Welcome to Kapuruka",
    subtitle: "Sign in with Google to unlock your personal shopping assistant, order history, and saved delivery profiles.",
  },
};

export default function AuthModal() {
  const { isAuthModalOpen, authModalReason, closeAuthModal, signInWithGoogle } = useAuth();

  if (!isAuthModalOpen) return null;

  const content = CONTENT[authModalReason ?? "login"];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={closeAuthModal} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeInScale border border-slate-100">
        {/* Purple gradient accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#402970] via-purple-500 to-indigo-500" />

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#402970] to-purple-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-black">K</span>
            </div>
            <span className="text-sm font-extrabold text-slate-700 tracking-tight">Kapuruka AI</span>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-7 flex flex-col items-center text-center gap-5">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${content.iconBg} flex items-center justify-center text-3xl shadow-sm`}>
            {content.icon}
          </div>

          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-extrabold text-slate-800 leading-snug">{content.title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{content.subtitle}</p>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-[0.97] transition-all shadow-sm group"
          >
            <GoogleIcon />
            <span className="text-sm group-hover:text-[#402970] transition-colors">Continue with Google</span>
          </button>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            By continuing, you agree to Kapuruka's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
