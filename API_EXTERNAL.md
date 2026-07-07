# DocFlow — API Externe : Intégration ACD

Documentation technique pour connecter un système externe (CRM, ERP, script...) à DocFlow et déclencher automatiquement l'envoi du document **ACD** pour signature électronique.

---

## Informations de connexion

| Paramètre | Valeur |
|-----------|--------|
| **Base URL** | `https://docflow.f-energieconseil.fr` |
| **Méthode d'auth** | Header HTTP `X-API-Key` |
| **Clé API** | Voir fichier `.env` → variable `EXTERNAL_API_KEY` |
| **Format** | JSON (`Content-Type: application/json`) |

---

## Authentification

Chaque requête doit inclure le header :

```
X-API-Key: c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732
```

> **Sécurité** : Cette clé ne doit jamais être exposée côté client (navigateur). Elle doit uniquement être utilisée dans du code serveur ou des scripts backend.

---

## Routes disponibles

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/external/send-acd` | Envoie le document ACD à un client pour signature |
| `GET` | `/api/external/document-status/:id` | Consulte le statut d'un document envoyé |
| `GET` | `/api/external/health` | Vérifie que l'API est opérationnelle |

---

## 1. Envoyer un ACD

### `POST /api/external/send-acd`

Crée ou retrouve le client en base, puis envoie l'ACD via DocuSeal. L'email de signature est envoyé automatiquement au client.

**Headers :**
```
Content-Type: application/json
X-API-Key: <votre_clé>
```

**Corps de la requête (JSON) :**

```json
{
  "prenom":        "Jean",
  "nom":           "Dupont",
  "email":         "jean.dupont@exemple.fr",
  "raison_sociale": "Dupont Énergie SAS",
  "siret":         "12345678900012",
  "adresse":       "12 rue des Lilas, 75001 Paris",
  "fonction":      "Gérant",
  
  "PDL-1": "22516914714270",
  "PDL-2": "",
  "PDL-3": "",
  "PDL-4": "",
  "PDL-5": "",
  
  "PCE-1": "GI123456",
  "PCE-2": "",
  "PCE-3": "",
  "PCE-4": "",
  "PCE-5": ""
}
```

### Description des champs

#### Champs client (obligatoires)

| Champ | Type | Obligatoire | Description |
|-------|------|:-----------:|-------------|
| `prenom` | string | **oui** | Prénom du signataire |
| `nom` | string | **oui** | Nom du signataire |
| `email` | string | **oui** | Email où sera envoyé le lien DocuSeal |
| `raison_sociale` | string | **oui** | Raison sociale de l'entreprise |
| `siret` | string | **oui** | SIRET (14 chiffres sans espaces) |
| `adresse` | string | non | Adresse complète de l'entreprise |
| `fonction` | string | non | Fonction du signataire (ex: Gérant, DG) |

#### Champs ACD dynamiques (tous optionnels)

Le template ACD accepte jusqu'à **5 PDL** (Points de Livraison Électricité) et **5 PCE** (Points de Comptage et d'Estimation Gaz). Envoyez uniquement les compteurs existants, laissez vide `""` pour les autres.

| Champ | Type | Description |
|-------|------|-------------|
| `PDL-1` | string | Numéro PDL électricité n°1 (14 chiffres) |
| `PDL-2` | string | Numéro PDL électricité n°2 |
| `PDL-3` | string | Numéro PDL électricité n°3 |
| `PDL-4` | string | Numéro PDL électricité n°4 |
| `PDL-5` | string | Numéro PDL électricité n°5 |
| `PCE-1` | string | Numéro PCE gaz n°1 (GI...) |
| `PCE-2` | string | Numéro PCE gaz n°2 |
| `PCE-3` | string | Numéro PCE gaz n°3 |
| `PCE-4` | string | Numéro PCE gaz n°4 |
| `PCE-5` | string | Numéro PCE gaz n°5 |

> **Alias acceptés :** Vous pouvez aussi utiliser `pdl` (→ PDL-1) et `pce` (→ PCE-1) si vous n'avez qu'un seul compteur.

#### Champs remplis automatiquement (ne pas envoyer)

Ces champs du document sont remplis automatiquement par le signataire dans DocuSeal :
- **Ville** — saisi par le signataire
- **Date** — date du jour automatique
- **Signature** — signature électronique du signataire

---

### Réponse succès — `200 OK`

```json
{
  "success": true,
  "message": "ACD envoyé avec succès à jean.dupont@exemple.fr",
  "document_id": 42,
  "docuseal_submission_id": 1089,
  "docuseal_url": "https://docsign.f-energieconseil.fr/s/XXXXXXXXXX",
  "client_id": 17,
  "status": "sent"
}
```

| Champ | Description |
|-------|-------------|
| `document_id` | **À stocker** — ID interne DocFlow pour les requêtes de suivi |
| `docuseal_submission_id` | ID DocuSeal de la soumission |
| `docuseal_url` | Lien direct vers le document à signer (peut être intégré dans un email personnalisé ou une interface) |
| `client_id` | ID client en BDD DocFlow (créé ou retrouvé) |
| `status` | Statut initial : toujours `"sent"` |

---

### Réponses d'erreur

| Code HTTP | Cause | Exemple de réponse |
|-----------|-------|-------------------|
| `401` | Clé API absente ou invalide | `{ "success": false, "error": "Unauthorized" }` |
| `400` | Champ obligatoire manquant | `{ "success": false, "error": "Champs obligatoires manquants", "missing_fields": ["email"] }` |
| `400` | Format email invalide | `{ "success": false, "error": "Format email invalide" }` |
| `404` | Template ACD non configuré | `{ "success": false, "error": "Template ACD introuvable" }` |
| `500` | Erreur DocuSeal ou serveur | `{ "success": false, "error": "Erreur interne du serveur", "details": "..." }` |
| `503` | `EXTERNAL_API_KEY` non définie | `{ "success": false, "error": "Service non configuré" }` |

---

## 2. Consulter le statut d'un document

### `GET /api/external/document-status/:id`

Retourne l'état actuel d'un document ACD envoyé. Utilisez le `document_id` retourné par `/send-acd`.

**Exemple :**
```
GET /api/external/document-status/42
X-API-Key: <votre_clé>
```

**Réponse `200 OK` :**
```json
{
  "success": true,
  "document_id": 42,
  "status": "signed",
  "docuseal_submission_id": 1089,
  "sent_at": "2026-07-07T10:00:00.000Z",
  "updated_at": "2026-07-07T11:23:00.000Z",
  "expires_at": null,
  "template": "ACD",
  "docuseal_submission_url": "https://docsign.f-energieconseil.fr/submissions/1089",
  "client": {
    "prenom": "Jean",
    "nom": "Dupont",
    "email": "jean.dupont@exemple.fr",
    "entreprise": "Dupont Énergie SAS",
    "siret": "12345678900012"
  },
  "dynamic_data": {
    "PDL-1": "22516914714270",
    "PCE-1": "GI123456"
  }
}
```

### Valeurs possibles de `status`

| Valeur | Signification |
|--------|---------------|
| `sent` | Email envoyé, en attente d'ouverture |
| `opened` | Document ouvert par le signataire |
| `signed` | **Document signé** — process terminé |
| `declined` | Refusé par le signataire |
| `expired` | Délai de signature dépassé |

> **Note :** Le statut est mis à jour automatiquement par le webhook DocuSeal configuré sur DocFlow. Vous n'avez pas besoin de configurer quoi que ce soit côté CRM pour la mise à jour du statut.

---

## 3. Vérification de l'API

### `GET /api/external/health`

Vérifie que l'API est opérationnelle et que le template ACD est bien configuré.

```
GET /api/external/health
X-API-Key: <votre_clé>
```

**Réponse :**
```json
{
  "success": true,
  "status": "ok",
  "acd_template": { "id": 12, "name": "ACD" },
  "acd_configured": true,
  "timestamp": "2026-07-07T10:00:00.000Z"
}
```

---

## Exemples complets

### cURL

```bash
# Envoyer un ACD (1 PDL + 1 PCE)
curl -X POST https://docflow.f-energieconseil.fr/api/external/send-acd \
  -H "Content-Type: application/json" \
  -H "X-API-Key: c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732" \
  -d '{
    "prenom": "Jean",
    "nom": "Dupont",
    "email": "jean.dupont@exemple.fr",
    "raison_sociale": "Dupont Énergie SAS",
    "siret": "12345678900012",
    "adresse": "12 rue des Lilas, 75001 Paris",
    "fonction": "Gérant",
    "PDL-1": "22516914714270",
    "PCE-1": "GI123456"
  }'

# Consulter le statut (document_id=42 retourné par l'envoi)
curl -X GET https://docflow.f-energieconseil.fr/api/external/document-status/42 \
  -H "X-API-Key: c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732"

# Vérifier que l'API fonctionne
curl -X GET https://docflow.f-energieconseil.fr/api/external/health \
  -H "X-API-Key: c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732"
```

### PHP

```php
<?php
$apiKey  = 'c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732';
$baseUrl = 'https://docflow.f-energieconseil.fr';

// Envoyer un ACD
$payload = [
    'prenom'         => 'Jean',
    'nom'            => 'Dupont',
    'email'          => 'jean.dupont@exemple.fr',
    'raison_sociale' => 'Dupont Énergie SAS',
    'siret'          => '12345678900012',
    'adresse'        => '12 rue des Lilas, 75001 Paris',
    'fonction'       => 'Gérant',
    'PDL-1'          => '22516914714270',
    'PCE-1'          => 'GI123456',
];

$ch = curl_init("{$baseUrl}/api/external/send-acd");
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        "X-API-Key: {$apiKey}",
    ],
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['success']) {
    $documentId = $response['document_id'];
    $signingUrl = $response['docuseal_url'];
    echo "ACD envoyé ! Document ID: {$documentId}";
    echo "Lien signature: {$signingUrl}";
} else {
    echo "Erreur: " . $response['error'];
}
```

### JavaScript / Node.js

```javascript
const API_KEY  = 'c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732';
const BASE_URL = 'https://docflow.f-energieconseil.fr';

// Envoyer un ACD
async function sendAcd(clientData) {
  const response = await fetch(`${BASE_URL}/api/external/send-acd`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(clientData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erreur lors de l\'envoi');
  }

  return data; // { success, document_id, docuseal_url, ... }
}

// Consulter le statut
async function getDocumentStatus(documentId) {
  const response = await fetch(
    `${BASE_URL}/api/external/document-status/${documentId}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return response.json();
}

// Exemple d'utilisation
sendAcd({
  prenom: 'Jean',
  nom: 'Dupont',
  email: 'jean.dupont@exemple.fr',
  raison_sociale: 'Dupont Énergie SAS',
  siret: '12345678900012',
  'PDL-1': '22516914714270',
  'PCE-1': 'GI123456',
}).then(result => {
  console.log('Document ID:', result.document_id);
  console.log('URL signature:', result.docuseal_url);
});
```

### Python

```python
import requests

API_KEY  = 'c8473a992beadda6e72c26d5da968d27f88b8257dc7066fb4e8d43851c0b1732'
BASE_URL = 'https://docflow.f-energieconseil.fr'

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
}

# Envoyer un ACD
payload = {
    'prenom':         'Jean',
    'nom':            'Dupont',
    'email':          'jean.dupont@exemple.fr',
    'raison_sociale': 'Dupont Énergie SAS',
    'siret':          '12345678900012',
    'adresse':        '12 rue des Lilas, 75001 Paris',
    'fonction':       'Gérant',
    'PDL-1':          '22516914714270',
    'PCE-1':          'GI123456',
}

response = requests.post(
    f'{BASE_URL}/api/external/send-acd',
    json=payload,
    headers=headers
)

data = response.json()

if data['success']:
    print(f"ACD envoyé ! Document ID: {data['document_id']}")
    print(f"URL signature: {data['docuseal_url']}")
    
    # Vérifier le statut plus tard
    status_response = requests.get(
        f"{BASE_URL}/api/external/document-status/{data['document_id']}",
        headers={'X-API-Key': API_KEY}
    )
    print(status_response.json())
else:
    print(f"Erreur: {data['error']}")
```

---

## Flux complet

```
CRM / Application externe
        │
        │  POST /api/external/send-acd
        │  X-API-Key: <clé>
        │  { prenom, nom, email, siret, PDL-1, PCE-1... }
        │
        ▼
DocFlow (api/external.ts)
  1. Vérifie X-API-Key
  2. Crée ou retrouve le client en BDD
  3. Charge le mapping ACD (template_field_mappings)
  4. Construit le payload DocuSeal
  5. Envoie via docusealApi.sendDocument()
  6. Sauvegarde en BDD (table documents)
        │
        │  { success, document_id, docuseal_url }
        │
        ▼
CRM stocke le document_id
        │
        │  Email automatique DocuSeal → Client signataire
        │
        ▼
Client signe sur https://docsign.f-energieconseil.fr/s/XXXXX
        │
        │  Webhook DocuSeal → DocFlow (mise à jour statut)
        │
        ▼
CRM appelle GET /api/external/document-status/<document_id>
  → status: "signed"
```

---

## Notes importantes

- **Idempotence client** : Si vous envoyez un ACD pour un email déjà présent en BDD, DocFlow retrouve le client existant et **met à jour** sa raison sociale/SIRET. Un nouveau document est créé à chaque appel.
- **Clé API** : Ne jamais exposer la clé dans du JavaScript front-end. Tous les appels doivent venir d'un serveur.
- **Régénérer la clé** : Modifier `EXTERNAL_API_KEY` dans `.env` et redémarrer le serveur. L'ancienne clé est immédiatement invalidée.
- **Suivi webhook** : DocFlow reçoit les événements DocuSeal et met à jour le `status` automatiquement — pas besoin de polling.
