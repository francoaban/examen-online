/**
 * Verifica el Neon AI Gateway: lista los modelos de la branch y pide una
 * respuesta corta. No imprime secretos.
 *
 * Uso: pnpm ai:check [modelo]
 */
import { askModel, DEFAULT_MODEL, listGatewayModels } from "../lib/ai";

async function main() {
  const host = new URL(process.env.NEON_AI_GATEWAY_BASE_URL ?? "http://missing").host;
  console.log(`Gateway: ${host}\n`);

  const models = await listGatewayModels();
  const enabled = models.filter((m) => m.enabled);
  console.log(`Modelos en el catálogo: ${models.length} (habilitados: ${enabled.length})`);
  for (const m of models) {
    const state = m.enabled ? "✔" : `✘ ${m.unavailableReason ?? "no disponible"}`;
    console.log(`  ${m.id.padEnd(32)} ${m.ownedBy.padEnd(10)} ${state}`);
  }

  const requested = process.argv[2];
  const model =
    requested ??
    (enabled.find((m) => m.id === DEFAULT_MODEL) ?? enabled[0])?.id ??
    DEFAULT_MODEL;

  console.log(`\nPregunta a ${model}…`);
  try {
    const { text, usage } = await askModel(
      "En una sola oración y en español: ¿qué es Postgres?",
      model,
    );
    console.log(`Respuesta: ${text.trim()}`);
    console.log(`Tokens: entrada ${usage.inputTokens ?? "?"}, salida ${usage.outputTokens ?? "?"}`);
  } catch (error) {
    const e = error as { statusCode?: number; message?: string; responseBody?: string };
    console.log(`La llamada falló (${e.statusCode ?? "sin status"}): ${e.message}`);
    if (e.responseBody) console.log(`Detalle: ${e.responseBody.slice(0, 400)}`);
    process.exitCode = 1;
  }
}

void main();
