import { Alert, Card, CardBody } from "@/components/ui";
import { SignOutForm } from "@/components/SignOutForm";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/guards";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });
  const mustChange = user.mustChangePassword;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          {mustChange ? "Elegí tu contraseña" : "Cambiar contraseña"}
        </h1>
        <p className="text-sm text-slate-600">
          {mustChange
            ? "Ingresaste con una contraseña temporal. Para continuar, reemplazala por una propia."
            : "Confirmá tu contraseña actual y elegí una nueva."}
        </p>
      </header>
      {mustChange ? (
        <Alert tone="amber" title="Cambio obligatorio">
          No vas a poder ver ni rendir exámenes hasta cambiar la contraseña que te
          dio tu docente.
        </Alert>
      ) : null}
      <Card>
        <CardBody>
          <ChangePasswordForm mustChange={mustChange} />
        </CardBody>
      </Card>
      {mustChange ? (
        <SignOutForm>
          <Button variant="ghost" type="submit">
            Cerrar sesión
          </Button>
        </SignOutForm>
      ) : null}
    </main>
  );
}
