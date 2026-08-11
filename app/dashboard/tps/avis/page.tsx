import TpsAvisTable from "@/components/tps/TpsAvisTable";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function TpsAvisPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Avis TPS validés</h1>
        <p className="text-sm text-slate-500 mt-1">
          Consultez les avis de mise en recouvrement TPS validés et téléchargez les PDF officiels.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement des avis validés...
          </div>
        }
      >
        <TpsAvisTable />
      </Suspense>
    </div>
  );
}
