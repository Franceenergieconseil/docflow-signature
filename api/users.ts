import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken } from './auth.ts';
import bcrypt from 'bcryptjs';

const router = Router();

// ========== ADMIN ONLY MIDDLEWARE ==========
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Accès réservé aux administrateurs" });
  }
  next();
};

// ========== GET ALL USERS ==========
router.get('/', authenticateToken, requireAdmin, (req: any, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, first_name, last_name, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `).all();
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des utilisateurs" });
  }
});

// ========== CREATE USER ==========
router.post('/', authenticateToken, requireAdmin, (req: any, res) => {
  const { email, first_name, last_name, role } = req.body;

  // Validation
  if (!email || !first_name || !last_name || !role) {
    return res.status(400).json({ 
      success: false, 
      message: "Email, prénom, nom et rôle sont obligatoires" 
    });
  }

  if (!['admin', 'commercial'].includes(role)) {
    return res.status(400).json({ 
      success: false, 
      message: "Rôle invalide (admin ou commercial)" 
    });
  }

  // Vérifier que l'email n'existe pas
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ 
      success: false, 
      message: "Cet email est déjà utilisé" 
    });
  }

  try {
    // Générer un mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    const result = db.prepare(`
      INSERT INTO users (email, password, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, hashedPassword, first_name, last_name, role);

    // Log activity
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'created_user', `Créé utilisateur ${email} avec rôle ${role}`);

    const newUser = db.prepare('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({ 
      success: true, 
      data: newUser,
      tempPassword: tempPassword,
      message: `Utilisateur créé. Mot de passe temporaire: ${tempPassword}`
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la création de l'utilisateur" });
  }
});

// ========== UPDATE USER ==========
router.put('/:userId', authenticateToken, requireAdmin, (req: any, res) => {
  const { userId } = req.params;
  const { email, first_name, last_name, role } = req.body;

  // Vérifier l'utilisateur existe
  const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
  }

  // Vérifier que le nouvel email n'existe pas (si changement)
  if (email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: "Cet email est déjà utilisé" 
      });
    }
  }

  try {
    const updateData = {
      email: email || user.email,
      first_name: first_name || user.first_name,
      last_name: last_name || user.last_name,
      role: role || user.role
    };

    db.prepare(`
      UPDATE users 
      SET email = ?, first_name = ?, last_name = ?, role = ?
      WHERE id = ?
    `).run(updateData.email, updateData.first_name, updateData.last_name, updateData.role, userId);

    // Log activity
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'updated_user', `Modifié utilisateur ${user.email}`);

    const updatedUser = db.prepare('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?')
      .get(userId);

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la modification de l'utilisateur" });
  }
});

// ========== DELETE USER ==========
router.delete('/:userId', authenticateToken, requireAdmin, (req: any, res) => {
  const { userId } = req.params;

  // Vérifier que l'utilisateur n'essaie pas de se supprimer lui-même
  if (req.user.id === parseInt(userId)) {
    return res.status(400).json({ 
      success: false, 
      message: "Vous ne pouvez pas supprimer votre propre compte" 
    });
  }

  // Vérifier l'utilisateur existe
  const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
  }

  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // Log activity
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'deleted_user', `Supprimé utilisateur ${user.email}`);

    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la suppression de l'utilisateur" });
  }
});

// ========== RESET PASSWORD ==========
router.post('/:userId/reset-password', authenticateToken, requireAdmin, (req: any, res) => {
  const { userId } = req.params;

  // Vérifier l'utilisateur existe
  const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
  }

  try {
    // Générer un mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    db.prepare('UPDATE users SET password = ? WHERE id = ?')
      .run(hashedPassword, userId);

    // Log activity
    db.prepare('INSERT INTO activities (user_id, action, details) VALUES (?, ?, ?)')
      .run(req.user.id, 'reset_password', `Réinitialise mot de passe pour ${user.email}`);

    res.json({ 
      success: true,
      tempPassword: tempPassword,
      message: `Mot de passe réinitialisé. Nouveau mot de passe temporaire: ${tempPassword}`
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la réinitialisation du mot de passe" });
  }
});

export default router;
