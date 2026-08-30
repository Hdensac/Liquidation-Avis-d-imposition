"use client";

import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleTestSentry = () => {
    try {
      const client = Sentry.getClient();
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
      
      console.log("Sentry Client:", client);
      console.log("Sentry DSN:", dsn);

      if (!client) {
        alert("Sentry n'est pas initialisé (Client introuvable). Vérifiez si NEXT_PUBLIC_SENTRY_DSN est défini.");
        return;
      }

      const err = new Error("Test Sentry Exception depuis le bouton d'accueil");
      Sentry.captureException(err);
      
      alert(`Sentry initialisé ! Erreur envoyée.\nDSN présent: ${dsn ? "OUI" : "NON"}`);
    } catch (e) {
      console.error("Erreur test Sentry:", e);
      alert("Erreur lors de l'envoi du test Sentry.");
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <button
        onClick={handleTestSentry}
        style={{
          padding: "12px 20px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: "pointer",
          background: "#f3f4f6",
          fontWeight: 600,
        }}
      >
        Tester Sentry
      </button>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
            background: "#4f46e5",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Accéder au dashboard
        </button>
      </div>
    </div>
  );
}



