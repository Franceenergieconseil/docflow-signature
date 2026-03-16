export type UserRole = 'admin' | 'commercial';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: string;
}

export interface Client {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  entreprise: string;
  siret?: string;
  adresse?: string;
  fonction?: string;
  created_by: number;
  created_at: string;
}

export interface DocumentTemplate {
  id: number;
  nom_template: string;
  id_docuseal: number;
  slug: string | null;
  schema: string | null;
  available: number;
  created_at: string;
}

export type DocumentStatus = 'sent' | 'opened' | 'signed' | 'declined' | 'expired';

export interface Document {
  id: number;
  client_id: number;
  template_id: number;
  sender_id: number;
  docuseal_submission_id: number | null;
  status: DocumentStatus;
  dynamic_data: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  user_id: number;
  action: string;
  details: string | null;
  created_at: string;
}
