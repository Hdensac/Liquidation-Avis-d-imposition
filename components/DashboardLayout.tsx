"use client";

import React, { useState, ReactNode } from "react";
import { FilePlus, Clock, History } from "lucide-react";

const TABS = [
  { label: "Nouvelle liquidation", icon: FilePlus },
  { label: "En attente", icon: Clock },
  { label: "Historique", icon: History },
];

type Props = { children: ReactNode[] };

export default function DashboardLayout({ children }: Props) {
  const [active, setActive] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Administration Fiscale – TFU / FNB
          </h1>
          <nav className="flex space-x-1">
            {TABS.map(({ label, icon: Icon }, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active === i
                    ? "bg-indigo-600 text-white shadow-md scale-105"
                    : "text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Panel content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {Array.isArray(children) &&
          children.map((child, i) => (
            <div key={i} className={i === active ? "block" : "hidden"}>
              {child}
            </div>
          ))}
      </main>
    </div>
  );
}

