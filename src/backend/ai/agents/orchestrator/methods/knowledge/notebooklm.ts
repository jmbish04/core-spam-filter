import { consultNotebook } from "@/ai/tools/notebooklm";

export async function handleConsultNotebook(env: Env, query: string) {
  return consultNotebook(env, query);
}
