import 'dotenv/config';
import express, { Router } from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting server.ts...');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Ensure the database and migrations are applied before starting the server
import './migrate.ts';
import db from "./db.ts";
import authRouter from "./api/auth.ts";
import clientsRouter from "./api/clients.ts";
import templatesRouter from "./api/templates.ts";
import documentsRouter from "./api/documents.ts";
import docusealSyncRouter from "./api/docuseal_sync.ts";
import webhooksRouter from "./api/webhooks.ts";
import usersRouter from "./api/users.ts";
import adminRouter from "./api/admin.ts";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // API Router
  const apiRouter = Router();
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/users", usersRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/clients", clientsRouter);
  apiRouter.use("/templates", templatesRouter);
  apiRouter.use("/documents", documentsRouter);
  apiRouter.use("/docuseal", docusealSyncRouter);
  apiRouter.use("/webhooks", webhooksRouter);

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Catch-all for unmatched API routes
  apiRouter.all("*", (req, res) => {
    console.log(`404 API Route: ${req.method} ${req.url}`);
    res.status(404).json({
      message: `API route ${req.method} ${req.url} not found`,
      suggestion: "Check if the route is correctly defined in the API router."
    });
  });

  // API Error Handler
  apiRouter.use((err: any, req: any, res: any, next: any) => {
    console.error('API Router Error:', err);
    res.status(err.status || 500).json({
      message: "Internal Server Error in API",
      error: err.message,
      path: req.url
    });
  });

  app.use("/api", apiRouter);

  const distPath = path.resolve(process.cwd(), 'dist');

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Avoid HMR port conflicts when restarting the dev server quickly.
        hmr: { port: Number(process.env.VITE_HMR_PORT) || 24679 },
      },
      appType: "spa",
      root: path.resolve(__dirname),
    });

    app.use(vite.middlewares);

    // Force return of the React app for all non-API GET requests (helps when Vite middleware is not returning index)
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();

      try {
        const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, indexHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(distPath));

    // Fallback route for React Router in production
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          console.error('Failed to send index.html:', err);
          res.status(404).send('Not found');
        }
      });
    });
  }

  // Global error handler for non-API routes
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server Error:', err);
    if (req.url.startsWith('/api/')) {
      return res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
    res.status(500).send(`<html><body><h1>Internal Server Error</h1><pre>${err.message}</pre></body></html>`);
  });

  const start = (port: number) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);
        start(port + 1);
        return;
      }
      console.error("Server failed to start:", err);
      process.exit(1);
    });
  };

  start(PORT);
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
