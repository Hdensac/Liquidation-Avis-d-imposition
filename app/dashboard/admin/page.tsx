import { fetchProfiles, fetchAuditLogs } from "@/actions/adminActions";
import AdminClient from "./AdminClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    const [profiles, logsResult] = await Promise.all([
      fetchProfiles(),
      fetchAuditLogs()
    ]);

    return <AdminClient initialProfiles={profiles} initialLogs={logsResult.logs} initialLogTotal={logsResult.total} />;
  } catch (err) {
    console.error("Erreur d'accès à l'administration :", err);
    redirect("/dashboard");
  }
}
