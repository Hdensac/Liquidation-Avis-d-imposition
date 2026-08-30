"use client";

import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleTestSentry = () => {
    try {
      // 1. Capturer une exception de test explicite
      const err = new Error("Test Sentry Exception depuis le bouton d'accueil");
      Sentry.captureException(err);
      
      // 2. Feedback visuel immédiat pour l'utilisateur
      alert("Erreur de test Sentry envoyée avec succès ! Vérifiez votre dashboard Sentry.");
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


