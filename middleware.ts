import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // On récupère le token de session Supabase dans les cookies
  // Supabase stocke généralement la session sous un nom contenant "auth-token"
  const cookies = request.cookies;
  const hasSession = cookies.getAll().some(cookie => cookie.name.includes("auth-token"));

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboardRoute && !hasSession) {
    // Si l'utilisateur tente d'accéder au dashboard sans session, redirection vers /login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configurer les routes sur lesquelles le middleware doit s'exécuter
export const config = {
  matcher: ["/dashboard/:path*"],
};
