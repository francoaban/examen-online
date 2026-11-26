import { neon } from "@neon/ai-sdk-provider";
import { generateText } from "ai";

/**
 * Llamadas a modelos a través del Neon AI Gateway.
 *
 * `@neon/ai-sdk-provider` lee NEON_AI_GATEWAY_BASE_URL y NEON_AI_GATEWAY_TOKEN
 * del entorno (los escribe `neon deploy` en .env; en Vercel hay que cargarlos
 * como variables de entorno). Solo usar en el servidor: el token es secreto.
 */

export const DEFAULT_MODEL = "claude-haiku-4-5";

export type GatewayModel = {
  id: string;
  name: string;
  ownedBy: string;
  enabled: boolean;
  unavailableReason: string | null;
};

function gatewayConfig() {
  const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  if (!baseUrl || !token)
    throw new Error(
      "Faltan NEON_AI_GATEWAY_BASE_URL / NEON_AI_GATEWAY_TOKEN. Ejecutá `neon deploy` o `neon env pull`.",
    );
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

/** Catálogo de modelos que sirve la branch (endpoint unificado /v1/models). */
export async function listGatewayModels(): Promise<GatewayModel[]> {
  const { baseUrl, token } = gatewayConfig();
  const res = await fetch(`${baseUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AI Gateway /v1/models respondió ${res.status}`);
  const body = (await res.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      owned_by?: string;
      enabled?: boolean;
      unavailable_reason?: string;
    }>;
  };
  return (body.data ?? []).map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    ownedBy: m.owned_by ?? "",
    enabled: m.enabled !== false,
    unavailableReason: m.unavailable_reason ?? null,
  }));
}

/** Una respuesta corta de texto, sin streaming. */
export async function askModel(prompt: string, model: string = DEFAULT_MODEL) {
  gatewayConfig();
  const { text, usage } = await generateText({
    model: neon(model),
    prompt,
    maxOutputTokens: 200,
  });
  return { text, usage };
}
