# ✅ Checklist de Déploiement DocFlow sur Coolify

## 📋 Configuration Validée

### ✅ 1. Dépendances (package.json)
- [x] `tsx` déplacé dans `dependencies` (nécessaire en production)
- [x] Script `start`: `tsx server.ts`
- [x] Script `build`: `vite build` (frontend uniquement)
- [x] Script `dev`: `tsx server.ts` (développement)

**Extrait package.json** :
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "start": "tsx server.ts",
    "build": "vite build"
  },
  "dependencies": {
    "tsx": "^4.21.0",
    // ... autres dépendances
  }
}
```

### ✅ 2. Dockerfile (Multi-stage optimisé)
- [x] **Stage 1** : Build frontend React/Vite
- [x] **Stage 2** : Installation dépendances backend + rebuild better-sqlite3
- [x] **Stage 3** : Image production Alpine Linux
- [x] Création automatique du répertoire `/app/data`
- [x] Healthcheck sur `/api/health`
- [x] CMD : `npm run start`

**Dernière ligne Dockerfile** :
```dockerfile
CMD ["npm", "run", "start"]
```

### ✅ 3. Base de Données SQLite (db.ts)
- [x] Variable d'environnement `DATABASE_PATH` prise en compte
- [x] Chemin par défaut : `/app/data/database.sqlite` (dans le volume Docker)
- [x] Création automatique du répertoire parent avec `fs.mkdirSync()`
- [x] Fallback local pour développement : `./database.sqlite`

**Code db.ts (lignes 10-19)** :
```typescript
const dbFile = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'database.sqlite');

const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`✓ Created database directory: ${dbDir}`);
}
```

### ✅ 4. Sécurité (.gitignore)
- [x] `node_modules/` exclu
- [x] `dist/` exclu (build artifacts)
- [x] `.env*` exclu (sauf `.env.example`)
- [x] `database.sqlite` et `*.db` exclus
- [x] `*.log` exclu

**Contenu .gitignore** :
```
node_modules/
build/
dist/
coverage/
.DS_Store
*.log
.env*
!.env.example

# Database
database.sqlite
*.db
*.sqlite
```

### ✅ 5. Volume Persistant (docker-compose.yml)
- [x] Volume nommé `docflow_db` configuré
- [x] Montage sur `/app/data` dans le conteneur
- [x] Healthcheck configuré
- [x] Restart policy : `unless-stopped`

**Extrait docker-compose.yml** :
```yaml
volumes:
  - docflow_db:/app/data

volumes:
  docflow_db:
    name: docflow_db
    driver: local
```

## 🚀 Instructions de Déploiement Coolify

### Étape 1 : Pousser sur GitHub
```bash
git add .
git commit -m "Production-ready Docker configuration with tsx"
git push origin main
```

### Étape 2 : Configuration Coolify

1. **Créer une nouvelle application**
   - Source : GitHub Repository
   - Coolify détectera automatiquement le `Dockerfile`

2. **Variables d'environnement** (à configurer dans Coolify) :
   ```env
   NODE_ENV=production
   DATABASE_PATH=/app/data/database.sqlite
   PORT=3000
   JWT_SECRET=YOUR_SUPER_SECRET_KEY_HERE
   DOCUSEAL_API_KEY=your_docuseal_api_key
   DOCUSEAL_BASE_URL=https://api.docuseal.co
   ```

3. **Volume persistant** :
   - Nom : `docflow_db`
   - Point de montage : `/app/data`

4. **Port exposé** : `3000`

5. **Lancer le déploiement** 🚀

### Étape 3 : Vérification Post-Déploiement

```bash
# Vérifier le healthcheck
curl https://your-app.coolify.io/api/health
# Devrait retourner : {"status":"ok"}

# Vérifier les logs
# Dans Coolify : Onglet "Logs"

# Se connecter à l'application
# Email : admin@example.com
# Mot de passe : admin123
# ⚠️ CHANGEZ IMMÉDIATEMENT LE MOT DE PASSE !
```

## 📊 Architecture Finale

```
┌─────────────────────────────────────┐
│       Coolify - GitHub Deploy       │
└─────────────────┬───────────────────┘
                  │
           ┌──────▼──────┐
           │  Dockerfile │
           │  Multi-stage│
           └──────┬──────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
┌─────▼─────┐ ┌──▼───┐ ┌─────▼──────┐
│  Frontend │ │ Node │ │   Backend  │
│   Build   │ │ Deps │ │ TypeScript │
│   Vite    │ │      │ │   (tsx)    │
└───────────┘ └──────┘ └────────────┘
      │           │           │
      └───────────┼───────────┘
                  │
          ┌───────▼────────┐
          │ Production     │
          │ Alpine Linux   │
          │ + tsx runtime  │
          └───────┬────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
┌─────▼─────┐ ┌──▼──────┐ ┌──▼─────┐
│   dist/   │ │ Express │ │ Volume │
│  (React)  │ │ Server  │ │ SQLite │
└───────────┘ └─────────┘ └────────┘
                  │            │
                  │      /app/data/
                  │   database.sqlite
                  │
              Port 3000
```

## ⚡ Optimisations Appliquées

1. **Multi-stage build** : Réduit la taille de l'image finale
2. **Alpine Linux** : Image de base légère (~5MB)
3. **tsx runtime** : Exécution TypeScript directe (pas de compilation nécessaire)
4. **Volume persistant** : Données SQLite sécurisées entre redémarrages
5. **Healthcheck** : Monitoring automatique de l'application
6. **Production dependencies** : Seules les dépendances nécessaires sont installées

## 🐛 Troubleshooting

### Erreur : "tsx: command not found"
✅ **Solution** : `tsx` est maintenant dans `dependencies`, pas dans `devDependencies`

### Erreur : "ENOENT: no such file or directory /app/data"
✅ **Solution** : `db.ts` crée automatiquement le répertoire avec `fs.mkdirSync()`

### Base de données vide après redémarrage
✅ **Solution** : Vérifiez que le volume `docflow_db` est monté sur `/app/data` dans Coolify

### Healthcheck échoue
✅ **Solution** : Vérifiez que le endpoint `/api/health` est accessible (défini dans `server.ts`)

## 📝 Fichiers du Projet

- ✅ `Dockerfile` - Configuration multi-stage
- ✅ `docker-compose.yml` - Orchestration locale + volume
- ✅ `.dockerignore` - Optimisation du build
- ✅ `.env.example` - Template des variables d'environnement
- ✅ `.gitignore` - Sécurité (exclusion fichiers sensibles)
- ✅ `package.json` - Scripts et dépendances
- ✅ `db.ts` - Gestion base de données avec `DATABASE_PATH`
- ✅ `README-DOCKER.md` - Documentation complète
- ✅ `DEPLOYMENT-CHECKLIST.md` - Ce fichier

## 🎯 Validation Finale

Avant de déployer, vérifiez :

- [ ] Code pushé sur GitHub (branche main)
- [ ] Variables d'environnement configurées dans Coolify
- [ ] Volume persistant créé (`docflow_db` → `/app/data`)
- [ ] Port `3000` exposé
- [ ] JWT_SECRET changé (ne pas utiliser la valeur par défaut !)

---

✨ **Votre application DocFlow est prête pour la production !**

🚀 **Déploiement recommandé** : Coolify via GitHub avec build automatique

📚 **Documentation complète** : Voir `README-DOCKER.md`
