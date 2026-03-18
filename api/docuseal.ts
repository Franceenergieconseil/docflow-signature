const getBaseUrl = () => {
  let url = process.env.DOCUSEAL_API_URL || 'https://docsign.f-energieconseil.fr/api';
  // If it's a custom domain (not api.docuseal.com) and doesn't end with /api, append it
  if (!url.includes('api.docuseal.com') && !url.endsWith('/api')) {
    url = url.endsWith('/') ? `${url}api` : `${url}/api`;
  }
  return url;
};

const DOCUSEAL_API_URL = getBaseUrl();
const API_KEY = process.env.DOCUSEAL_API_KEY;

export interface DocusealSubmissionParams {
  template_id: number;
  send_email?: boolean;
  submitters: {
    email: string;
    role?: string;
    fields?: Record<string, any>;
  }[];
}

export const docusealApi = {
  async sendDocument(params: DocusealSubmissionParams) {
    if (!API_KEY) {
      console.warn('DOCUSEAL_API_KEY is not set. Using mock response.');
      return { id: Math.floor(Math.random() * 1000000), status: 'sent' };
    }

    const response = await fetch(`${DOCUSEAL_API_URL}/submissions`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Erreur détaillée DocuSeal:', JSON.stringify(errorData, null, 2));
      console.error('📋 Status:', response.status, response.statusText);
      throw new Error(`Failed to send document: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('✅ Document envoyé avec succès:', result);
    return result;
  },

  async getSubmission(id: number) {
    if (!API_KEY) return { id, status: 'sent' };

    const response = await fetch(`${DOCUSEAL_API_URL}/submissions/${id}`, {
      headers: { 'X-Auth-Token': API_KEY },
    });

    return response.json();
  },

  async getTemplates() {
    // Essayer d'abord /api/v1/templates, puis /api/templates en fallback
    const baseUrl = DOCUSEAL_API_URL;
    const apiUrls = [
      `${baseUrl}/v1/templates`,
      `${baseUrl}/templates`,
      baseUrl.replace(/\/api\/?$/, '') + '/api/v1/templates'
    ];

    if (!API_KEY) {
      console.warn('⚠️  DOCUSEAL_API_KEY manquante - retour de données de test');
      return {
        data: [
          { id: 101, name: 'Contrat de Vente', created_at: new Date().toISOString() },
          { id: 102, name: 'Accord de Confidentialité', created_at: new Date().toISOString() }
        ]
      };
    }

    console.log('🌐 Appel API DocuSeal - Clé API:', API_KEY.substring(0, 10) + '...');

    for (const apiUrl of apiUrls) {
      try {
        console.log(`📍 Tentative URL: ${apiUrl}`);
        const response = await fetch(apiUrl, {
          headers: { 
            'X-Auth-Token': API_KEY,
            'Content-Type': 'application/json'
          },
        });

        console.log(`  Réponse: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const data = await response.json();
          const count = Array.isArray(data) ? data.length : (data.data?.length || 0);
          console.log(`✅ Succès! Reçu ${count} templates de: ${apiUrl}`);
          return data;
        }

        if (response.status === 401) {
          console.error('❌ 401 Unauthorized - Clé API invalide ou expirée');
          throw new Error('Clé API DocuSeal invalide (401)');
        }

        const errorText = await response.text();
        console.warn(`⚠️  ${response.status}: ${errorText.substring(0, 200)}`);
      } catch (error: any) {
        console.error(`❌ Erreur sur ${apiUrl}:`, error.message);
      }
    }

    throw new Error('Impossible de contacter l\'API DocuSeal. Vérifiez DOCUSEAL_API_KEY et DOCUSEAL_API_URL');
  },

  async getTemplateFields(templateId: number) {
    if (!API_KEY) {
      return [
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'company', type: 'text' },
        { name: 'pdl', type: 'text' },
        { name: 'siret', type: 'text' }
      ];
    }

    const response = await fetch(`${DOCUSEAL_API_URL}/templates/${templateId}`, {
      headers: { 'X-Auth-Token': API_KEY },
    });

    if (!response.ok) throw new Error('Failed to fetch template fields from Docuseal');
    const data = await response.json();
    // Docuseal usually returns fields in schema or similar
    return data.fields || [];
  },

  async resendSubmission(submissionId: number) {
    if (!API_KEY) {
      console.warn('DOCUSEAL_API_KEY is not set. Using mock response.');
      return { id: submissionId, status: 'sent', message: 'Mock resend successful' };
    }

    const response = await fetch(`${DOCUSEAL_API_URL}/submissions/${submissionId}/resend`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resend document to Docuseal');
    }

    return response.json();
  }
};
