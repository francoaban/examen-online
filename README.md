# Aula Evalúa · MVP v0.1

Plataforma de exámenes en línea con acceso por email y contraseña, lista de alumnos
habilitados por examen, **cantidad de intentos configurable** (1 a 20), **tiempo límite
opcional** controlado por el servidor y registro auditable de **cuántas veces y cuánto
tiempo** el alumno salió de la pestaña del examen.

Stack: **Next.js 16 · React 19 · Neon Postgres · Neon Auth · Drizzle ORM · Tailwind 4**.
La infraestructura base funciona en los planes gratuitos de Neon y Vercel.

El detalle de decisiones y el roadmap está en [`docs/PLAN.md`](docs/PLAN.md).

---

## Funcionalidades

**Para el docente**

- Exámenes con fechas de apertura y cierre (hora Argentina), duración en minutos
  **o sin límite de tiempo**, y de 1 a 20 intentos por alumno.
- Preguntas de múltiple opción (corrección automática) y a desarrollar (con rúbrica,
  corrección manual).
- **Importación de preguntas desde CSV o Excel** (`.csv` / `.xlsx`), con vista previa y
  errores por fila. Plantilla: [`public/plantillas/preguntas-ejemplo.csv`](public/plantillas/preguntas-ejemplo.csv).
- Lista de alumnos habilitados por email.
- **Monitor en vivo** de los intentos activos (se actualiza cada 10 segundos), con el
  estado de foco de cada alumno.
- Vista previa del examen, duplicado de exámenes y prórroga de tiempo por intento.
- Exportación de resultados a CSV: intento, puntajes, salidas de foco y tiempo fuera.
- Publicación de notas, u opción de **mostrar la nota al finalizar** el examen.

**Para el alumno**

- *Mis exámenes*: exámenes disponibles, intentos usados y mejor nota.
- Autoguardado de respuestas; si se cierra la pestaña, el intento se retoma donde quedó.
- Aviso de cada salida de foco durante el examen.

---

## Requisitos

- **Node.js 26 LTS** (fijado en `.nvmrc` y en `engines`).
- **pnpm 11**. Si no lo tenés:
  ```powershell
  corepack enable
  corepack prepare pnpm@11.10.0 --activate
  ```
  El campo `packageManager` de `package.json` fija la versión exacta.
- Cuenta en [Neon](https://neon.tech) (Postgres y Auth) y en [Vercel](https://vercel.com)
  (deploy). Ambas tienen plan gratuito.

---

## 1. Configurar Neon

Los servicios se declaran en [`neon.ts`](neon.ts) (Auth y AI Gateway). Con el proyecto
creado en Neon, en una región de AWS:

```powershell
npm install -g neon@latest
neon init -y --project-id <project-id> --branch production --services postgres,auth
neon deploy
```

`neon deploy` habilita los servicios en la branch y escribe en `.env` las variables
`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL` y, si está declarado,
las del AI Gateway.

Exigí verificación por código para los registros nuevos:

```powershell
neon neon-auth config email-password update --enabled --require-email-verification --auto-sign-in-after-verification --send-verification-email-on-sign-up --email-verification-method otp
```

Para desarrollo local, permití conexiones desde `localhost`:

```powershell
neon neon-auth domain allow-localhost enable
```

---

## 2. Variables de entorno

Copiá [`.env.example`](.env.example) a `.env` y completá lo que `neon deploy` no escribe.
Next.js también lee `.env.local`, que tiene prioridad sobre `.env`.

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | `neon deploy` (cadena *pooled*, host con `-pooler`) |
| `DATABASE_URL_UNPOOLED` | `neon deploy` (conexión directa, para migraciones) |
| `NEON_AUTH_BASE_URL` | `neon deploy` |
| `NEON_AUTH_COOKIE_SECRET` | generalo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |
| `TEACHER_EMAILS` | correos con rol docente, separados por coma |
| `ALLOW_UNVERIFIED_TEST_EMAILS` | opcional: permite cuentas `@example.test` sin verificar, solo en `pnpm dev` |
| `NEON_AI_GATEWAY_BASE_URL` / `NEON_AI_GATEWAY_TOKEN` | opcionales: `neon deploy`, para [`lib/ai.ts`](lib/ai.ts) |

---

## 3. Base de datos

En una base nueva, creá las tablas con una de estas opciones:

- **Automática:** `pnpm db:push`.
- **Manual:** pegá [`lib/db/schema.sql`](lib/db/schema.sql) en el **SQL Editor** de Neon.

Si actualizás una base existente, aplicá en orden las migraciones de
[`drizzle/`](drizzle/) desde el SQL Editor o con
`psql "$DATABASE_URL" -f drizzle/<archivo>.sql`:

| Migración | Qué agrega |
|---|---|
| `0001_intentos_y_foco.sql` | intentos configurables, examen sin límite de tiempo y métricas de foco |
| `0002_nota_al_finalizar.sql` | opción de mostrar la nota al finalizar |

Todas son idempotentes: se pueden volver a ejecutar sin riesgo.

---

## 4. Ejecutar y crear la primera cuenta docente

```powershell
pnpm install
pnpm dev
```

1. Agregá tu correo a `TEACHER_EMAILS`.
2. Abrí `http://localhost:3000`, creá la cuenta con ese correo y verificá el código
   que llega por email.
3. Después de iniciar sesión, la bienvenida muestra el rol docente y el acceso al panel.

Los alumnos se registran por su cuenta. Para rendir un examen, su correo tiene que estar
en la lista de habilitados de ese examen. En **Panel docente → Cuentas** se ven los
usuarios que ya iniciaron sesión.

---

## 5. Primer examen (recorrido completo)

1. **Panel docente → Nuevo examen.** Definí título, fechas, duración (o *Sin límite de
   tiempo*), intentos permitidos y si la nota se muestra al finalizar.
2. **Preguntas.** Cargalas a mano o importá un CSV/Excel. En múltiple opción, marcá la
   correcta; en las preguntas a desarrollar, escribí la rúbrica. Tocá **Guardar preguntas**.
3. **Alumnos habilitados.** Pegá la columna de emails desde Excel; se avisa si hay
   direcciones mal formadas.
4. **Abrir examen.** Con estado *Abierto* y dentro de las fechas, los alumnos de la lista
   lo ven en *Mis exámenes*.
5. El alumno lee las condiciones y comienza. El intento cuenta desde ese momento.
6. **Intentos.** En la ficha del examen ves estado, salidas de foco y nota de cada
   intento. Con *Ver* corregís las preguntas a desarrollar y revisás el historial.
7. **Publicar notas** cuando termines de corregir. Recién ahí el alumno ve el detalle
   con las respuestas correctas.

---

## 6. Deploy en Vercel

1. Subí el proyecto a GitHub, **incluido `pnpm-lock.yaml`**: con ese archivo Vercel
   instala con pnpm automáticamente.
2. En Vercel: **Add New → Project** e importá el repositorio.
3. En **Settings → Environment Variables** cargá `DATABASE_URL`, `NEON_AUTH_BASE_URL`,
   `NEON_AUTH_COOKIE_SECRET` y `TEACHER_EMAILS` (y las del AI Gateway si las usás).
   Sin `TEACHER_EMAILS` nadie tiene permisos docentes.
4. Agregá el dominio de Vercel a los dominios de confianza de Neon Auth:
   ```powershell
   neon neon-auth domain add https://<tu-dominio>.vercel.app
   ```
5. Desplegá. Cada docente se registra con un correo de `TEACHER_EMAILS` y lo verifica.

---

## 7. Cómo funciona el control de intentos

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

- `POST /api/attempts/start` retoma el intento abierto si lo hay. Si ya se usaron
  todos, responde **409** con el id del último; si no, inserta el intento `n + 1` con
  `onConflictDoNothing()`, así dos pestañas a la vez no crean dos intentos.
- Las vistas previas docentes (`is_preview = true`) no consumen intentos ni aparecen en
  estadísticas o exportaciones.
- El alumno ve la **mejor nota** entre sus intentos entregados; el docente ve y exporta
  todos.
- `deadline_at` se fija al iniciar el intento; cerrar la pestaña no lo detiene.
- **Sin límite de tiempo** (`duration_minutes = NULL`): `deadline_at` es el cierre del
  examen, y si el docente mueve el cierre, los intentos abiertos lo acompañan.
- Las respuestas se autoguardan a los 700 ms de cada cambio y al ocultar la pestaña.
- Si un intento venció, el servidor lo cierra con lo guardado la próxima vez que se lee.

---

## 8. Detección de foco

[`ExamRunner.tsx`](app/examen/attempt/[attemptId]/ExamRunner.tsx) registra estos eventos:

| Evento | Cuándo |
|---|---|
| `hidden` / `visible` | `visibilitychange` (cambio de pestaña o ventana minimizada) |
| `blur` / `focus` | la ventana pierde o recupera el foco |
| `pagehide` | cierre o navegación fuera (se envía con `sendBeacon`) |
| `copy` / `paste` | uso del portapapeles (solo se registra) |
| `heartbeat` | cada 25 s mientras el examen está abierto |

El servidor los resume en el intento ([`lib/exam/focus.ts`](lib/exam/focus.ts)), siempre
con su propia hora:

| Columna | Qué guarda |
|---|---|
| `focus_loss_count` | cantidad de salidas (pestaña oculta, ventana sin foco o cierre) |
| `focus_lost_ms` | tiempo total fuera del examen |
| `focus_warning_count` | salidas que duraron al menos `warn_after_seconds` |
| `focus_lost_since` | inicio de la salida en curso (`NULL` = está en el examen) |

`hidden` y `blur` del mismo cambio de pestaña cuentan como una sola salida. Si el alumno
cierra la pestaña, la salida termina cuando vuelve a entrar o al entregar.
**El examen nunca se anula automáticamente**: la decisión es del docente, con el
historial a la vista.

---

## 9. Autenticación

- [`lib/auth/server.ts`](lib/auth/server.ts) expone `auth` (handler de `/api/auth/*` y
  proxy) y `sessionReader`, que lee la sesión desde Server Components sin intentar
  escribir cookies durante el render.
- [`proxy.ts`](proxy.ts) (el antiguo *middleware* de Next.js) valida y refresca la sesión
  antes de cada página. `/` (login) y las rutas de Neon Auth son públicas; el resto
  redirige a `/` si no hay sesión.
- El rol docente se decide en el servidor en cada request según `TEACHER_EMAILS`.

---

## 10. Scripts

Se ejecutan con `pnpm <script>`.

| Comando | Qué hace |
|---|---|
| `pnpm dev` | servidor de desarrollo en `localhost:3000` |
| `pnpm build` / `pnpm start` | build y servidor de producción |
| `pnpm typecheck` | chequeo de tipos |
| `pnpm test:unit` | pruebas unitarias, sin conexión a la base |
| `pnpm smoke` | prueba de integración contra la base real (crea y borra datos de prueba) |
| `pnpm db:push` | sincroniza el esquema de Drizzle con la base |
| `pnpm db:generate` | genera migraciones de Drizzle |
| `pnpm db:studio` | Drizzle Studio (explorador de datos) |
| `pnpm ai:check [modelo]` | lista los modelos del AI Gateway y pide una respuesta de prueba |

### Gestor de paquetes

| Archivo | Rol |
|---|---|
| `pnpm-lock.yaml` | versiones exactas; **se commitea** y hace que Vercel use pnpm |
| `pnpm-workspace.yaml` | `allowBuilds: esbuild`: habilita el script nativo que pnpm 11 bloquea por defecto |
| `.npmrc` | no fallar por dependencias *peer* opcionales ni exigir la versión exacta de Node |

Si agregás una dependencia con binarios nativos (por ejemplo `sharp`), habilitá su build
con `pnpm approve-builds`.

---

## 11. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `DATABASE_URL no está definida` | falta `.env` o no reiniciaste `pnpm dev` |
| `database "…" does not exist` | la base cambió de nombre: corré `neon env pull` (o `neon deploy`) para actualizar `.env` |
| `DATABASE_URL` apunta a un host inesperado | una variable del entorno del sistema prevalece sobre `.env`; en PowerShell: `Remove-Item Env:DATABASE_URL` y reiniciá |
| `column "…" does not exist` | falta aplicar una migración de `drizzle/` (ver sección 3) |
| `Cookies can only be modified in a Server Action or Route Handler` | falta `proxy.ts` o una lectura de sesión no usa `sessionReader` |
| Error en `/_global-error` al hacer `pnpm build` | hay `NODE_ENV=development` en las variables del sistema; quitala o usá `NODE_ENV=production pnpm build` |
| Neon Auth responde 404 o `user_not_found` | Auth no está habilitado en la branch: `neon deploy`, y verificá `NEON_AUTH_BASE_URL` |
| No puedo iniciar sesión en producción | falta el dominio de Vercel en Neon Auth (sección 6, paso 4) |
| `ERR_PNPM_IGNORED_BUILDS` | aprobá los scripts nativos con `pnpm approve-builds --all` |
| `ERR_PNPM_OUTDATED_LOCKFILE` | corré `pnpm install` y commiteá el `pnpm-lock.yaml` actualizado |
| Vercel instala con npm | quedó un `package-lock.json` en el repo; borralo y volvé a desplegar |
| "Tu correo no está en la lista" | el email de la cuenta no coincide con el de la lista de habilitados |
| El examen no aparece | está en borrador, fuera de fechas, o el alumno no está en la lista |
| `prepared statement already exists` | usá la cadena *pooled* (host con `-pooler`) |
| El alumno no ve su nota | publicá las notas, o activá *Mostrar la nota al finalizar* |
| Cambié `TEACHER_EMAILS` y no toma efecto | reiniciá `pnpm dev` y volvé a iniciar sesión |
| El AI Gateway responde 403 `paid_plan_required` | la cuenta de Neon no tiene créditos de AI Gateway (Billing) |

---

## 12. Límites del MVP

- Sin pantalla completa obligatoria.
- Sin bloqueo de copiar/pegar (solo se registra).
- La corrección de las preguntas a desarrollar es manual, pregunta por pregunta.

Vercel Hobby es **solo para uso no comercial**. Si el instituto cobra por el servicio,
pasá a un plan pago de Vercel o a otro proveedor (el acceso a datos está aislado en
Drizzle).

---

## Autor y licencia

**Aula Evalúa** fue diseñado y desarrollado por **Franco Emanuel Aban Tejerina**.

Se distribuye bajo la [licencia MIT](LICENSE): podés usarlo, copiarlo, modificarlo y
redistribuirlo libremente, incluso con fines comerciales, **siempre que conserves el
aviso de copyright con el nombre del autor** en todas las copias o partes sustanciales
del software. Si lo usás en tu institución, se agradece mantener el crédito visible en
el pie de la aplicación.
