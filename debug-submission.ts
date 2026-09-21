import { docusealApi } from './api/docuseal.ts';

async function test() {
  const sub = await docusealApi.getSubmission(111);
  console.log(JSON.stringify(sub, null, 2));
}
test().catch(console.error);