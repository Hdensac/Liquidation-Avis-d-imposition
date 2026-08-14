"use client";

import React from "react";
import { FilePlus, Clock, History, Briefcase, Settings, Landmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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

  // Modules disponibles pour le switcher dropdown (facile à étendre)
  const modules = [
    { value: "new",      label: "TFU / FNB",  baseHref: "/dashboard/new",     color: "indigo" },
    { value: "tps/new", label: "TPS",         baseHref: "/dashboard/tps/new", color: "emerald" },
  ];

  const currentModule = isTpsSection ? "tps/new" : "new";

  function handleModuleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedModule = modules.find((m) => m.value === e.target.value);
    if (selectedModule) router.push(selectedModule.baseHref);
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

          {/* MODULE SWITCHER: Dropdown vertical – extensible */}
          <div className="flex-shrink-0">
            <div className="relative">
              <select
                id="module-switcher"
                value={currentModule}
                onChange={handleModuleChange}
                className={`
                  appearance-none cursor-pointer text-xs font-bold pl-3 pr-8 py-2 rounded-lg
                  border-2 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2
                  ${
                    isTpsSection
                      ? "bg-emerald-600 text-white border-emerald-700 focus:ring-emerald-300"
                      : "bg-indigo-600 text-white border-indigo-700 focus:ring-indigo-300"
                  }
                `}
                aria-label="Sélectionner le module"
              >
                {modules.map((m) => (
                  <option key={m.value} value={m.value} className="bg-white text-gray-800 font-semibold">
                    {m.label}
                  </option>
                ))}
              </select>
              {/* Chevron icon */}
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
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
