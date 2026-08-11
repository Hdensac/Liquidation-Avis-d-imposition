import TpsRolesTable from "@/components/tps/TpsRolesTable";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function TpsRolesPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rôles d'imposition TPS</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gérez les rôles communaux TPS. Clôturez un rôle pour en créer un nouveau avec un numéro incrémenté.
          Les numéros d'articles se réinitialisent à chaque nouveau rôle.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement des rôles...
          </div>
        }
      >
        <TpsRolesTable />
      </Suspense>
    </div>
  );
}
