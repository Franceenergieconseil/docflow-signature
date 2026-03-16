import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Trash2, Edit2, Plus, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'commercial';
  created_at: string;
}

interface CreateUserPayload {
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'commercial';
}

const Users: React.FC = () => {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState<CreateUserPayload>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'commercial'
  });

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la récupération des utilisateurs');
      
      const data = await response.json();
      setUsers(data.data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open create modal
  const handleCreateClick = () => {
    setEditingUser(null);
    setFormData({ email: '', first_name: '', last_name: '', role: 'commercial' });
    setTempPassword('');
    setShowModal(true);
  };

  // Open edit modal
  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    });
    setTempPassword('');
    setShowModal(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email || !formData.first_name || !formData.last_name) {
      setError('Tous les champs sont obligatoires');
      return;
    }

    try {
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la sauvegarde');
      }

      if (!editingUser && data.tempPassword) {
        setTempPassword(data.tempPassword);
      } else {
        setShowModal(false);
        setSuccess(editingUser ? 'Utilisateur modifié avec succès' : 'Utilisateur créé avec succès');
        setTimeout(() => setSuccess(''), 3000);
      }

      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete user
  const handleDelete = async (userId: number) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erreur lors de la suppression');
      }

      setShowDeleteConfirm(null);
      setSuccess('Utilisateur supprimé avec succès');
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Copy password
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Check if admin
  if (authUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-semibold">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">Gestion des Utilisateurs</h1>
          <p className="text-[#64748B] mt-2">Créez, modifiez ou supprimez les comptes utilisateurs</p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Créer un utilisateur
        </button>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3"
          >
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex gap-3"
          >
            <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
            <p className="text-emerald-700 text-sm">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-[#64748B]">Chargement...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[#64748B]">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[#0F172A]">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[#0F172A]">Nom</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[#0F172A]">Rôle</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[#0F172A]">Créé le</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-[#0F172A]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-[#0F172A] font-medium">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-[#0F172A]">{user.first_name} {user.last_name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Commercial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#64748B]">
                    {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(user)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(user.id)}
                        disabled={user.id === authUser?.id}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={user.id === authUser?.id ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer"}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => !tempPassword && setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold mb-6 text-[#0F172A]">
                {tempPassword
                  ? 'Utilisateur créé avec succès'
                  : editingUser
                  ? 'Modifier l\'utilisateur'
                  : 'Créer un nouvel utilisateur'}
              </h2>

              {tempPassword ? (
                <div className="space-y-4">
                  <p className="text-[#64748B] text-sm">
                    L'utilisateur a été créé. Voici son mot de passe temporaire :
                  </p>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
                    <div className="font-mono text-lg font-bold text-[#2563EB] break-all">
                      {tempPassword}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyPassword}
                    className="w-full flex items-center justify-center gap-2 bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {copiedPassword ? (
                      <>
                        <CheckCircle2 size={18} />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        Copier le mot de passe
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#0F172A] mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      disabled={!!editingUser}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] disabled:bg-[#F8FAFC] disabled:cursor-not-allowed"
                      placeholder="utilisateur@example.com"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#0F172A] mb-1">
                        Prénom
                      </label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        placeholder="Jean"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#0F172A] mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        placeholder="Dupont"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#0F172A] mb-1">
                      Rôle
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                    >
                      <option value="commercial">Commercial</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                      <AlertCircle className="text-red-500 shrink-0" size={18} />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-lg text-[#0F172A] hover:bg-[#F8FAFC] transition-colors font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg transition-colors font-semibold"
                    >
                      {editingUser ? 'Modifier' : 'Créer'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold mb-4 text-[#0F172A]">Confirmer la suppression</h2>
              <p className="text-[#64748B] mb-6">
                Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-[#E2E8F0] rounded-lg text-[#0F172A] hover:bg-[#F8FAFC] transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
