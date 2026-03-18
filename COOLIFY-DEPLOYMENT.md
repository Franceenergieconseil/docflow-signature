# 🚀 Guide de Déploiement Coolify - DocFlow Signature

## 📋 Prérequis

- [x] GitHub repository à jour sur `main`
- [x] Compte Coolify configuré
- [x] Accès à votre instance DocuSeal
- [x] Nom de domaine configuré (optionnel)

---

## 🔧 Configuration Coolify

### 1. **Créer un nouveau projet**

1. Connectez-vous à **Coolify**
2. Cliquez sur **"New Resource"** → **"Dockerfile"**
3. Remplissez les informations :

| Champ                 | Valeur                                                          |
| --------------------- | --------------------------------------------------------------- |
| **Name**              | `docflow-signature`                                             |
| **Repository**        | `https://github.com/Franceenergieconseil/docflow-signature.git` |
| **Branch**            | `main`                                                          |
| **Dockerfile**        | `Dockerfile` (racine du projet)                                 |
| **Port**              | `3000`                                                          |
| **Health Check Path** | `/api/health`                                                   |

---

## 🔐 Variables d'Environnement (Secrets)

Dans l'onglet **Environment** de Coolify, ajoutez les variables suivantes :

### **🛡️ Sécurité** (OBLIGATOIRE)

```env
# Secret pour signer les tokens JWT (minimum 32 caractères)
JWT_SECRET=CHANGEZ_MOI_EN_PRODUCTION_secret_jwt_32_chars_min

# Secret pour valider les webhooks DocuSeal (minimum 32 caractères)
# ⚠️ À configurer AUSSI dans DocuSeal lors de la création du webhook
DOCUSEAL_WEBHOOK_SECRET=CHANGEZ_MOI_webhook_secret_32_chars_min
```

**🔑 Générer des secrets forts** :

```bash
# Dans un terminal Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### **🔗 Intégration DocuSeal** (OBLIGATOIRE)

```env
# Clé API DocuSeal (obtenue depuis Settings → API Keys)
DOCUSEAL_API_KEY=ds_votre_cle_api_docuseal_ici

# URL de votre instance DocuSeal (SANS /api à la fin)
DOCUSEAL_API_URL=https://docsign.f-energieconseil.fr
```

---

### **🌐 Application** (OBLIGATOIRE)

```env
# URL publique de votre application (pour les webhooks DocuSeal)
APP_URL=https://docflow.f-energieconseil.fr

# Environnement (toujours production sur Coolify)
NODE_ENV=production
```

---

### **💾 Base de Données** (PRÉ-CONFIGURÉ)

```env
# Chemin vers la base SQLite (déjà défini dans le Dockerfile)
DATABASE_PATH=/app/data/database.sqlite

# Port du serveur (déjà défini)
PORT=3000
```

> ℹ️ **Note** : Ces variables sont pré-configurées dans le Dockerfile, vous n'avez pas besoin de les ajouter dans Coolify.

---

### **🤖 IA Gemini** (OPTIONNEL)

```env
# Clé API Google Gemini (uniquement si vous utilisez les fonctionnalités d'IA)
GEMINI_API_KEY=AIzaS... (optionnel)
```

---

## 💾 **Configuration du Volume Persistant**

Dans l'onglet **Storage** de Coolify :

| Paramètre       | Valeur             |
| --------------- | ------------------ |
| **Name**        | `docflow-database` |
| **Source Path** | `/app/data`        |
| **Mount Path**  | `/app/data`        |
| **Type**        | Persistent Volume  |

✅ **Important** : Ce volume garantit que votre base SQLite (`database.sqlite`) ne sera pas effacée lors des redéploiements.

---

## 🌐 **Configuration du Webhook DocuSeal**

### **Sur DocuSeal** :

1. Allez dans **Settings** → **Webhooks** → **Add Webhook**
2. Remplissez :

| Champ           | Valeur                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **Webhook URL** | `https://docflow.f-energieconseil.fr/api/webhooks/docuseal`                                                |
| **Secret**      | _(Le même que `DOCUSEAL_WEBHOOK_SECRET` dans Coolify)_                                                     |
| **Events**      | ✅ `submission.completed`<br>✅ `submission.opened`<br>✅ `submission.declined`<br>✅ `submission.expired` |

3. Cliquez sur **Save**

---

## ✅ **Vérification Post-Déploiement**

### **1. Build Docker réussi**

Vérifiez les logs Coolify :

```
✓ 2088 modules transformed
✓ built in 15.14s
[production] Starting server...
Server running on http://0.0.0.0:3000
✅ Webhook DocuSeal activé sur https://docflow.f-energieconseil.fr/api/webhooks/docuseal
```

### **2. Application accessible**

Ouvrez votre navigateur :

- `https://docflow.f-energieconseil.fr` → Interface de connexion ✅
- `https://docflow.f-energieconseil.fr/api/health` → `{"status":"ok"}` ✅

### **3. Base de données initialisée**

Logs à vérifier :

```
✅ Database ready
✅ Running migrations...
```

### **4. Test du Webhook**

1. Envoyez un document de test depuis l'interface
2. Signez-le sur DocuSeal
3. Vérifiez dans les logs Coolify :

```
🔔 Webhook DocuSeal reçu: { "event_type": "submission.completed", ... }
✅ Signature validée avec succès
📋 Données des champs récupérées: { ... }
✅ Document 123 mis à jour avec succès (statut: signed)
```

---

## 🎯 **Récapitulatif des URLs**

| Service              | URL                                                       |
| -------------------- | --------------------------------------------------------- |
| **Application**      | https://docflow.f-energieconseil.fr                       |
| **Health Check**     | https://docflow.f-energieconseil.fr/api/health            |
| **Webhook DocuSeal** | https://docflow.f-energieconseil.fr/api/webhooks/docuseal |
| **DocuSeal**         | https://docsign.f-energieconseil.fr                       |

---

## 📞 **Support**

En cas de problème :

1. **Logs Coolify** : Vérifiez les logs du container
2. **Webhook test** : Utilisez la fonction "Test Webhook" de DocuSeal
3. **Database** : Le volume persistant est dans `/var/lib/docker/volumes/` sur votre serveur Coolify

---

## 🎉 **Votre application est prête pour la production !**

**Architecture déployée** :

- ✅ Backend Node.js/Express sur port:3000
- ✅ Frontend React/Vite servi depuis `dist/`
- ✅ Base SQLite persistante dans volume Docker
- ✅ Webhook sécurisé avec signature HMAC
- ✅ Multi-types de champs (checkbox, date, select, etc.)
- ✅ Système de filtrage avancé
- ✅ Rôles Admin/Commercial
