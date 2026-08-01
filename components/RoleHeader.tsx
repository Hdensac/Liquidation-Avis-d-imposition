"use client";

import React, { useEffect, useState } from "react";
import { getActiveRole } from "../actions/liquidationActions";

type RoleInfo = {
  id: string;
  numero_role: number;
  commune: string;
  annee: number;
  status: string;
};

export default function RoleHeader() {
  const [role, setRole] = useState<RoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getActiveRole();
        setRole((data as RoleInfo) ?? null);
      } catch (error) {
        console.error("Failed to load active role", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-center text-gray-500 dark:text-gray-400 pt-4">Chargement du rôle...</p>;
  }

  if (!role) {
    return <p className="text-center text-gray-500 dark:text-gray-400 pt-4">Aucun rôle actif trouvé.</p>;
  }

  return (
    <div className="flex items-center justify-center mb-6 pt-4">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-full shadow-lg text-sm font-medium tracking-wide">
        Rôle #{role.numero_role} | {role.commune} | {role.annee}
      </div>
    </div>
  );
}