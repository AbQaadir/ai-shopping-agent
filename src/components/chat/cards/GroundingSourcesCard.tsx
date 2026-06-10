"use client";

import React from "react";
import { Globe, ExternalLink } from "lucide-react";

export interface GroundingSource {
  title: string;
  uri: string;
}

interface GroundingSourcesCardProps {
  sources: GroundingSource[];
}

export default function GroundingSourcesCard({ sources }: GroundingSourcesCardProps) {
  if (!sources || sources.length === 0) return null;

  // Helper to extract clean domain name (e.g., "wikipedia.org")
  const getDomainName = (urlStr: string) => {
    try {
      // Decode potential Vertex redirect URL if it contains target destination
      let actualUrl = urlStr;
      if (urlStr.includes("grounding-api-redirect")) {
        // Vertex AI search redirect URLs might not contain the destination directly in searchParams,
        // but we can fallback to standard hostname parsing or parse redirection params.
        const urlObj = new URL(urlStr);
        const redirectParam = urlObj.searchParams.get("url") || urlObj.searchParams.get("dest");
        if (redirectParam) actualUrl = redirectParam;
      }
      return new URL(actualUrl).hostname.replace("www.", "");
    } catch {
      return "web source";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm transition-all duration-300 hover:shadow-md mt-4 animate-fadeIn">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 border-b border-slate-100/80">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-emerald-600 animate-pulse" />
          <span className="text-xs font-extrabold text-slate-700">Sources & Grounding References</span>
        </div>
        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100/60 rounded-full px-2.5 py-0.5 select-none">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
      </div>

      {/* Grid Content */}
      <div className="p-4 bg-slate-50/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sources.map((source, index) => {
            const domain = getDomainName(source.uri);
            return (
              <a
                key={index}
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-start gap-3 p-3 rounded-xl border border-slate-200/50 bg-white hover:bg-slate-50 hover:border-emerald-200 shadow-2xs hover:shadow-sm transition-all duration-200 active:scale-[0.99]"
              >
                {/* Number index indicator */}
                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100 text-slate-500 font-bold text-[10px] shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  {index + 1}
                </div>

                {/* Domain & Title */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide truncate">
                    {domain}
                  </div>
                  <div className="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors line-clamp-2 mt-0.5">
                    {source.title}
                  </div>
                </div>

                {/* Hover-visible external link icon */}
                <div className="absolute right-3 top-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors">
                  <ExternalLink size={12} className="stroke-[2.5]" />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
