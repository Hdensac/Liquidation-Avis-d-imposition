// app/dashboard/page.tsx
import DashboardLayout from "@/components/DashboardLayout";
import RoleHeader from "@/components/RoleHeader";
import NewLiquidationForm from "@/components/NewLiquidationForm";
import PendingLiquidationsTable from "@/components/PendingLiquidationsTable";
import HistoryTable from "@/components/HistoryTable";
import Head from "next/head";

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Administration fiscale – Tableau de bord</title>
        <meta name="description" content="Gestion des liquidations et avis de recouvrement" />
      </Head>
      <DashboardLayout>
        {/* Header with active role information */}
        <RoleHeader />
        {/* Tab contents are rendered inside DashboardLayout */}
        <DashboardLayout.TabPanel index={0}>
          <NewLiquidationForm />
        </DashboardLayout.TabPanel>
        <DashboardLayout.TabPanel index={1}>
          <PendingLiquidationsTable />
        </DashboardLayout.TabPanel>
        <DashboardLayout.TabPanel index={2}>
          <HistoryTable />
        </DashboardLayout.TabPanel>
      </DashboardLayout>
    </>
  );
}
