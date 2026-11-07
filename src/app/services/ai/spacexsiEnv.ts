const DEFAULT_SPACEXSI_MODEL = 'grok-4.20-0309-non-reasoning';

/** Prefer SPACEXSI_*; fall back to legacy XAI_* during transition. */
export function getSpacexsiApiKey(): string | undefined {
  return process.env.SPACEXSI_API_KEY ?? process.env.XAI_API_KEY;
}

export function getSpacexsiModel(): string {
  return (
    process.env.SPACEXSI_MODEL?.trim() ||
    process.env.XAI_MODEL?.trim() ||
    DEFAULT_SPACEXSI_MODEL
  );
}

export function hasSpacexsiApiKey(): boolean {
  return Boolean(getSpacexsiApiKey()?.trim());
}
