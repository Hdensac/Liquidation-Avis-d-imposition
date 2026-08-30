"use client";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";

export default function Home() {
  return (
    <div style={{ padding: 32 }}>
      <button
        onClick={() => {
          Sentry.captureMessage("Test Sentry depuis le projet", "info");
        }}
        style={{
          padding: "12px 20px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        Tester Sentry
      </button>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => redirect("/dashboard")}
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Accéder au dashboard
        </button>
      </div>
    </div>
  );
}

