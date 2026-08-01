// components/ModalCloseRole.tsx
"use client";

import React, { useState } from "react";
import { closeActiveRole } from "../actions/liquidationActions";
import { useToast } from "./useToast";
import { ToastContainer } from "./useToast";

/**
 * Modal to confirm closure of the active role for a given commune.
 * Calls the RPC `cloturer_role_actif` and displays toast feedback.
 * After success, the page reloads to refresh the RoleHeader badge.
 */
export default function ModalCloseRole({ commune }: { commune: string }) {
  const [open, setOpen] = useState(false);
  const { toast, toasts } = useToast();

  const handleClose = async () => {
    try {
      const result = await closeActiveRole(commune);
      const newRole = result?.numero_role ?? "?";
      toast.success(`Rôle clôturé. Nouveau rôle actif : #${newRole}`);
      setOpen(false);
      // Refresh role header data
      window.location.reload();
    } catch (e) {
      console.error(e);
      toast.error("Échec de la clôture du rôle.");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
      >
        Clôturer le Rôle
      </button>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Confirmation
        </h2>
        <p className="mb-6 text-gray-700 dark:text-gray-300">
          Voulez‑vous vraiment clôturer le rôle actif pour la commune de <strong>{commune}</strong>?<br />
          Cette action est irréversible et réinitialisera les numéros d'article à 1 pour les prochains avis.
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded"
          >
            Annuler
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Confirmer
          </button>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
