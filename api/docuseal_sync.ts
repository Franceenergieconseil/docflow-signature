import { Router } from 'express';
import db from '../db.ts';
import { docusealApi } from './docuseal.ts';
import { authenticateToken } from './auth.ts';

const router = Router();

// 1. SYNCHRONISATION DES TEMPLATES DOCUSEAL
router.get('/templates/sync', authenticateToken, async (req, res) => {
  console.log('🔄 Sync request received from user:', (req as any).user?.id);
  try {
    console.log('📥 Début de la synchronisation des templates...');
    console.log('🔑 Clé API utilisée:', process.env.DOCUSEAL_API_KEY?.substring(0, 5) + '...');
    console.log('🌐 URL API DocuSeal:', process.env.DOCUSEAL_API_URL);
    
    // Étape 0 : Vérifier l'API DocuSeal EN PREMIER
    console.log('📡 Vérification de l\'API DocuSeal...');
    let responseData;
    try {
      responseData = await docusealApi.getTemplates();
    } catch (apiError: any) {
      console.error('❌ ERREUR API DocuSeal:', apiError.message);
      return res.status(503).json({ 
        message: 'Service DocuSeal indisponible',
        error: apiError.message
      });
    }

    console.log('📋 Réponse brute de DocuSeal:', JSON.stringify(responseData).substring(0, 500));

    // Gérer les deux formats possibles : array ou { data: array }
    const templates = Array.isArray(responseData) 
      ? responseData 
      : (Array.isArray(responseData.data) ? responseData.data : []);

    console.log(`✅ Nombre de templates récupérés: ${templates.length}`);

    if (templates.length === 0) {
      console.warn('⚠️  Aucun template reçu de l\'API DocuSeal');
      return res.json({ 
        message: 'Synchronisation complétée (aucun template trouvé)', 
        count: 0 
      });
    }

    // Détailler chaque template
    templates.forEach((t: any) => {
      console.log(`  Template: id=${t.id}, name=${t.name}, has_fields=${!!t.fields}`);
    });

    // Insérer ou mettre à jour les templates avec UPSERT (clé: id_docuseal)
    const insertStmt = db.prepare(`
      INSERT INTO document_templates (id_docuseal, nom_template, slug, schema, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id_docuseal) DO UPDATE SET
        nom_template = excluded.nom_template,
        slug = excluded.slug,
        schema = excluded.schema
    `);

    let successCount = 0;
    let errorCount = 0;

    console.log('📝 Insertion des templates dans la DB...');
    for (const template of templates) {
      try {
        // Extraire le schema : DocuSeal peut l'appeler "fields", "schema", "form_fields", etc.
        const schemaData = template.fields || template.schema || template.form_fields || null;
        const schema = schemaData ? JSON.stringify(schemaData) : null;
        
        insertStmt.run(
          template.id,  // ← id_docuseal (clé unique)
          template.name || 'Sans nom',
          template.slug || null,
          schema,
          template.created_at || new Date().toISOString()
        );
        
        console.log(`  ✓ Template ${template.id}: "${template.name}" synchronisé (${schemaData?.length || 0} champs)`);
        successCount++;
      } catch (dbError: any) {
        console.error(`  ❌ Erreur insertion template ${template.id}:`, dbError.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Résumé synchronisation: ${successCount} réussis, ${errorCount} échoués`);

    res.json({ 
      message: 'Templates synchronisés avec succès', 
      count: successCount,
      errors: errorCount
    });
  } catch (error: any) {
    console.error('❌ ERREUR SYNC:', error.message);
    res.status(500).json({ 
      message: error.message,
      hint: 'Vérifie DOCUSEAL_API_KEY et DOCUSEAL_API_URL dans .env'
    });
  }
});

// 2. RÉCUPÉRATION DES CHAMPS D’UN TEMPLATE + MAPPING AUTOMATIQUE
router.get('/templates/:id/fields', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template: any = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(id);
    if (!template) return res.status(404).json({ message: 'Template non trouvé' });

    const fields = await docusealApi.getTemplateFields(template.id_docuseal);
    
    // Mapping automatique
    const mappingRules: Record<string, string> = {
      'first_name': 'prenom',
      'last_name': 'nom',
      'email': 'email',
      'company': 'entreprise',
      'entreprise': 'entreprise',
      'nom': 'nom',
      'prenom': 'prenom'
    };

    // Nettoyer les anciens champs
    db.prepare('DELETE FROM template_fields WHERE template_id = ?').run(id);

    const insertField = db.prepare(`
      INSERT INTO template_fields (template_id, field_name, field_type, mapped_to)
      VALUES (?, ?, ?, ?)
    `);

    const processedFields = fields.map((field: any) => {
      const mappedTo = mappingRules[field.name.toLowerCase()] || null;
      insertField.run(id, field.name, field.type, mappedTo);
      return { ...field, mapped_to: mappedTo };
    });

    res.json(processedFields);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
