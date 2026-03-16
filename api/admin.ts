import { Router } from 'express';
import db from '../db.ts';
import { authenticateToken } from './auth.ts';

const router = Router();

// ========== ADMIN ONLY MIDDLEWARE ==========
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Accès réservé aux administrateurs" });
  }
  next();
};

// ========== GET DASHBOARD STATS ==========
router.get('/stats/dashboard', authenticateToken, requireAdmin, (req: any, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Total dossiers du mois
    const totalDossiers: any = db.prepare(`
      SELECT COUNT(*) as count FROM documents 
      WHERE sent_at >= ?
    `).get(firstDayOfMonth);

    // En attente de signature
    const enAttente: any = db.prepare(`
      SELECT COUNT(*) as count FROM documents 
      WHERE sent_at >= ? AND status IN ('sent', 'opened')
    `).get(firstDayOfMonth);

    // Terminés (signés)
    const termines: any = db.prepare(`
      SELECT COUNT(*) as count FROM documents 
      WHERE sent_at >= ? AND status = 'signed'
    `).get(firstDayOfMonth);

    const total = totalDossiers.count || 0;
    const pending = enAttente.count || 0;
    const completed = termines.count || 0;
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalDossiers: total,
        enAttente: pending,
        termines: completed,
        tauxConversion: conversionRate
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des statistiques" });
  }
});

// ========== GET DOCUMENTS LIST WITH DETAILS ==========
router.get('/documents/list', authenticateToken, requireAdmin, (req: any, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Récupérer tous les documents du mois avec les détails
    const documents: any[] = db.prepare(`
      SELECT 
        d.id,
        d.docuseal_submission_id as dossierNumber,
        c.prenom as clientPrenom,
        c.nom as clientNom,
        u.first_name as commercialPrenom,
        u.last_name as commercialNom,
        d.status,
        d.sent_at as sentAt,
        t.nom_template as templateName
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      JOIN users u ON d.sender_id = u.id
      JOIN document_templates t ON d.template_id = t.id
      WHERE d.sent_at >= ?
      ORDER BY d.sent_at DESC
    `).all(firstDayOfMonth);

    // Calculer le délai pour chaque document
    const docsWithDelay = documents.map((doc: any) => {
      const sentDate = new Date(doc.sentAt);
      const delayMs = now.getTime() - sentDate.getTime();
      const delayHours = delayMs / (1000 * 60 * 60);
      const delayDays = delayHours / 24;

      let delayFormatted = '';
      if (delayHours < 1) {
        delayFormatted = `${Math.round(delayMs / (1000 * 60))}m`;
      } else if (delayHours < 24) {
        delayFormatted = `${Math.round(delayHours)}h`;
      } else {
        delayFormatted = `${Math.round(delayDays)}j`;
      }

      return {
        ...doc,
        delayMs,
        delayFormatted,
        isOverdue: delayHours > 48
      };
    });

    res.json({
      success: true,
      data: docsWithDelay
    });
  } catch (error) {
    console.error('Error fetching documents list:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des documents" });
  }
});

// ========== GET COMMERCIAL PERFORMANCE ==========
router.get('/commerciaux/performance', authenticateToken, requireAdmin, (req: any, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Top commerciaux avec dossiers signés ce mois
    const commerciaux: any[] = db.prepare(`
      SELECT 
        u.id,
        u.first_name as firstName,
        u.last_name as lastName,
        COUNT(d.id) as totalCount,
        SUM(CASE WHEN d.status = 'signed' THEN 1 ELSE 0 END) as signedCount
      FROM users u
      LEFT JOIN documents d ON u.id = d.sender_id AND d.sent_at >= ?
      WHERE u.role = 'commercial'
      GROUP BY u.id
      ORDER BY signedCount DESC
      LIMIT 5
    `).all(firstDayOfMonth);

    res.json({
      success: true,
      data: commerciaux
    });
  } catch (error) {
    console.error('Error fetching commercial performance:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des performances" });
  }
});

export default router;
