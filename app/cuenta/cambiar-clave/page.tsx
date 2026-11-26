import { Card, CardBody } from "@/components/ui";
import { requireUser } from "@/lib/guards";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          Cambiar contraseña
        </h1>
        <p className="text-sm text-slate-600">
          Confirmá tu contraseña actual y elegí una nueva.
        </p>
      </header>
      <Card>
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </main>
  );
}
