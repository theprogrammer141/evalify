import { UserManagement } from "@/components/admin/user-management";
import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth/authorization";
import { listAccounts } from "@/lib/auth/accounts";

export const instant = false;

export default async function AdminPage() {
  const user = await requirePageRole("ADMIN");
  const users = await listAccounts();

  return (
    <AppShell user={user}>
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Platform access
        </p>
        <h1 className="mt-3 font-heading text-4xl">People & roles</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Create authorized accounts and keep each person&apos;s access aligned
          with their role.
        </p>
      </div>
      <UserManagement initialUsers={users} currentUserId={user.id} />
    </AppShell>
  );
}
