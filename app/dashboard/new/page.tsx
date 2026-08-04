import NewLiquidationForm from "@/components/NewLiquidationForm";
import { createClient } from "@/utils/supabase/server";
import { canApplyExoneration, type UserRole } from "@/types/user";

export default async function NewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  return (
    <section>
      <NewLiquidationForm canApplyExoneration={canApplyExoneration(profile?.role as UserRole | null)} />
    </section>
  );
}
