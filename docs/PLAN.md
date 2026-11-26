# Plan del proyecto · Aula Evalúa

Documento vivo. Describe **qué** se construyó en el MVP v0.1, **por qué** se tomaron
las decisiones y **qué** queda para las próximas versiones.

- **Versión:** MVP v0.1 (noviembre 2026)
- **Stack:** Next.js 16 · React 19 · Neon Auth · Neon Postgres · Drizzle ORM · Tailwind 4
- **Gestor de paquetes:** pnpm 11 (`packageManager` en `package.json`, lockfile commiteado)
- **Costo de infraestructura:** USD 0 (Vercel Hobby + Neon free; el AI Gateway opcional requiere créditos)

---

## 1. Objetivo y alcance

Formulario de examen en línea con:

| Requisito | Estado en v0.1 |
|---|---|
| Deploy en Vercel con recursos gratuitos | ✅ |
| Registro con email, contraseña y verificación | ✅ |
| Intentos configurables por examen (1 a 20) | ✅ candado en base de datos |
| Detección de cierre de pestaña / pérdida de foco | ✅ registro + aviso |
| Preguntas de múltiple opción con corrección automática | ✅ |
| Preguntas a desarrollar con corrección manual | ✅ |
| Panel de administración docente | ✅ |
| Lista blanca de correos por examen | ✅ |
| Examen sin límite de tiempo | ✅ vence al cierre del examen |
| Cantidad y tiempo fuera de foco | ✅ calculado en el servidor |
| Importar preguntas desde CSV o Excel | ✅ con vista previa y errores por fila |
| Mostrar la nota al finalizar | ✅ opcional por examen |
| Vista previa, monitor en vivo, duplicar y exportar CSV | ✅ |

**Fuera del alcance de v0.1** (ver §9): banco de preguntas reutilizable, notificaciones
por email, bloqueo real del navegador.

---

## 2. Decisiones y fundamentos

### 2.1 El límite de intentos se resuelve en la base, no en el navegador

Cada intento se **consume al comenzar**, con un `INSERT` protegido por dos índices
únicos parciales: el número de intento no se repite por alumno
(`exam_id, user_id, attempt_number`) y no puede haber dos intentos abiertos a la vez
(`exam_id, user_id` con `submitted_at IS NULL`). El tope (`max_attempts`, 1 a 20) se
controla antes de insertar.

Consecuencias (todas deseadas):

- Cerrar la pestaña no libera el intento.
- Abrir dos pestañas a la vez no crea dos intentos: una gana, la otra recibe 409.
- Borrar `localStorage` o cookies no cambia nada.
- El cronómetro vive en el servidor (`deadline_at`), no en el cliente.

### 2.2 El reloj no se pausa

Al iniciar se fija `deadline_at = min(inicio + duración, cierre global)`; si el examen
no tiene límite de tiempo, `deadline_at` es el cierre global. No hay
`setTimeout` de larga duración (imposible en serverless). La expiración es
**perezosa**: se evalúa en cada escritura y al abrir la página de resultados.

> En Vercel Hobby los cron corren como máximo **1 vez por día**, por eso no se usa cron
> para cerrar exámenes en tiempo real.

### 2.3 Autenticación

- **Neon Managed Better Auth** gestiona registro, verificación por código, inicio y
  cierre de sesión; la app usa `@neon/auth` con un proxy same-origin en Next.js.
- La recuperación de contraseña también usa los códigos OTP administrados por Neon.
- La cuenta local se crea solo después de comprobar una sesión con email verificado.
  Los IDs de Neon Auth se vinculan al perfil local por ese email.
- `role = 'teacher'` se deriva de `TEACHER_EMAILS` o de un rol docente ya guardado,
  por lo que la dirección debe estar verificada antes de acceder al panel.
- `requireUser` / `requireTeacher` resuelven el usuario contra la base en cada
  request, manteniendo las autorizaciones de exámenes existentes.
- Las columnas de autenticación de la versión anterior (`password_hash`,
  `google_sub`) se conservan sin uso para evitar una migración destructiva.

### 2.4 Lista blanca obligatoria

1. `exam_students` guarda los emails habilitados **por examen** (cargados antes de que
   el alumno tenga cuenta).
2. `/mis-examenes` muestra el email de la sesión en grande. Es la mitigación más barata
   del error más común ("no me aparece el examen" = dirección mal tipeada).

Sin fila en el roster: la cuenta existe, pero no hay examen visible ni acceso al
endpoint de inicio. El correo se compara de manera normalizada; la identidad debe
estar verificada por Neon Auth antes de asociarse al roster.

### 2.5 Foco y cierre de pestaña: alcance real

| Señal | Evento | Fiabilidad |
|---|---|---|
| Cambio de pestaña / minimizar | `visibilitychange` | Alta (funciona en móvil) |
| Cierre o navegación | `pagehide` + `navigator.sendBeacon` | Media-alta |
| Pérdida de foco de ventana | `blur` / `focus` | Alta, con falsos positivos |
| Copiar / pegar | `copy` / `paste` | Alta (solo registro) |
| Señal de vida | heartbeat cada 25 s | Alta |

Reglas implementadas:

- Se **registran todos** los eventos con hora del servidor (el reloj del cliente no es
  evidencia).
- Solo se cuenta **advertencia** si la ausencia de foco supera `warn_after_seconds`
  (por defecto 10 s). Así una notificación o un alt-tab accidental no ensucia la
  auditoría.
- Al llegar a `max_warnings` el banner del alumno pasa a rojo. **Nunca se anula el
  examen automáticamente.**

**Lo que esta app no puede hacer:** detectar un celular al lado, otra persona en la
habitación o una máquina virtual. La integridad real combina esto con supervisión
presencial, preguntas mezcladas por intento y defensa oral.

### 2.6 Mezclado determinístico

`buildStudentExam` mezcla preguntas y opciones usando un PRNG sembrado con el **id del
intento**. Resultado:

- Recargar la página no cambia el orden.
- Dos alumnos no ven lo mismo.
- Las opciones viajan **ya permutadas**, cada una con su índice original, así la
  corrección compara contra `correct_option` sin revelar nada ni "des-permutar".
- `correct_option` y `rubric` **nunca** se serializan al cliente.

### 2.7 Corrección

- Múltiple opción: automática, comparación exacta, sin puntaje parcial.
- Desarrollo: manual desde el panel; el puntaje se valida contra el máximo de la
  pregunta.
- `recalcAttempt` recalcula todo desde la base; el cliente jamás aporta puntajes.
- Estado: `in_progress → submitted → graded`. Solo pasa a `graded` cuando **todas** las
  preguntas abiertas tienen puntaje.
- Las notas se publican a mano (`results_published_at`). Sin publicar, el alumno ve
  "corrección pendiente" y no ve el detalle.

---

## 3. Arquitectura

```
Navegador (React 19 / Next 15 App Router)
   │
   ├── Server Components  ── leen Postgres vía Drizzle (solo servidor)
   ├── Client (ExamRunner) ── countdown, autosave, eventos de foco
   └── fetch / sendBeacon
          │
          ▼
   Route Handlers (runtime nodejs)
     POST /api/attempts/start          ← INSERT con unique constraint
     PATCH /api/attempts/:id/answers   ← autosave validado
     POST /api/attempts/:id/events     ← auditoría (hora del servidor)
     POST /api/attempts/:id/submit     ← finaliza y consolida nota
          │
          ▼
   Neon Postgres (free) + Drizzle ORM
```

Server Actions (panel docente): `app/admin/actions.ts`, todas validan `assertTeacher()`.

### Estructura

```
app/
  page.tsx                       landing + login de credenciales
  mis-examenes/                  lista del alumno (roster + estado)
  examen/[examId]/               condiciones + botón comenzar
  examen/attempt/[attemptId]/    ExamRunner (cliente)
  resultado/[attemptId]/         entrega, nota si está publicada
  admin/                         panel docente
    exams/new/                   alta de examen
    exams/[examId]/              configuración, preguntas, roster, intentos
    attempts/[attemptId]/        corrección + historial de eventos
  api/                           endpoints de intento
lib/
  auth.ts  guards.ts  config.ts  password.ts
  db/{schema.ts,index.ts,schema.sql}
  exam/{random,queries,scoring,attempts}.ts
components/ui.tsx                sistema de UI mínimo (sin dependencias extra)
```

---

## 4. Modelo de datos

| Tabla | Propósito | Claves |
|---|---|---|
| `users` | cuentas y hashes de contraseña | `email` único; `google_sub` legado y nullable |
| `exams` | examen y política | `slug` único |
| `questions` | preguntas y respuestas correctas | `exam_id` |
| `exam_students` | lista blanca por examen | PK `(exam_id, email)` |
| `attempts` | intento consumido, nota y métricas de foco | **UNIQUE `(exam_id, user_id, attempt_number)`** y un intento abierto por alumno |
| `answers` | respuestas y puntaje manual | UNIQUE `(attempt_id, question_id)` |
| `events` | auditoría de foco/cierre | índice `(attempt_id, at)` |

El DDL completo está en `lib/db/schema.sql` (se puede pegar en el SQL Editor de Neon).

---

## 5. Reglas de negocio implementadas

1. **Inicio**: sesión válida → email en roster → examen `open` → dentro de ventana →
   hay preguntas → `INSERT` (si choca: 409 con el id existente).
2. **Escritura**: dueño del intento, `in_progress`, dentro del deadline (+20 s de
   tolerancia de red), pregunta del examen, opción dentro de rango.
3. **Envío**: idempotente; `submitted_at` nunca posterior al deadline.
4. **Expiración**: al leer un intento vencido se finaliza con lo autoguardado.
5. **Edición de preguntas**: se permite con intentos existentes, pero **prohíbe borrar**
   preguntas que ya tienen respuestas (evita pérdida de datos por cascada).
6. **Rescate docente**: extender plazo y reiniciar intento, ambas acciones explícitas.

---

## 6. Seguridad · resumen

- `DATABASE_URL` y secretos solo en el servidor; nunca en componentes cliente.
- Toda ruta de intento verifica `attempt.user_id === session.user.id`.
- Todas las server actions del panel llaman a `assertTeacher()`.
- La hora de los eventos la pone el servidor.
- Las respuestas correctas no se envían antes de la entrega.
- `robots: noindex`; las sesiones y cookies se administran con Neon Auth.

**Privacidad (Ley 25.326):** se guardan nombre, email, IP y user-agent. Informarlo en la
pantalla de inicio (ya está) y definir una política de borrado (p. ej. 12 meses).

---

## 7. Puesta en marcha

Ver `README.md` para el paso a paso. Resumen:

1. `pnpm install`
2. Neon → `DATABASE_URL` → `pnpm db:push` (o pegar `lib/db/schema.sql`)
3. `.env.local` con `DATABASE_URL`, `NEON_AUTH_BASE_URL`,
   `NEON_AUTH_COOKIE_SECRET` y `TEACHER_EMAILS`
4. `pnpm dev`
5. Vercel: importar repo, configurar las mismas variables y registrar/verificar las
   cuentas docentes con una dirección incluida en `TEACHER_EMAILS`.

Las identidades y contraseñas de proveedores anteriores no se migran; los usuarios
deben registrarse y verificar el email de la cuenta que usarán en la plataforma.

---

## 8. Verificación (checklist manual)

- [ ] Login con cuenta que **no** está en el roster: no ve examen.
- [ ] Login con cuenta del roster: ve el examen y puede comenzar.
- [ ] Doble clic en "Comenzar": un solo intento (el segundo recibe 409).
- [ ] Comenzar, cerrar pestaña, volver: el cronómetro siguió corriendo.
- [ ] Cambiar de pestaña 15 s: aparece advertencia y queda el evento en `/admin`.
- [ ] Autosave: recargar conserva respuestas.
- [ ] Enviar: la nota de múltiple opción se calcula sola.
- [ ] Puntuar una respuesta abierta: la nota total se actualiza.
- [ ] Publicar notas: el alumno ve puntaje y detalle.
- [ ] Abrir el examen antes de `opens_at`: bloqueado por el servidor.

---

## 9. Roadmap

### Ya incorporado
- Exportación CSV de resultados, modo vista previa, monitor en vivo y duplicar examen.
- Intentos configurables, examen sin límite de tiempo y métricas de foco.
- Importar preguntas desde CSV/Excel y mostrar la nota al finalizar.

### v0.2 — operación real
- Exportación CSV del historial de eventos.
- Borrado/anonimización por antigüedad.

### v0.3 — calidad de examen
- Banco de preguntas reutilizable.
- Puntaje parcial y múltiple respuesta correcta.
- Estadísticas por pregunta (índice de dificultad).

### v0.4 — endurecimiento (opcional)
- Exigir pantalla completa al iniciar y registrar salidas.
- Ventana de gracia configurable para reconexión.
- Segundo factor de asistencia (código que dicta el docente en el aula).
- Migración a Cloudflare Pages + D1 si el uso deja de ser no comercial.

---

## 10. Riesgos conocidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Vercel Hobby es solo uso **no comercial** | Suspensión del deploy | Plan B: Cloudflare Pages + D1 (Drizzle ya abstrae el acceso) |
| Alumno usa otra cuenta de Gmail | Suplantación | Roster + control presencial de identidad al inicio |
| Dos alumnos comparten un Gmail | Un solo intento | El docente detecta duplicados en el roster |
| Falsos positivos de foco | Advertencias injustas | Umbral de 10 s + registro con duración, decisión humana |
| Edición de preguntas con intentos | Notas inconsistentes | Se recalcula automáticamente; no se pueden borrar preguntas respondidas |
| Neon free se suspende por inactividad | Primer request lento | Despierta en <1 s; aceptable |
| Reloj del cliente alterado | — | No afecta: el deadline es del servidor |
