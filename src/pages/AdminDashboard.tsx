import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { BarChart3, TrendingUp, CheckCircle2, Clock, Search, AlertTriangle, Download, Eye, X, XCircle, Timer, FileText } from 'lucide-react';
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

interface TemplatePerf {
  templateId: number;
  templateName: string;
  totalCount: number;
  signedCount: number;
  declinedCount: number;
  conversionRate: number | null;
}

interface DashboardStats {
  totalDossiers: number;
  enAttente: number;
  termines: number;
  refuses: number;
  enRetard: number;
  tauxConversion: number;
  tauxRefus: number;
  delaiMoyenHeures: number | null;
  delaiMoyenFormatted: string;
  templatePerformance: TemplatePerf[];
}

interface CommercialStats {
  id: number;
  firstName: string;
  lastName: string;
  totalCount: number;
  signedCount: number;
  declinedCount: number;
  conversionRate: number | null;
}

type Period = '7d' | '30d' | '3m' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d',  label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '3m',  label: '3 derniers mois' },
  { value: 'all', label: 'Tout l\'historique' },
];

const AdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [period, setPeriod]             = useState<Period>('30d');
  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [documents, setDocuments]       = useState<Document[]>([]);
  const [commerciaux, setCommerciaux]   = useState<CommercialStats[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [activeTab, setActiveTab]       = useState<'tous' | 'aTraiter' | 'enCours' | 'archives'>('tous');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData(period);
      const interval = setInterval(() => fetchData(period), 30000);
      return () => clearInterval(interval);
    }
  }, [period]);

  const fetchData = async (p: Period) => {
    try {
      setLoading(true);
      const qs = `?period=${p}`;
      const [statsRes, docsRes, commRes] = await Promise.all([
        fetch(`/api/admin/stats/dashboard${qs}`,        { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/admin/documents/list${qs}`,         { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/admin/commerciaux/performance${qs}`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) { const d = await statsRes.json(); setStats(d.data); }
      if (docsRes.ok)  { const d = await docsRes.json();  setDocuments(d.data || []); }
      if (commRes.ok)  { const d = await commRes.json();  setCommerciaux(d.data || []); }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredDocuments = () => {
    let filtered = documents;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        `${doc.clientPrenom} ${doc.clientNom}`.toLowerCase().includes(search) ||
        `${doc.commercialPrenom} ${doc.commercialNom}`.toLowerCase().includes(search) ||
        doc.templateName.toLowerCase().includes(search)
      );
    }
    switch (activeTab) {
      case 'aTraiter': return filtered.filter(doc => doc.isOverdue || doc.status === 'sent');
      case 'enCours':  return filtered.filter(doc => (doc.status === 'sent' || doc.status === 'opened') && !doc.isOverdue);
      case 'archives': return filtered.filter(doc => ['signed', 'declined', 'expired'].includes(doc.status));
      default:         return filtered;
    }
  };

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue && !['signed', 'declined', 'expired'].includes(status))
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' };
    switch (status) {
      case 'sent':     return { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100' };
      case 'opened':   return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100' };
      case 'signed':   return { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',badge: 'bg-emerald-100' };
      case 'declined': return { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100' };
      case 'expired':  return { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   badge: 'bg-gray-100' };
      default:         return { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   badge: 'bg-gray-100' };
    }
  };

  const getStatusLabel = (status: string, isOverdue: boolean) => {
    if (isOverdue && !['signed', 'declined', 'expired'].includes(status)) return '🔴 RETARD';
    switch (status) {
      case 'sent':     return '🔵 Envoyé';
      case 'opened':   return '🟠 Ouvert';
      case 'signed':   return '🟢 Signé';
      case 'declined': return '❌ Refusé';
      case 'expired':  return '⚪ Expiré';
      default:         return '○ Inconnu';
    }
  };

  const filteredDocs = getFilteredDocuments();

  const handleExportCSV = () => {
    const csvContent = [
      ['Dossier', 'Client', 'Commercial', 'Template', 'Statut', 'Envoyé le', 'Délai'].join(','),
      ...filteredDocs.map(doc =>
        [
          `#${doc.dossierNumber}`,
          `${doc.clientPrenom} ${doc.clientNom}`,
          `${doc.commercialPrenom} ${doc.commercialNom}`,
          doc.templateName,
          getStatusLabel(doc.status, doc.isOverdue),
          new Date(doc.sentAt).toLocaleDateString('fr-FR'),
          doc.delayFormatted,
        ].map(v => `"${v}"`).join(',')
      ),
    ].join('\n');

    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    a.download = `docflow_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-semibold">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label ?? '';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">Tableau de Bord</h1>
          <p className="text-[#64748B] mt-1">Vue opérationnelle · {periodLabel}</p>
        </div>
        {/* Sélecteur de période */}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="self-start sm:self-auto px-4 py-2.5 border border-[#E2E8F0] rounded-lg bg-white text-sm font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
        >
          {PERIOD_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </header>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-[#E2E8F0] p-5 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">

          {/* Envoyés */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="text-[#2563EB]" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-[#0F172A]">{stats.totalDossiers}</p>
            <p className="text-sm text-[#64748B] mt-1 font-medium">Documents envoyés</p>
          </motion.div>

          {/* En attente + retards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className={`bg-white rounded-lg border p-5 hover:shadow-lg transition-shadow ${stats.enRetard > 0 ? 'border-red-300' : 'border-[#E2E8F0]'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.enRetard > 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                <Clock className={stats.enRetard > 0 ? 'text-red-500' : 'text-orange-500'} size={20} />
              </div>
              {stats.enRetard > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                  {stats.enRetard} en retard
                </span>
              )}
            </div>
            <p className={`text-3xl font-bold ${stats.enRetard > 0 ? 'text-red-600' : 'text-orange-600'}`}>{stats.enAttente}</p>
            <p className="text-sm text-[#64748B] mt-1 font-medium">En attente</p>
          </motion.div>

          {/* Signés */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="text-emerald-600" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats.termines}</p>
            <p className="text-sm text-[#64748B] mt-1 font-medium">Documents signés</p>
          </motion.div>

          {/* Taux de conversion */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#2563EB]/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-[#2563EB]" size={20} />
              </div>
              {stats.tauxRefus > 0 && (
                <span className="text-[10px] text-red-500 font-semibold">{stats.tauxRefus}% refus</span>
              )}
            </div>
            <p className="text-3xl font-bold text-[#2563EB]">{stats.tauxConversion}%</p>
            <p className="text-sm text-[#64748B] mt-1 font-medium">Taux conversion</p>
          </motion.div>

          {/* Délai moyen */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Timer className="text-purple-600" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600">{stats.delaiMoyenFormatted}</p>
            <p className="text-sm text-[#64748B] mt-1 font-medium">Délai moyen signature</p>
          </motion.div>

        </div>
      ) : null}

      {/* ── Top Commerciaux + Performance par Template ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Widget Top 5 Commerciaux */}
        <div className="md:col-span-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-lg border border-[#E2E8F0] p-6 h-full">
            <h3 className="text-lg font-bold text-[#0F172A] mb-4">
              🏆 Top Commerciaux
              <span className="text-xs font-normal text-[#64748B] ml-2">({periodLabel})</span>
            </h3>
            <div className="space-y-4">
              {loading ? (
                <p className="text-[#64748B] text-sm">Chargement...</p>
              ) : commerciaux.length === 0 ? (
                <p className="text-[#64748B] text-sm italic">Aucune donnée sur cette période</p>
              ) : (
                commerciaux.map((comm, idx) => {
                  const rate = comm.conversionRate ?? 0;
                  return (
                    <motion.div key={comm.id}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.05 }}
                      className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1 gap-2">
                          <span className="font-semibold text-[#0F172A] text-sm truncate">
                            {comm.firstName} {comm.lastName}
                          </span>
                          <span className="text-xs text-[#64748B] font-semibold whitespace-nowrap shrink-0">
                            {rate}% ({comm.signedCount}/{comm.totalCount} signés)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${rate}%` }}
                            transition={{ delay: 0.5 + idx * 0.05, duration: 0.8 }}
                            className={`h-full rounded-full ${
                              rate >= 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                              rate >= 50 ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8]' :
                              rate >= 25 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                              'bg-gradient-to-r from-red-400 to-red-300'
                            }`}
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

        {/* Performance par Template */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-lg border border-[#E2E8F0] p-6">
          <h3 className="text-lg font-bold text-[#0F172A] mb-4">📋 Par Template</h3>
          {loading || !stats ? (
            <p className="text-[#64748B] text-sm">Chargement...</p>
          ) : stats.templatePerformance.filter(t => t.totalCount > 0).length === 0 ? (
            <p className="text-[#64748B] text-sm italic">Aucune donnée sur cette période</p>
          ) : (
            <div className="space-y-3">
              {stats.templatePerformance
                .filter(t => t.totalCount > 0)
                .map((t) => {
                  const rate = t.conversionRate ?? 0;
                  return (
                    <div key={t.templateId} className="space-y-1.5">
                      <div className="flex justify-between items-baseline gap-1">
                        <span className="text-sm font-semibold text-[#0F172A] truncate" title={t.templateName}>
                          {t.templateName}
                        </span>
                        <span className="text-xs text-[#64748B] whitespace-nowrap shrink-0">
                          {t.signedCount}/{t.totalCount}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${rate}%` }}
                          transition={{ duration: 0.8 }}
                          className={`h-full rounded-full ${
                            rate >= 75 ? 'bg-emerald-500' :
                            rate >= 50 ? 'bg-[#2563EB]' :
                            rate >= 25 ? 'bg-amber-500' :
                            'bg-red-400'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#94A3B8]">
                        <span>{rate}% signé</span>
                        {t.declinedCount > 0 && <span className="text-red-400">{t.declinedCount} refus</span>}
                      </div>
                    </div>
                  );
                })}

              {/* Résumé équipe */}
              <div className="pt-3 mt-3 border-t border-[#E2E8F0] space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Actifs période</span>
                  <span className="font-bold text-[#0F172A]">
                    {commerciaux.filter(c => c.totalCount > 0).length}/{commerciaux.length}
                  </span>
                </div>
                {stats.tauxRefus > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#64748B]">Taux de refus</span>
                    <span className="font-bold text-red-500">{stats.tauxRefus}%</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Délai moyen</span>
                  <span className="font-bold text-purple-600">{stats.delaiMoyenFormatted}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

      </div>

      {/* ── Tableau Principal ── */}
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
            { id: 'tous',     label: 'Tous',      count: documents.length },
            { id: 'aTraiter', label: 'À traiter', count: documents.filter(d => d.isOverdue || d.status === 'sent').length },
            { id: 'enCours',  label: 'En cours',  count: documents.filter(d => (d.status === 'sent' || d.status === 'opened') && !d.isOverdue).length },
            { id: 'archives', label: 'Archives',  count: documents.filter(d => ['signed','declined','expired'].includes(d.status)).length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium transition-all border-b-2 flex items-center gap-2 ${
                activeTab === tab.id ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.id ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-gray-100 text-[#94A3B8]'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[#64748B]">Chargement...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-[#64748B]">
              {searchTerm ? 'Aucun document ne correspond à votre recherche' : 'Aucun document sur cette période'}
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
                  {filteredDocs.map((doc) => {
                    const colors = getStatusColor(doc.status, doc.isOverdue);
                    return (
                      <motion.tr key={doc.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="border-b border-[#E2E8F0] hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono font-semibold text-[#0F172A]">#{doc.dossierNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-[#0F172A]">{doc.clientPrenom} {doc.clientNom}</p>
                          <p className="text-xs text-[#64748B]">{doc.templateName}</p>
                        </td>
                        <td className="px-6 py-4 text-[#0F172A]">
                          {doc.commercialPrenom} {doc.commercialNom}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.badge} ${colors.text}`}>
                            {getStatusLabel(doc.status, doc.isOverdue)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className={`font-medium ${doc.isOverdue ? 'text-red-600' : 'text-[#0F172A]'}`}>
                            {doc.delayFormatted}
                          </p>
                          {doc.isOverdue && (
                            <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                              <AlertTriangle size={11} /> En retard
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setSelectedDocument(doc)}
                            className="p-2 hover:bg-[#F8FAFC] rounded-lg text-[#2563EB] transition-colors" title="Voir les détails">
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

        {/* Alerte retards */}
        {filteredDocs.some(doc => doc.isOverdue) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="text-red-600 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-red-900">
                {filteredDocs.filter(d => d.isOverdue).length} document(s) en retard
              </p>
              <p className="text-sm text-red-700 mt-1">
                Ces documents attendent une signature depuis plus de 48 heures
              </p>
            </div>
          </motion.div>
        )}

      </div>

      {/* ── Modal Détails Document ── */}
      <AnimatePresence>
        {selectedDocument && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedDocument(null)}
              className="absolute inset-0 bg-black/50" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-[#E2E8F0] p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#0F172A]">
                  Dossier #{selectedDocument.dossierNumber}
                </h2>
                <button onClick={() => setSelectedDocument(null)} className="text-[#64748B] hover:text-[#0F172A]">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-6">
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
                  {[
                    { label: 'Statut',       value: <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedDocument.status, selectedDocument.isOverdue).badge} ${getStatusColor(selectedDocument.status, selectedDocument.isOverdue).text}`}>{getStatusLabel(selectedDocument.status, selectedDocument.isOverdue)}</span> },
                    { label: 'Délai écoulé', value: <span className={`font-bold ${selectedDocument.isOverdue ? 'text-red-600' : 'text-[#0F172A]'}`}>{selectedDocument.delayFormatted}</span> },
                    { label: 'Envoyé le',    value: new Date(selectedDocument.sentAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                    { label: 'Document',     value: selectedDocument.templateName },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center">
                      <span className="text-[#64748B] font-medium">{row.label}</span>
                      <span className="text-[#0F172A]">{row.value}</span>
                    </div>
                  ))}
                </div>
                {selectedDocument.isOverdue && selectedDocument.status !== 'signed' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="text-red-600 shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-red-900">Document en retard</p>
                      <p className="text-sm text-red-700 mt-1">Ce document attend une signature depuis plus de 48 heures.</p>
                    </div>
                  </div>
                )}
                <button onClick={() => setSelectedDocument(null)}
                  className="w-full px-4 py-2 bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg transition-colors font-semibold">
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminDashboard;
