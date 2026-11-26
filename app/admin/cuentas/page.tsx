import { asc } from "drizzle-orm";
import { Alert, Card, CardBody } from "@/components/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireTeacher } from "@/lib/guards";
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
    })
    .from(users)
    .orderBy(asc(users.email));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Cuentas</h1>
        <p className="text-sm text-slate-500">
          Usuarios que ya verificaron su correo e iniciaron sesión.
        </p>
      </header>

      <Alert tone="sky" title="Registro con verificación">
        Cada persona crea su propia cuenta y verifica su correo. Para habilitarla
        en un examen, agregá esa dirección a la lista de alumnos.
      </Alert>

      <Card>
        <CardBody>
          <UserList accounts={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
