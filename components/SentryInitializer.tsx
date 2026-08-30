"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryInitializer() {
  useEffect(() => {
    try {
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn: "https://431e8bb74354ad68be4d43bfedd97bf0@o4512000199426048.ingest.de.sentry.io/4512000214564944",
          enabled: true,
          tracesSampleRate: 1.0,
          environment: process.env.NODE_ENV || "production",
        });
      }
    } catch (e) {
      console.error("Failed to initialize Sentry on client:", e);
    }
  }, []);

  return null;
}
