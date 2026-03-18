import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken, isAdmin } from './auth.ts';
import { docusealApi } from './docuseal.ts';

const router = Router();

// Get all documents (with client and template info)
router.get('/', authenticateToken, (req: any, res) => {
  try {
    let query = `
      SELECT d.*,
             c.prenom as client_prenom, c.nom as client_nom, c.entreprise as client_entreprise,
             t.nom_template as template_name,
             u.first_name as sender_first_name, u.last_name as sender_last_name, u.email as sender_email
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      JOIN document_templates t ON d.template_id = t.id
      JOIN users u ON d.sender_id = u.id
    `;
    
    const params: any[] = [];
    if (req.user.role !== 'admin') {
      query += ' WHERE d.sender_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY d.sent_at DESC';
    
    const documents = db.prepare(query).all(...params);
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des documents" });
  }
});

// 5. ENVOI DU DOCUMENT EN SIGNATURE
router.post('/send', authenticateToken, async (req: any, res) => {
  const { client_id, template_id, dynamic_data, expires_at } = req.body;

  if (!client_id || !template_id) {
    return res.status(400).json({ message: "Missing client or template ID" });
  }

  try {
    const client: any = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id);
    const template: any = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(template_id);

    if (!client || !template) {
      return res.status(404).json({ message: "Client or Template not found" });
    }

    // Récupérer les mappings configurés du template
    const mappings: any[] = db.prepare(`
      SELECT * FROM template_field_mappings 
      WHERE template_id = ?
    `).all(template_id);

    // Construire les données à envoyer à DocuSeal avec les mappings (FORMAT ARRAY)
    const submissionFields: any[] = [];
    
    // Parcourir les champs mappés
    mappings.forEach((mapping: any) => {
      // ⚠️ IGNORER les champs marqués comme 'ignore' (à remplir par le client)
      if (mapping.source_category === 'ignore') {
        console.log(`  ⏭️ Champ ignoré (rempli par le client): ${mapping.docuseal_field_name}`);
        return; // Ne pas inclure dans les fields
      }

      // ⚠️ IGNORER les champs de type "signature" (toujours remplis par le client)
      if (mapping.field_type === 'signature') {
        console.log(`  ⏭️ Champ signature ignoré: ${mapping.docuseal_field_name}`);
        return;
      }

      let fieldValue = '';
      
      if (mapping.contact_field_name) {
        if (mapping.fusion) {
          // Cas fusion nom + prénom
          const nom = client.nom || '';
          const prenom = client.prenom || '';
          fieldValue = `${prenom} ${nom}`.trim();
        } else {
          // Mappage simple depuis le contact
          fieldValue = client[mapping.contact_field_name] || '';
        }
      } else {
        // Champ dynamique - utiliser la valeur du formulaire
        fieldValue = dynamic_data[mapping.docuseal_field_name] || '';
      }

      // Ajouter le champ au tableau (format DocuSeal)
      submissionFields.push({
        name: mapping.docuseal_field_name,
        value: fieldValue
      });
    });

    // Préparer les paramètres pour DocuSeal
    console.log('📤 Préparation envoi DocuSeal:');
    console.log('  Template ID (DocuSeal):', template.id_docuseal);
    console.log('  Client Email:', client.email);
    console.log('  Champs mappés:', JSON.stringify(submissionFields, null, 2));

    const docusealParams: any = {
      template_id: template.id_docuseal,
      send_email: true,
      submitters: [
        {
          email: client.email,
          fields: submissionFields
        }
      ]
    };

    // Ajouter la date d'expiration à DocuSeal si fournie
    if (expires_at) {
      docusealParams.expires_at = new Date(expires_at).toISOString();
    }

    console.log('📡 Envoi vers DocuSeal API:', JSON.stringify(docusealParams, null, 2));
    const submission = await docusealApi.sendDocument(docusealParams);

    // 6. SAUVEGARDE DU DOCUMENT ENVOYÉ
    const result = db.prepare(`
      INSERT INTO documents (client_id, template_id, sender_id, docuseal_submission_id, status, dynamic_data, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(client_id, template_id, req.user.id, submission.id, 'sent', JSON.stringify(dynamic_data), expires_at || null);

    const newDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);

    // Log activity
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'sent_document', `Sent ${template.nom_template} to ${client.prenom} ${client.nom}`);

    res.status(201).json(newDoc);
  } catch (error: any) {
    console.error('Error sending document:', error);
    res.status(500).json({ message: error.message || "Error sending document" });
  }
});

// Obtenir l'historique d'un document (statuts et activités)
router.get('/:docId/history', authenticateToken, (req: any, res) => {
  const { docId } = req.params;
  try {
    const document: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    
    if (!document) {
      return res.status(404).json({ success: false, message: "Document non trouvé" });
    }

    // Récupérer les activités liées au document
    const activities = db.prepare(`
      SELECT a.* FROM activities a
      WHERE a.details LIKE ?
      ORDER BY a.created_at DESC
    `).all(`%submission ${document.docuseal_submission_id}%`);

    res.json({ 
      success: true, 
      data: {
        document,
        activities
      }
    });
  } catch (error) {
    console.error('Error fetching document history:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'historique" });
  }
});

// RELANCER UN DOCUMENT (renvoyer l'email de signature)
router.post('/:id/relaunch', authenticateToken, async (req: any, res) => {
  const { id } = req.params;

  try {
    const document: any = db.prepare(`
      SELECT d.*, c.email as client_email, c.prenom as client_prenom, c.nom as client_nom,
             t.nom_template as template_name
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      JOIN document_templates t ON d.template_id = t.id
      WHERE d.id = ?
    `).get(id);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document non trouvé" });
    }

    // Vérifier que le document peut être relancé (pas déjà signé ou expiré)
    if (document.status === 'signed') {
      return res.status(400).json({ success: false, message: "Le document est déjà signé, il ne peut pas être relancé" });
    }

    if (document.status === 'declined') {
      return res.status(400).json({ success: false, message: "Le document a été décliné, il ne peut pas être relancé" });
    }

    // Envoyer la requête de relance à DocuSeal
    await docusealApi.resendSubmission(document.docuseal_submission_id);

    // Logger l'activité
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'relaunch_document', `Relancé ${document.template_name} pour ${document.client_prenom} ${document.client_nom}`);

    res.json({ 
      success: true, 
      message: "Document relancé avec succès"
    });
  } catch (error: any) {
    console.error('Error relaunching document:', error);
    res.status(500).json({ success: false, message: error.message || "Erreur lors de la relance du document" });
  }
});

// SUPPRIMER UN DOCUMENT
router.delete('/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;

  try {
    const document: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document non trouvé" });
    }

    // Vérifier les permissions (admin ou propriétaire du document)
    if (req.user.role !== 'admin' && document.sender_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Vous n'êtes pas autorisé à supprimer ce document" });
    }

    // Supprimer le document (les FOREIGN KEY avec ON DELETE CASCADE supprimeront automatiquement les activités liées)
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    // Logger l'activité
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'delete_document', `Document ID ${id} supprimé`);

    res.json({ 
      success: true, 
      message: "Document supprimé avec succès"
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, message: error.message || "Erreur lors de la suppression du document" });
  }
});

// GET /api/documents/:id/download - Télécharger le PDF signé (Admin uniquement)
router.get('/:id/download', authenticateToken, isAdmin, async (req: any, res) => {
  const { id } = req.params;

  try {
    // 1. Récupérer le document avec docuseal_submission_id
    const document: any = db.prepare(`
      SELECT d.docuseal_submission_id, d.status, t.nom_template as template_name,
             c.prenom as client_prenom, c.nom as client_nom
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      JOIN document_templates t ON d.template_id = t.id
      WHERE d.id = ?
    `).get(id);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document non trouvé" });
    }

    // 2. Vérifier que le document est signé
    if (document.status !== 'signed') {
      return res.status(400).json({
        success: false,
        message: `Le document n'est pas signé (statut actuel : ${document.status})`
      });
    }

    // 3. Récupérer le PDF depuis DocuSeal API
    const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || 'https://docsign.f-energieconseil.fr';
    const API_KEY = process.env.DOCUSEAL_API_KEY;
    
    // Construire l'URL complète de l'API (avec /api si nécessaire)
    let apiBaseUrl = DOCUSEAL_API_URL;
    if (!apiBaseUrl.includes('api.docuseal.com') && !apiBaseUrl.endsWith('/api')) {
      apiBaseUrl = apiBaseUrl.endsWith('/') ? `${apiBaseUrl}api` : `${apiBaseUrl}/api`;
    }

    console.log(`📥 Récupération du PDF depuis DocuSeal : submission ${document.docuseal_submission_id}`);

    const response = await fetch(
      `${apiBaseUrl}/submissions/${document.docuseal_submission_id}/download`,
      {
        headers: { 'X-Auth-Token': API_KEY }
      }
    );

    if (!response.ok) {
      console.error('❌ Erreur DocuSeal:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Détails:', errorText);
      return res.status(500).json({
        success: false,
        message: `Impossible de récupérer le PDF depuis DocuSeal (${response.status})`
      });
    }

    // 4. Générer un nom de fichier propre
    const fileName = `${document.template_name}_${document.client_prenom}_${document.client_nom}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '');

    // 5. Transférer le PDF au client
    const pdfBuffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.byteLength.toString());
    
    res.send(Buffer.from(pdfBuffer));

    // 6. Logger l'activité
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'download_document', `Téléchargement du document ID ${id} : ${fileName}`);

    console.log(`✅ Document téléchargé : ${fileName} par ${req.user.email}`);
  } catch (error: any) {
    console.error('❌ Erreur téléchargement document:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du téléchargement"
    });
  }
});

export default router;
