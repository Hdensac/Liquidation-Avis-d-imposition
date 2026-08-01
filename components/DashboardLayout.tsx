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
      <header className="sticky top-0 z-20 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="relative">
          {/* Centered role pill */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full shadow-lg">
              <span className="font-semibold">Rôle #1</span>
              <span className="opacity-80">|</span>
              <span className="uppercase text-sm tracking-wide">COTONOU</span>
              <span className="opacity-80">|</span>
              <span className="text-sm">2026</span>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Administration Fiscale – TFU / FNB
            </h1>

            <nav className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1">
                {TABS.map(({ label, icon: Icon }, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    aria-pressed={active === i}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                      active === i
                        ? "bg-indigo-600 text-white shadow-md scale-105"
                        : "text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Mobile: compact menu */}
              <div className="sm:hidden flex items-center gap-2">
                <button
                  onClick={() => setActive((prev) => (prev + 1) % TABS.length)}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white shadow-sm"
                  title="Basculer l'onglet"
                >
                  {TABS[active].label}
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Panel content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
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
