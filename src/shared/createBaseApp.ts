import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { getAllowedOrigins } from '../config/http';

type CreateBaseAppOptions = {
  serviceName?: string;
  auditLogger?: (entry: {
    serviceName: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId?: number | null;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void> | void;
};

export const createBaseApp = (options: CreateBaseAppOptions = {}) => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const serviceName = options.serviceName || 'clients-service';

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  if (options.auditLogger) {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        void Promise.resolve(
          options.auditLogger?.({
            serviceName,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            userId: (req as any)?.session?.usuarioId ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
              baseUrl: req.baseUrl,
              route: req.route?.path,
            },
          })
        ).catch(error => {
          console.error('Erro ao registrar auditoria:', error);
        });
      });
      next();
    });
  }

  return app;
};
