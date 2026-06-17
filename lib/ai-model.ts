/** Default Claude model with vision support (June 2026) */
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

/** Resolve model at runtime; ignore invalid ANTHROPIC_MODEL env values */
export function getClaudeModel(): string {
  const env = process.env.ANTHROPIC_MODEL?.trim();

  if (!env) return DEFAULT_CLAUDE_MODEL;

  // Common misconfiguration: user put env var name instead of model id
  if (
    env.includes('API_KEY') ||
    env.includes('SECRET') ||
    !env.startsWith('claude-')
  ) {
    console.warn(`Invalid ANTHROPIC_MODEL="${env}", using ${DEFAULT_CLAUDE_MODEL}`);
    return DEFAULT_CLAUDE_MODEL;
  }

  return env;
}
