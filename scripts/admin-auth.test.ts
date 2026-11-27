/**
 * Regresión de seguridad SEC-01 (security/audit/03-vulnerability-report.md).
 *
 * En el App Router, el layout no es una barrera de autorización: no se vuelve a
 * ejecutar en navegaciones del cliente y no impide que la página se renderice ni
 * que sus datos viajen en el RSC payload. Por eso cada página de `app/admin/`
 * tiene que verificar el rol docente por su cuenta, antes de leer datos.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ADMIN_DIR = join(process.cwd(), "app", "admin");

const pages = readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" })
  .filter((file) => /(^|[\\/])page\.tsx$/.test(file))
  .map((file) => join(ADMIN_DIR, file));

/** Primer acceso a datos o a la request dentro del componente de la página. */
const DATA_ACCESS = /\b(db\.|await\s+params\b|await\s+searchParams\b|fetch\()/;

test("app/admin has pages to check", () => {
  assert.ok(pages.length >= 5, `se esperaban páginas en ${ADMIN_DIR}`);
});

for (const file of pages) {
  const relative = file.slice(process.cwd().length + 1).replaceAll("\\", "/");

  test(`${relative} checks the teacher role before reading data`, () => {
    const source = readFileSync(file, "utf8");

    assert.match(
      source,
      /import\s*\{[^}]*\brequireTeacher\b[^}]*\}\s*from\s*["']@\/lib\/guards["']/,
      "debe importar requireTeacher desde @/lib/guards",
    );

    const start = source.search(/export\s+default\s+(async\s+)?function\b/);
    assert.ok(start >= 0, "no se encontró el componente exportado por defecto");
    const body = source.slice(start);

    const guard = body.search(/await\s+requireTeacher\(\)/);
    assert.ok(guard >= 0, "el componente de la página debe llamar a `await requireTeacher()`");

    const dataAccess = body.search(DATA_ACCESS);
    if (dataAccess >= 0) {
      assert.ok(
        guard < dataAccess,
        "`await requireTeacher()` tiene que ir antes del primer acceso a datos o parámetros",
      );
    }
  });
}
