"use client";

import {
  CalendarDays,
  ChevronRight,
  Gift,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OrderFlowStepData } from "@/types/sourcing";

interface DeliveryDateBubbleProps {
  step: OrderFlowStepData;
  onAction: (userMessage: string) => void;
  isActive?: boolean;
}

/** Format a Date to "Tue 24 Jun" */
function formatPill(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Format YYYY-MM-DD to "Tuesday, 24 June 2026" */
function formatFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Convert a Date to YYYY-MM-DD */
function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function DeliveryDateBubble({ step, onAction, isActive = true }: DeliveryDateBubbleProps) {
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState<string>("");
  const [confirmedMsg, setConfirmedMsg] = useState<string>("");

  // Selected pill index (0-3) or "custom"
  const [selectedPill, setSelectedPill] = useState<number | "custom" | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [customDate, setCustomDate] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Personal message
  const [personalMessage, setPersonalMessage] = useState("");
  const MAX_MSG = 140;

  // Generate next 4 upcoming calendar days
  const pillDates: Date[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    pillDates.push(d);
  }

  // Min date for custom input (tomorrow)
  const minDate = toYMD(pillDates[0]);

  const hasError = !!step.deliveryCheckResult && !step.deliveryCheckResult.canDeliver;
  const deliveryError = step.errorMessage;

  const handlePillClick = (idx: number) => {
    if (!isActive || submitted) return;
    setSelectedPill(idx);
    setSelectedDate(toYMD(pillDates[idx]));
    setShowCustomInput(false);
    setCustomDate("");
  };

  const handleCustomClick = () => {
    if (!isActive || submitted) return;
    setSelectedPill("custom");
    setShowCustomInput(true);
    setSelectedDate(customDate);
  };

  const handleCustomDateChange = (val: string) => {
    setCustomDate(val);
    setSelectedDate(val);
  };

  const handleConfirm = () => {
    if (!selectedDate || submittedRef.current || !isActive) return;
    submittedRef.current = true;
    setSubmitted(true);
    setConfirmedDate(selectedDate);
    setConfirmedMsg(personalMessage.trim());
    // Structured message parsed by the Order Agent
    onAction(`Delivery date confirmed: ${selectedDate}|Personal message: ${personalMessage.trim()}`);
  };

  // Inactive / submitted summary view
  if (submitted || !isActive) {
    const displayDate = (submitted ? confirmedDate : step.deliveryDate) || "";
    const displayMsg = (submitted ? confirmedMsg : step.personalMessage) || "";
    return (
      <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 mt-4 animate-fadeInScale select-none">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100/60 mb-3">
          <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
            <CalendarDays size={16} />
          </span>
          <h4 className="text-sm font-bold text-slate-800">Delivery Date Selected</h4>
          <CheckCircle size={14} className="text-green-500 ml-auto" />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <CalendarDays size={13} className="text-[#402970]" />
            <span className="font-semibold">{displayDate ? formatFull(displayDate) : "—"}</span>
          </div>
          {displayMsg && (
            <div className="mt-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-start gap-2.5 transition-all hover:bg-rose-50/80">
              <div className="p-1.5 bg-rose-100/50 text-rose-500 rounded-lg shrink-0">
                <Gift size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Personal Message</span>
                <span className="text-xs font-medium text-slate-700 italic leading-relaxed">"{displayMsg}"</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-slate-100 rounded-[20px] shadow-xs p-5 sm:p-6 animate-fadeInScale select-none mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100/60 mb-5">
        <span className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl shrink-0">
          <CalendarDays size={16} />
        </span>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Choose Delivery Date</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Select when you'd like your order delivered</p>
        </div>
      </div>

      {/* Error banner (from failed delivery check) */}
      {hasError && deliveryError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-xs text-red-600 font-medium">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <span>{deliveryError}</span>
        </div>
      )}

      {/* Date pill buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {pillDates.map((date, idx) => {
          const isSelected = selectedPill === idx;
          return (
            <button
              key={idx}
              onClick={() => handlePillClick(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 border cursor-pointer outline-none
                ${isSelected
                  ? "bg-[#402970] text-white border-[#402970] shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#402970]/40 hover:text-[#402970] hover:bg-[#402970]/5"
                }`}
            >
              {formatPill(date)}
            </button>
          );
        })}

        {/* Custom date pill */}
        <button
          onClick={handleCustomClick}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 border cursor-pointer outline-none
            ${selectedPill === "custom"
              ? "bg-[#402970] text-white border-[#402970] shadow-sm"
              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#402970]/40 hover:text-[#402970] hover:bg-[#402970]/5"
            }`}
        >
          Custom date +
        </button>
      </div>

      {/* Custom date input */}
      {showCustomInput && (
        <div className="mb-4">
          <input
            type="date"
            min={minDate}
            value={customDate}
            onChange={(e) => handleCustomDateChange(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#402970]/20 focus:border-[#402970]/50 transition-all bg-slate-50"
          />
        </div>
      )}

      {/* Personal message input */}
      <div className="mb-4">
        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Gift size={12} className="text-rose-400" />
              Personal message (optional)
            </label>
          </div>
          <textarea
            rows={3}
            maxLength={MAX_MSG}
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder='e.g. "Happy Birthday! 🎂 With love, from us all"'
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-sans text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#402970]/20 focus:border-[#402970]/50 transition-all bg-slate-50 leading-relaxed"
          />
          <div className="text-right text-[10px] text-slate-400 mt-1">
            {personalMessage.length} / {MAX_MSG}
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={!selectedDate}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer outline-none
          ${selectedDate
            ? "bg-[#402970] text-white hover:bg-[#2e1f52] active:scale-[0.98] shadow-sm shadow-[#402970]/20"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
      >
        Confirm Delivery Date
        {selectedDate && <ChevronRight size={15} />}
      </button>
    </div>
  );
}
