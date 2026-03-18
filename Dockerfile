# ===================================
# Stage 1: Installer les dépendances
# ===================================
FROM node:20-alpine AS installer

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer TOUTES les dépendances (dev + prod) pour le build
RUN npm ci

# ===================================
# Stage 2: Build (Frontend + Backend)
# ===================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les node_modules depuis installer
COPY --from=installer /app/node_modules ./node_modules

# Copier tout le code source
COPY . .

# Build du frontend React/Vite
RUN npm run build

# ===================================
# Stage 3: Runner (Production)
# ===================================
FROM node:20-alpine AS runner

# Installer les dépendances système pour SQLite
RUN apk add --no-cache sqlite-libs

WORKDIR /app

# Copier uniquement package*.json
COPY package*.json ./

# Installer uniquement les dépendances de production et rebuild better-sqlite3
RUN npm ci --omit=dev && \
    npm rebuild better-sqlite3

# Copier le code backend
COPY server.ts ./
COPY db.ts ./
COPY migrate.ts ./
COPY api ./api
COPY tsconfig.json ./

# Copier le frontend buildé depuis builder
COPY --from=builder /app/dist ./dist

# Créer le répertoire pour la base de données persistante
RUN mkdir -p /app/data && \
    chmod 755 /app/data

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/database.sqlite
ENV PORT=3000

# Exposer le port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Démarrer l'application
CMD ["npm", "run", "start"]
