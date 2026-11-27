import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/authorization";

export const instant = false;

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? roleHome(user.role) : "/sign-in");
}
