import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/dal";

/** Entrada única: cada usuario va al panel que le corresponde según su rol. */
export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "admin" ? "/dashboard" : "/cobrador");
}
