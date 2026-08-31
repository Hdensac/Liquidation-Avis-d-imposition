import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://431e8bb74354ad68be4d43bfedd97bf0@o4512000199426048.ingest.de.sentry.io/4512000214564944";

Sentry.init({
  dsn: DSN,
  enabled: true,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || "production",
});

