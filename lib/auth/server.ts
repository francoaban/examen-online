import { createNeonAuth } from "@neon/auth/next/server";
import { createAuthServer, extractNeonAuthCookies } from "@neon/auth/server";
import { cookies, headers } from "next/headers";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) {
  throw new Error(
    "NEON_AUTH_BASE_URL no está definida. Verificá las variables de entorno en Vercel o en .env.local.",
  );
}

if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error(
    "NEON_AUTH_COOKIE_SECRET debe tener al menos 32 caracteres. " +
      "Generá uno con: node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64'))\"",
  );
}

/**
 * Elimina la barra final si la hay.
 * Error frecuente al copiar la URL desde Neon Console: termina en "/"
 * y Better Auth no resuelve correctamente las rutas internas.
 */
const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

/** Handler de `/api/auth/*` y proxy (`proxy.ts`): pueden escribir cookies. */
export const auth = createNeonAuth({
  baseUrl: cleanBaseUrl,
  cookies: { secret: cookieSecret },
});

/**
 * Lectura de sesión segura para Server Components.
 *
 * `auth.getSession()` consulta a Neon Auth cuando la cookie cacheada
 * (`session_data`) venció o es inválida, y si la respuesta trae `Set-Cookie`
 * (refresco o borrado de una sesión vieja) intenta escribirla. En un Server
 * Component Next.js no permite escribir cookies y lanza
 * "Cookies can only be modified in a Server Action or Route Handler".
 *
 * Esto pasa sobre todo en `/`, que es el `loginUrl` del proxy: Neon Auth no
 * procesa la sesión en la página de login, así que no la refresca antes.
 *
 * Mismo contexto que el adapter oficial de Next, pero la escritura de cookies
 * es "best effort": en Route Handlers y Server Actions se guardan; en Server
 * Components se ignoran (las persiste el proxy o la próxima llamada a
 * `/api/auth`). La sesión devuelta es la misma en ambos casos.
 */
export const sessionReader = createAuthServer({
  baseUrl: cleanBaseUrl,
  cookieSecret,
  context: async () => {
    const cookieStore = await cookies();
    const headerStore = await headers();
    return {
      getCookies: () => extractNeonAuthCookies(headerStore),
      setCookie: (name, value, options) => {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Server Component: no se pueden escribir cookies durante el render.
        }
      },
      getHeader: (name) => headerStore.get(name) ?? null,
      getOrigin: () =>
        headerStore.get("origin") ||
        headerStore.get("referer")?.split("/").slice(0, 3).join("/") ||
        "",
      getFramework: () => "nextjs",
    };
  },
});