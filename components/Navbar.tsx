"use client";

import React, { useState } from "react";
import {
  Menu,
  X,
  FilePlus,
  Clock,
  History,
  Download,
  User,
} from "lucide-react";

type NavItem = { key: string; label: string; icon?: React.ComponentType<any> };

type Props = {
  brand?: string;
  items?: NavItem[];
  activeKey?: string;
  onNavigate?: (key: string) => void;
  rolePill?: string | null;
};

export default function Navbar({
  brand = "Administration Fiscale",
  items = [
    { key: "new", label: "Nouvelle liquidation", icon: FilePlus },
    { key: "pending", label: "En attente", icon: Clock },
    { key: "history", label: "Historique", icon: History },
  ],
  activeKey = "new",
  onNavigate,
  rolePill = "Rôle #1 | COTONOU | 2026",
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleNav(key: string) {
    onNavigate?.(key);
    setMobileOpen(false);
  }

  return (
    <header className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      {/* Centered role pill (optional) */}
      {rolePill && (
        <div className="absolute left-1/2 transform -translate-x-1/2 -top-4 z-40">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
            <span>{rolePill}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">AF</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{brand}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">TFU / FNB</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex sm:items-center sm:gap-3" aria-label="Primary">
            <div className="flex items-center gap-2">
              {items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleNav(key)}
                  aria-pressed={activeKey === key}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                    activeKey === key
                      ? "bg-indigo-600 text-white shadow"
                      : "text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {Icon && <Icon size={16} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="ml-4 flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                <Download size={16} />
                <span>Exporter</span>
              </button>

              <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:brightness-105 shadow">
                <FilePlus size={16} />
                <span>Nouvelle</span>
              </button>

              <button className="ml-2 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" aria-label="Compte">
                <User size={16} />
              </button>
            </div>
          </nav>

          {/* Mobile actions */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label="Menu mobile"
              className="p-2 rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        className={`sm:hidden absolute left-0 right-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 transition-all duration-200 overflow-hidden ${
          mobileOpen ? "max-h-96 py-4" : "max-h-0"
        }`}
      >
        <div className="px-4 space-y-3">
          {items.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleNav(key)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                activeKey === key ? "bg-indigo-600 text-white" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {Icon && <Icon size={18} />}
              <span className="font-medium">{label}</span>
            </button>
          ))}

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Download size={16} /> Exporter
            </button>
            <button className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white">
              <FilePlus size={16} /> Nouvelle liquidation
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
