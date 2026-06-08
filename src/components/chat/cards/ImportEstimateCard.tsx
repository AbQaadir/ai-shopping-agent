"use client";

import React from "react";
import { Globe, ExternalLink, AlertTriangle } from "lucide-react";
import type { ImportEstimate } from "@/types/sourcing";

interface ImportEstimateCardProps {
  estimate: ImportEstimate;
}

function formatLKR(amount?: number) {
  if (!amount) return "N/A";
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export default function ImportEstimateCard({ estimate }: ImportEstimateCardProps) {
  const domainMatch = estimate.originalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
  const domain = domainMatch ? domainMatch[1] : "external store";

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-100">
        <Globe size={14} className="text-violet-600" />
        <span className="text-xs font-extrabold text-slate-700">Sri Lanka Import Cost Estimate</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Product / source */}
        <div className="flex items-center gap-2">
          <ExternalLink size={12} className="text-slate-400 shrink-0" />
          <a
            href={estimate.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#402970] hover:underline truncate"
          >
            {estimate.productTitle.substring(0, 60)} — {domain}
          </a>
        </div>

        {/* Breakdown table */}
        <div className="rounded-xl border border-slate-100 overflow-hidden text-xs">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="px-3 py-2 text-slate-500 font-medium">CIF Value</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-700">
                  ${estimate.usdPrice.toFixed(2)} × {estimate.usdToLkrRate} LKR
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.cifValueLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <td className="px-3 py-2 text-slate-500 font-medium">
                  Customs Duty ({(estimate.customsDutyPct * 100).toFixed(0)}%)
                </td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">on CIF</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.customsDutyLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="px-3 py-2 text-slate-500 font-medium">PAL (10%)</td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">Port & Airport Levy</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.palLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <td className="px-3 py-2 text-slate-500 font-medium">CESS (2.5%)</td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]" />
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.cessLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="px-3 py-2 text-slate-500 font-medium">VAT (18%)</td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">on total dutiable</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.vatLKR)}
                </td>
              </tr>
              <tr className="bg-[#402970]/5">
                <td className="px-3 py-2.5 font-extrabold text-slate-800">Total Landed Cost</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right font-extrabold text-[#402970] text-sm">
                  {formatLKR(estimate.totalLandedLKR)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] font-medium text-amber-700 leading-relaxed">{estimate.disclaimer}</p>
        </div>

        {/* CTA */}
        <a
          href="https://www.kapruka.com/globalshop"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#402970] hover:bg-[#33205a] text-white text-xs font-bold rounded-xl transition-colors"
        >
          <Globe size={12} />
          Order via Kapruka Global Shop
        </a>
      </div>
    </div>
  );
}
