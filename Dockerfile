# ===================================
# Stage 1: Build Frontend (React/Vite)
# ===================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# IMPORTANT: Installer TOUTES les dépendances (y compris devDependencies) pour le build
# On force l'installation des devDependencies même si NODE_ENV=production
RUN npm ci --include=dev

# Copier le code source frontend
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./

# Build du frontend avec Vite
RUN npm run build

# ===================================
# Stage 2: Prepare Backend
# ===================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer uniquement les dépendances de production + better-sqlite3 rebuild
RUN npm ci --only=production && \
    npm rebuild better-sqlite3

# ===================================
# Stage 3: Production Image
# ===================================
FROM node:20-alpine AS production

# Installer les dépendances système nécessaires pour better-sqlite3
RUN apk add --no-cache sqlite-libs

WORKDIR /app

# Copier les node_modules depuis backend-builder
COPY --from=backend-builder /app/node_modules ./node_modules

# Copier le code backend
COPY server.ts ./
COPY db.ts ./
COPY migrate.ts ./
COPY api ./api
COPY tsconfig.json ./

# Copier le frontend buildé depuis frontend-builder
COPY --from=frontend-builder /app/dist ./dist

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

# Démarrer l'application avec le script npm start
CMD ["npm", "run", "start"]
