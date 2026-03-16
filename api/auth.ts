import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../db.ts';
import { Router } from 'express';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Middleware to verify JWT
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ message: "Authentication token missing or invalid" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// Middleware to check admin role
export const isAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Login route
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    }
  });
});

// Create initial admin if none exists
const createInitialAdmin = () => {
  const adminExists = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any;
  if (adminExists.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (email, password, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin@example.com', hashedPassword, 'Admin', 'User', 'admin');
    console.log('Initial admin created: admin@example.com / admin123');
  }
};

const createInitialTemplates = () => {
  // Les templates d'exemple ne sont plus créés automatiquement
  // Les vrais templates sont synchronisés via l'API DocuSeal
  // Les admins peuvent créer manuellement des templates s'ils le souhaitent
  console.log('✓ Templates initialization skipped - use Docuseal sync instead');
};

try {
  createInitialAdmin();
  createInitialTemplates();
} catch (error) {
  console.error('Error creating initial data:', error);
}

export default router;
