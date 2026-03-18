import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utilise DATABASE_PATH depuis l'environnement, sinon /app/data/database.sqlite par défaut
const dbFile = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'database.sqlite');

// Crée le répertoire parent si nécessaire (pour Docker)
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`✓ Created database directory: ${dbDir}`);
}

console.log(`Using SQLite file: ${dbFile}`);

const db = new Database(dbFile);

// ENABLE FOREIGN KEYS
db.pragma('foreign_keys = ON');

// ============================================================================
// INITIALISATION DES TABLES (Source unique de vérité)
// ============================================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'commercial')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    email TEXT NOT NULL,
    entreprise TEXT NOT NULL,
    siret TEXT,
    adresse TEXT,
    fonction TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS document_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_docuseal INTEGER UNIQUE NOT NULL,
    nom_template TEXT NOT NULL,
    slug TEXT,
    schema TEXT,
    available INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS template_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT,
    mapped_to TEXT,
    FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    docuseal_submission_id INTEGER,
    status TEXT CHECK(status IN ('sent', 'opened', 'signed', 'declined', 'expired')) DEFAULT 'sent',
    dynamic_data TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS template_field_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    docuseal_field_name TEXT NOT NULL,
    contact_field_name TEXT,
    field_type TEXT DEFAULT 'text',
    is_dynamic INTEGER DEFAULT 0,
    label TEXT,
    is_required INTEGER DEFAULT 0,
    fusion INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ============================================================================
// MIGRATIONS (Ajustements de schéma)
// ============================================================================

console.log('Running schema migrations...');

try {
  // Ajouter les colonnes schema et slug si elles n'existent pas
  try {
    db.exec("ALTER TABLE document_templates ADD COLUMN schema TEXT");
    console.log('✓ Column schema added to document_templates');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.exec("ALTER TABLE document_templates ADD COLUMN available INTEGER DEFAULT 0");
    console.log('✓ Column available added to document_templates');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.exec("ALTER TABLE document_templates ADD COLUMN slug TEXT");
    console.log('✓ Column slug added to document_templates');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.exec("ALTER TABLE documents ADD COLUMN expires_at DATETIME");
    console.log('✓ Column expires_at added to documents');
  } catch (e) {
    // Colonne existe déjà
  }

  // Ajouter les colonnes aux clients
  try {
    db.exec("ALTER TABLE clients ADD COLUMN siret TEXT");
    console.log('✓ Column siret added to clients');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.exec("ALTER TABLE clients ADD COLUMN adresse TEXT");
    console.log('✓ Column adresse added to clients');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.exec("ALTER TABLE template_field_mappings ADD COLUMN fusion INTEGER DEFAULT 0");
    console.log('✓ Column fusion added to template_field_mappings');
  } catch (e) {
    // Colonne existe déjà
  }

  try {
    db.exec("ALTER TABLE clients ADD COLUMN fonction TEXT");
    console.log('✓ Column fonction added to clients');
  } catch (e) {
    // Colonne existe déjà
  }

  // Ajouter la colonne source_category pour la catégorisation des mappings
  try {
    db.exec("ALTER TABLE template_field_mappings ADD COLUMN source_category TEXT DEFAULT 'dynamique'");
    console.log('✓ Column source_category added to template_field_mappings');
  } catch (e) {
    // Colonne existe déjà
  }

  // NOTE: La colonne fusion existe déjà en tant que INTEGER.
  // SQLite ne supporte pas ALTER COLUMN TYPE, mais TEXT peut stocker du JSON.
  // La colonne fusion actuelle (INTEGER) sera progressivement remplacée par des valeurs JSON.
  // Les valeurs 0/1 seront converties côté application en JSON approprié.

  // Insérer l'utilisateur admin par défaut s'il n'existe pas
  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (email, password, first_name, last_name, role) 
      VALUES ('admin@example.com', ?, 'Admin', 'User', 'admin')
    `).run(hashedPassword);
    console.log('✓ Admin user inserted');
  } catch (e) {
    // Admin existe déjà
  }

  // Insérer un utilisateur commercial par défaut s'il n'existe pas
  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = bcrypt.hashSync('commercial123', 10);
    db.prepare(`
      INSERT INTO users (email, password, first_name, last_name, role) 
      VALUES ('commercial@example.com', ?, 'Jean', 'Dupont', 'commercial')
    `).run(hashedPassword);
    console.log('✓ Commercial user inserted');
  } catch (e) {
    // Commercial existe déjà
  }

  // Insérer un utilisateur commercial de test s'il n'existe pas
  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = bcrypt.hashSync('test123', 10);
    db.prepare(`
      INSERT INTO users (email, password, first_name, last_name, role) 
      VALUES ('test.commercial@example.com', ?, 'Test', 'Commercial', 'commercial')
    `).run(hashedPassword);
    console.log('✓ Test commercial user inserted');
  } catch (e) {
    // Commercial test existe déjà
  }

  console.log('\n✅ Schema initialization complete');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

export default db;
