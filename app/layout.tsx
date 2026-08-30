import type { Metadata } from "next";
import "./globals.css";
import AuthSync from "@/components/AuthSync";
import SentryInitializer from "@/components/SentryInitializer";

export const metadata: Metadata = {
  title: "Liquidation -  (TFU)",
  description:
    "Application d'automatisation de la création de fiche de liquidation d'impôt foncier TFU/FNB avec export PDF et Excel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <SentryInitializer />
        <AuthSync />
        {children}
      </body>
    </html>
  );
}

