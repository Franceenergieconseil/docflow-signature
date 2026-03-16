import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Plus, RefreshCw, FileText, Trash2, ExternalLink, Search, CheckCircle2, AlertCircle, Eye, Play, FileJson, CloudOff, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentTemplate } from '../types';
import TemplateConfig from './TemplateConfig';

const Templates: React.FC = () => {
  const { token, user } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; template: DocumentTemplate | null }>({ isOpen: false, template: null });
  const [useModal, setUseModal] = useState<{ isOpen: boolean; template: DocumentTemplate | null }>({ isOpen: false, template: null });
  const [configModal, setConfigModal] = useState<{ isOpen: boolean; templateId: number | null; templateName: string }>({ isOpen: false, templateId: null, templateName: '' });
  const [newTemplate, setNewTemplate] = useState({ nom_template: '', id_docuseal: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    // Vérifier que l'utilisateur est admin
    if (user && user.role !== 'admin') {
      setAccessDenied(true);
      return;
    }
    fetchTemplates();
  }, [user]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      console.log('Fetching templates...');
      const response = await fetch('/api/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log("Données reçues du serveur:", data);
      
      // Handle both direct array and { data: [] } format
      const templatesList = Array.isArray(data) ? data : (data.data || []);
      setTemplates(templatesList);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Démarrage de la synchronisation...');
      const response = await fetch('/api/docuseal/templates/sync', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const contentType = response.headers.get("content-type");
      const data = contentType && contentType.indexOf("application/json") !== -1 
        ? await response.json() 
        : await response.text();

      if (response.ok) {
        console.log('✅ Synchronisation réussie:', data);
        alert(`✅ Synchronisation réussie! ${data.count || 0} modèle(s) synchronisé(s).`);
        // Petit délai avant de rafraîchir
        await new Promise(r => setTimeout(r, 1000));
        fetchTemplates();
      } else {
        const errorMessage = typeof data === 'object' ? (data.message || data.error || 'Erreur inconnue') : data;
        console.error('❌ Erreur serveur:', errorMessage);
        alert(`❌ Erreur serveur: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('❌ Erreur synchronisation:', error.message);
      alert(`❌ Erreur de synchronisation: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTemplate)
      });
      if (response.ok) {
        setIsModalOpen(false);
        setNewTemplate({ nom_template: '', id_docuseal: '' });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.nom_template.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id_docuseal.toString().includes(searchTerm)
  );

  const handleMarkAvailable = async () => {
    if (!useModal.template) return;

    try {
      const response = await fetch(`/api/templates/${useModal.template.id}/available`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ available: true })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour du statut');
      }

      alert(`✅ Le modèle "${useModal.template.nom_template}" est maintenant disponible pour les utilisateurs.`);
      setUseModal({ isOpen: false, template: null });
      fetchTemplates(); // Rafraîchir la liste
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur lors de la mise à jour du modèle');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accès Restreint</h2>
          <p className="text-[#64748B]">Vous n'avez pas les permissions nécessaires pour gérer les modèles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Modal de Configuration */}
      {configModal.isOpen && configModal.templateId && (
        <TemplateConfig
          templateId={configModal.templateId}
          templateName={configModal.templateName}
          onBack={() => setConfigModal({ isOpen: false, templateId: null, templateName: '' })}
        />
      )}

      {/* Contenu principal - masqué pendant la config */}
      {!configModal.isOpen && (
        <>
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Modèles de documents</h2>
          <p className="text-sm text-[#64748B] mt-1">Gérez vos contrats et formulaires Docuseal</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Synchronisation...' : 'Synchroniser'}</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            <Plus size={18} />
            <span>Nouveau Modèle</span>
          </button>
        </div>
      </header>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <AlertCircle className="text-blue-600 shrink-0" size={20} />
        <p className="text-sm text-blue-800">
          Les modèles sont synchronisés directement depuis votre compte Docuseal. Assurez-vous que les noms des champs correspondent à vos besoins de mapping.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
        <input
          type="text"
          placeholder="Rechercher un modèle par nom ou ID..."
          className="input pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Skeleton Loading
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 space-y-4 animate-pulse">
              <div className="flex justify-between">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <div className="w-16 h-6 bg-gray-200 rounded-full" />
              </div>
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="pt-4 border-t border-gray-100 flex gap-2">
                <div className="h-9 bg-gray-200 rounded flex-1" />
                <div className="h-9 bg-gray-200 rounded flex-1" />
              </div>
            </div>
          ))
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-6 bg-gray-50/50 border-2 border-dashed border-[#E2E8F0] rounded-2xl">
            <div className="w-20 h-20 bg-gray-100 text-[#94A3B8] rounded-full flex items-center justify-center">
              <CloudOff size={40} />
            </div>
            <div className="max-w-sm">
              <h3 className="text-xl font-bold text-[#0F172A]">Aucun modèle trouvé</h3>
              <p className="text-[#64748B] mt-2">
                Votre bibliothèque de modèles est vide. Veuillez lancer la synchronisation avec Docuseal pour récupérer vos documents.
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Synchronisation...' : 'Lancer la synchronisation'}</span>
            </button>
          </div>
        ) : (
          filteredTemplates.map((template, i) => {
            let fieldCount = 0;
            const hasEmptySchema = !template.schema;
            try {
              if (template.schema) {
                const schemaObj = typeof template.schema === 'string' ? JSON.parse(template.schema) : template.schema;
                fieldCount = Array.isArray(schemaObj) ? schemaObj.length : 0;
              }
            } catch (e) {
              console.error("Error parsing schema for template", template.id);
            }

            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card group hover:border-[#2563EB] transition-all flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                    hasEmptySchema
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-red-50 text-red-600 group-hover:bg-red-100'
                  }`}>
                      <FileText size={24} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                        hasEmptySchema
                          ? 'bg-orange-50 text-orange-600'
                          : 'bg-blue-50 text-[#2563EB]'
                      }`}>
                        {hasEmptySchema ? 'À synchroniser' : `${fieldCount} champs`}
                      </span>
                      {!hasEmptySchema && (
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          template.available
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-gray-50 text-[#64748B]'
                        }`}>
                          {template.available ? '✓ Disponible' : 'Non disponible'}
                        </span>
                      )}
                      <button className="p-1.5 text-[#64748B] hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-lg mb-1 group-hover:text-[#2563EB] transition-colors line-clamp-2" title={template.nom_template}>
                    {template.nom_template}
                  </h3>
                  <p className="text-xs text-[#64748B] flex items-center gap-1.5 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    ID: {template.id_docuseal}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-[#E2E8F0]">
                    {hasEmptySchema ? (
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="col-span-3 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm shadow-orange-200 disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Synchronisation...' : 'Récupérer les champs'}</span>
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => setPreviewModal({ isOpen: true, template })}
                          className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-[#64748B] bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                          <Eye size={14} />
                          <span>Aperçu</span>
                        </button>
                        <button 
                          onClick={() => setConfigModal({ isOpen: true, templateId: template.id, templateName: template.nom_template })}
                          className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-[#64748B] bg-gray-50 hover:bg-blue-50 hover:text-[#2563EB] rounded-lg transition-colors">
                          <Settings size={14} />
                          <span>Config</span>
                        </button>
                        <button 
                          onClick={() => setUseModal({ isOpen: true, template })}
                          className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors shadow-sm shadow-blue-200">
                          <Play size={14} />
                          <span>Utiliser</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="px-6 py-3 bg-gray-50/50 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[#94A3B8]">
                    Sync: {new Date(template.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#64748B]">
                    <FileJson size={10} />
                    <span>JSON Schema</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal Nouveau Modèle */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Ajouter un modèle</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Nom du modèle</label>
                    <input
                      type="text"
                      required
                      value={newTemplate.nom_template}
                      onChange={(e) => setNewTemplate({ ...newTemplate, nom_template: e.target.value })}
                      className="input"
                      placeholder="ex: Contrat de prestation"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">ID Docuseal</label>
                    <input
                      type="number"
                      required
                      value={newTemplate.id_docuseal}
                      onChange={(e) => setNewTemplate({ ...newTemplate, id_docuseal: e.target.value })}
                      className="input"
                      placeholder="ex: 123456"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn-secondary flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex-1"
                    >
                      Ajouter
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Aperçu du Template */}
      <AnimatePresence>
        {previewModal.isOpen && previewModal.template && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewModal({ isOpen: false, template: null })}
              className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0] max-h-[80vh] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Aperçu du modèle</h3>
                  <button 
                    onClick={() => setPreviewModal({ isOpen: false, template: null })}
                    className="text-[#64748B] hover:text-[#0F172A]">
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-[#0F172A] mb-2">Nom du modèle</h4>
                    <p className="text-base text-[#64748B]">{previewModal.template.nom_template}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-bold text-[#0F172A] mb-2">ID DocuSeal</h4>
                    <p className="text-base text-[#64748B]">{previewModal.template.id_docuseal}</p>
                  </div>

                  {previewModal.template.slug && (
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] mb-2">Slug</h4>
                      <p className="text-base text-[#64748B]">{previewModal.template.slug}</p>
                    </div>
                  )}

                  {previewModal.template.schema && (
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] mb-3">Champs du modèle</h4>
                      {(() => {
                        try {
                          const schema = JSON.parse(previewModal.template.schema || '[]');
                          const fields = Array.isArray(schema) ? schema : [];
                          
                          if (fields.length === 0) {
                            return <p className="text-sm text-[#94A3B8] italic">Aucun champ défini</p>;
                          }

                          return (
                            <div className="space-y-2">
                              {fields.map((field: any, idx: number) => (
                                <div 
                                  key={idx}
                                  className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start justify-between"
                                >
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-[#0F172A]">{field.name || `Champ ${idx + 1}`}</p>
                                    {field.type && <p className="text-xs text-[#64748B] mt-1">Type: <span className="font-semibold">{field.type}</span></p>}
                                    {field.label && <p className="text-xs text-[#64748B]">Label: <span className="font-semibold">{field.label}</span></p>}
                                  </div>
                                  {field.required && (
                                    <span className="ml-2 px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded">Requis</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        } catch (e) {
                          return (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                              <p className="text-sm text-amber-700">Erreur lors de l'analyse du schéma</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setPreviewModal({ isOpen: false, template: null })}
                    className="btn-secondary flex-1"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Utiliser le Template */}
      <AnimatePresence>
        {useModal.isOpen && useModal.template && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUseModal({ isOpen: false, template: null })}
              className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Utiliser le modèle</h3>
                  <button 
                    onClick={() => setUseModal({ isOpen: false, template: null })}
                    className="text-[#64748B] hover:text-[#0F172A]">
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <p className="text-[#64748B]">
                    Vous êtes sur le point d'utiliser le modèle <strong>{useModal.template.nom_template}</strong>.
                  </p>
                  <p className="text-sm text-[#94A3B8]">
                    Vous serez redirigé vers la page de création de document pour sélectionner un client et envoyer un document basé sur ce modèle.
                  </p>
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setUseModal({ isOpen: false, template: null })}
                    className="btn-secondary flex-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAvailable}
                    className="btn-primary flex-1"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default Templates;
