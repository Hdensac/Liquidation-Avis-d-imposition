// app/dashboard/page.tsx
import type { Metadata } from "next";
import DashboardLayout from "@/components/DashboardLayout";
import RoleHeader from "@/components/RoleHeader";
import NewLiquidationForm from "@/components/NewLiquidationForm";
import PendingLiquidationsTable from "@/components/PendingLiquidationsTable";
import HistoryTable from "@/components/HistoryTable";

export const metadata: Metadata = {
  title: "Administration fiscale – Tableau de bord",
  description: "Gestion des liquidations et avis de mise en recouvrement TFU/FNB",
};

export default function DashboardPage() {
  return (
    <div>
      <RoleHeader />
      <DashboardLayout>
        <NewLiquidationForm />
        <PendingLiquidationsTable />
        <HistoryTable />
      </DashboardLayout>
    </div>
  );
}

