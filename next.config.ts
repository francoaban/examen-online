import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /**
   * Evita que Next infiera la raíz del monorepo por lockfiles ajenos
   * (hay un pnpm-lock.yaml en C:\Users\franc).
   */
  outputFileTracingRoot: process.cwd(),

  /**
   * `postgres` usa sockets TCP nativos de Node y no puede empaquetarse
   * en el bundle de Edge ni en el bundle estándar de Webpack.
   * Declararlo acá le dice a Next que lo deje como dependencia externa
   * y lo resuelva en runtime desde node_modules, evitando errores del tipo:
   *   "Module not found: Can't resolve 'net'"
   *   "Module not found: Can't resolve 'tls'"
   */
  serverExternalPackages: ["postgres"],
};

export default nextConfig;