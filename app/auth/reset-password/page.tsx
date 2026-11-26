import { Card, CardBody } from "@/components/ui";
import { PasswordResetForm } from "@/components/PasswordResetForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-slate-600">
          Te enviaremos un código para elegir una contraseña nueva.
        </p>
      </header>
      <Card>
        <CardBody>
          <PasswordResetForm />
        </CardBody>
      </Card>
    </main>
  );
}
