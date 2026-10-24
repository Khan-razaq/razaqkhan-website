import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddCompany from "./AddCompany";

export const metadata: Metadata = {
  title: "Save company",
  robots: { index: false },
};

// Where the phone share sheet, the iPhone shortcut and the bookmark send a
// link: /companies/add?url=…&title=…&text=…
export default async function AddCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 2000) ?? null;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const query = new URLSearchParams();
    for (const key of ["url", "title", "text", "close"]) {
      const v = get(key);
      if (v) query.set(key, v);
    }
    redirect(`/login?next=${encodeURIComponent(`/companies/add?${query}`)}`);
  }

  return <AddCompany url={get("url")} title={get("title")} text={get("text")} closeWhenDone={get("close") === "1"} />;
}
