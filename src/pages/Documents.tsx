import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Search, FileText, User, ChevronRight, Check, ArrowLeft, Send, Building2, Mail, Loader2, AlertCircle, Plus, Eye, Download, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Trash2, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FieldMapping {
  id: number;
  template_id: number;
  docuseal_field_name: string;
  source_category: 'client' | 'entreprise' | 'dynamique' | 'ignore';
  contact_field_name: string | null;
  field_type: string;
  is_dynamic: boolean;
  label: string;
  is_required: boolean;
  fusion: boolean;
}

interface TemplateFieldsResponse {
  template: any;
  mappings: FieldMapping[];
  docusealFields: any[];
}

interface Document {
  id: number;
  client_id: number;
  template_id: number;
  sender_id: number;
  docuseal_submission_id: number;
  status: 'sent' | 'opened' | 'signed' | 'declined' | 'expired';
  dynamic_data: string;
  sent_at: string;
  expires_at: string | null;
  updated_at: string;
  client_prenom: string;
  client_nom: string;
  client_entreprise: string;
  template_name: string;
  sender_first_name: string;
  sender_last_name: string;
  sender_email: string;
}

interface DocumentsProps {
  initialFilter?: 'all' | 'pending' | 'signed' | 'archived';
}

const Documents: React.FC<DocumentsProps> = ({ initialFilter }) => {
  const { token, user } = useAuth();
  const [mode, setMode] = useState<'list' | 'create'>('list'); // list or create
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateFieldsResponse, setTemplateFieldsResponse] = useState<TemplateFieldsResponse | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validityDays, setValidityDays] = useState(14);
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [showRelaunchModal, setShowRelaunchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Filtres avec persistance via localStorage
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'signed' | 'archived'>(() => {
    if (initialFilter) return initialFilter;
    const saved = localStorage.getItem('documentsStatusFilter');
    return (saved as any) || 'all';
  });
  
  // Mettre à jour le filtre initial si fourni
  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    fetchClients();
    fetchTemplates();
    if (mode === 'list') {
      fetchDocuments();
      // Rafraîchir les documents toutes les 10 secondes
      const interval = setInterval(fetchDocuments, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.role, mode]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const clientsList = Array.isArray(data) ? data : (data.data || []);
      setClients(clientsList);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      // Les admins voient tous les templates, les commerciaux voient uniquement les disponibles
      const endpoint = user?.role === 'admin' ? '/api/templates' : '/api/templates/available';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const templatesList = Array.isArray(data) ? data : (data.data || []);
      setTemplates(templatesList);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const documentsList = Array.isArray(data) ? data : (data.data || []);
      setDocuments(documentsList);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Clock };
      case 'opened':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: Eye };
      case 'signed':
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 };
      case 'declined':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: XCircle };
      case 'expired':
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: AlertTriangle };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: AlertCircle };
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      sent: 'Envoyé',
      opened: 'Ouvert',
      signed: 'Signé',
      declined: 'Décliné',
      expired: 'Expiré'
    };
    return labels[status] || status;
  };

  const handleRelaunch = async () => {
    if (!selectedDoc) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}/relaunch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActionSuccess('Document relancé avec succès !');
        setTimeout(() => {
          setShowRelaunchModal(false);
          setSelectedDoc(null);
          setActionSuccess(null);
        }, 2000);
      } else {
        alert(data.message || 'Erreur lors de la relance');
      }
    } catch (error) {
      console.error('Error relaunching document:', error);
      alert('Erreur lors de la relance du document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActionSuccess('Document supprimé avec succès !');
        setTimeout(() => {
          setShowDeleteModal(false);
          setSelectedDoc(null);
          setActionSuccess(null);
          fetchDocuments(); // Rafraîchir la liste
        }, 2000);
      } else {
        alert(data.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Erreur lors de la suppression du document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (
    docId: number,
    templateName: string,
    clientPrenom: string,
    clientNom: string
  ) => {
    try {
      const response = await fetch(`/api/documents/${docId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || 'Erreur lors du téléchargement');
        return;
      }

      // Créer un nom de fichier propre
      const fileName = `${templateName}_${clientPrenom}_${clientNom}.pdf`
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '');

      // Récupérer le blob PDF
      const blob = await response.blob();

      // Déclencher le téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyage
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`✅ Document téléchargé : ${fileName}`);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur réseau lors du téléchargement');
    }
  };

  const fetchTemplateFields = async (templateId: number, client: any) => {
    setLoading(true);
    try {
      // Charger les champs du template avec les mappings configurés
      const response = await fetch(`/api/templates/${templateId}/fields`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        const { template, mappings, docusealFields } = data.data;
        setTemplateFieldsResponse({ template, mappings, docusealFields });

        // Pré-remplir les champs selon les mappings
        const initialData: any = {};
        
        docusealFields.forEach((field: any) => {
          const mapping = mappings.find((m: FieldMapping) => m.docuseal_field_name === field.name);
          
          if (mapping && mapping.contact_field_name) {
            // Ce champ a un mappage configuré
            if (mapping.fusion) {
              // Cas spécial: fusion nom + prénom
              const nom = client?.nom || '';
              const prenom = client?.prenom || '';
              initialData[field.name] = `${prenom} ${nom}`.trim();
            } else {
              // Mappage simple: récupérer la valeur du contact
              initialData[field.name] = client?.[mapping.contact_field_name] || '';
            }
          } else {
            // Pas de mappage ou mappage dynamique
            initialData[field.name] = '';
          }
        });
        
        setFormData(initialData);
      }
    } catch (error) {
      console.error('Error fetching template fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setStep(2);
  };

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    fetchTemplateFields(template.id, selectedClient);
    setStep(3);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      // Calculer la date d'expiration
      let expiresAt: string | null = null;
      if (validityDays > 0) {
        const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
        expiresAt = expiryDate.toISOString();
      } else if (validityDays === -1 && customExpiryDate) {
        const expiryDate = new Date(customExpiryDate);
        expiryDate.setHours(23, 59, 59, 999);
        expiresAt = expiryDate.toISOString();
      }

      const response = await fetch('/api/documents/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: selectedClient.id,
          template_id: selectedTemplate.id,
          dynamic_data: formData,
          expires_at: expiresAt
        })
      });
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          setStep(1);
          setSelectedClient(null);
          setSelectedTemplate(null);
          setTemplateFieldsResponse(null);
          setFormData({});
          setValidityDays(14);
          setCustomExpiryDate('');
          setSuccess(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error sending document:', error);
    } finally {
      setSending(false);
    }
  };

  // Fonction pour rendre le bon type d'input selon le field_type
  const renderFieldInput = (mapping: FieldMapping, isIgnored: boolean, isAutoFilled: boolean, autoFilledSource: string) => {
    const fieldType = (mapping.field_type || 'text').toLowerCase();
    const fieldName = mapping.docuseal_field_name;
    const value = formData[fieldName];

    // Props communes
    const commonProps = {
      required: mapping.is_required && mapping.source_category !== 'ignore',
      readOnly: isAutoFilled && !isIgnored,
      disabled: isIgnored,
    };

    const getClassName = () => `transition-all ${
      isIgnored
        ? 'bg-purple-50 border-purple-200 cursor-not-allowed'
        : (isAutoFilled ? 'bg-emerald-50 border-emerald-200 cursor-not-allowed' : 'bg-white')
    }`;

    // CHECKBOX - Utilise un booléen
    if (fieldType === 'checkbox') {
      return (
        <div className="flex items-center gap-3 p-4 border border-[#E2E8F0] rounded-lg hover:bg-gray-50">
          <input
            type="checkbox"
            id={fieldName}
            checked={!!value} // Convertir en booléen
            onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.checked })}
            {...commonProps}
            className={`w-5 h-5 text-[#2563EB] rounded focus:ring-2 focus:ring-[#2563EB] cursor-pointer ${getClassName()}`}
          />
          <label htmlFor={fieldName} className="text-sm font-medium text-[#0F172A] cursor-pointer flex-1">
            {mapping.label}
          </label>
        </div>
      );
    }

    // DATE - Input date avec format min
    if (fieldType === 'date') {
      return (
        <input
          type="date"
          value={isIgnored ? '' : (value || '')}
          onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          placeholder={isIgnored ? 'Le client remplira ce champ' : 'Sélectionner une date'}
          {...commonProps}
          className={`input ${getClassName()}`}
        />
      );
    }

    // SELECT - Menu déroulant
    if (fieldType === 'select') {
      // Récupérer les options depuis le schema DocuSeal si disponible
      const field = templateFieldsResponse?.docusealFields.find(f => f.name === fieldName);
      const options = field?.options || [];

      return (
        <select
          value={isIgnored ? '' : (value || '')}
          onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.value })}
          {...commonProps}
          className={`input ${getClassName()}`}
        >
          <option value="">-- Sélectionner --</option>
          {options.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // TEXTAREA - Pour texte long
    if (fieldType === 'textarea') {
      return (
        <textarea
          value={isIgnored ? '' : (value || '')}
          onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.value })}
          placeholder={isIgnored ? 'Le client remplira ce champ' : 'Saisir le texte'}
          rows={4}
          {...commonProps}
          className={`input ${getClassName()}`}
        />
      );
    }

    // NUMBER - Champ numérique
    if (fieldType === 'number') {
      return (
        <input
          type="number"
          value={isIgnored ? '' : (value || '')}
          onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.value })}
          placeholder={isIgnored ? 'Le client remplira ce champ' : 'Saisir un nombre'}
          {...commonProps}
          className={`input ${getClassName()}`}
        />
      );
    }

    // EMAIL - avec validation
    if (fieldType === 'email') {
      return (
        <input
          type="email"
          value={isIgnored ? '' : (value || '')}
          onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.value })}
          placeholder={isIgnored ? 'Le client remplira ce champ' : 'exemple@email.com'}
          {...commonProps}
          className={`input ${getClassName()}`}
        />
      );
    }

    // TEXT - Par défaut
    return (
      <input
        type="text"
        value={isIgnored ? '' : (value || '')}
        onChange={(e) => !isIgnored && setFormData({ ...formData, [fieldName]: e.target.value })}
        placeholder={isIgnored ? 'Le client remplira ce champ' : (isAutoFilled ? `Auto-rempli: ${autoFilledSource}` : 'Veuillez remplir ce champ')}
        {...commonProps}
        className={`input ${getClassName()}`}
      />
    );
  };

  // Fonction pour changer le filtre et le sauvegarder dans localStorage
  const handleFilterChange = (filter: 'all' | 'pending' | 'signed' | 'archived') => {
    setStatusFilter(filter);
    localStorage.setItem('documentsStatusFilter', filter);
  };

  // Filtrer les documents par statut
  const filteredByStatus = documents.filter(doc => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return doc.status === 'sent' || doc.status === 'opened';
    if (statusFilter === 'signed') return doc.status === 'signed';
    if (statusFilter === 'archived') return doc.status === 'declined' || doc.status === 'expired';
    return true;
  });

  // Filtrer par recherche (client ou commercial)
  const filteredDocuments = filteredByStatus.filter(doc => {
    const clientName = `${doc.client_prenom} ${doc.client_nom}`.toLowerCase();
    const clientCompany = doc.client_entreprise.toLowerCase();
    const senderName = `${doc.sender_first_name} ${doc.sender_last_name}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return clientName.includes(search) || clientCompany.includes(search) || senderName.includes(search);
  });

  const filteredClients = clients.filter(c =>
    `${c.prenom} ${c.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.entreprise.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const steps = [
    { id: 1, label: 'Client', icon: User },
    { id: 2, label: 'Modèle', icon: FileText },
    { id: 3, label: 'Détails', icon: Check },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Mode Selector */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setMode('list')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
            mode === 'list'
              ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-200'
              : 'bg-gray-100 text-[#64748B] hover:bg-gray-200'
          }`}
        >
          <FileText size={18} />
          <span>Mes Documents</span>
        </button>
        <button
          onClick={() => {
            setMode('create');
            setStep(1);
          }}
          className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
            mode === 'create'
              ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-200'
              : 'bg-gray-100 text-[#64748B] hover:bg-gray-200'
          }`}
        >
          <Plus size={18} />
          <span>Créer un Document</span>
        </button>
      </div>

      {/* LIST MODE */}
      {mode === 'list' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Mes Documents</h2>
            <p className="text-[#64748B] mt-1">Suivi en temps réel des documents envoyés en signature</p>
          </div>

          {/* Filtres de statut */}
          <div className="flex flex-wrap gap-3">
            {[
              { value: 'all', label: 'Tous', count: documents.length, icon: FileText },
              { value: 'pending', label: 'En attente', count: documents.filter(d => d.status === 'sent' || d.status === 'opened').length, icon: Clock },
              { value: 'signed', label: 'Signés', count: documents.filter(d => d.status === 'signed').length, icon: CheckCircle2 },
              { value: 'archived', label: 'Archives', count: documents.filter(d => d.status === 'declined' || d.status === 'expired').length, icon: XCircle }
            ].map(filter => {
              const FilterIcon = filter.icon;
              return (
                <button
                  key={filter.value}
                  onClick={() => handleFilterChange(filter.value as any)}
                  className={`px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    statusFilter === filter.value
                      ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-200'
                      : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB]'
                  }`}
                >
                  <FilterIcon size={16} />
                  <span>{filter.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-[#64748B]'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filter */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={20} />
            <input
              type="text"
              placeholder={user?.role === 'admin' ? "Rechercher par client ou commercial..." : "Rechercher par client..."}
              className="input pl-12 h-14 text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Documents Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-[#64748B]">
                <Loader2 className="animate-spin mx-auto mb-4" size={40} />
                <p>Chargement des documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center text-[#64748B] italic">
                {documents.length === 0 ? 'Aucun document envoyé' : 'Aucun document ne correspond aux filtres'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-[#E2E8F0]">
                      <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Client</th>
                      {user?.role === 'admin' && (
                        <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Commercial</th>
                      )}
                      <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Template</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Envoyé le</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Expires</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredDocuments.map((doc) => {
                      const statusColor = getStatusColor(doc.status);
                      const StatusIcon = statusColor.icon;
                      
                      return (
                        <motion.tr
                          key={doc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-gray-50/50 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-[#64748B]">
                                {doc.client_prenom?.[0]}{doc.client_nom?.[0]}
                              </div>
                              <div>
                                <span className="font-semibold text-sm">{doc.client_prenom} {doc.client_nom}</span>
                                <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                                  <Building2 size={12} />
                                  <span>{doc.client_entreprise}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* COLONNE COMMERCIAL (Admin uniquement) */}
                          {user?.role === 'admin' && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm">
                                <User size={14} className="text-[#64748B]" />
                                <div>
                                  <span className="font-semibold text-[#0F172A]">
                                    {doc.sender_first_name} {doc.sender_last_name}
                                  </span>
                                  <p className="text-xs text-[#64748B]">{doc.sender_email}</p>
                                </div>
                              </div>
                            </td>
                          )}
                          
                          <td className="px-6 py-4 text-sm text-[#64748B]">{doc.template_name}</td>
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor.bg} ${statusColor.border} border ${statusColor.text}`}>
                              <StatusIcon size={14} />
                              <span>{getStatusLabel(doc.status)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#64748B]">
                            {new Date(doc.sent_at).toLocaleDateString('fr-FR', { 
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {doc.expires_at ? (
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-[#2563EB]" />
                                <span className="text-[#64748B]">
                                  {new Date(doc.expires_at).toLocaleDateString('fr-FR', { 
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#CBD5E1]">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                title="Voir les détails"
                                onClick={() => { setSelectedDoc(doc); setShowDetailsModal(true); }}
                                className="p-2 hover:bg-blue-50 text-[#2563EB] rounded-md transition-all">
                                <Eye size={16} />
                              </button>
                              
                              {/* BOUTON TÉLÉCHARGEMENT (Admin + Signed) */}
                              {user?.role === 'admin' && doc.status === 'signed' && (
                                <button
                                  title="Télécharger le PDF signé"
                                  onClick={() => handleDownload(doc.id, doc.template_name, doc.client_prenom, doc.client_nom)}
                                  className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-md transition-all">
                                  <Download size={16} />
                                </button>
                              )}
                              {doc.status !== 'signed' && doc.status !== 'declined' && (
                                <>
                                  <button 
                                    title="Relancer"
                                    onClick={() => { setSelectedDoc(doc); setShowRelaunchModal(true); }}
                                    className="p-2 hover:bg-amber-50 text-amber-600 rounded-md transition-all">
                                    <RefreshCw size={16} />
                                  </button>
                                  <button 
                                    title="Supprimer"
                                    onClick={() => { setSelectedDoc(doc); setShowDeleteModal(true); }}
                                    className="p-2 hover:bg-red-50 text-red-600 rounded-md transition-all">
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODE */}
      {mode === 'create' && (
        <div>
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-12">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                step >= s.id ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-200' : 'bg-white border-2 border-[#E2E8F0] text-[#64748B]'
              }`}>
                {step > s.id ? <Check size={18} /> : <s.icon size={18} />}
              </div>
              <span className={`absolute -bottom-7 text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                step >= s.id ? 'text-[#0F172A]' : 'text-[#64748B]'
              }`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-24 h-0.5 mx-4 transition-all duration-500 ${
                step > s.id ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Sélectionnez un client</h2>
              <p className="text-[#64748B] mt-1">À qui souhaitez-vous envoyer un document ?</p>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={20} />
              <input
                type="text"
                placeholder="Rechercher par nom ou entreprise..."
                className="input pl-12 h-14 text-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="card overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto divide-y divide-[#E2E8F0]">
                {filteredClients.length === 0 ? (
                  <div className="p-12 text-center text-[#64748B] italic">Aucun client trouvé</div>
                ) : (
                  filteredClients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full flex items-center justify-between p-5 hover:bg-blue-50/50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#64748B] group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                          {client.prenom?.[0]}{client.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A]">{client.prenom} {client.nom}</p>
                          <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                            <Building2 size={12} />
                            <span>{client.entreprise}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-[#E2E8F0] group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setStep(1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Choisissez un modèle</h2>
                <p className="text-[#64748B] mt-1">Pour {selectedClient?.prenom} {selectedClient?.nom}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="card p-6 flex items-center gap-4 hover:border-[#2563EB] hover:shadow-md transition-all group text-left"
                >
                  <div className="w-12 h-12 bg-blue-50 text-[#2563EB] rounded-lg flex items-center justify-center shrink-0 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-lg truncate">{template.nom_template}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">ID Docuseal: {template.id_docuseal}</p>
                  </div>
                  <ChevronRight size={20} className="text-[#E2E8F0] group-hover:text-[#2563EB]" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setStep(2)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Complétez les informations</h2>
                <p className="text-[#64748B] mt-1">{selectedTemplate?.nom_template} pour {selectedClient?.prenom}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="text-[#2563EB] animate-spin" />
                <p className="text-[#64748B] font-medium">Récupération des champs...</p>
              </div>
            ) : templateFieldsResponse && templateFieldsResponse.mappings.length > 0 ? (
              <form onSubmit={handleSend} className="space-y-6">
                {/* Info sur le mappage - affichée si des mappings existent */}
                <div className="card bg-blue-50 border-blue-200 p-4 flex gap-3">
                  <AlertCircle className="text-blue-600 shrink-0" size={20} />
                  <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">📋 Champs pré-configurés</p>
                    <p>Certains champs sont automatiquement remplis depuis le contact sélectionné. Seuls les champs dynamiques doivent être complétés.</p>
                  </div>
                </div>

                <div className="card p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {templateFieldsResponse.mappings.map((mapping) => {
                      // Déterminer si le champ est auto-rempli OU ignoré (rempli par le client)
                      const isAutoFilled = mapping.contact_field_name !== null || mapping.source_category === 'ignore';
                      const isIgnored = mapping.source_category === 'ignore';
                      const autoFilledSource = mapping.fusion ? 'Nom + Prénom fusionnés' : mapping.label;
                      
                      return (
                        <div key={mapping.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider ml-1 flex-1">
                              {mapping.label}
                            </label>
                            {isIgnored && (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-md whitespace-nowrap">
                                ✍️ CLIENT
                              </span>
                            )}
                            {!isIgnored && isAutoFilled && (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md whitespace-nowrap">
                                ✓ CONTACT
                              </span>
                            )}
                            {!isAutoFilled && !isIgnored && (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md whitespace-nowrap">
                                ✎ À REMPLIR
                              </span>
                            )}
                          </div>
                          
                          {/* Rendu dynamique selon le type de champ */}
                          {renderFieldInput(mapping, isIgnored, isAutoFilled, autoFilledSource)}
                          
                          {isIgnored && (
                            <p className="text-xs text-purple-700 ml-1">✍️ Ce champ sera rempli par le destinataire lors de la signature</p>
                          )}
                          {!isIgnored && isAutoFilled && (
                            <p className="text-xs text-emerald-700 ml-1">📌 Pré-rempli depuis le contact</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* VALIDITY SELECTION */}
                <div className="card p-8 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A] mb-4">📅 Validité du document</h3>
                    <div className="space-y-3">
                      {[
                        { value: 7, label: '7 jours' },
                        { value: 14, label: '14 jours (défaut)' },
                        { value: 30, label: '30 jours' },
                        { value: -1, label: 'Date personnalisée' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-3 p-3 border border-[#E2E8F0] rounded-lg hover:bg-blue-50/50 cursor-pointer transition-all group">
                          <input
                            type="radio"
                            name="validity"
                            value={option.value}
                            checked={validityDays === option.value}
                            onChange={(e) => {
                              setValidityDays(parseInt(e.target.value));
                              setCustomExpiryDate('');
                            }}
                            className="w-4 h-4 text-[#2563EB] cursor-pointer"
                          />
                          <span className="text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB]">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {validityDays === -1 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider ml-1">
                        Choisissez une date d'expiration
                      </label>
                      <input
                        type="date"
                        value={customExpiryDate}
                        onChange={(e) => setCustomExpiryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="input w-full"
                        required
                      />
                      {customExpiryDate && (
                        <p className="text-xs text-[#64748B] ml-1">
                          ✓ Expire le {new Date(customExpiryDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {validityDays > 0 && (
                    <p className="text-xs text-[#64748B] ml-1">
                      ✓ Expire dans {validityDays} jours (le {new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })})
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-secondary flex-1 h-14 text-lg"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={sending || success || (validityDays === -1 && !customExpiryDate)}
                    className={`btn-primary flex-1 h-14 text-lg gap-3 ${success ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                  >
                    {sending ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Envoi en cours...</span>
                      </>
                    ) : success ? (
                      <>
                        <Check size={20} />
                        <span>Document envoyé !</span>
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        <span>Envoyer pour signature</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSend} className="space-y-6">
                {/* Fallback si pas de mappings configurés - affiche tous les champs du template */}
                <div className="card bg-amber-50 border-amber-200 p-4 flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">⚠️ Aucune configuration</p>
                    <p>Ce template n'a pas encore été configuré. Complétez tous les champs manuellement.</p>
                  </div>
                </div>

                <div className="card p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {templateFieldsResponse?.docusealFields.map((field: any) => (
                      <div key={field.name} className="space-y-2">
                        <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider ml-1">
                          {field.name}
                        </label>
                        <input
                          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                          required={field.required || false}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          placeholder={`Veuillez remplir ce champ`}
                          className="input"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-secondary flex-1 h-14 text-lg"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={sending || success}
                    className={`btn-primary flex-1 h-14 text-lg gap-3 ${success ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                  >
                    {sending ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Envoi en cours...</span>
                      </>
                    ) : success ? (
                      <>
                        <Check size={20} />
                        <span>Document envoyé !</span>
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        <span>Envoyer pour signature</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      )}

      {/* MODAL DE RELANCE */}
      <AnimatePresence>
        {showRelaunchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !actionLoading && setShowRelaunchModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {actionSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="text-emerald-600" size={32} />
                  </div>
                  <p className="text-emerald-600 font-semibold text-lg">{actionSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <RefreshCw className="text-amber-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#0F172A]">Relancer le document</h3>
                      <p className="text-sm text-[#64748B]">Envoyer un nouvel email de signature</p>
                    </div>
                  </div>
                  
                  {selectedDoc && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-[#64748B] mb-2">Vous êtes sur le point de relancer :</p>
                      <p className="font-semibold text-[#0F172A]">{selectedDoc.template_name}</p>
                      <p className="text-sm text-[#64748B]">{selectedDoc.client_prenom} {selectedDoc.client_nom}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRelaunchModal(false)}
                      disabled={actionLoading}
                      className="btn-secondary flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleRelaunch}
                      disabled={actionLoading}
                      className="btn-primary flex-1 gap-2"
                    >
                      {actionLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <RefreshCw size={18} />
                      )}
                      Relancer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DE SUPPRESSION */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !actionLoading && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {actionSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="text-emerald-600" size={32} />
                  </div>
                  <p className="text-emerald-600 font-semibold text-lg">{actionSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="text-red-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#0F172A]">Supprimer le document</h3>
                      <p className="text-sm text-[#64748B]">Cette action est irréversible</p>
                    </div>
                  </div>
                  
                  {selectedDoc && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-[#64748B] mb-2">Vous êtes sur le point de supprimer :</p>
                      <p className="font-semibold text-[#0F172A]">{selectedDoc.template_name}</p>
                      <p className="text-sm text-[#64748B]">{selectedDoc.client_prenom} {selectedDoc.client_nom}</p>
                      <p className="text-xs text-red-500 mt-2">⚠️ Cette action supprimera également l'historique du document</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      disabled={actionLoading}
                      className="btn-secondary flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 flex-1"
                    >
                      {actionLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DE DÉTAILS */}
      <AnimatePresence>
        {showDetailsModal && selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-[#E2E8F0] p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Eye className="text-[#2563EB]" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0F172A]">Détails du document</h3>
                    <p className="text-sm text-[#64748B]">{selectedDoc.template_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-[#64748B]" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <User size={16} />
                    Informations Client
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[#64748B] text-xs uppercase tracking-wider font-semibold mb-1">Nom complet</p>
                      <p className="font-semibold text-[#0F172A]">{selectedDoc.client_prenom} {selectedDoc.client_nom}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B] text-xs uppercase tracking-wider font-semibold mb-1">Entreprise</p>
                      <p className="font-semibold text-[#0F172A]">{selectedDoc.client_entreprise}</p>
                    </div>
                  </div>
                </div>

                {/* Commercial Info (Admin only) */}
                {user?.role === 'admin' && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                      <User size={16} />
                      Commercial responsable
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[#64748B] text-xs uppercase tracking-wider font-semibold mb-1">Nom</p>
                        <p className="font-semibold text-[#0F172A]">{selectedDoc.sender_first_name} {selectedDoc.sender_last_name}</p>
                      </div>
                      <div>
                        <p className="text-[#64748B] text-xs uppercase tracking-wider font-semibold mb-1">Email</p>
                        <p className="font-semibold text-[#0F172A]">{selectedDoc.sender_email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Clock size={16} />
                    Historique
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Envoyé le</p>
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {new Date(selectedDoc.sent_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {selectedDoc.status === 'opened' && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Ouvert le</p>
                          <p className="text-sm font-semibold text-[#0F172A]">
                            {new Date(selectedDoc.updated_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedDoc.status === 'signed' && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Signé le</p>
                          <p className="text-sm font-semibold text-[#0F172A]">
                            {new Date(selectedDoc.updated_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedDoc.expires_at && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">
                            {selectedDoc.status === 'expired' ? 'Expiré le' : 'Expire le'}
                          </p>
                          <p className="text-sm font-semibold text-[#0F172A]">
                            {new Date(selectedDoc.expires_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Data */}
                {selectedDoc.dynamic_data && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                      <FileText size={16} />
                      Données saisies
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(JSON.parse(selectedDoc.dynamic_data)).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-[#64748B] text-xs uppercase tracking-wider font-semibold mb-1">{key}</p>
                          <p className="font-semibold text-[#0F172A]">{value as string}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DocuSeal Link */}
                <div className="flex gap-3">
                  <button
onClick={() => window.open(`https://docuseal.co/submissions/${selectedDoc.docuseal_submission_id}`, '_blank')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    Voir sur DocuSeal
                  </button>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="btn-primary flex-1"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Documents;
