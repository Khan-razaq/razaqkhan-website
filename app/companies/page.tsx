import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompaniesClient from "./CompaniesClient";

export const metadata: Metadata = {
  title: "Companies",
  robots: { index: false },
};

export default async function CompaniesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/companies");
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  return <CompaniesClient companies={companies || []} />;
}
