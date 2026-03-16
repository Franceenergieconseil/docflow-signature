import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { ArrowLeft, Plus, Trash2, Save, Loader2, AlertCircle, Check, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentTemplate } from '../types';

interface FieldMapping {
  id?: number;
  docuseal_field_name: string;
  contact_field_name: string | null;
  field_type: string;
  is_dynamic: boolean;
  label: string;
  is_required: boolean;
  fusion?: boolean;
}

const contactFieldOptions = [
  { value: 'email', label: 'Email du contact' },
  { value: 'prenom', label: 'Prénom' },
  { value: 'nom', label: 'Nom' },
  { value: 'fonction', label: 'Fonction' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'siret', label: 'SIRET' },
  { value: 'adresse', label: 'Adresse du siège social' },
  { value: 'nom_et_prenom', label: 'Nom + Prénom (fusionné)' },
  { value: null, label: 'Champ dynamique (à remplir)' },
];

// Auto-detection patterns pour détection intelligente
const fieldDetectionPatterns: { [key: string]: string[] } = {
  email: ['email', 'mail', 'e-mail', 'adresse mail'],
  prenom: ['prenom', 'firstname', 'first name', 'prénom'],
  nom: ['nom', 'lastname', 'last name', 'name'],
  fonction: ['fonction', 'job', 'job title', 'poste', 'position', 'titre'],
  entreprise: ['entreprise', 'company', 'societe', 'société', 'raison sociale'],
  siret: ['siret', 'siren', 'numéro'],
  adresse: ['adresse', 'address', 'lieu', 'rue', 'adresse du siège'],
  nom_et_prenom: ['nom et prenom', 'nom et prénom', 'fullname', 'full name', 'nom du signataire', 'signataire', 'beneficiaire']
};

interface TemplateConfigProps {
  templateId: number;
  templateName: string;
  onBack: () => void;
  schema?: any;
}

const TemplateConfig: React.FC<TemplateConfigProps> = ({ templateId, templateName, onBack, schema }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [success, setSuccess] = useState(false);
  const [showAutoDetect, setShowAutoDetect] = useState(false);

  useEffect(() => {
    fetchMappings();
  }, [templateId]);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setFieldMappings(data.data.map((m: any) => ({
          ...m,
          is_dynamic: !!m.is_dynamic,
          is_required: !!m.is_required,
          contact_field_name: m.contact_field_name || null,
          fusion: m.fusion
        })));
      } else {
        // Pas de config existante, vide
        setFieldMappings([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mappages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Détection intelligente des champs
  const detectFieldType = (fieldName: string): string => {
    const lowerName = fieldName.toLowerCase();
    
    for (const [fieldType, patterns] of Object.entries(fieldDetectionPatterns)) {
      if (patterns.some(pattern => lowerName.includes(pattern))) {
        return fieldType;
      }
    }
    
    return 'text';
  };

  const autoDetectMappings = () => {
    if (!schema) return;
    
    try {
      const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
      const docusealFields = schemaObj.fields || [];
      
      const autoMappings: FieldMapping[] = docusealFields.map((field: any) => {
        const detectedContactField = detectFieldType(field.name);
        
        return {
          docuseal_field_name: field.name,
          contact_field_name: detectedContactField === 'text' ? null : detectedContactField,
          field_type: field.type || 'text',
          is_dynamic: detectedContactField === 'text',
          label: field.name,
          is_required: field.required || false,
          fusion: detectedContactField === 'nom_et_prenom'
        };
      });
      
      setFieldMappings(autoMappings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Erreur lors de la détection automatique:', error);
    }
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mappings: fieldMappings.map(m => ({
            docuseal_field_name: m.docuseal_field_name,
            contact_field_name: m.contact_field_name,
            field_type: m.field_type,
            is_dynamic: m.is_dynamic ? 1 : 0,
            label: m.label,
            is_required: m.is_required ? 1 : 0,
            fusion: m.fusion ? 1 : 0
          }))
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...fieldMappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    setFieldMappings(newMappings);
  };

  const addCustomField = () => {
    setFieldMappings([
      ...fieldMappings,
      {
        docuseal_field_name: `custom_field_${Date.now()}`,
        contact_field_name: null,
        field_type: 'text',
        is_dynamic: true,
        label: 'Nouveau champ',
        is_required: false
      }
    ]);
  };

  const removeMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuration des champs</h2>
          <p className="text-[#64748B] mt-1">{templateName}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="text-[#2563EB] animate-spin" />
          <p className="text-[#64748B] font-medium">Chargement de la configuration...</p>
        </div>
      ) : (
        <>
          {/* Info Box */}
          <div className="card bg-blue-50 border-blue-200 p-4 flex gap-3">
            <AlertCircle className="text-blue-600 shrink-0" size={20} />
            <div className="text-sm text-blue-800 flex-1">
              <p className="font-bold mb-1">📝 Configuration des champs</p>
              <p>Mappez les champs DocuSeal avec les données du contact ou définissez des champs dynamiques que le commercial devra remplir.</p>
            </div>
          </div>

          {/* Auto-detect button */}
          <button
            onClick={autoDetectMappings}
            className="w-full card p-4 border-2 border-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-all flex items-center justify-center gap-2 text-[#2563EB] font-bold"
          >
            <Zap size={20} />
            <span>🤖 Détection automatique des champs</span>
          </button>

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card bg-emerald-50 border-emerald-200 p-4 flex gap-3"
            >
              <Check className="text-emerald-600 shrink-0" size={20} />
              <p className="text-emerald-700 font-medium">Configuration sauvegardée avec succès ✓</p>
            </motion.div>
          )}

          <div className="space-y-4">
            {fieldMappings.length === 0 ? (
              <div className="card p-12 text-center text-[#64748B] italic">
                Aucune configuration définie. Créez des champs personnalisés pour ce template.
              </div>
            ) : (
              fieldMappings.map((mapping, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-6 space-y-4"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                        Nom du champ
                      </label>
                      <input
                        type="text"
                        value={mapping.label}
                        onChange={(e) => updateMapping(index, { label: e.target.value })}
                        placeholder="ex: Email du client"
                        className="input"
                      />
                    </div>
                    <button
                      onClick={() => removeMapping(index)}
                      className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                        Mappage avec le contact
                      </label>
                      <select
                        value={mapping.contact_field_name || 'custom'}
                        onChange={(e) => {
                          const value = e.target.value === 'custom' ? null : e.target.value;
                          updateMapping(index, {
                            contact_field_name: value,
                            is_dynamic: value === null,
                            fusion: value === 'nom_et_prenom'
                          });
                        }}
                        className="input"
                      >
                        {contactFieldOptions.map(opt => (
                          <option key={opt.value || 'custom'} value={opt.value || 'custom'}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                        Type de champ
                      </label>
                      <select
                        value={mapping.field_type}
                        onChange={(e) => updateMapping(index, { field_type: e.target.value })}
                        className="input"
                      >
                        <option value="text">Texte</option>
                        <option value="email">Email</option>
                        <option value="number">Nombre</option>
                        <option value="date">Date</option>
                        <option value="textarea">Texte long</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id={`required-${index}`}
                      checked={mapping.is_required}
                      onChange={(e) => updateMapping(index, { is_required: e.target.checked })}
                      className="w-4 h-4 rounded border-[#E2E8F0]"
                    />
                    <label htmlFor={`required-${index}`} className="text-sm text-[#64748B]">
                      Champ obligatoire
                    </label>
                  </div>

                  {mapping.is_dynamic && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                      <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                        CHAMP DYNAMIQUE - À remplir par le commercial
                      </span>
                    </div>
                  )}
                  {mapping.contact_field_name && !mapping.fusion && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                      <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                        MAPPAGE CONTACT - Pré-rempli automatiquement
                      </span>
                    </div>
                  )}
                  {mapping.fusion && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">
                        🔗 FUSION - Prénom + Nom combinés
                      </span>
                      <p className="text-xs text-[#64748B] mt-2">
                        Ce champ sera pré-rempli avec: <code className="bg-gray-100 px-2 py-1 rounded">prénom + " " + nom</code>
                      </p>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          <button
            onClick={addCustomField}
            className="w-full card p-4 border-2 border-dashed border-[#E2E8F0] hover:border-[#2563EB] hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-[#2563EB] font-bold"
          >
            <Plus size={20} />
            <span>Ajouter un champ personnalisé</span>
          </button>

          <div className="flex gap-4 pt-6">
            <button
              onClick={onBack}
              className="btn-secondary flex-1 h-14"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveMappings}
              disabled={saving}
              className="btn-primary flex-1 h-14 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Sauvegarder la configuration</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TemplateConfig;
