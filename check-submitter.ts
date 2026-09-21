import db from './db.ts';

const count = db.prepare('SELECT COUNT(*) as c FROM documents WHERE docuseal_submitter_id IS NULL').get() as {c:number};
const total = db.prepare('SELECT COUNT(*) as c FROM documents').get() as {c:number};
console.log(`Documents with null submitter_id: ${count.c} / ${total.c}`);