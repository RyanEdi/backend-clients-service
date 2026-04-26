declare module 'express-session' {
  interface SessionData {
    usuarioId?: number;
    isAdmin?: boolean;
  }
}
