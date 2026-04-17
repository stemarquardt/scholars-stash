import express, { type Express } from "express";
import path from "path";
import passport from "passport";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { writeLimiter, aiLimiter } from "./lib/rate-limit";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(helmet({
  // CSP disabled here — the SPA's asset hashes and external image domains need
  // careful tuning. Add a proper CSP policy once the allowed origins are known.
  contentSecurityPolicy: false,
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ credentials: true, origin: allowedOrigin }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(authMiddleware);

// General API rate limit: 120 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

app.use("/api", generalLimiter);

app.use("/api", router);

// Serve the built frontend in production.
// STATIC_FILES_PATH is set by the Dockerfile; in dev, Vite handles this separately.
const staticPath = process.env.STATIC_FILES_PATH;
if (staticPath) {
  app.use(express.static(staticPath));
  // SPA fallback — let the React router handle all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

export default app;
