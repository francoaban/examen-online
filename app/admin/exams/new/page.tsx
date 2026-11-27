import Link from "next/link";
import { requireTeacher } from "@/lib/guards";
import { toArgLocalInput } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { ExamForm } from "../ExamForm";
import type { ExamInput } from "../../types";

export const dynamic = "force-dynamic";

export default async function NewExamPage() {
  // El layout no alcanza como barrera: la página verifica el rol por su cuenta (SEC-01).
  await requireTeacher();
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const initial: ExamInput = {
    title: "",
    slug: "",
    description: "",
    opensAt: toArgLocalInput(now),
    closesAt: toArgLocalInput(inAWeek),
    durationMinutes: 60,
    maxAttempts: 1,
    shuffleQuestions: true,
    shuffleOptions: true,
    warnAfterSeconds: 10,
    maxWarnings: 3,
    showScoreOnSubmit: false,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
          ← Exámenes
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nuevo examen</h1>
        <p className="text-sm text-slate-500">
          El examen se crea como borrador. Después cargás preguntas y alumnos.
        </p>
      </div>

      <Card>
        <CardHeader title="Datos del examen" />
        <CardBody>
          <ExamForm initial={initial} mode="create" />
        </CardBody>
      </Card>
    </div>
  );
}
