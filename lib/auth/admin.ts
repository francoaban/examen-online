import { sessionReader } from "./server";

/**
 * Plugin Admin de Neon Auth (Better Auth), con la sesión de la request actual.
 *
 * `@neon/auth` 0.8 expone estos endpoints en runtime (`admin/create-user`,
 * etc.), pero su tipo `NeonAuthServer` los declara como `unknown`. Este módulo
 * tipa solo lo que usa la app. Requiere que quien llama tenga rol `admin` en
 * Neon Auth; si no, Neon Auth responde 401/403.
 */

export type AdminApiError = { message?: string; status?: number; code?: string };
type AdminResult<T> = Promise<{ data: T | null; error: AdminApiError | null }>;

export type AdminAuthUser = { id: string; email: string; name?: string; role?: string };

type AdminApi = {
  createUser(body: {
    email: string;
    password: string;
    name: string;
    role?: string;
    data?: Record<string, unknown>;
  }): AdminResult<{ user: AdminAuthUser }>;
  listUsers(args: {
    query: {
      searchField?: "email" | "name";
      searchOperator?: "contains" | "starts_with" | "ends_with";
      searchValue?: string;
      limit?: number;
    };
  }): AdminResult<{ users: AdminAuthUser[]; total: number }>;
  setUserPassword(body: { userId: string; newPassword: string }): AdminResult<unknown>;
  revokeUserSessions(body: { userId: string }): AdminResult<unknown>;
};

export const authAdmin = sessionReader.admin as AdminApi;
