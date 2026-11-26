import { auth } from "@/lib/auth/server";

/**
 * Proxy de Next.js 16 (antes "middleware").
 *
 * Neon Auth valida y refresca la cookie de sesión acá, antes de renderizar.
 * Sin este archivo, `auth.getSession()` intenta escribir la cookie desde un
 * Server Component y Next lanza "Cookies can only be modified in a Server
 * Action or Route Handler".
 *
 * - `/` es la pantalla de login y es pública.
 * - `/api/auth/*` y las vistas `/auth/*` (p. ej. reset-password) ya son
 *   públicas por defecto en Neon Auth.
 * - El resto requiere sesión; sin sesión se redirige a `/`.
 *   Las páginas y APIs igual verifican rol y permisos en el servidor.
 */
export default auth.middleware({
  loginUrl: "/",
  publicRoutes: ["/"],
});

export const config = {
  matcher: [
    // Todo excepto assets estáticos de Next y archivos con extensión (íconos, imágenes…).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
