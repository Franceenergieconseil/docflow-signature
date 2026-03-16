import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogIn, ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full z-10"
      >
        <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-[#E2E8F0] overflow-hidden">
          <div className="p-10">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-14 h-14 bg-[#2563EB] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-6">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-[#0F172A]">Docuseal SaaS</h2>
              <p className="text-[#64748B] mt-2">Connectez-vous pour gérer vos signatures</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider ml-1">Email professionnel</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-12 h-12"
                    placeholder="nom@entreprise.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider">Mot de passe</label>
                  <button type="button" className="text-xs font-bold text-[#2563EB] hover:underline">Oublié ?</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-12 h-12"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-12 text-lg mt-4 disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>Se connecter</span>
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-[#F8FAFC] p-6 border-t border-[#E2E8F0] text-center">
            <p className="text-xs text-[#64748B]">
              En vous connectant, vous acceptez nos <button className="font-bold text-[#0F172A] hover:underline">Conditions d'utilisation</button>
            </p>
          </div>
        </div>
        
        <p className="text-center mt-8 text-sm text-[#64748B]">
          Vous n'avez pas de compte ? <button className="font-bold text-[#2563EB] hover:underline">Contactez votre administrateur</button>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
