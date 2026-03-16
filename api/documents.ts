import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken } from './auth.ts';
import { docusealApi } from './docuseal.ts';

const router = Router();

// Get all documents (with client and template info)
router.get('/', authenticateToken, (req: any, res) => {
  try {
    let query = `
      SELECT d.*, c.prenom as client_prenom, c.nom as client_nom, c.entreprise as client_entreprise,
             t.nom_template as template_name
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      JOIN document_templates t ON d.template_id = t.id
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

    // Construire les données à envoyer à DocuSeal avec les mappings
    const submissionFields: any = {};
    
    // D'abord, ajouter les champs mappés
    mappings.forEach((mapping: any) => {
      if (mapping.contact_field_name) {
        if (mapping.fusion) {
          // Cas fusion nom + prénom
          const nom = client.nom || '';
          const prenom = client.prenom || '';
          submissionFields[mapping.docuseal_field_name] = `${prenom} ${nom}`.trim();
        } else {
          // Mappage simple depuis le contact
          submissionFields[mapping.docuseal_field_name] = client[mapping.contact_field_name] || '';
        }
      } else {
        // Champ dynamique - utiliser la valeur du formulaire
        submissionFields[mapping.docuseal_field_name] = dynamic_data[mapping.docuseal_field_name] || '';
      }
    });

    // Prepare Docuseal submission
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

export default router;
