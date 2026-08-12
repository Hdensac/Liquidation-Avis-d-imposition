"use client";

import React from "react";
import { FilePlus, Clock, History, Briefcase, Settings, Landmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import UserNav from "@/components/UserNav";

interface HeaderClientProps {
  user?: {
    email?: string;
    name?: string;
    avatarUrl?: string;
    role?: string | null;
  };
}

export default function HeaderClient({ user }: HeaderClientProps) {
  const pathname = usePathname() || "/dashboard/new";
  const router = useRouter();

  // Determine if we are in TPS or TFU context
  const isTpsSection = pathname.includes("/dashboard/tps");

  // TFU nav items
  const tfuItems = [
    { key: "new",     label: "Nouvelle fiche",  icon: FilePlus  },
    { key: "pending", label: "En attente",       icon: Clock     },
    { key: "history", label: "Historique",       icon: History   },
    { key: "roles",   label: "Rôles",            icon: Briefcase },
  ];

  if (user?.role === "ADMIN") {
    tfuItems.push({ key: "admin", label: "Administration", icon: Settings });
  }

  // TPS nav items
  const tpsItems = [
    { key: "tps/new",     label: "Nouvelle fiche TPS", icon: FilePlus  },
    { key: "tps/pending", label: "En attente",          icon: Clock     },
    { key: "tps/avis",    label: "Avis validés",        icon: Landmark  },
    { key: "tps/roles",   label: "Rôles TPS",           icon: Briefcase },
  ];

  // Active key detection (from current URL)
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "new";
  const activeKey = isTpsSection
    ? `tps/${last}`
    : (["new", "pending", "history", "roles", "admin"].includes(last) ? last : "new");

  const currentItems = isTpsSection ? tpsItems : tfuItems;

  function onNavigate(key: string) {
    router.push(`/dashboard/${key}`);
  }

  return (
    <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">

          {/* BRAND */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow">
              CA
            </div>
            <div>
              <div className="text-base font-bold text-gray-800 dark:text-gray-100 leading-none">CIPE-ALLADA</div>
              <div className="text-[10px] text-gray-400 mt-0.5"></div>
            </div>
          </div>

          {/* MODULE SWITCHER: TFU / TPS */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0">
            <Link
              href="/dashboard/new"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                !isTpsSection
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              TFU / FNB
            </Link>
            <Link
              href="/dashboard/tps/new"
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                isTpsSection
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              TPS
            </Link>
          </div>

          {/* NAV ITEMS */}
          <nav className="hidden sm:flex items-center gap-1 flex-1" aria-label="Primary">
            {currentItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                aria-pressed={activeKey === key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 ${
                  isTpsSection
                    ? activeKey === key
                      ? "bg-emerald-600 text-white shadow focus:ring-emerald-300"
                      : "text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800 focus:ring-emerald-200"
                    : activeKey === key
                    ? "bg-indigo-600 text-white shadow focus:ring-indigo-300"
                    : "text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800 focus:ring-indigo-200"
                }`}
              >
                {Icon && <Icon size={15} />}
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* USER NAV */}
          {user && (
            <div className="flex-shrink-0">
              <UserNav name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
