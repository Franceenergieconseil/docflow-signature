import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.ts';

const router = Router();

// 7. WEBHOOK DOCUSEAL - Mise à jour du statut et des données des documents
// ⚠️ ATTENTION : Cette route est accessible SANS authentification JWT (DocuSeal appelle depuis l'extérieur)
// ✅ Sécurité : Utilise la vérification de signature HMAC-SHA256
router.post('/docuseal', (req, res) => {
  console.log('🔔 Webhook DocuSeal reçu:', JSON.stringify(req.body, null, 2));
  
  try {
    // 1️⃣ VÉRIFICATION DE LA SIGNATURE (sécurité)
    const signature = req.headers['x-docuseal-signature'] as string;
    const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ DOCUSEAL_WEBHOOK_SECRET manquant dans .env !');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      console.error('❌ Header x-docuseal-signature manquant !');
      return res.status(403).json({ error: 'Missing signature header' });
    }

    // Calculer le hash HMAC du payload
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Comparer les signatures de manière sécurisée (évite les timing attacks)
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.error('❌ Signature invalide ! Tentative d\'accès non autorisé.');
      console.error('   Signature reçue:', signature);
      console.error('   Signature attendue:', expectedSignature);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    console.log('✅ Signature validée avec succès');

    // 2️⃣ EXTRACTION DES DONNÉES
    const { event_type, data } = req.body;

    // Validation du format
    if (!data || !data.id) {
      console.error('❌ Payload invalide : data.id manquant');
      return res.status(400).json({ error: 'Invalid payload format' });
    }

    // 3️⃣ MAPPER LES ÉVÉNEMENTS DOCUSEAL À NOS STATUTS
    let status = 'sent';
    if (event_type === 'submission.completed') status = 'signed';
    else if (event_type === 'submission.opened') status = 'opened';
    else if (event_type === 'submission.declined') status = 'declined';
    else if (event_type === 'submission.expired') status = 'expired';

    console.log(`📊 Événement: ${event_type} → Statut: ${status}`);

    // 4️⃣ EXTRAIRE LES DONNÉES DES CHAMPS REMPLIS (si completed)
    let fieldsData: any = null;
    
    if (event_type === 'submission.completed' && data.submitters && Array.isArray(data.submitters)) {
      try {
        // Récupérer les valeurs du premier signataire
        const firstSubmitter = data.submitters[0];
        
        if (firstSubmitter && firstSubmitter.values) {
          fieldsData = firstSubmitter.values;
          console.log('📋 Données des champs récupérées:', JSON.stringify(fieldsData, null, 2));
        } else {
          console.warn('⚠️ Aucune valeur trouvée dans data.submitters[0].values');
        }
      } catch (extractError) {
        console.error('❌ Erreur lors de l\'extraction des champs:', extractError);
        // Continue sans les données plutôt que de crasher
      }
    }

    // 5️⃣ METTRE À JOUR LE DOCUMENT DANS LA BASE DE DONNÉES
    let updateQuery: string;
    let params: any[];

    if (fieldsData) {
      // Mettre à jour le statut ET les données
      updateQuery = `
        UPDATE documents 
        SET status = ?, dynamic_data = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE docuseal_submission_id = ?
      `;
      params = [status, JSON.stringify(fieldsData), data.id];
      console.log('🔄 Mise à jour du statut ET des données');
    } else {
      // Mettre à jour uniquement le statut
      updateQuery = `
        UPDATE documents 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE docuseal_submission_id = ?
      `;
      params = [status, data.id];
      console.log('🔄 Mise à jour du statut uniquement');
    }

    const result = db.prepare(updateQuery).run(...params);

    // 6️⃣ LOG DE L'ACTIVITÉ
    if (result.changes > 0) {
      // Récupérer le document pour obtenir user_id
      const doc: any = db.prepare(
        'SELECT sender_id FROM documents WHERE docuseal_submission_id = ?'
      ).get(data.id);
      
      if (doc) {
        const detailsMsg = fieldsData 
          ? `Statut mis à jour: ${event_type} → ${status} (${Object.keys(fieldsData).length} champs récupérés)`
          : `Statut mis à jour: ${event_type} → ${status}`;

        db.prepare(`
          INSERT INTO activities (user_id, action, details) 
          VALUES (?, ?, ?)
        `).run(
          doc.sender_id,
          'document_status_updated',
          detailsMsg
        );
      }

      console.log(`✅ Document ${data.id} mis à jour avec succès (statut: ${status})`);
    } else {
      console.warn(`⚠️ Aucun document trouvé pour submission_id: ${data.id}`);
    }

  } catch (error) {
    console.error('❌ Erreur critique lors du traitement du webhook:', error);
    // On envoie quand même 200 pour que DocuSeal ne redemande pas indéfiniment
    // (erreur loggée pour investigation)
  }

  res.sendStatus(200);
});

export default router;
