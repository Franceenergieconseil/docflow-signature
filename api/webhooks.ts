import { Router } from 'express';
import db from '../db.ts';

const router = Router();

// 7. WEBHOOK DOCUSEAL - Mise à jour du statut des documents
router.post('/docuseal', (req, res) => {
  const { event_type, data } = req.body;
  
  // Docuseal webhook event types: submission.completed, submission.opened, etc.
  if (data && data.id) {
    try {
      // Mapper les événements DocuSeal à nos statuts
      let status = 'sent';
      if (event_type === 'submission.completed') status = 'signed';
      else if (event_type === 'submission.opened') status = 'opened';
      else if (event_type === 'submission.declined') status = 'declined';
      else if (event_type === 'submission.expired') status = 'expired';

      // Mettre à jour le document
      const result = db.prepare(`
        UPDATE documents 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE docuseal_submission_id = ?
      `).run(status, data.id);

      // Log de l'activité si le document a été trouvé
      if (result.changes > 0) {
        // Récupérer le document pour obtenir user_id
        const doc: any = db.prepare(
          'SELECT sender_id FROM documents WHERE docuseal_submission_id = ?'
        ).get(data.id);
        
        if (doc) {
          db.prepare(`
            INSERT INTO activities (user_id, action, details) 
            VALUES (?, ?, ?)
          `).run(
            doc.sender_id,
            'document_status_updated',
            `Statut du document mis à jour: ${event_type} -> ${status}`
          );
        }

        console.log(`✅ Webhook received: ${event_type} for submission ${data.id}. Status updated to ${status}.`);
      } else {
        console.warn(`⚠️ Webhook: No document found for submission ${data.id}`);
      }
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      // On envoie quand même 200 pour que DocuSeal ne redemande pas
    }
  }

  res.sendStatus(200);
});

export default router;
