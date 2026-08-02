"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import { FilePlus, Clock, History, Briefcase } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function HeaderClient() {
  const pathname = usePathname() || "/dashboard/new";
  const router = useRouter();

  // Determine active key from the path (/dashboard/new -> new)
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "new";
  const activeKey = ["new", "pending", "history", "roles"].includes(last) ? last : "new";

  const items = [
    { key: "new",     label: "Nouvelle liquidation", icon: FilePlus  },
    { key: "pending", label: "En attente",            icon: Clock     },
    { key: "history", label: "Historique",            icon: History   },
    { key: "roles",   label: "Rôles",                 icon: Briefcase },
  ];

  function onNavigate(key: string) {
    router.push(`/dashboard/${key}`);
  }

  return (
    <div>
      <Navbar brand="Administration Fiscale" items={items} activeKey={activeKey} onNavigate={onNavigate} rolePill={null} />
    </div>
  );
}
