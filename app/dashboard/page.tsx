import { redirect } from "next/navigation";

export default function DashboardIndex() {
  // Redirect default /dashboard to /dashboard/new
  redirect("/dashboard/new");
}
