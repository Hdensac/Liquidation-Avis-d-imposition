"use client";

import React, { useState, Suspense } from "react";
import { FilePlus, Clock, History, Briefcase, Settings, Landmark, Menu, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function HeaderContent({ user }: HeaderClientProps) {
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fromParam = searchParams.get("from");

  // Determine section context
  const isHomePortal = pathname === "/dashboard";
  const isAdminSection = pathname.startsWith("/dashboard/admin");
  const isTpsSection = pathname.includes("/dashboard/tps") || (isAdminSection && fromParam === "tps");

  // TFU nav items
  const tfuItems = [
    { key: "tfu/new",     label: "Nouvelle fiche",  icon: FilePlus  },
    { key: "tfu/pending", label: "En attente",       icon: Clock     },
    { key: "tfu/history", label: "Historique",       icon: History   },
    { key: "tfu/roles",   label: "Rôles TFU",        icon: Briefcase },
  ];

  if (user?.role === "ADMIN") {
    tfuItems.push({ key: "admin?from=tfu", label: "Administration", icon: Settings });
  }

  // TPS nav items
  const tpsItems = [
    { key: "tps/new",     label: "Nouvelle fiche TPS", icon: FilePlus  },
    { key: "tps/pending", label: "En attente",          icon: Clock     },
    { key: "tps/avis",    label: "Avis validés",        icon: Landmark  },
    { key: "tps/roles",   label: "Rôles TPS",           icon: Briefcase },
  ];

  if (user?.role === "ADMIN") {
    tpsItems.push({ key: "admin?from=tps", label: "Administration", icon: Settings });
  }

  // Active key detection
  let activeKey = "";
  if (isAdminSection) {
    activeKey = isTpsSection ? "admin?from=tps" : "admin?from=tfu";
  } else if (isTpsSection) {
    if (pathname.includes("/tps/pending")) activeKey = "tps/pending";
    else if (pathname.includes("/tps/avis")) activeKey = "tps/avis";
    else if (pathname.includes("/tps/roles")) activeKey = "tps/roles";
    else activeKey = "tps/new";
  } else {
    if (pathname.includes("/pending")) activeKey = "tfu/pending";
    else if (pathname.includes("/history")) activeKey = "tfu/history";
    else if (pathname.includes("/roles")) activeKey = "tfu/roles";
    else activeKey = "tfu/new";
  }

  const currentItems = isTpsSection ? tpsItems : tfuItems;

  function onNavigate(key: string) {
    setIsMobileMenuOpen(false);
    router.push(`/dashboard/${key}`);
  }

  // Modules disponibles pour le switcher dropdown
  const modules = [
    { value: "tfu/new",  label: "📋 TFU (FNB / FB)",  baseHref: "/dashboard/tfu/new" },
    { value: "tps/new",  label: "🏢 TPS (Synthétique)", baseHref: "/dashboard/tps/new" },
  ];

  const currentModule = isTpsSection ? "tps/new" : "tfu/new";

  function handleModuleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setIsMobileMenuOpen(false);
    const selectedModule = modules.find((m) => m.value === e.target.value);
    if (selectedModule) router.push(selectedModule.baseHref);
  }

  return (
    <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-6">

          {/* BRAND LINK TO PORTAL */}
          <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 flex-shrink-0 group">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow group-hover:scale-105 transition-transform flex-shrink-0">
              CA
            </div>
            <div>
              <div className="hidden min-[380px]:block text-xs sm:text-base font-bold text-gray-800 dark:text-gray-100 leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                CIPE-ALLADA
              </div>
            </div>
          </Link>

          {!isHomePortal && (
            <>
              {/* MODULE SWITCHER Dropdown */}
              <div className="flex-shrink min-w-0">
                <div className="relative">
                  <select
                    id="module-switcher"
                    value={currentModule}
                    onChange={handleModuleChange}
                    className={`
                      appearance-none cursor-pointer text-[11px] sm:text-xs font-bold pl-2.5 pr-6 sm:pr-8 py-1.5 rounded-lg truncate max-w-[130px] min-[400px]:max-w-[170px] sm:max-w-none
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
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 sm:w-3.5 sm:h-3.5">
                      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* NAV ITEMS DESKTOP */}
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
            </>
          )}

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user && <UserNav name={user.name} email={user.email} avatarUrl={user.avatarUrl} />}

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="sm:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE NAV DRAWER */}
      {isMobileMenuOpen && (
        <nav className="sm:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-2 pb-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-2">
            Menu {isTpsSection ? "TPS" : "TFU"}
          </div>
          {currentItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              aria-pressed={activeKey === key}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                isTpsSection
                  ? activeKey === key
                    ? "bg-emerald-600 text-white shadow"
                    : "text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
                  : activeKey === key
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-gray-800"
              }`}
            >
              {Icon && <Icon size={18} />}
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

export default function HeaderClient(props: HeaderClientProps) {
  return (
    <Suspense fallback={
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-16 sticky top-0 z-40" />
    }>
      <HeaderContent {...props} />
    </Suspense>
  );
}
