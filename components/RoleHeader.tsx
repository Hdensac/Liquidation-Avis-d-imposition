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
    return <p className="text-center text-gray-500 dark:text-gray-400">Chargement du rôle...</p>;
  }

  if (!role) {
    return <p className="text-center text-gray-500 dark:text-gray-400">Aucun rôle actif trouvé pour le moment.</p>;
  }

  return (
    <div className="flex items-center justify-center mb-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg shadow-lg transform hover:scale-105 transition">
        <span className="font-medium">Rôle #{role.numero_role}</span>
        <span className="mx-2">|</span>
        <span>{role.commune}</span>
        <span className="mx-2">|</span>
        <span>{role.annee}</span>
      </div>
    </div>
  );
}