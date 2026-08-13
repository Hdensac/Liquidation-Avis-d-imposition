import { createClient } from "@/utils/supabase/server";
import HeaderClient from "./HeaderClient";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Administration fiscale – Tableau de bord ",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    redirect("/unauthorized");
  }

  const userData = {
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
    avatarUrl: user.user_metadata?.avatar_url,
    role: profile?.role || null,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <HeaderClient user={userData} />
      <main className="max-w-6xl mx-auto px-4 py-12">{children}</main>
    </div>
  );
}