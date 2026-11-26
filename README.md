# Aula Evalúa · MVP v0.1

Plataforma de exámenes en línea: acceso con email y contraseña, lista blanca por examen,
**cantidad de intentos configurable** (1 a 20), duración con cronómetro del lado del servidor
**o sin límite de tiempo**, y registro auditable de la **cantidad y el tiempo** de las
salidas de pestaña / pérdidas de foco.

Stack: **Next.js 16 · React 19 · Neon Managed Auth · Neon Postgres · Drizzle ORM · Tailwind 4**.
Costo de infraestructura: **USD 0**.

El detalle de decisiones y el roadmap están en [`docs/PLAN.md`](docs/PLAN.md).
El panel docente permite exportar resultados CSV, monitorear intentos activos,
probar exámenes en vista previa y duplicar su configuración.

---

## Requisitos

- Node.js 26 LTS (fijado en `.nvmrc` y `engines`).
- **pnpm 11** (gestor del proyecto). Si no lo tenés:
  ```powershell
  corepack enable
  corepack prepare pnpm@11.10.0 --activate
  ```
  El campo `packageManager` de `package.json` fija la versión exacta.
- Cuenta gratuita en [Neon](https://neon.tech) (Postgres).
- Cuenta gratuita en [Vercel](https://vercel.com) para el deploy.

---

## 1. Configurar Neon

1. Creá un proyecto en una región AWS e iniciá sesión con Neon CLI:

   ```powershell
   npm install -g neon@latest
   neon init -y --project-id <project-id> --branch production --services postgres,auth
   neon deploy
   ```

   `neon deploy` habilita Managed Auth y agrega sus variables al archivo `.env`.
   Exigí verificación por código para los nuevos registros:

   ```powershell
   neon neon-auth config email-password update --enabled --require-email-verification --auto-sign-in-after-verification --send-verification-email-on-sign-up --email-verification-method otp
   ```

2. En **Connection Details** copiá la cadena **Pooled connection** (la que tiene
   `-pooler` en el host) como `DATABASE_URL`.
3. Creá las tablas de la aplicación. Dos opciones:

   - **Automática:** con `DATABASE_URL` ya cargada en `.env.local`, ejecutá
     `pnpm db:push`.
   - **Manual:** abrí el **SQL Editor** de Neon y pegá el contenido de
     `lib/db/schema.sql`.

---

## 2. Variables de entorno

`neon deploy` agrega `NEON_AUTH_BASE_URL` a `.env`. Completá ese archivo con las
variables siguientes. Si preferís `.env.local`, copiá allí también las variables
de Neon: Next.js le da prioridad sobre `.env`.

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Neon → cadena *pooled* |
| `NEON_AUTH_BASE_URL` | `neon deploy` / Neon Console → Better Auth |
| `NEON_AUTH_COOKIE_SECRET` | Generá uno con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |
| `TEACHER_EMAILS` | correos docentes, separados por coma |
| `ALLOW_UNVERIFIED_TEST_EMAILS` | opcional; solo permite `@example.test` sin verificar en `pnpm dev` |

---

## 3. Ejecutar y registrar la primera cuenta docente

```powershell
pnpm install
pnpm db:push        # crea las tablas (si no usaste el SQL Editor)
pnpm dev
```

Agregá el correo docente a `TEACHER_EMAILS`, abrí la app, creá la cuenta con ese
correo y verificá el código que se envía al buzón. Después del login se muestra la
bienvenida con el rol confirmado. Los alumnos también se registran por su cuenta;
para rendir un examen, el docente debe agregar su correo a la lista habilitada.
Desde **Panel docente → Cuentas** se consultan los usuarios que ya iniciaron sesión.

Si actualizás una instalación que usaba Google, `pnpm db:push` adapta el esquema.
Después de actualizar el código, aplicá las migraciones de `drizzle/` en orden
(Neon Console → SQL Editor, o `psql "$DATABASE_URL" -f drizzle/0001_intentos_y_foco.sql`).
Son idempotentes: se pueden volver a ejecutar sin riesgo.
Las contraseñas y sesiones de Auth.js no se migran a Neon Auth. Cada persona debe
crear una cuenta nueva y verificar su correo; los perfiles locales y sus roles se
vinculan al email verificado al iniciar sesión.

---

## 4. Primer examen (recorrido completo)

1. **Panel docente → Nuevo examen.** Definí título, fechas (hora Argentina), duración.
2. **Preguntas:** agregá múltiple opción (marcá la correcta con el radio verde) y/o
   preguntas a desarrollar (con rúbrica).
3. **Alumnos habilitados:** pegá la columna de emails desde Excel. Se validan y se
   avisa si hay direcciones mal formadas.
4. **Abrir examen.** Con estado *Abierto* y dentro de la ventana de fechas, los alumnos
   de la lista lo ven en *Mis exámenes*.
5. El alumno entra, lee las condiciones, comienza (queda consumido el intento) y rinde.
6. **Intentos:** desde la ficha del examen ves estado, salidas de foco y nota. Entrá a
   *Ver* para corregir las preguntas abiertas y revisar el historial de eventos.
7. **Publicar notas** cuando terminaste de corregir.

---

## 5. Deploy en Vercel

1. Subí el proyecto a un repositorio de GitHub (**incluí `pnpm-lock.yaml`**; no lo
   agregues a `.gitignore`).
2. En Vercel: **Add New → Project** → importá el repo. Al detectar `pnpm-lock.yaml`,
   Vercel instala con pnpm automáticamente; no hace falta tocar el *Install Command*.
3. **Environment Variables**: cargá `DATABASE_URL`, `NEON_AUTH_BASE_URL`,
   `NEON_AUTH_COOKIE_SECRET` y `TEACHER_EMAILS`.
   `TEACHER_EMAILS` es obligatoria: sin ella, la aplicación no reconocerá cuentas docentes.
4. Agregá el dominio de Vercel a los dominios permitidos de Neon Auth y desplegá.
5. Cada docente debe registrarse con un email incluido en `TEACHER_EMAILS` y
   verificarlo para acceder al panel.

> Si Vercel eligiera npm por un `package-lock.json` viejo, borralo del repo: tener los
> dos lockfiles hace que el gestor quede indefinido.

---

## 6. Cómo funciona el control de intentos

Cada examen define `max_attempts` (1 a 20). La base garantiza el límite con dos
índices únicos parciales:

```sql
-- Números de intento sin repetir por alumno.
UNIQUE INDEX attempts_exam_user_number_uq ON attempts (exam_id, user_id, attempt_number)
WHERE is_preview = false;
-- Como máximo un intento abierto a la vez.
UNIQUE INDEX attempts_exam_user_open_uq ON attempts (exam_id, user_id)
WHERE is_preview = false AND submitted_at IS NULL;
```

- `POST /api/attempts/start` retoma el intento abierto si lo hay; si ya se usaron
  todos, responde **409** con el id del último. Si no, inserta el intento
  `n + 1` con `onConflictDoNothing()` (dos pestañas a la vez no crean dos intentos).
- Las vistas previas docentes se marcan con `is_preview = true` y no consumen
  intentos ni se incluyen en estadísticas o exportaciones.
- Al alumno se le muestra la **mejor nota** entre sus intentos entregados; el docente
  ve y exporta todos.
- `deadline_at` se fija en ese mismo insert. Cerrar la pestaña no lo detiene.
- **Sin límite de tiempo** (`duration_minutes = NULL`): `deadline_at` es el cierre del
  examen. Si el docente mueve el cierre, los intentos abiertos lo acompañan.
- Las respuestas se autoguardan cada 700 ms (y al ocultar la pestaña).
- Al leer un intento vencido, el servidor lo cierra con lo que haya guardado.

## 7. Herramientas docentes

- **Monitor en vivo:** lista intentos de alumnos activos y actualiza cada 10 segundos.
- **Exportar CSV:** descarga estado, puntajes y salidas de foco; los campos se
  protegen contra fórmulas de hoja de cálculo.
- **Vista previa:** habilita probar preguntas en borrador, fuera de fecha o cerradas,
  sin afectar intentos ni estadísticas de alumnos.
- **Duplicar examen:** copia configuración, preguntas y roster en un nuevo examen
  en borrador; los intentos no se copian.

## 8. Pruebas

`pnpm test:unit` ejecuta pruebas sin conectarse a Neon. `pnpm smoke` sigue siendo
la prueba de integración y requiere `DATABASE_URL`.

---

## 7. Detección de foco y cierre

`app/examen/attempt/[attemptId]/ExamRunner.tsx` registra:

| Evento | Cuándo |
|---|---|
| `hidden` / `visible` | `visibilitychange` (incluye minimize y cambio de pestaña) |
| `blur` / `focus` | pérdida/recuperación de foco de la ventana |
| `pagehide` | cierre o navegación fuera (enviado con `sendBeacon`) |
| `copy` / `paste` | portapapeles (solo registro) |
| `heartbeat` | cada 25 s mientras el examen está abierto |

El servidor resume esos eventos en el intento (`lib/exam/focus.ts`), siempre con su
propia hora:

| Columna | Qué guarda |
|---|---|
| `focus_loss_count` | cantidad de salidas (pestaña oculta, ventana sin foco o cierre) |
| `focus_lost_ms` | tiempo total fuera del examen |
| `focus_warning_count` | salidas que duraron al menos `warn_after_seconds` |
| `focus_lost_since` | inicio de la salida en curso (`NULL` = está en el examen) |

`hidden` + `blur` del mismo cambio de pestaña cuentan como una sola salida. Si el
alumno cierra la pestaña, la salida se cierra al volver a entrar o al entregar.
Las advertencias cuentan solo si la ausencia supera `warn_after_seconds`. **El examen
nunca se anula automáticamente**: la decisión es del docente, con el historial a la
vista.

---

## 8. Scripts

Se invocan con `pnpm <script>` (sin `run`).

| Comando | Qué hace |
|---|---|
| `pnpm dev` | desarrollo en `localhost:3000` |
| `pnpm build` | build de producción |
| `pnpm typecheck` | chequeo de tipos |
| `pnpm db:push` | sincroniza el esquema con la base |
| `pnpm db:studio` | Drizzle Studio (explorador de datos) |
| `pnpm smoke` | 15 verificaciones de la lógica contra la base real (crea y borra datos de prueba) |

### Gestor de paquetes

El proyecto usa **pnpm 11** (fijado en `packageManager` dentro de `package.json`).

| Archivo | Rol |
|---|---|
| `pnpm-lock.yaml` | versiones exactas. **Se commitea** y es lo que hace que Vercel use pnpm |
| `pnpm-workspace.yaml` | `allowBuilds: esbuild` — habilita el script nativo que pnpm 11 bloquea por defecto |
| `.npmrc` | no fallar por peers opcionales y no exigir versión exacta de Node |

Si agregás una dependencia con binarios nativos (por ejemplo `sharp`), habilitá su build
con `pnpm approve-builds`.

---

## 9. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `DATABASE_URL no está definida` | falta `.env.local` o no reiniciaste `pnpm dev` |
| `DATABASE_URL` apunta a un host inesperado | una variable del entorno del proceso prevalece sobre `.env`; en PowerShell, quitá la heredada con `Remove-Item Env:DATABASE_URL` y reiniciá |
| Neon Auth no inicia | verificá `NEON_AUTH_BASE_URL` y `NEON_AUTH_COOKIE_SECRET` en `.env.local` y en Vercel |
| `ERR_PNPM_IGNORED_BUILDS` | los scripts nativos no están aprobados: `pnpm approve-builds --all` (ya queda fijado en `pnpm-workspace.yaml`) |
| `ERR_PNPM_OUTDATED_LOCKFILE` | corré `pnpm install` y commiteá el `pnpm-lock.yaml` actualizado |
| Vercel instala con npm | quedó un `package-lock.json` en el repo; borralo y volvé a desplegar |
| No puedo iniciar sesión | verificá el email y la contraseña; si la olvidaste, usá **¿Olvidaste tu contraseña?** para recibir un código |
| "Tu correo no está en la lista" | el email de la cuenta no coincide con el del roster (compará en `/mis-examenes`) |
| El examen no aparece | estado `draft`, fuera de la ventana de fechas, o no está en el roster |
| `prepared statement already exists` | estás usando el host sin `-pooler`; usá la cadena *pooled* |
| Las notas no se ven | falta **Publicar notas** en el panel |
| Cambié `TEACHER_EMAILS` y no toma efecto | reiniciá `pnpm dev` y volvé a iniciar sesión |

---

## 10. Límites del MVP (a propósito)

- Sin pantalla completa obligatoria.
- Sin bloqueo de copiar/pegar (solo se registra).
- Sin exportación CSV (v0.2).
- Sin modo preview del examen (v0.2).
- La corrección de desarrollo es manual, pregunta por pregunta.

Vercel Hobby es **solo para uso no comercial**. Si el instituto factura el servicio,
migrá a Cloudflare Pages + D1 (el acceso a datos ya está aislado en Drizzle).

---

## Autor y licencia

**Aula Evalúa** fue diseñado y desarrollado por **Franco Emanuel Aban Tejerina**.

Se distribuye bajo la [licencia MIT](LICENSE): podés usarlo, copiarlo, modificarlo y
redistribuirlo libremente, incluso con fines comerciales, **siempre que conserves el
aviso de copyright con el nombre del autor** en todas las copias o partes sustanciales
del software. Si lo usás en tu institución, se agradece mantener el crédito visible en
el pie de la aplicación.
