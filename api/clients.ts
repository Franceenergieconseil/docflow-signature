import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken } from './auth.ts';

const router = Router();

// Get all clients
router.get('/', authenticateToken, (req: any, res) => {
  try {
    console.log('GET /api/clients hit');
    const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
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
      INSERT INTO clients (prenom, nom, email, entreprise, siret, adresse, fonction, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(prenom, nom, email, entreprise, siret || null, adresse || null, fonction || null, req.user.id);

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
