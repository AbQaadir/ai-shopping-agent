import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SourcingProvider } from "@/context/SourcingContext";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "Kapuruka.com AI Mode",
  description: "All tasks in one ask, smart sourcing with AI. Go beyond search — let Kapuruka Work handle your entire sourcing workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body 
        className="h-full overflow-hidden flex flex-col bg-white text-slate-800 font-sans"
        suppressHydrationWarning
      >
        <SourcingProvider>
          {children}
        </SourcingProvider>
      </body>
    </html>
  );
}
