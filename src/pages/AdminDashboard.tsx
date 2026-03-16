import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { BarChart3, TrendingUp, CheckCircle2, Clock, Search, AlertTriangle, Download, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Document {
  id: number;
  dossierNumber: number;
  clientPrenom: string;
  clientNom: string;
  commercialPrenom: string;
  commercialNom: string;
  status: 'sent' | 'opened' | 'signed' | 'declined' | 'expired';
  sentAt: string;
  templateName: string;
  delayMs: number;
  delayFormatted: string;
  isOverdue: boolean;
}

interface DashboardStats {
  totalDossiers: number;
  enAttente: number;
  termines: number;
  tauxConversion: number;
}

interface CommercialStats {
  id: number;
  firstName: string;
  lastName: string;
  totalCount: number;
  signedCount: number;
}

const AdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [commerciaux, setCommerciaux] = useState<CommercialStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'tous' | 'aTraiter' | 'enCours' | 'archives'>('tous');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
      // Rafraîchir les données toutes les 10 secondes
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, docsRes, commRes] = await Promise.all([
        fetch('/api/admin/stats/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/documents/list', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/commerciaux/performance', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.data || []);
      }

      if (commRes.ok) {
        const commData = await commRes.json();
        setCommerciaux(commData.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les documents selon l'onglet
  const getFilteredDocuments = () => {
    let filtered = documents;

    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        `${doc.clientPrenom} ${doc.clientNom}`.toLowerCase().includes(search) ||
        `${doc.commercialPrenom} ${doc.commercialNom}`.toLowerCase().includes(search) ||
        doc.templateName.toLowerCase().includes(search)
      );
    }

    // Filtre par onglet
    switch (activeTab) {
      case 'aTraiter':
        return filtered.filter(doc => doc.isOverdue || doc.status === 'sent');
      case 'enCours':
        return filtered.filter(doc => (doc.status === 'sent' || doc.status === 'opened') && !doc.isOverdue);
      case 'archives':
        return filtered.filter(doc => doc.status === 'signed' || doc.status === 'declined' || doc.status === 'expired');
      default:
        return filtered;
    }
  };

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== 'signed' && status !== 'declined' && status !== 'expired') {
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' };
    }
    switch (status) {
      case 'sent':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' };
      case 'opened':
        return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100' };
      case 'signed':
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100' };
      case 'declined':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' };
      case 'expired':
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100' };
    }
  };

  const getStatusLabel = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== 'signed' && status !== 'declined' && status !== 'expired') {
      return '🔴 RETARD';
    }
    switch (status) {
      case 'sent':
        return '🔵 Envoyé';
      case 'opened':
        return '🟠 Ouvert';
      case 'signed':
        return '🟢 Signé';
      case 'declined':
        return '❌ Refusé';
      case 'expired':
        return '⚪ Expiré';
      default:
        return '○ Inconnu';
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ['Dossier', 'Client', 'Email', 'Commercial', 'Template', 'Statut', 'Envoyé le', 'Délai'].join(','),
      ...filteredDocs.map(doc =>
        [
          `#${doc.dossierNumber}`,
          `${doc.clientPrenom} ${doc.clientNom}`,
          '',
          `${doc.commercialPrenom} ${doc.commercialNom}`,
          doc.templateName,
          getStatusLabel(doc.status, doc.isOverdue),
          new Date(doc.sentAt).toLocaleDateString('fr-FR'),
          doc.delayFormatted
        ].map(v => `"${v}"`).join(',')
      )
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', `docflow_export_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const filteredDocs = getFilteredDocuments();

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-semibold">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold text-[#0F172A]">Tableau de Bord</h1>
        <p className="text-[#64748B] mt-2">Vue opérationnelle & monitoring des documents</p>
      </header>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-[#E2E8F0] p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-12 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm font-medium">Total Dossiers</p>
                <p className="text-3xl font-bold text-[#0F172A] mt-2">{stats.totalDossiers}</p>
              </div>
              <div className="w-12 h-12 bg-[#2563EB]/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-[#2563EB]" size={24} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm font-medium">En Attente</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.enAttente}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="text-orange-600" size={24} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm font-medium">Terminés</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.termines}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="text-emerald-600" size={24} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] text-sm font-medium">Taux Conversion</p>
                <p className="text-3xl font-bold text-[#2563EB] mt-2">{stats.tauxConversion}%</p>
              </div>
              <div className="w-12 h-12 bg-[#2563EB]/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-[#2563EB]" size={24} />
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* Top Commerciaux & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget Top 5 Commerciaux */}
        <div className="md:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-6"
          >
            <h3 className="text-lg font-bold text-[#0F172A] mb-4">🏆 Top Commerciaux</h3>
            <div className="space-y-3">
              {loading ? (
                <p className="text-[#64748B] text-sm">Chargement...</p>
              ) : commerciaux.length === 0 ? (
                <p className="text-[#64748B] text-sm">Aucune donnée</p>
              ) : (
                commerciaux.map((comm, idx) => {
                  const maxSigned = Math.max(...commerciaux.map(c => c.signedCount), 1);
                  const percentage = (comm.signedCount / maxSigned) * 100;
                  
                  return (
                    <motion.div
                      key={comm.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-[#0F172A] text-sm">
                            {comm.firstName} {comm.lastName}
                          </span>
                          <span className="text-xs text-[#64748B] font-semibold">
                            {comm.signedCount} / {comm.totalCount}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: 0.6 + idx * 0.05, duration: 0.8 }}
                            className="h-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8]"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Pie Chart Visuel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg border border-[#E2E8F0] p-6 flex flex-col items-center justify-center"
        >
          <h3 className="text-lg font-bold text-[#0F172A] mb-4">Répartition</h3>
          {loading || commerciaux.length === 0 ? (
            <p className="text-[#64748B] text-sm">Aucune donnée</p>
          ) : (
            <div className="w-32 h-32 rounded-full relative flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {commerciaux.reduce((acc, comm, idx) => {
                  const totalSigned = commerciaux.reduce((sum, c) => sum + c.signedCount, 0);
                  const percentage = totalSigned > 0 ? (comm.signedCount / totalSigned) * 100 : 0;
                  const startAngle = acc;
                  const endAngle = acc + (percentage * 3.6);
                  
                  const colors = ['#2563EB', '#1D4ED8', '#1e40af', '#1e3a8a', '#172554'];
                  const color = colors[idx % colors.length];
                  
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;
                  
                  const x1 = 50 + 40 * Math.cos(startRad);
                  const y1 = 50 + 40 * Math.sin(startRad);
                  const x2 = 50 + 40 * Math.cos(endRad);
                  const y2 = 50 + 40 * Math.sin(endRad);
                  
                  const largeArc = percentage > 50 ? 1 : 0;
                  const pathData = [
                    `M 50 50`,
                    `L ${x1} ${y1}`,
                    `A 40 40 0 ${largeArc} 1 ${x2} ${y2}`,
                    'Z'
                  ].join(' ');

                  return acc + (percentage * 3.6);
                }, 0)}
              </svg>
              <div className="absolute text-center">
                <p className="text-lg font-bold text-[#0F172A]">{commerciaux.length}</p>
                <p className="text-xs text-[#64748B]">commerciaux</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Tableau Principal */}
      <div className="space-y-4">
        {/* Barre de Recherche & Export */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
            <input
              type="text"
              placeholder="Rechercher par client, commercial ou template..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            <Download size={18} />
            Exporter CSV
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 border-b border-[#E2E8F0]">
          {[
            { id: 'tous', label: 'Tous' },
            { id: 'aTraiter', label: 'À traiter' },
            { id: 'enCours', label: 'En cours' },
            { id: 'archives', label: 'Archives' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[#64748B]">Chargement...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-[#64748B]">
              {searchTerm ? 'Aucun document ne correspond à votre recherche' : 'Aucun document trouvé'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="px-6 py-3 font-semibold text-[#0F172A]">Dossier</th>
                    <th className="px-6 py-3 font-semibold text-[#0F172A]">Client</th>
                    <th className="px-6 py-3 font-semibold text-[#0F172A]">Commercial</th>
                    <th className="px-6 py-3 font-semibold text-[#0F172A]">Statut</th>
                    <th className="px-6 py-3 font-semibold text-[#0F172A]">Délai</th>
                    <th className="px-6 py-3 font-semibold text-[#0F172A] text-right">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc, idx) => {
                    const colors = getStatusColor(doc.status, doc.isOverdue);
                    const statusLabel = getStatusLabel(doc.status, doc.isOverdue);

                    return (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`border-b border-[#E2E8F0] hover:${colors.bg} transition-colors ${
                          doc.isOverdue ? 'animate-pulse' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono font-semibold text-[#0F172A]">
                            #{doc.dossierNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-[#0F172A]">
                              {doc.clientPrenom} {doc.clientNom}
                            </p>
                            <p className="text-xs text-[#64748B]">{doc.templateName}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[#0F172A]">
                            {doc.commercialPrenom} {doc.commercialNom}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.badge} ${colors.text}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className={`font-medium ${doc.isOverdue ? 'text-red-600' : 'text-[#0F172A]'}`}>
                              {doc.delayFormatted}
                            </p>
                            {doc.isOverdue && (
                              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                <AlertTriangle size={12} />
                                En retard
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className={`font-medium ${doc.isOverdue ? 'text-red-600' : 'text-[#0F172A]'}`}>
                              {doc.delayFormatted}
                            </p>
                            {doc.isOverdue && (
                              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                <AlertTriangle size={12} />
                                En retard
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedDocument(doc)}
                            className="p-2 hover:bg-[#F8FAFC] rounded-lg text-[#2563EB] transition-colors"
                            title="Voir les détails"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Détails Document */}
        <AnimatePresence>
          {selectedDocument && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedDocument(null)}
                className="absolute inset-0 bg-black/50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b border-[#E2E8F0] p-6 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[#0F172A]">Détails du Dossier #{selectedDocument.dossierNumber}</h2>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="text-[#64748B] hover:text-[#0F172A]"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Info Principales */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[#64748B] text-sm font-medium mb-1">Client</p>
                      <p className="text-lg font-bold text-[#0F172A]">{selectedDocument.clientPrenom} {selectedDocument.clientNom}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B] text-sm font-medium mb-1">Commercial</p>
                      <p className="text-lg font-bold text-[#0F172A]">{selectedDocument.commercialPrenom} {selectedDocument.commercialNom}</p>
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748B] font-medium">Statut</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedDocument.status, selectedDocument.isOverdue).badge} ${getStatusColor(selectedDocument.status, selectedDocument.isOverdue).text}`}>
                        {getStatusLabel(selectedDocument.status, selectedDocument.isOverdue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748B] font-medium">Délai écoulé</span>
                      <span className={`font-bold ${selectedDocument.isOverdue ? 'text-red-600' : 'text-[#0F172A]'}`}>
                        {selectedDocument.delayFormatted}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748B] font-medium">Envoyé le</span>
                      <span className="text-[#0F172A]">
                        {new Date(selectedDocument.sentAt).toLocaleDateString('fr-FR', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748B] font-medium">Document</span>
                      <span className="text-[#0F172A]">{selectedDocument.templateName}</span>
                    </div>
                  </div>

                  {selectedDocument.isOverdue && selectedDocument.status !== 'signed' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                      <AlertTriangle className="text-red-600 shrink-0" size={20} />
                      <div>
                        <p className="font-semibold text-red-900">Document en retard</p>
                        <p className="text-sm text-red-700 mt-1">
                          Ce document attend une signature depuis plus de 48 heures. Un suivi est recommandé.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setSelectedDocument(null)}
                      className="flex-1 px-4 py-2 bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg transition-colors font-semibold"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Info retards */}
        {filteredDocs.some(doc => doc.isOverdue) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3"
          >
            <AlertTriangle className="text-red-600 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-900">
                {filteredDocs.filter(doc => doc.isOverdue).length} document(s) en retard
              </p>
              <p className="text-sm text-red-700 mt-1">
                Des documents attendent une signature depuis plus de 48 heures
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
