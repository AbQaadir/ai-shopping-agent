"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface AgeVerificationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export default function AgeVerificationModal({
  isOpen,
  onConfirm,
  onReject,
}: AgeVerificationModalProps) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-md flex items-center justify-center"
      // Prevent closing when clicking outside to force a choice
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl">
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Age Verification Required</h3>
        </div>
        
        <p className="text-sm text-slate-600 mb-6 pl-1 leading-relaxed">
          These product(s) on this page will only be sold if you are above the age of 21. By pressing the &quot;I am above 21&quot; button, you declare that your age is above 21 years.
        </p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            I am under 21
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#402970] hover:bg-[#301e56] transition-colors shadow-sm"
          >
            I am above 21
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
