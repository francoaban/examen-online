import { asc } from "drizzle-orm";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireTeacher } from "@/lib/guards";
import { CreateStudentsForm } from "./CreateStudentsForm";
import { UserList } from "./UserList";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requireTeacher();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .orderBy(asc(users.email));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Cuentas</h1>
        <p className="text-sm text-slate-500">
          Los alumnos pueden registrarse solos (con verificación de correo) o podés
          habilitarlos vos con una contraseña temporal.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Habilitar alumnos"
          description="Crea las cuentas con el correo ya verificado y una contraseña temporal que el alumno debe cambiar en su primer ingreso. Para que rindan un examen, agregá sus correos a la lista de alumnos del examen."
        />
        <CardBody>
          <CreateStudentsForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Usuarios" />
        <CardBody>
          <UserList accounts={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
