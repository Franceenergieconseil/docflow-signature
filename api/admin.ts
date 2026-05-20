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

// ========== HELPER : CONVERTIT ?period= EN DATE ISO POUR SQLITE ==========
// Retourne null pour "all" (pas de filtre temporel)
function getPeriodDate(period: string | undefined): string | null {
  switch (period) {
    case '7d':  return new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();
    case '3m':  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case 'all': return null;
    case '30d':
    default:    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

// Construit la clause WHERE + paramètre selon la date limite (ou rien si null)
function buildDateFilter(sinceIso: string | null): { clause: string; params: string[] } {
  if (!sinceIso) return { clause: '', params: [] };
  return { clause: 'WHERE d.sent_at >= ?', params: [sinceIso] };
}

// ========== GET DASHBOARD STATS ==========
router.get('/stats/dashboard', authenticateToken, requireAdmin, (req: any, res) => {
  try {
    const sinceIso = getPeriodDate(req.query.period as string);
    const dateClause = sinceIso ? 'WHERE sent_at >= ?' : '';
    const dateParams = sinceIso ? [sinceIso] : [];

    // Total dossiers
    const totalDossiers: any = db.prepare(
      `SELECT COUNT(*) as count FROM documents ${dateClause}`
    ).get(...dateParams);

    // En attente de signature
    const enAttente: any = db.prepare(
      `SELECT COUNT(*) as count FROM documents ${dateClause ? dateClause + " AND status IN ('sent','opened')" : "WHERE status IN ('sent','opened')"}`
    ).get(...dateParams);

    // Terminés (signés)
    const termines: any = db.prepare(
      `SELECT COUNT(*) as count FROM documents ${dateClause ? dateClause + " AND status = 'signed'" : "WHERE status = 'signed'"}`
    ).get(...dateParams);

    // Refusés
    const refuses: any = db.prepare(
      `SELECT COUNT(*) as count FROM documents ${dateClause ? dateClause + " AND status = 'declined'" : "WHERE status = 'declined'"}`
    ).get(...dateParams);

    // Documents en retard : statut sent/opened ET envoyés il y a plus de 48h
    const overdueThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const enRetard: any = db.prepare(`
      SELECT COUNT(*) as count FROM documents
      WHERE status IN ('sent', 'opened')
        AND sent_at <= ?
        ${sinceIso ? 'AND sent_at >= ?' : ''}
    `).get(...(sinceIso ? [overdueThreshold, sinceIso] : [overdueThreshold]));

    // Délai moyen de signature en secondes (updated_at - sent_at pour les signés)
    // SQLite stocke les dates en texte ISO — on utilise strftime et julianday
    const delaiMoyen: any = db.prepare(`
      SELECT AVG(
        (julianday(updated_at) - julianday(sent_at)) * 24
      ) as avgHours
      FROM documents
      WHERE status = 'signed'
        ${sinceIso ? 'AND sent_at >= ?' : ''}
    `).get(...(sinceIso ? [sinceIso] : []));

    // Performance par template (volume + taux de signature)
    const templatePerf: any[] = db.prepare(`
      SELECT
        t.id                                                     AS templateId,
        t.nom_template                                           AS templateName,
        COUNT(d.id)                                              AS totalCount,
        SUM(CASE WHEN d.status = 'signed'   THEN 1 ELSE 0 END)  AS signedCount,
        SUM(CASE WHEN d.status = 'declined' THEN 1 ELSE 0 END)  AS declinedCount,
        ROUND(
          SUM(CASE WHEN d.status = 'signed' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(d.id), 0), 1
        ) AS conversionRate
      FROM document_templates t
      LEFT JOIN documents d ON d.template_id = t.id
        ${sinceIso ? 'AND d.sent_at >= ?' : ''}
      GROUP BY t.id
      ORDER BY totalCount DESC
    `).all(...(sinceIso ? [sinceIso] : []));

    const total     = totalDossiers.count  || 0;
    const pending   = enAttente.count      || 0;
    const completed = termines.count       || 0;
    const declined  = refuses.count        || 0;
    const overdue   = enRetard.count       || 0;
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const refusalRate    = total > 0 ? Math.round((declined  / total) * 100) : 0;

    // Formater le délai moyen en texte lisible
    const avgHours = delaiMoyen?.avgHours ?? null;
    let delaiMoyenFormatted = 'N/A';
    if (avgHours !== null) {
      if (avgHours < 1)       delaiMoyenFormatted = `${Math.round(avgHours * 60)}min`;
      else if (avgHours < 24) delaiMoyenFormatted = `${Math.round(avgHours)}h`;
      else                    delaiMoyenFormatted = `${(avgHours / 24).toFixed(1)}j`;
    }

    res.json({
      success: true,
      data: {
        totalDossiers:        total,
        enAttente:            pending,
        termines:             completed,
        refuses:              declined,
        enRetard:             overdue,
        tauxConversion:       conversionRate,
        tauxRefus:            refusalRate,
        delaiMoyenHeures:     avgHours ? Math.round(avgHours * 10) / 10 : null,
        delaiMoyenFormatted,
        templatePerformance:  templatePerf
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
    const now      = new Date();
    const sinceIso = getPeriodDate(req.query.period as string);
    const dateClause = sinceIso ? 'WHERE d.sent_at >= ?' : '';
    const dateParams = sinceIso ? [sinceIso] : [];

    const documents: any[] = db.prepare(`
      SELECT
        d.id,
        d.docuseal_submission_id as dossierNumber,
        c.prenom  as clientPrenom,
        c.nom     as clientNom,
        u.first_name as commercialPrenom,
        u.last_name  as commercialNom,
        d.status,
        d.sent_at    as sentAt,
        t.nom_template as templateName
      FROM documents d
      JOIN clients c           ON d.client_id  = c.id
      JOIN users u             ON d.sender_id  = u.id
      JOIN document_templates t ON d.template_id = t.id
      ${dateClause}
      ORDER BY d.sent_at DESC
    `).all(...dateParams);

    const docsWithDelay = documents.map((doc: any) => {
      const sentDate  = new Date(doc.sentAt);
      const delayMs   = now.getTime() - sentDate.getTime();
      const delayHours = delayMs / (1000 * 60 * 60);
      const delayDays  = delayHours / 24;

      let delayFormatted = '';
      if      (delayHours < 1)  delayFormatted = `${Math.round(delayMs / (1000 * 60))}m`;
      else if (delayHours < 24) delayFormatted = `${Math.round(delayHours)}h`;
      else                      delayFormatted = `${Math.round(delayDays)}j`;

      return { ...doc, delayMs, delayFormatted, isOverdue: delayHours > 48 };
    });

    res.json({ success: true, data: docsWithDelay });
  } catch (error) {
    console.error('Error fetching documents list:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des documents" });
  }
});

// ========== GET COMMERCIAL PERFORMANCE ==========
router.get('/commerciaux/performance', authenticateToken, requireAdmin, (req: any, res) => {
  try {
    const sinceIso   = getPeriodDate(req.query.period as string);
    const dateFilter = sinceIso ? 'AND d.sent_at >= ?' : '';
    const dateParams = sinceIso ? [sinceIso] : [];

    const commerciaux: any[] = db.prepare(`
      SELECT
        u.id,
        u.first_name as firstName,
        u.last_name  as lastName,
        COUNT(d.id)  as totalCount,
        SUM(CASE WHEN d.status = 'signed'   THEN 1 ELSE 0 END) as signedCount,
        SUM(CASE WHEN d.status = 'declined' THEN 1 ELSE 0 END) as declinedCount,
        ROUND(
          SUM(CASE WHEN d.status = 'signed' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(d.id), 0),
          1
        ) as conversionRate
      FROM users u
      LEFT JOIN documents d ON u.id = d.sender_id ${dateFilter}
      WHERE u.role = 'commercial'
      GROUP BY u.id
      ORDER BY signedCount DESC, conversionRate DESC
      LIMIT 5
    `).all(...dateParams);

    res.json({ success: true, data: commerciaux });
  } catch (error) {
    console.error('Error fetching commercial performance:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des performances" });
  }
});

export default router;
