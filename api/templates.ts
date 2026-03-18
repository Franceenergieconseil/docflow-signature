import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken, isAdmin } from './auth.ts';

const router = Router();

/**
 * @route   GET /api/templates
 * @desc    Récupère tous les modèles avec leurs schémas et slugs
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    console.log('GET /api/templates - Fetching all templates');
    
    // On récupère tout (*) pour inclure id, nom_template, id_docuseal, slug et schema
    const templates = db.prepare(`
      SELECT * FROM document_templates 
      ORDER BY nom_template ASC
    `).all();

    // IMPORTANT : On renvoie un objet { data: [...] } car le Front-end 
    // moderne (avec Skeleton/Animations) attend cette structure pour mapper.
    res.json({ 
      success: true,
      data: templates 
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des modèles" });
  }
});

/**
 * @route   GET /api/templates/available
 * @desc    Récupère uniquement les modèles marqués comme disponibles pour les utilisateurs
 */
router.get('/available', authenticateToken, (req, res) => {
  try {
    console.log('GET /api/templates/available - Fetching available templates for user');
    
    const templates = db.prepare(`
      SELECT * FROM document_templates 
      WHERE available = 1
      ORDER BY nom_template ASC
    `).all();

    res.json({ 
      success: true,
      data: templates 
    });
  } catch (error) {
    console.error('Error fetching available templates:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des modèles" });
  }
});

/**
 * @route   GET /api/templates/:id/fields
 * @desc    Récupère les champs d'un modèle avec leurs mappings configurés
 */
router.get('/:templateId/fields', authenticateToken, (req, res) => {
  const { templateId } = req.params;
  try {
    // Récupérer le template pour le schema
    const template = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(templateId);
    
    if (!template) {
      return res.status(404).json({ success: false, message: "Template non trouvé" });
    }

    // Récupérer les mappings configurés
    const mappings = db.prepare(`
      SELECT * FROM template_field_mappings 
      WHERE template_id = ?
      ORDER BY id ASC
    `).all(templateId);

    // Si aucun mapping, retourner un objet vide avec le schema du template
    const schemaObj = template.schema ? JSON.parse(template.schema) : {};
    const docusealFields = schemaObj.fields || [];

    // Enrichir les mappings avec les infos des champs DocuSeal
    const enrichedMappings = mappings.map((mapping: any) => ({
      ...mapping,
      is_dynamic: !!mapping.is_dynamic,
      is_required: !!mapping.is_required,
      fusion: !!mapping.fusion
    }));

    res.json({ 
      success: true, 
      data: {
        template,
        mappings: enrichedMappings,
        docusealFields
      }
    });
  } catch (error) {
    console.error('Error fetching template fields:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des champs" });
  }
});

/**
 * @route   PUT /api/templates/:id/available
 * @desc    Marque un template comme disponible pour les utilisateurs (Admin uniquement)
 */
router.put('/:id/available', authenticateToken, isAdmin, (req: any, res) => {
  const { id } = req.params;
  const { available } = req.body;

  if (typeof available !== 'boolean') {
    return res.status(400).json({ message: "Le champ 'available' doit être un booléen" });
  }

  try {
    const template = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(id);
    
    if (!template) {
      return res.status(404).json({ message: "Modèle non trouvé" });
    }

    db.prepare('UPDATE document_templates SET available = ? WHERE id = ?')
      .run(available ? 1 : 0, id);

    // Log de l'activité
    const action = available ? 'made_template_available' : 'made_template_unavailable';
    const details = available 
      ? `Modèle rendu disponible : ${template.nom_template}` 
      : `Modèle rendu indisponible : ${template.nom_template}`;
    
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, action, details);

    const updatedTemplate = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(id);
    res.json({ success: true, data: updatedTemplate });
  } catch (error) {
    console.error('Error updating template availability:', error);
    res.status(500).json({ message: "Erreur lors de la mise à jour du modèle" });
  }
});

/**
 * @route   POST /api/templates
 * @desc    Création manuelle d'un modèle (Admin uniquement)
 */
router.post('/', authenticateToken, isAdmin, (req: any, res) => {
  const { nom_template, id_docuseal, slug, schema } = req.body;

  if (!nom_template || !id_docuseal) {
    return res.status(400).json({ message: "Champs obligatoires manquants" });
  }

  try {
    const result = db.prepare(`
      INSERT INTO document_templates (nom_template, id_docuseal, slug, schema)
      VALUES (?, ?, ?, ?)
    `).run(nom_template, id_docuseal, slug, schema || null);

    const newTemplate = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(result.lastInsertRowid);
    
    // Log de l'activité
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'created_template', `Modèle créé : ${nom_template}`);

    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: "Erreur lors de la création du modèle" });
  }
});

/**
 * Fonction utilitaire : Normalise un nom de champ pour la détection auto
 */
function normalizeFieldName(name: string): string {
  return name.toLowerCase()
    .replace(/[-_]/g, ' ')  // Tirets et underscores → espaces
    .trim();
}

/**
 * Fonction utilitaire : Détecte automatiquement la catégorie d'un champ
 */
function autoDetectCategory(fieldName: string): 'client' | 'entreprise' | 'dynamique' {
  const normalized = normalizeFieldName(fieldName);
  
  // Patterns Client
  const clientPatterns = ['prenom', 'firstname', 'nom', 'lastname', 'fonction', 'job', 'email du contact', 'signataire', 'beneficiaire'];
  if (clientPatterns.some(p => normalized.includes(p))) {
    return 'client';
  }
  
  // Patterns Entreprise
  const entreprisePatterns = ['raison sociale', 'entreprise', 'company', 'societe', 'siret', 'siren', 'adresse du siege', 'adresse'];
  if (entreprisePatterns.some(p => normalized.includes(p))) {
    return 'entreprise';
  }
  
  // Patterns Dynamiques (PDL, PCE, compteurs energy)
  const dynamicPatterns = ['pdl', 'pce', 'compteur', 'numero de', 'reference', 'puissance'];
  if (dynamicPatterns.some(p => normalized.includes(p))) {
    return 'dynamique';
  }
  
  // Par défaut: dynamique (le commercial devra remplir)
  return 'dynamique';
}

/**
 * Fonction utilitaire : Suggère automatically le champ de la base à mapper
 */
function autoDetectFieldName(fieldName: string, category: string): string | null {
  const normalized = normalizeFieldName(fieldName);
  
  if (category === 'client') {
    if (normalized.includes('prenom')) return 'prenom';
    if (normalized.includes('nom') && !normalized.includes('prenom')) return 'nom';
    if (normalized.includes('email')) return 'email';
    if (normalized.includes('fonction') || normalized.includes('job')) return 'fonction';
    
    // Détection fusion Nom + Prénom
    if (normalized.includes('nom et prenom') || 
        normalized.includes('nom prenom') ||
        normalized.includes('signataire') ||
        normalized.includes('beneficiaire') ||
        normalized.includes('fullname')) {
      return 'nom_prenom_fusion';  // Flag spécial
    }
    
    return null;  // Champ client non reconnu
  }
  
  if (category === 'entreprise') {
    if (normalized.includes('raison sociale') || normalized.includes('entreprise') || normalized.includes('company')) {
      return 'entreprise';
    }
    if (normalized.includes('siret') || normalized.includes('siren')) return 'siret';
    if (normalized.includes('adresse')) return 'adresse';
    
    return null;
  }
  
  // Catégorie dynamique : pas de mapping auto
  return null;
}

/**
 * @route   GET /api/templates/:id/config
 * @desc    Récupère la configuration de mappage d'un template avec merging du schema DocuSeal
 */
router.get('/:templateId/config', authenticateToken, async (req: any, res) => {
  const { templateId } = req.params;

  // Désactiver le cache pour forcer le rechargement des données
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // 1️⃣ Récupérer le template avec son schema DocuSeal
    let template: any = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(templateId);
    
    console.log('📦 SCHEMA SQLITE:', template?.schema);
    
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template non trouvé' });
    }

    // 2️⃣ Si le schema est vide, synchroniser automatiquement avec DocuSeal
    if (!template.schema || template.schema === '{}' || template.schema === 'null') {
      console.log('⚠️ Schema manquant pour template ID ' + templateId + ', synchronisation depuis DocuSeal...');
      
      try {
        const { docusealApi } = await import('./docuseal.ts');
        const docusealTemplate = await docusealApi.getTemplateFields(template.id_docuseal);
        
        if (docusealTemplate && docusealTemplate.length > 0) {
          const schemaToSave = JSON.stringify({ fields: docusealTemplate });
          db.prepare('UPDATE document_templates SET schema = ? WHERE id = ?')
            .run(schemaToSave, templateId);
          
          template.schema = schemaToSave;
          console.log('✅ Schema synchronisé : ' + docusealTemplate.length + ' champs récupérés');
        } else {
          console.warn('⚠️ Aucun champ retourné par DocuSeal pour le template ' + template.id_docuseal);
        }
      } catch (syncError: any) {
        console.error('❌ Erreur lors de la synchronisation DocuSeal:', syncError.message);
        // Continue avec un schema vide plutôt que de crasher
      }
    }

    // 3️⃣ Parser le schema DocuSeal
    let docusealFields: any[] = [];
    if (template.schema) {
      try {
        const schemaObj = typeof template.schema === 'string' ? JSON.parse(template.schema) : template.schema;
        
        // ✅ Le schema peut être un tableau direct [...] OU un objet { fields: [...] }
        if (Array.isArray(schemaObj)) {
          docusealFields = schemaObj;
        } else if (schemaObj.fields && Array.isArray(schemaObj.fields)) {
          docusealFields = schemaObj.fields;
        } else {
          console.warn('⚠️ Format de schema non reconnu:', typeof schemaObj);
          docusealFields = [];
        }
        
        console.log('📋 Nombre de champs DocuSeal détectés:', docusealFields.length);
      } catch (parseError) {
        console.error('Erreur lors du parsing du schema:', parseError);
        docusealFields = [];
      }
    }

    // 4️⃣ Récupérer les mappings existants configurés
    const existingMappings: any[] = db.prepare(`
      SELECT * FROM template_field_mappings 
      WHERE template_id = ?
      ORDER BY id ASC
    `).all(templateId);

    // 5️⃣ Créer un Map pour accès rapide
    const mappingsMap: { [key: string]: any } = {};
    existingMappings.forEach(mapping => {
      mappingsMap[mapping.docuseal_field_name] = mapping;
    });

    // 6️⃣ MERGING : Fusionner les champs DocuSeal avec les mappings existants
    const unifiedConfig = docusealFields.map((docusealField: any) => {
      const fieldName = docusealField.name;
      const existingMapping = mappingsMap[fieldName];

      if (existingMapping) {
        // ✅ Configuration existe déjà : utiliser celle-ci
        return {
          ...existingMapping,
          is_required: docusealField.required !== undefined ? (docusealField.required ? 1 : 0) : existingMapping.is_required,
          field_type: docusealField.type || existingMapping.field_type,
          // Convertir fusion INTEGER en objet si nécessaire
          fusion: existingMapping.fusion
        };
      } else {
        // ⚠️ Pas de config : DÉTECTION AUTO
        const detectedCategory = autoDetectCategory(fieldName);
        const detectedFieldName = autoDetectFieldName(fieldName, detectedCategory);
        
        // Si détection de fusion Nom+Prénom, créer la config JSON
        let fusionConfig = null;
        if (detectedFieldName === 'nom_prenom_fusion') {
          fusionConfig = JSON.stringify({
            enabled: true,
            fields: ['prenom', 'nom'],
            separator: ' ',
            pattern: '{prenom} {nom}'
          });
        }

        return {
          id: null,  // Pas encore sauvegardé en DB
          template_id: templateId,
          docuseal_field_name: fieldName,
          source_category: detectedCategory,
          contact_field_name: detectedFieldName === 'nom_prenom_fusion' ? null : detectedFieldName,
          field_type: docusealField.type || 'text',
          is_dynamic: detectedCategory === 'dynamique' ? 1 : 0,
          label: fieldName,
          is_required: docusealField.required ? 1 : 0,
          fusion: fusionConfig,
          created_at: null
        };
      }
    });

    console.log('📡 Envoi de la config pour le template ' + templateId + ':', JSON.stringify(unifiedConfig).substring(0, 100) + '...');
    res.json({ success: true, data: unifiedConfig });
  } catch (error) {
    console.error('Error fetching and merging template config:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la configuration' });
  }
});

/**
 * @route   POST /api/templates/:id/config
 * @desc    Sauvegarde la configuration de mappage d'un template (Admin uniquement)
 */
router.post('/:templateId/config', authenticateToken, isAdmin, (req: any, res) => {
  const { templateId } = req.params;
  const { mappings } = req.body;

  if (!Array.isArray(mappings)) {
    return res.status(400).json({ message: "Le champ 'mappings' doit être un array" });
  }

  try {
    // Supprimer les anciens mappings
    db.prepare('DELETE FROM template_field_mappings WHERE template_id = ?').run(templateId);

    // Insérer les nouveaux mappings
    const insert = db.prepare(`
      INSERT INTO template_field_mappings 
      (template_id, docuseal_field_name, source_category, contact_field_name, field_type, is_dynamic, label, is_required, fusion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    mappings.forEach((mapping: any) => {
      // Conversion de fusion : si c'est un booléen 0/1, convertir en JSON approprié
      let fusionValue = mapping.fusion;
      if (typeof fusionValue === 'number' || typeof fusionValue === 'boolean') {
        if (fusionValue) {
          // Valeur 1/true : créer config par défaut Nom+Prénom
          fusionValue = JSON.stringify({
            enabled: true,
            fields: ['prenom', 'nom'],
            separator: ' ',
            pattern: '{prenom} {nom}'
          });
        } else {
          fusionValue = null;
        }
      } else if (typeof fusionValue === 'object' && fusionValue !== null) {
        // Si c'est déjà un objet, le stringifier
        fusionValue = JSON.stringify(fusionValue);
      }
      
      insert.run(
        templateId,
        mapping.docuseal_field_name,
        mapping.source_category || 'dynamique',  // ✅ Nouvelle colonne
        mapping.contact_field_name || null,
        mapping.field_type || 'text',
        mapping.is_dynamic ? 1 : 0,
        mapping.label || mapping.docuseal_field_name,
        mapping.is_required ? 1 : 0,
        fusionValue  // ✅ Gère JSON ou null
      );
    });

    // Log de l'activité
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'configured_template', `Configuration sauvegardée pour template ID: ${templateId}`);

    res.json({ success: true, message: 'Configuration sauvegardée' });
  } catch (error) {
    console.error('Error saving template config:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde de la configuration' });
  }
});

/**
 * @route   GET /api/templates/:id/mappings
 * @desc    Récupère les mappings configurés pour remplir les champs d'un template
 */
router.get('/:templateId/mappings', authenticateToken, (req: any, res) => {
  const { templateId } = req.params;

  try {
    const mappings = db.prepare(`
      SELECT * FROM template_field_mappings 
      WHERE template_id = ?
      ORDER BY id ASC
    `).all(templateId);

    res.json({ success: true, data: mappings || [] });
  } catch (error) {
    console.error('Error fetching template mappings:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des mappings' });
  }
});

export default router;