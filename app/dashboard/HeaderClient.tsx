"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import { FilePlus, Clock, History, Briefcase, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

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

  // Determine active key from the path
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "new";
  const activeKey = ["new", "pending", "history", "roles", "admin"].includes(last) ? last : "new";

  const items = [
    { key: "new",     label: "Nouvelle liquidation", icon: FilePlus  },
    { key: "pending", label: "En attente",            icon: Clock     },
    { key: "history", label: "Historique",            icon: History   },
    { key: "roles",   label: "Rôles",                 icon: Briefcase },
  ];

  if (user?.role === "ADMIN") {
    items.push({ key: "admin", label: "Administration", icon: Settings });
  }

  function onNavigate(key: string) {
    router.push(`/dashboard/${key}`);
  }

  return (
    <div>
      <Navbar
        brand="CIPE-ALLADA"
        items={items}
        activeKey={activeKey}
        onNavigate={onNavigate}
        rolePill={null}
        user={user}
      />
    </div>
  );
}
