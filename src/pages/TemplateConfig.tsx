import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { ArrowLeft, Save, Loader2, AlertCircle, Check } from 'lucide-react';
import { motion } from 'motion/react';
import MappingTable from './MappingTable';

interface UnifiedFieldConfig {
  id: number | null;
  template_id: number;
  docuseal_field_name: string;
  source_category: 'client' | 'entreprise' | 'dynamique' | 'ignore';
  contact_field_name: string | null;
  field_type: string;
  is_dynamic: number;
  label: string;
  is_required: number;
  fusion: string | null;
  created_at: string | null;
}

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
  const [fieldMappings, setFieldMappings] = useState<UnifiedFieldConfig[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMappings();
  }, [templateId]);

  const fetchMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/templates/${templateId}/config?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setFieldMappings(data.data);
      } else {
        setError('Format de réponse inattendu');
        setFieldMappings([]);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des mappages:', error);
      setError(error.message || 'Erreur lors du chargement');
      setFieldMappings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    setError(null);
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
            source_category: m.source_category,
            contact_field_name: m.contact_field_name,
            field_type: m.field_type,
            is_dynamic: m.is_dynamic ? 1 : 0,
            label: m.label,
            is_required: m.is_required ? 1 : 0,
            fusion: m.fusion
          }))
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          // Recharger pour récupérer les IDs assignés
          fetchMappings();
        }, 2000);
      } else {
        setError(data.message || 'Erreur lors de la sauvegarde');
      }
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      setError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Configuration des champs</h2>
            <p className="text-[#64748B] mt-1">{templateName}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => fetchMappings()}
            disabled={loading}
            className="btn-secondary h-12 px-4 flex items-center gap-2"
          >
            <span>🔍 Détection Automatique</span>
          </button>
          <button
            onClick={handleSaveMappings}
            disabled={saving || loading}
            className="btn-primary h-12 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Sauvegarde...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Enregistrer la configuration</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages de feedback */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="card bg-emerald-50 border-emerald-200 p-4 flex gap-3"
        >
          <Check className="text-emerald-600 shrink-0" size={20} />
          <p className="text-emerald-700 font-medium">✓ Configuration sauvegardée avec succès !</p>
        </motion.div>
      )}
      
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-red-50 border-red-200 p-4 flex gap-3"
        >
          <AlertCircle className="text-red-600 shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-700 font-medium">Erreur</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="text-[#2563EB] animate-spin" />
          <p className="text-[#64748B] font-medium">Chargement de la configuration...</p>
        </div>
      ) : (
        <>
          {/* Mapping Table */}
          <MappingTable 
            mappings={fieldMappings} 
            onChange={setFieldMappings} 
          />

          {/* Boutons d'action (en bas) */}
          <div className="flex gap-4 pt-6 border-t border-[#E2E8F0]">
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
