# Déploiement DocFlow sur Coolify

Ce guide vous aide à déployer DocFlow sur Coolify via GitHub.

## 📋 Prérequis

- Un compte GitHub avec votre repository DocFlow
- Un serveur Coolify configuré
- Les variables d'environnement nécessaires (voir `.env.example`)

## 🐳 Architecture Docker

L'application utilise un **Dockerfile multi-stage** optimisé :

1. **Stage 1 (frontend-builder)** : Build du frontend React/Vite
2. **Stage 2 (backend-builder)** : Installation des dépendances backend
3. **Stage 3 (production)** : Image finale légère avec Alpine Linux

## 📦 Volume Persistant

Le fichier `docker-compose.yml` configure un **volume nommé `docflow_db`** pour persister la base de données SQLite :

```yaml
volumes:
  docflow_db:
    name: docflow_db
    driver: local
```

La base de données est stockée dans `/app/data/database.sqlite` à l'intérieur du conteneur.

## 🚀 Déploiement sur Coolify

### Option 1 : Via GitHub (Recommandé)

1. **Poussez votre code sur GitHub** :
   ```bash
   git add .
   git commit -m "Add Docker configuration for Coolify"
   git push origin main
   ```

2. **Dans Coolify** :
   - Cliquez sur "New Resource" > "Application"
   - Sélectionnez votre repository GitHub
   - Coolify détectera automatiquement le `Dockerfile`
   - Configurez le port : `3000`

3. **Configurez les variables d'environnement** dans Coolify :
   ```
   NODE_ENV=production
   DATABASE_PATH=/app/data/database.sqlite
   PORT=3000
   JWT_SECRET=<votre_secret_jwt>
   DOCUSEAL_API_KEY=<votre_clé_api>
   DOCUSEAL_BASE_URL=https://api.docuseal.co
   ```

4. **Configurez le volume persistant** :
   - Dans les paramètres de votre application Coolify
   - Ajoutez un volume : `/app/data` → Volume persistant

5. **Déployez** : Coolify build et déploie automatiquement !

### Option 2 : Déploiement Docker local

Pour tester en local avant de déployer :

```bash
# Build l'image
docker build -t docflow:latest .

# Lancer avec docker-compose
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

L'application sera accessible sur `http://localhost:3000`

## 🔧 Configuration de la Base de Données

Le fichier `db.ts` a été modifié pour :

1. Lire la variable d'environnement `DATABASE_PATH`
2. Utiliser `/app/data/database.sqlite` par défaut si non définie
3. Créer automatiquement le répertoire parent si nécessaire

```typescript
const dbFile = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'database.sqlite');
```

## 🏥 Health Check

Un endpoint `/api/health` est disponible pour vérifier l'état de l'application :

```bash
curl http://localhost:3000/api/health
# Réponse : {"status":"ok"}
```

Le healthcheck Docker vérifie automatiquement cet endpoint toutes les 30 secondes.

## 📝 Fichiers Créés/Modifiés

### Nouveaux fichiers :
- `Dockerfile` - Configuration multi-stage optimisée
- `docker-compose.yml` - Orchestration avec volume persistant
- `.dockerignore` - Optimisation du contexte de build
- `.env.example` - Template des variables d'environnement
- `README-DOCKER.md` - Ce fichier

### Fichiers modifiés :
- `db.ts` - Support de `DATABASE_PATH` avec création automatique du répertoire

## 🔒 Sécurité

**Important** : Ne commitez jamais vos vraies valeurs de `.env` ! 

- Ajoutez `.env` dans `.gitignore` (déjà fait)
- Configurez toutes les variables sensibles directement dans Coolify
- Changez le `JWT_SECRET` en production

## 📊 Monitoring

Coolify fournit automatiquement :
- Logs en temps réel
- Métriques de ressources (CPU, RAM)
- État du healthcheck
- Redémarrage automatique en cas de crash

## 🐛 Troubleshooting

### Le conteneur ne démarre pas
```bash
# Vérifier les logs
docker logs docflow-app

# Vérifier que le répertoire data existe
docker exec docflow-app ls -la /app/data
```

### La base de données est vide après redémarrage
- Vérifiez que le volume `docflow_db` est bien configuré dans Coolify
- Le volume doit être monté sur `/app/data`

### Erreur de connexion à DocuSeal
- Vérifiez que `DOCUSEAL_API_KEY` et `DOCUSEAL_BASE_URL` sont correctement configurés
- Testez l'API DocuSeal depuis le conteneur :
  ```bash
  docker exec docflow-app curl -H "Authorization: Bearer $DOCUSEAL_API_KEY" $DOCUSEAL_BASE_URL
  ```

## 🎯 Next Steps

Après le déploiement :

1. Accédez à votre application via l'URL fournie par Coolify
2. Connectez-vous avec le compte admin par défaut :
   - Email : `admin@example.com`
   - Mot de passe : `admin123`
3. **Changez immédiatement le mot de passe admin** !
4. Configurez vos templates et commencez à utiliser DocFlow

## 📚 Ressources

- [Documentation Coolify](https://coolify.io/docs)
- [Docker Documentation](https://docs.docker.com/)
- [DocuSeal API](https://docs.docuseal.co/)

---

✨ Votre application DocFlow est maintenant prête pour la production !
