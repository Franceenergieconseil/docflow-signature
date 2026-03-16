import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { FileText, Clock, CheckCircle, XCircle, Eye, RefreshCw, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      description: 'Total des documents initiés'
    },
    { 
      label: 'Documents signés', 
      value: documents.filter(d => d.status === 'signed').length, 
      icon: CheckCircle, 
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      description: 'Documents finalisés avec succès'
    },
    { 
      label: 'En attente', 
      value: documents.filter(d => d.status === 'sent' || d.status === 'opened').length, 
      icon: Clock, 
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      description: 'En attente de signature client'
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
            className="card p-6 flex items-start gap-4"
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center shrink-0`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#64748B]">{stat.label}</p>
              <p className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
              <p className="text-[10px] text-[#64748B] mt-1 uppercase tracking-wider font-semibold">{stat.description}</p>
            </div>
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
                        <button className="p-2 hover:bg-gray-100 rounded-md transition-all text-[#64748B] hover:text-[#0F172A]">
                          <Eye size={16} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-md transition-all text-[#64748B]">
                          <MoreHorizontal size={16} />
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
    </div>
  );
};

export default Dashboard;
