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
    subtitle: "You've used your 9 free messages. Sign in to keep chatting — it's free and takes just a second.",
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={closeAuthModal} />

      <div className="relative w-full max-w-[740px] bg-white rounded-xl overflow-hidden border border-slate-100 shadow-2xl flex flex-col md:flex-row animate-fadeInScale">
        
        {/* Left Illustration Panel (representing the Product image container) */}
        <div className="w-full md:w-[330px] shrink-0 bg-slate-50 flex items-center justify-center p-10 border-b md:border-b-0 md:border-r border-slate-100 select-none relative min-h-[330px] md:min-h-[390px]">
          {/* Subtle grid pattern for premium Windows app feel */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#402970_1px,transparent_1px)] [background-size:12px_12px]" />
          
          {/* Subtle brand color glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-50/50 via-transparent to-[#402970]/5 opacity-40" />

          {/* Stylized Image box matching the product thumbnail container */}
          <div className="w-full aspect-square max-w-[260px] rounded-lg overflow-hidden border border-slate-200/60 bg-white shadow-md flex items-center justify-center p-5 relative z-10">
            <img
              src="/auth_illustration.png"
              alt="Kapuruka AI"
              className="w-full h-full object-contain rounded"
            />
          </div>
        </div>

        {/* Right Message & Actions Panel */}
        <div className="flex-1 p-12 flex flex-col justify-center gap-10 relative min-h-[330px] md:min-h-[390px]">
          {/* Floating Close Button */}
          <button
            onClick={closeAuthModal}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer z-10"
          >
            <X size={16} />
          </button>

          <div className="space-y-3 text-left">
            <h3 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">
              {content.title}
            </h3>
            <p className="text-base text-slate-500 leading-relaxed font-medium">
              {content.subtitle}
            </p>
          </div>

          {/* Clean separation divider */}
          <div className="h-px bg-slate-100 w-full" />

          {/* Sign-In Actions */}
          <div className="space-y-5">
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-[#402970] font-black py-[18px] px-6 rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all cursor-pointer text-base group"
            >
              <GoogleIcon />
              <span className="transition-colors">Sign in with Google</span>
            </button>

            <p className="text-xs text-slate-400 leading-normal text-left font-medium">
              By continuing, you agree to Kapuruka's{" "}
              <a href="#" className="underline hover:text-slate-600 transition-colors">Terms of Service</a>{" "}
              and{" "}
              <a href="#" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
