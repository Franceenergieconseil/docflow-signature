/**
 * API Externe DocFlow — Routes sécurisées par X-API-Key
 *
 * Permet à une application externe (CRM, etc.) de déclencher l'envoi
 * du template ACD via DocFlow sans passer par l'interface utilisateur.
 *
 * Authentification : Header HTTP  X-API-Key: <EXTERNAL_API_KEY>
 * Aucune dépendance sur le système JWT interne.
 */

import { Router, Request, Response } from 'express';
import db from '../db.ts';
import { docusealApi } from './docuseal.ts';

const router = Router();

// ============================================================================
// MIDDLEWARE — Vérification de la clé API externe
// ============================================================================

function requireApiKey(req: Request, res: Response, next: Function) {
  const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;

  if (!EXTERNAL_API_KEY) {
    console.error('❌ EXTERNAL_API_KEY non définie dans .env — API externe désactivée');
    return res.status(503).json({
      success: false,
      error: 'Service non configuré',
      details: 'EXTERNAL_API_KEY manquante dans la configuration serveur',
    });
  }

  const providedKey = req.headers['x-api-key'];

  if (!providedKey || providedKey !== EXTERNAL_API_KEY) {
    console.warn(`⛔ Tentative d'accès API externe non autorisée — IP: ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      details: 'Header X-API-Key absent ou invalide',
    });
  }

  next();
}

// ============================================================================
// POST /api/external/send-acd
// Déclenche l'envoi du template ACD à un client pour signature électronique
// ============================================================================

router.post('/send-acd', requireApiKey, async (req: Request, res: Response) => {
  console.log('\n📥 [API Externe] POST /send-acd — Début du traitement');

  const {
    // Format natif DocFlow
    prenom:         _prenom,
    nom:            _nom,
    email:          _email,
    // Format CRM LeadFlow — aliases absorbés ici
    nom_signataire, // "Prénom Nom" → splitté ci-dessous
    email_client,   // alias de email
    // siren présent dans le payload CRM — ignoré volontairement (pas utilisé dans l'ACD)
    siren: _siren,
    // Champs communs
    raison_sociale,
    siret,
    adresse,
    fonction,
    // Champs PDL/PCE dynamiques (jusqu'à 5 compteurs)
    'PDL-1': pdl1,
    'PDL-2': pdl2,
    'PDL-3': pdl3,
    'PDL-4': pdl4,
    'PDL-5': pdl5,
    'PCE-1': pce1,
    'PCE-2': pce2,
    'PCE-3': pce3,
    'PCE-4': pce4,
    'PCE-5': pce5,
    // Alias simplifiés acceptés aussi (ex: pce ou pdl pour le 1er)
    pce,
    pdl,
  } = req.body;

  // ── Résolution prenom / nom ───────────────────────────────────────────────
  // Priorité : champs séparés (prenom/nom) > nom_signataire splitté sur le 1er espace
  let prenom: string;
  let nom: string;
  if (_prenom || _nom) {
    prenom = (_prenom || '').toString().trim();
    nom    = (_nom    || '').toString().trim();
  } else if (nom_signataire) {
    const spaceIdx = nom_signataire.trim().indexOf(' ');
    if (spaceIdx === -1) {
      // Pas d'espace → tout dans nom, prenom vide
      prenom = '';
      nom    = nom_signataire.trim();
    } else {
      prenom = nom_signataire.trim().slice(0, spaceIdx);
      nom    = nom_signataire.trim().slice(spaceIdx + 1);
    }
  } else {
    prenom = '';
    nom    = '';
  }

  // ── Résolution email ──────────────────────────────────────────────────────
  // Priorité : email > email_client
  const email: string = ((_email || email_client) || '').toString().trim().toLowerCase();

  // ── Validation des champs obligatoires ────────────────────────────────────
  const missingFields: string[] = [];
  if (!prenom && !nom_signataire) missingFields.push('prenom + nom (ou nom_signataire)');
  if (!nom    && !nom_signataire) missingFields.push('nom (ou nom_signataire)');
  if (!email)                     missingFields.push('email (ou email_client)');
  if (!raison_sociale)            missingFields.push('raison_sociale');
  if (!siret)                     missingFields.push('siret');

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Champs obligatoires manquants',
      missing_fields: missingFields,
    });
  }

  // Validation email basique
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Format email invalide',
      field: 'email',
    });
  }

  try {
    // ── 1. Récupérer le template ACD (nom_template = 'ACD', available = 1) ─
    const template: any = db.prepare(`
      SELECT * FROM document_templates 
      WHERE nom_template = 'ACD' AND available = 1
      LIMIT 1
    `).get();

    if (!template) {
      console.error('❌ Template ACD introuvable ou non disponible en BDD');
      return res.status(404).json({
        success: false,
        error: 'Template ACD introuvable',
        details: 'Le template ACD n\'existe pas ou n\'est pas marqué comme disponible (available=1)',
      });
    }

    console.log(`✅ Template ACD trouvé — id: ${template.id}, id_docuseal: ${template.id_docuseal}`);

    // ── 2. Upsert client (cherche par email, crée si absent) ────────────────
    let client: any = db.prepare('SELECT * FROM clients WHERE email = ?').get(email);

    if (!client) {
      console.log(`👤 Client non trouvé pour ${email} — création en cours...`);

      // Récupérer le sender_id système (user api@system.local)
      const systemUser: any = db.prepare("SELECT id FROM users WHERE email = 'api@system.local'").get();
      const systemUserId = systemUser?.id ?? null;

      const insertResult = db.prepare(`
        INSERT INTO clients (prenom, nom, email, entreprise, siret, adresse, fonction, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        prenom.trim(),
        nom.trim(),
        email.trim().toLowerCase(),
        raison_sociale.trim(),
        siret.trim(),
        adresse?.trim() || '',
        fonction?.trim() || '',
        systemUserId,
      );

      client = db.prepare('SELECT * FROM clients WHERE id = ?').get(insertResult.lastInsertRowid);
      console.log(`✅ Client créé — id: ${client.id}`);
    } else {
      console.log(`✅ Client existant trouvé — id: ${client.id}`);
      // Mise à jour des données entreprise si fournies (siret/adresse peuvent avoir changé)
      db.prepare(`
        UPDATE clients SET 
          entreprise = ?,
          siret = ?,
          adresse = COALESCE(?, adresse),
          fonction = COALESCE(?, fonction)
        WHERE id = ?
      `).run(
        raison_sociale.trim(),
        siret.trim(),
        adresse?.trim() || null,
        fonction?.trim() || null,
        client.id,
      );
      // Recharger le client avec les données à jour
      client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
    }

    // ── 3. Récupérer les mappings du template ACD ───────────────────────────
    const mappings: any[] = db.prepare(`
      SELECT * FROM template_field_mappings 
      WHERE template_id = ?
    `).all(template.id);

    // ── 4. Construire les champs dynamiques ACD ─────────────────────────────
    // Normalisation des compteurs : accepte 'pce'/'pdl' (alias court) ou 'PCE-1'/'PDL-1' (format complet)
    const dynamicData: Record<string, string> = {
      'PDL-1': (pdl1 ?? pdl ?? '').toString(),
      'PDL-2': (pdl2 ?? '').toString(),
      'PDL-3': (pdl3 ?? '').toString(),
      'PDL-4': (pdl4 ?? '').toString(),
      'PDL-5': (pdl5 ?? '').toString(),
      'PCE-1': (pce1 ?? pce ?? '').toString(),
      'PCE-2': (pce2 ?? '').toString(),
      'PCE-3': (pce3 ?? '').toString(),
      'PCE-4': (pce4 ?? '').toString(),
      'PCE-5': (pce5 ?? '').toString(),
    };

    // ── 5. Construire le payload DocuSeal (même logique que documents.ts) ───
    const submissionFields: any[] = [];

    mappings.forEach((mapping: any) => {
      // Champs ignorés (remplis par le signataire : Ville, Date, Signature)
      if (mapping.source_category === 'ignore') {
        return;
      }
      // Champs signature (toujours remplis par le signataire)
      if (mapping.field_type === 'signature') {
        return;
      }

      let fieldValue = '';

      if (mapping.contact_field_name) {
        // Fusion nom+prénom
        if (mapping.fusion) {
          try {
            const fusionConfig = typeof mapping.fusion === 'string'
              ? JSON.parse(mapping.fusion)
              : mapping.fusion;

            if (fusionConfig?.enabled) {
              const nomVal    = client.nom    || '';
              const prenomVal = client.prenom || '';
              fieldValue = fusionConfig.pattern
                ? fusionConfig.pattern.replace('{prenom}', prenomVal).replace('{nom}', nomVal)
                : `${prenomVal} ${nomVal}`.trim();
            } else {
              fieldValue = client[mapping.contact_field_name] || '';
            }
          } catch {
            const nomVal    = client.nom    || '';
            const prenomVal = client.prenom || '';
            fieldValue = `${prenomVal} ${nomVal}`.trim();
          }
        } else {
          // Mappage direct depuis le client
          fieldValue = client[mapping.contact_field_name] || '';
        }
      } else {
        // Champ dynamique (PDL-1..5, PCE-1..5) — vient du payload de la requête
        fieldValue = dynamicData[mapping.docuseal_field_name] || '';
      }

      submissionFields.push({
        name:  mapping.docuseal_field_name,
        value: fieldValue,
      });
    });

    console.log(`📋 Champs préparés pour DocuSeal (${submissionFields.length}) :`, JSON.stringify(submissionFields, null, 2));

    // ── 6. Envoi vers DocuSeal ───────────────────────────────────────────────
    const docusealParams = {
      template_id: template.id_docuseal,
      send_email:  true,
      submitters: [
        {
          email:  client.email,
          fields: submissionFields,
        },
      ],
    };

    console.log('📡 Envoi vers DocuSeal API...');
    const submissionRaw = await docusealApi.sendDocument(docusealParams);

    // DocuSeal peut retourner un objet ou un tableau — on normalise
    const submission = Array.isArray(submissionRaw) ? submissionRaw[0] : submissionRaw;

    if (!submission || !submission.id) {
      console.error('❌ DocuSeal n\'a pas retourné d\'ID valide :', submissionRaw);
      return res.status(500).json({
        success: false,
        error: 'DocuSeal n\'a pas retourné d\'ID de soumission',
        details: submissionRaw,
      });
    }

    console.log(`✅ Soumission DocuSeal créée — id: ${submission.id}`);

    // ── 7. Récupérer l'ID de l'utilisateur système ──────────────────────────
    const systemUser: any = db.prepare("SELECT id FROM users WHERE email = 'api@system.local'").get();
    const systemUserId = systemUser?.id;

    if (!systemUserId) {
      console.error('❌ Utilisateur système api@system.local introuvable en BDD');
      return res.status(500).json({
        success: false,
        error: 'Configuration serveur incomplète',
        details: 'Utilisateur système "api@system.local" manquant en BDD. Redémarrez le serveur.',
      });
    }

    // ── 8. Insérer le document en BDD ───────────────────────────────────────
    const docResult = db.prepare(`
      INSERT INTO documents (client_id, template_id, sender_id, docuseal_submission_id, status, dynamic_data)
      VALUES (?, ?, ?, ?, 'sent', ?)
    `).run(
      client.id,
      template.id,
      systemUserId,
      submission.id,
      JSON.stringify(dynamicData),
    );

    const newDocument: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(docResult.lastInsertRowid);

    // ── 9. Log activité ─────────────────────────────────────────────────────
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(systemUserId, 'external_api_send', `[API Externe] ACD envoyé à ${client.prenom} ${client.nom} (${client.email}) — DocuSeal submission #${submission.id}`);

    // ── 10. Construction de l'URL DocuSeal pour le signataire ───────────────
    // DocuSeal retourne slug ou embed_src selon la version
    const docusealBaseUrl = (process.env.DOCUSEAL_API_URL || '')
      .replace(/\/api\/?$/, '');

    // L'URL de signature est dans submission.submitters[0].embed_src ou construite depuis le slug
    let signingUrl = '';
    if (submission.submitters && submission.submitters[0]) {
      signingUrl = submission.submitters[0].embed_src
        || submission.submitters[0].action_url
        || `${docusealBaseUrl}/s/${submission.submitters[0].slug}`
        || '';
    }

    console.log(`\n✅ [API Externe] ACD envoyé avec succès — document_id: ${newDocument.id}`);

    return res.status(201).json({
      success:                true,
      message:                `ACD envoyé avec succès à ${client.email}`,
      document_id:            newDocument.id,
      docuseal_submission_id: submission.id,
      docuseal_url:           signingUrl,
      client_id:              client.id,
      status:                 'sent',
    });
  } catch (error: any) {
    console.error('❌ [API Externe] Erreur lors de l\'envoi ACD :', error);
    return res.status(500).json({
      success: false,
      error:   'Erreur interne du serveur',
      details: error?.message || 'Erreur inconnue',
    });
  }
});

// ============================================================================
// GET /api/external/document-status/:id
// Retourne le statut d'un document envoyé via l'API externe
// ============================================================================

router.get('/document-status/:id', requireApiKey, (req: Request, res: Response) => {
  const { id } = req.params;

  console.log(`\n📥 [API Externe] GET /document-status/${id}`);

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      error:   'ID de document invalide',
    });
  }

  try {
    const document: any = db.prepare(`
      SELECT 
        d.id,
        d.status,
        d.docuseal_submission_id,
        d.dynamic_data,
        d.sent_at,
        d.updated_at,
        d.expires_at,
        c.prenom        AS client_prenom,
        c.nom           AS client_nom,
        c.email         AS client_email,
        c.entreprise    AS client_entreprise,
        c.siret         AS client_siret,
        t.nom_template  AS template_name,
        t.id_docuseal   AS template_docuseal_id
      FROM documents d
      JOIN clients c           ON d.client_id   = c.id
      JOIN document_templates t ON d.template_id = t.id
      WHERE d.id = ?
    `).get(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error:   `Document ID ${id} introuvable`,
      });
    }

    // Récupérer l'URL DocuSeal depuis DOCUSEAL_API_URL
    const docusealBaseUrl = (process.env.DOCUSEAL_API_URL || '')
      .replace(/\/api\/?$/, '');

    // Extraire les données dynamiques (PDL/PCE) du JSON stocké
    let dynamicData: Record<string, string> = {};
    try {
      dynamicData = document.dynamic_data ? JSON.parse(document.dynamic_data) : {};
    } catch {
      dynamicData = {};
    }

    return res.status(200).json({
      success:                true,
      document_id:            document.id,
      status:                 document.status,
      docuseal_submission_id: document.docuseal_submission_id,
      sent_at:                document.sent_at,
      updated_at:             document.updated_at,
      expires_at:             document.expires_at,
      template:               document.template_name,
      docuseal_submission_url: `${docusealBaseUrl}/submissions/${document.docuseal_submission_id}`,
      client: {
        prenom:     document.client_prenom,
        nom:        document.client_nom,
        email:      document.client_email,
        entreprise: document.client_entreprise,
        siret:      document.client_siret,
      },
      dynamic_data: dynamicData,
    });
  } catch (error: any) {
    console.error('❌ [API Externe] Erreur récupération statut document :', error);
    return res.status(500).json({
      success: false,
      error:   'Erreur interne du serveur',
      details: error?.message || 'Erreur inconnue',
    });
  }
});

// ============================================================================
// GET /api/external/health
// Vérification que l'API externe est opérationnelle
// ============================================================================

router.get('/health', requireApiKey, (_req: Request, res: Response) => {
  const template: any = db.prepare(
    "SELECT id, nom_template FROM document_templates WHERE nom_template = 'ACD' AND available = 1 LIMIT 1"
  ).get();

  return res.status(200).json({
    success:         true,
    status:          'ok',
    acd_template:    template ? { id: template.id, name: template.nom_template } : null,
    acd_configured:  !!template,
    timestamp:       new Date().toISOString(),
  });
});

export default router;
