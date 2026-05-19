import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken } from './auth.ts';

const router = Router();

// Get all clients
router.get('/', authenticateToken, (req: any, res) => {
  try {
    console.log('GET /api/clients hit');

    let query = `
      SELECT c.*,
             u.first_name AS commercial_prenom,
             u.last_name  AS commercial_nom
      FROM clients c
      LEFT JOIN users u ON c.assigned_to = u.id
    `;

    const params: any[] = [];
    if (req.user.role !== 'admin') {
      query += ' WHERE c.assigned_to = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY c.created_at DESC';

    const clients = db.prepare(query).all(...params);
    res.json({ success: true, data: clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des clients" });
  }
});

// Create a client
router.post('/', authenticateToken, (req: any, res) => {
  const { prenom, nom, email, entreprise, siret, adresse, fonction } = req.body;
  
  if (!prenom || !nom || !email || !entreprise) {
    return res.status(400).json({ success: false, message: "Champs obligatoires manquants" });
  }

  try {
    const result = db.prepare(`
      INSERT INTO clients (prenom, nom, email, entreprise, siret, adresse, fonction, created_by, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(prenom, nom, email, entreprise, siret || null, adresse || null, fonction || null, req.user.id, req.user.id);

    const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    
    // Log activity
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'created_client', `Client créé : ${prenom} ${nom} (${entreprise})`);

    res.status(201).json({ success: true, data: newClient });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la création du client" });
  }
});

export default router;
