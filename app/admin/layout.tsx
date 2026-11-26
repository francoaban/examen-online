import Link from "next/link";
import { requireTeacher } from "@/lib/guards";
import { SignOutForm } from "@/components/SignOutForm";
import { APP_AUTHOR, APP_NAME } from "@/lib/config";
import { Badge, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireTeacher();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-semibold text-slate-900">
              Panel docente
            </Link>
            <Badge tone="emerald">Docente</Badge>
            <Link
              href="/admin/cuentas"
              className="text-sm text-slate-600 hover:text-indigo-700"
            >
              Cuentas
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline">
              {user.email}
            </span>
            <Link href="/mis-examenes">
              <Button size="sm" variant="ghost">
                Vista alumno
              </Button>
            </Link>
            <SignOutForm>
              <Button size="sm" variant="secondary" type="submit">
                Salir
              </Button>
            </SignOutForm>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-8">{children}</main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-xs text-slate-400">
        {APP_NAME} · MVP v0.1 · Desarrollado por {APP_AUTHOR} · Licencia MIT
      </footer>
    </div>
  );
}
