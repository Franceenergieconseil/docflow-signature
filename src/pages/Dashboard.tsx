import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { FileText, Clock, CheckCircle, XCircle, Eye, RefreshCw, MoreHorizontal, ChevronRight, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  onNavigateToDocuments?: (filter: 'all' | 'pending' | 'signed' | 'archived') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToDocuments }) => {
  const { token, user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        console.error('Error:', response.status);
        setDocuments([]);
        return;
      }
      const data = await response.json();
      // Gérer les deux formats : array ou { success: true, data: [...] }
      const documentsList = Array.isArray(data) ? data : (data.data || []);
      setDocuments(documentsList);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed': return <span className="badge badge-green">Signé</span>;
      case 'declined': return <span className="badge badge-red">Refusé</span>;
      case 'opened': return <span className="badge badge-blue">Ouvert</span>;
      case 'expired': return <span className="badge badge-amber">Expiré</span>;
      default: return <span className="badge badge-gray">Envoyé</span>;
    }
  };

  const stats = [
    {
      label: 'Documents envoyés',
      value: documents.length,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      description: 'Total des documents initiés',
      filter: 'all'
    },
    {
      label: 'Documents signés',
      value: documents.filter(d => d.status === 'signed').length,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      description: 'Documents finalisés avec succès',
      filter: 'signed'
    },
    {
      label: 'En attente',
      value: documents.filter(d => d.status === 'sent' || d.status === 'opened').length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      description: 'En attente de signature client',
      filter: 'pending'
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Vue d'ensemble</h2>
        <p className="text-sm text-[#64748B] mt-1">Suivi de vos signatures en temps réel</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onNavigateToDocuments?.(stat.filter as any)}
            className="card p-6 flex items-start gap-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#64748B]">{stat.label}</p>
              <p className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
              <p className="text-[10px] text-[#64748B] mt-1 uppercase tracking-wider font-semibold">{stat.description}</p>
            </div>
            <ChevronRight className="text-gray-300 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all self-center" size={20} />
          </motion.div>
        ))}
      </div>

      {/* Recent Documents Table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="font-bold text-lg">Documents récents</h3>
          <button 
            onClick={fetchDocuments}
            className="p-2 hover:bg-gray-50 rounded-md transition-colors text-[#64748B]"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[#E2E8F0]">
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#64748B] italic text-sm">Chargement des données...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#64748B] italic text-sm">Aucun document envoyé pour le moment</td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{doc.client_prenom} {doc.client_nom}</span>
                        <span className="text-xs text-[#64748B]">{doc.client_entreprise}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium">{doc.template_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#64748B]">
                      {new Date(doc.sent_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setSelectedDoc(doc); setShowDetailsModal(true); }}
                          title="Voir les détails"
                          className="p-2 hover:bg-blue-50 text-[#2563EB] rounded-md transition-all">
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DÉTAILS (identique à Documents.tsx) */}
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
                {user?.role === 'admin' && selectedDoc.sender_first_name && (
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

export default Dashboard;
