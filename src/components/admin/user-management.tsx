"use client";

import { useState, type FormEvent } from "react";
import type { UserRole } from "@/lib/db/schema";
import { roleSchema } from "@/lib/auth/validation";
import { useToast } from "@/components/feedback-provider";
import { Spinner } from "@/components/ui/spinner";

type Account = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date | string;
};

const roles: UserRole[] = ["ADMIN", "EXAMINER", "CANDIDATE"];

export function UserManagement({
  initialUsers,
  currentUserId,
}: {
  initialUsers: Account[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>(
    Object.fromEntries(initialUsers.map((user) => [user.id, user.role])),
  );
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const pending = creating || savingRole !== null;
  const toast = useToast();

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setCreating(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(
          result.error === "email_in_use"
            ? "An account already uses that email."
            : "Could not create the account.",
        );
        return;
      }

      setUsers((current) => [...current, result.user]);
      setSelectedRoles((current) => ({
        ...current,
        [result.user.id]: result.user.role,
      }));
      form.reset();
      setNotice("");
      toast("Account created.");
    } catch {
      setNotice("Unable to create the account right now.");
    } finally {
      setCreating(false);
    }
  }

  async function saveRole(userId: string) {
    setNotice("");
    setSavingRole(userId);
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRoles[userId] }),
      });
      const result = await response.json();

      if (!response.ok) {
        const messages: Record<string, string> = {
          last_admin: "The last administrator must remain an administrator.",
          self_demotion: "You cannot remove your own administrator access.",
        };
        setNotice(messages[result.error] ?? "Could not update the role.");
        return;
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, role: result.user.role } : user,
        ),
      );
      setNotice("");
      toast("Role updated.");
    } catch {
      setNotice("Unable to update the role right now.");
    } finally {
      setSavingRole(null);
    }
  }

  return (
    <div className="space-y-12">
      {notice && (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {notice}
        </p>
      )}
      <section className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Account management
          </p>
          <h2 className="mt-2 font-heading text-2xl">Create an account</h2>
        </div>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={createUser}
        >
          <label className="space-y-2 text-sm font-medium">
            <span>Email address</span>
            <input
              autoComplete="off"
              className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Temporary password (at least 12 characters)</span>
            <input
              autoComplete="new-password"
              className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Role</span>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              defaultValue="CANDIDATE"
              name="role"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              className="h-11 w-full rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {creating ? <Spinner label="Creating account" /> : "Create account"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Access directory
            </p>
            <h2 className="mt-2 font-heading text-2xl">User accounts</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? "account" : "accounts"}
          </span>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {users.map((user) => (
            <div
              className="grid gap-4 py-5 sm:grid-cols-[1fr_auto_auto]"
              key={user.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Added{" "}
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(user.createdAt))}
                </p>
              </div>
              <label className="sr-only" htmlFor={`role-${user.id}`}>
                Role for {user.email}
              </label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                id={`role-${user.id}`}
                onChange={(event) => {
                  const role = roleSchema.safeParse(event.target.value);
                  if (role.success) {
                    setSelectedRoles((current) => ({
                      ...current,
                      [user.id]: role.data,
                    }));
                  }
                }}
                value={selectedRoles[user.id]}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                className="h-10 rounded-md border border-border px-4 text-xs font-semibold uppercase tracking-wider transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  pending ||
                  user.id === currentUserId ||
                  selectedRoles[user.id] === user.role
                }
                onClick={() => saveRole(user.id)}
                type="button"
              >
                {savingRole === user.id ? <Spinner label="Saving role" /> : "Save role"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
