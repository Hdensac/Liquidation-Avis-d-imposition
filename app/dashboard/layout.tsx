import HeaderClient from "./HeaderClient";

export const metadata = {
  title: "Administration fiscale – Tableau de bord",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <HeaderClient />
      <main className="max-w-6xl mx-auto px-4 py-12">{children}</main>
    </div>
  );
}
