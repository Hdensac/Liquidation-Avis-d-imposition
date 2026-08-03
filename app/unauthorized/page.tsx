import { ShieldAlert, LogOut } from "lucide-react";
import { signOut } from "@/actions/authActions";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function UnauthorizedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Si l'utilisateur est connecté et possède un rôle, on le redirige vers le dashboard
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 text-center shadow-2xl relative z-10">
        <div className="mx-auto w-16 h-16 bg-red-950/40 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Accès Non Autorisé
        </h1>

        <p className="text-slate-300 text-sm leading-relaxed mb-8">
          Désolé, le système ne reconnaît pas votre rôle actuel. Votre compte a bien été créé, mais un administrateur doit vous attribuer un rôle (<code className="text-amber-400 font-mono text-xs">ADMIN</code> ou <code className="text-amber-400 font-mono text-xs">AGENT</code>) avant que vous ne puissiez accéder à la plateforme.
        </p>

        <div className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 mb-8 text-left">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Que devez-vous faire ?
          </h2>
          <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
            <li>Contactez votre administrateur système.</li>
            <li>Fournissez-lui l'adresse email de votre compte.</li>
            <li>Attendez l'attribution de votre rôle puis actualisez la page.</li>
          </ul>
        </div>

        <form action={signOut} className="w-full">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm py-3 px-4 rounded-xl transition duration-200 shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 relative z-10">
        Système d'Administration Fiscale d'État · République du Bénin
      </div>
    </div>
  );
}
