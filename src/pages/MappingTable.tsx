import React from 'react';

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

interface MappingTableProps {
  mappings: UnifiedFieldConfig[];
  onChange: (updatedMappings: UnifiedFieldConfig[]) => void;
}

const clientFieldOptions = [
  { value: 'nom', label: 'Nom' },
  { value: 'prenom', label: 'Prénom' },
  { value: 'email', label: 'Email' },
  { value: 'fonction', label: 'Fonction' },
  { value: 'nom_prenom_fusion', label: '🔗 Nom + Prénom (fusionné)' },
];

const entrepriseFieldOptions = [
  { value: 'entreprise', label: 'Raison Sociale' },
  { value: 'siret', label: 'SIRET' },
  { value: 'adresse', label: 'Adresse du Siège' },
];

const MappingTable: React.FC<MappingTableProps> = ({ mappings, onChange }) => {
  const updateField = (index: number, updates: Partial<UnifiedFieldConfig>) => {
    const next = [...mappings];
    const current = next[index];
    const updated: UnifiedFieldConfig = { ...current, ...updates };

    if (updates.source_category && updates.source_category !== current.source_category) {
      updated.contact_field_name = null;
      updated.label = '';
      updated.is_dynamic = updates.source_category === 'dynamique' ? 1 : 0;
      updated.fusion = null;
    }

    if (updates.contact_field_name === 'nom_prenom_fusion') {
      updated.fusion = JSON.stringify({ enabled: true, fields: ['prenom', 'nom'], pattern: '{prenom} {nom}' });
    } else if (updates.contact_field_name) {
      updated.fusion = null;
    }

    next[index] = updated;
    onChange(next);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-600 border-b border-slate-200">
        <div className="col-span-5">Nom du champ</div>
        <div className="col-span-3">Sélecteur Catégorie</div>
        <div className="col-span-4">Sélecteur Source</div>
      </div>

      {mappings.length === 0 ? (
        <div className="px-3 py-5 text-center text-slate-500">Aucun champ disponible.</div>
      ) : (
        mappings.map((mapping, index) => (
          <div key={`${mapping.docuseal_field_name}-${index}`} className="grid grid-cols-12 gap-2 px-3 py-3 border-b border-slate-100">
            <div className="col-span-5">
              <div className="font-medium text-slate-800">{mapping.docuseal_field_name}</div>
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${mapping.is_required === 1 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {mapping.is_required === 1 ? 'Requis' : 'Optionnel'}
              </span>
            </div>

            <div className="col-span-3">
              <select
                className="w-full border border-slate-300 rounded p-2 text-sm"
                value={mapping.source_category}
                onChange={(e) => updateField(index, { source_category: e.target.value as UnifiedFieldConfig['source_category'] })}
              >
                <option value="client">Client</option>
                <option value="entreprise">Entreprise</option>
                <option value="dynamique">Dynamique</option>
                <option value="ignore">🖊️ Rempli par le client</option>
              </select>
            </div>

            <div className="col-span-4">
              {mapping.source_category === 'client' && (
                <select
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                  value={mapping.contact_field_name || ''}
                  onChange={(e) => updateField(index, { contact_field_name: e.target.value || null })}
                >
                  <option value="">Sélectionner...</option>
                  {clientFieldOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {mapping.source_category === 'entreprise' && (
                <select
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                  value={mapping.contact_field_name || ''}
                  onChange={(e) => updateField(index, { contact_field_name: e.target.value || null })}
                >
                  <option value="">Sélectionner...</option>
                  {entrepriseFieldOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {mapping.source_category === 'dynamique' && (
                <input
                  className="w-full border border-slate-300 rounded p-2 text-sm"
                  placeholder="Libellé dynamique"
                  value={mapping.label || ''}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                />
              )}

              {mapping.source_category === 'ignore' && (
                <div className="flex items-center gap-2 text-sm text-slate-500 italic px-2 py-2">
                  <span className="text-lg">✍️</span>
                  <span>Le client remplira ce champ lui-même</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MappingTable;
