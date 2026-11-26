import { redirect } from "next/navigation";
import { APP_AUTHOR, APP_NAME } from "@/lib/config";
import { getSessionUser } from "@/lib/guards";
import { Badge, Card, CardBody } from "@/components/ui";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/bienvenida");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-3">
        <Badge tone="indigo">Plataforma de Evaluaciones Online</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="max-w-2xl text-slate-600">
          Plataforma de evaluaciones en línea. Creá una cuenta con tu email
          verificado. La cantidad de intentos y el tiempo de cada examen los
          define el docente.
        </p>
      </header>

      <Card>
        <CardBody className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Ingresá o creá una cuenta
            </h2>
            <p className="text-sm text-slate-600">
              Registrate con tu correo y verificá la dirección con el código que
              te enviaremos.
            </p>
          </div>
          <LoginForm />

          <p className="text-xs text-slate-500">
            El acceso a cada examen depende de la lista de alumnos habilitados.
            Durante el examen se guardan marcas de tiempo de foco/pestaña con
            fines de auditoría académica.
          </p>
        </CardBody>
      </Card>

      <footer className="text-xs text-slate-400">
        {APP_NAME} · MVP v0.1 · Desarrollado por {APP_AUTHOR} · Licencia MIT
      </footer>
    </main>
  );
}
