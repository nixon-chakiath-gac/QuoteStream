export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { resumeReading } = await import('./lib/server/flow');
  resumeReading().catch(() => undefined);
}
