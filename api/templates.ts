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
 * @route   GET /api/templates/:id/config
 * @desc    Récupère la configuration de mappage d'un template
 */
router.get('/:templateId/config', authenticateToken, (req: any, res) => {
  const { templateId } = req.params;

  try {
    const config = db.prepare(`
      SELECT * FROM template_field_mappings 
      WHERE template_id = ?
      ORDER BY id ASC
    `).all(templateId);

    res.json({ success: true, data: config || [] });
  } catch (error) {
    console.error('Error fetching template config:', error);
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
      (template_id, docuseal_field_name, contact_field_name, field_type, is_dynamic, label, is_required, fusion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    mappings.forEach((mapping: any) => {
      insert.run(
        templateId,
        mapping.docuseal_field_name,
        mapping.contact_field_name || null,
        mapping.field_type || 'text',
        mapping.is_dynamic ? 1 : 0,
        mapping.label || mapping.docuseal_field_name,
        mapping.is_required ? 1 : 0,
        mapping.fusion ? 1 : 0
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