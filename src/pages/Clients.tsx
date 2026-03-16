import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Plus, Search, Building2, Mail, UserPlus, MoreHorizontal, Send, User as UserIcon, X, AlertCircle, Phone, MapPin, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Client {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  fonction?: string;
  entreprise: string;
  siret?: string;
  adresse?: string;
  created_at: string;
}

interface Template {
  id: number;
  nom_template: string;
  id_docuseal: number;
}

const Clients: React.FC = () => {
  const { token } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientProfile, setSelectedClientProfile] = useState<Client | null>(null);
  const [selectedClientForDoc, setSelectedClientForDoc] = useState<Client | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newClient, setNewClient] = useState({
    prenom: '',
    nom: '',
    email: '',
    fonction: '',
    entreprise: '',
    siret: '',
    adresse: ''
  });

  useEffect(() => {
    fetchClients();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const templatesList = Array.isArray(data) ? data : (data.data || []);
      setTemplates(templatesList.filter((t: any) => t.available === 1));
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newClient)
      });
      if (response.ok) {
        setIsModalOpen(false);
        setNewClient({ prenom: '', nom: '', email: '', fonction: '', entreprise: '', siret: '', adresse: '' });
        fetchClients();
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.message || 'Impossible d\'enregistrer le client'}`);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Une erreur réseau est survenue.');
    }
  };

  const handleViewProfile = (client: Client) => {
    setSelectedClientProfile(client);
  };

  const handleSendDocument = (client: Client) => {
    setSelectedClientForDoc(client);
    setSelectedTemplate(null);
  };

  const handleSendDocumentSubmit = async () => {
    if (!selectedClientForDoc || !selectedTemplate) {
      alert('Veuillez sélectionner un template');
      return;
    }

    try {
      const response = await fetch('/api/documents/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: selectedClientForDoc.id,
          template_id: selectedTemplate,
          dynamic_data: {}
        })
      });

      if (response.ok) {
        alert('Document envoyé avec succès !');
        setSelectedClientForDoc(null);
        setSelectedTemplate(null);
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.message || 'Impossible d\'envoyer le document'}`);
      }
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Une erreur réseau est survenue.');
    }
  };

  const filteredClients = clients.filter(client => 
    `${client.prenom} ${client.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.entreprise.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-sm text-[#64748B] mt-1">Gérez votre portefeuille de prospects</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <UserPlus size={18} />
          <span>Nouveau Client</span>
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
        <input
          type="text"
          placeholder="Rechercher un client, une entreprise ou un email..."
          className="input pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Clients Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-[#E2E8F0]">
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Nom</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Entreprise</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#64748B] italic text-sm">Chargement des clients...</td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#64748B] italic text-sm">Aucun client trouvé</td>
                </tr>
              ) : (
                filteredClients.map((client, i) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-[#64748B]">
                          {client.prenom?.[0]}{client.nom?.[0]}
                        </div>
                        <span className="font-semibold text-sm">{client.prenom} {client.nom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-[#64748B]">
                        <Building2 size={14} className="opacity-50" />
                        <span>{client.entreprise}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-[#64748B]">
                        <Mail size={14} className="opacity-50" />
                        <span>{client.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleViewProfile(client)}
                          className="p-2 hover:bg-gray-100 rounded-md transition-all text-[#64748B] hover:text-[#0F172A]" 
                          title="Voir Profil"
                        >
                          <UserIcon size={16} />
                        </button>
                        <button 
                          onClick={() => handleSendDocument(client)}
                          className="p-2 hover:bg-gray-100 rounded-md transition-all text-[#64748B] hover:text-[#2563EB]" 
                          title="Envoyer Document"
                        >
                          <Send size={16} />
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

      {/* Modal Nouveau Client */}
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
              className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Nouveau Client</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Section 1: Informations Contact */}
                  <div className="space-y-4 pb-6 border-b border-[#E2E8F0]">
                    <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                      <UserIcon size={16} className="text-[#2563EB]" />
                      Informations Contact
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Prénom</label>
                        <input
                          type="text"
                          required
                          value={newClient.prenom}
                          onChange={(e) => setNewClient({ ...newClient, prenom: e.target.value })}
                          className="input"
                          placeholder="Jean"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Nom</label>
                        <input
                          type="text"
                          required
                          value={newClient.nom}
                          onChange={(e) => setNewClient({ ...newClient, nom: e.target.value })}
                          className="input"
                          placeholder="Dupont"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Email professionnel</label>
                      <input
                        type="email"
                        required
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        className="input"
                        placeholder="jean.dupont@entreprise.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Fonction (optionnel)</label>
                      <input
                        type="text"
                        value={newClient.fonction}
                        onChange={(e) => setNewClient({ ...newClient, fonction: e.target.value })}
                        className="input"
                        placeholder="ex: Directeur, Responsable RH, etc."
                      />
                    </div>
                  </div>

                  {/* Section 2: Informations Société */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                      <Building2 size={16} className="text-[#2563EB]" />
                      Informations Société
                    </h4>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Entreprise</label>
                      <input
                        type="text"
                        required
                        value={newClient.entreprise}
                        onChange={(e) => setNewClient({ ...newClient, entreprise: e.target.value })}
                        className="input"
                        placeholder="Acme Corp"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">SIRET (optionnel)</label>
                      <input
                        type="text"
                        value={newClient.siret}
                        onChange={(e) => setNewClient({ ...newClient, siret: e.target.value })}
                        className="input"
                        placeholder="12345678901234"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">Adresse du siège social (optionnel)</label>
                      <textarea
                        value={newClient.adresse}
                        onChange={(e) => setNewClient({ ...newClient, adresse: e.target.value })}
                        className="input resize-none"
                        placeholder="123 rue de la Paix, 75000 Paris"
                        rows={2}
                      />
                    </div>
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
                      Enregistrer le client
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Vue Profil Client */}
      <AnimatePresence>
        {selectedClientProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClientProfile(null)}
              className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Profil Client</h3>
                  <button onClick={() => setSelectedClientProfile(null)} className="text-[#64748B] hover:text-[#0F172A]">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* En-tête avec avatar */}
                  <div className="flex items-center gap-4 pb-6 border-b border-[#E2E8F0]">
                    <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-lg font-bold text-[#2563EB]">
                      {selectedClientProfile.prenom?.[0]}{selectedClientProfile.nom?.[0]}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-[#0F172A]">{selectedClientProfile.prenom} {selectedClientProfile.nom}</h4>
                      <p className="text-sm text-[#64748B]">{selectedClientProfile.entreprise}</p>
                    </div>
                  </div>

                  {/* Informations Contact */}
                  <div className="space-y-3">
                    <h5 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Informations Contact</h5>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <Mail size={16} className="text-[#64748B] shrink-0" />
                      <div>
                        <p className="text-[#64748B] text-xs mb-0.5">Email</p>
                        <p className="text-[#0F172A] font-medium">{selectedClientProfile.email}</p>
                      </div>
                    </div>

                    {selectedClientProfile.fonction && (
                      <div className="flex items-center gap-3 text-sm">
                        <Briefcase size={16} className="text-[#64748B] shrink-0" />
                        <div>
                          <p className="text-[#64748B] text-xs mb-0.5">Fonction</p>
                          <p className="text-[#0F172A] font-medium">{selectedClientProfile.fonction}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Informations Entreprise */}
                  <div className="space-y-3">
                    <h5 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Informations Entreprise</h5>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 size={16} className="text-[#64748B] shrink-0" />
                      <div>
                        <p className="text-[#64748B] text-xs mb-0.5">Entreprise</p>
                        <p className="text-[#0F172A] font-medium">{selectedClientProfile.entreprise}</p>
                      </div>
                    </div>

                    {selectedClientProfile.siret && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone size={16} className="text-[#64748B] shrink-0" />
                        <div>
                          <p className="text-[#64748B] text-xs mb-0.5">SIRET</p>
                          <p className="text-[#0F172A] font-medium">{selectedClientProfile.siret}</p>
                        </div>
                      </div>
                    )}

                    {selectedClientProfile.adresse && (
                      <div className="flex items-start gap-3 text-sm">
                        <MapPin size={16} className="text-[#64748B] shrink-0 mt-1" />
                        <div className="flex-1">
                          <p className="text-[#64748B] text-xs mb-0.5">Adresse</p>
                          <p className="text-[#0F172A] font-medium">{selectedClientProfile.adresse}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setSelectedClientProfile(null)}
                      className="btn-primary flex-1"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Envoyer Document */}
      <AnimatePresence>
        {selectedClientForDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClientForDoc(null)}
              className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0]"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold tracking-tight">Envoyer un document</h3>
                  <button onClick={() => setSelectedClientForDoc(null)} className="text-[#64748B] hover:text-[#0F172A]">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Info client */}
                  <div className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                    <p className="text-sm text-[#64748B] mb-1">Destinataire</p>
                    <p className="font-bold text-[#0F172A]">{selectedClientForDoc.prenom} {selectedClientForDoc.nom}</p>
                    <p className="text-sm text-[#64748B]">{selectedClientForDoc.email}</p>
                  </div>

                  {/* Sélection du template */}
                  <div>
                    <label className="block text-sm font-bold text-[#0F172A] uppercase tracking-wider mb-3">Sélectionner un document</label>
                    {templates.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="text-amber-600 shrink-0" size={20} />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">Aucun template disponible</p>
                          <p className="text-xs text-amber-700 mt-1">Contactez votre administrateur pour configurer des templates</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template.id)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              selectedTemplate === template.id
                                ? 'bg-[#2563EB]/5 border-[#2563EB]'
                                : 'border-[#E2E8F0] hover:border-[#2563EB]/50'
                            }`}
                          >
                            <p className="font-semibold text-[#0F172A]">{template.nom_template}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setSelectedClientForDoc(null)}
                      className="btn-secondary flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSendDocumentSubmit}
                      disabled={!selectedTemplate || templates.length === 0}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Clients;
