import db from './db.ts';
import { docusealApi } from './api/docuseal.ts';

async function migrate() {
  console.log('🔍 Recherche des documents avec submitter_id manquant...');
  const docs = db.prepare(`
    SELECT id, docuseal_submission_id
    FROM documents
    WHERE docuseal_submitter_id IS NULL
      AND docuseal_submission_id IS NOT NULL
  `).all() as { id: number; docuseal_submission_id: number }[];

  console.log(`📄 ${docs.length} document(s) à traiter.`);

  let success = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const submission = await docusealApi.getSubmission(doc.docuseal_submission_id);
      const submitterId = submission.submitters?.[0]?.id ?? null;
      if (submitterId) {
        db.prepare(`
          UPDATE documents SET docuseal_submitter_id = ? WHERE id = ?
        `).run(submitterId, doc.id);
        console.log(`✅ Document ${doc.id} → submitter_id ${submitterId}`);
        success++;
      } else {
        console.warn(`⚠️ Aucun submitter_id trouvé pour document ${doc.id} (submission ${doc.docuseal_submission_id})`);
        failed++;
      }
    } catch (error: any) {
      console.error(`❌ Erreur lors de la récupération de la submission ${doc.docuseal_submission_id} (document ${doc.id}):`, error.message);
      failed++;
    }
  }

  console.log(`\n✅ Migration terminée : ${success} succès, ${failed} échecs.`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});