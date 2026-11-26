import { Badge } from "@/components/ui";

type Account = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export function UserList({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Todavía no hay usuarios registrados.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200">
      {accounts.map((account) => (
        <li
          key={account.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {account.name || account.email}
            </p>
            {account.name ? (
              <p className="truncate text-xs text-slate-500">{account.email}</p>
            ) : null}
          </div>
          <Badge tone={account.role === "teacher" ? "emerald" : "sky"}>
            {account.role === "teacher" ? "Docente" : "Alumno"}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
