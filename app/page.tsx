import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";

export default function Home() {
  Sentry.captureMessage("Sentry test event from homepage", "info");
  redirect("/dashboard");
}

