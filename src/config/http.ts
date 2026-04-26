export const getAllowedOrigins = (): string[] => {
  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5181',
    'http://localhost:5182',
    'http://localhost:5183',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];
};

export const resolvePort = (envName: string, fallback: number): number => {
  const raw = process.env[envName];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};
