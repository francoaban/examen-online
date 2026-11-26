import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutForm } from "@/components/SignOutForm";
import { APP_NAME } from "@/lib/config";
import { requireUser } from "@/lib/guards";
import { Alert, Badge, Button, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUser();
  const isTeacher = user.role === "teacher";

  if (!isTeacher && user.role !== "student") redirect("/");

  const roleLabel = isTeacher ? "Docente" : "Alumno";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-2">
        <Badge tone="indigo">{APP_NAME}</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          ¡Bienvenido{user.name ? `, ${user.name}` : ""}!
        </h1>
      </header>

      <Card>
        <CardBody className="space-y-5">
          <Alert tone="emerald" title="Inicio de sesión verificado">
            Tu cuenta está autenticada y tiene el siguiente rol:
          </Alert>

          <div className="space-y-1">
            <Badge tone={isTeacher ? "emerald" : "sky"}>{roleLabel}</Badge>
            <p className="pt-2 text-sm text-slate-600">{user.email}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={isTeacher ? "/admin" : "/mis-examenes"}>
              <Button size="lg">
                {isTeacher ? "Ir al panel docente" : "Ver mis exámenes"}
              </Button>
            </Link>
            {isTeacher ? (
              <Link href="/mis-examenes">
                <Button size="lg" variant="secondary">
                  Vista alumno
                </Button>
              </Link>
            ) : null}
            <Link href="/cuenta/cambiar-clave">
              <Button size="lg" variant="secondary">
                Cambiar contraseña
              </Button>
            </Link>
            <SignOutForm>
              <Button size="lg" variant="ghost" type="submit">
                Cerrar sesión
              </Button>
            </SignOutForm>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
