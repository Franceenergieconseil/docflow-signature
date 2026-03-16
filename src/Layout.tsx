import React from 'react';
import { useAuth } from './AuthContext';
import { LogOut, LayoutDashboard, Users, FileText, Settings, Menu, X, ChevronRight, Shield, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  if (user?.role === 'admin') {
    menuItems.unshift({ id: 'admin-dashboard', label: 'Tableau de Bord', icon: BarChart3 });
    menuItems.push({ id: 'templates', label: 'Templates', icon: Settings });
    menuItems.push({ id: 'users', label: 'Utilisateurs', icon: Shield });
  }

  const activeItem = menuItems.find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-[#0F172A]">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E2E8F0] h-screen sticky top-0">
        <div className="p-6 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center text-white font-bold">D</div>
            <h1 className="text-xl font-bold tracking-tight">DocFlow</h1>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-[#2563EB]/5 text-[#2563EB]'
                  : 'hover:bg-gray-50 text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-[#2563EB]' : 'text-[#64748B] group-hover:text-[#0F172A]'} />
              <span className="font-medium text-sm">{item.label}</span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="ml-auto w-1 h-4 bg-[#2563EB] rounded-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center font-bold text-xs">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-500 hover:bg-red-50 transition-all duration-200 text-sm font-medium"
          >
            <LogOut size={16} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-[#E2E8F0] p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center text-white font-bold">D</div>
          <h1 className="text-lg font-bold">DocFlow</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-[#64748B]">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="md:hidden fixed inset-0 z-50 bg-white flex flex-col"
          >
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center text-white font-bold">D</div>
                <h1 className="text-lg font-bold">DocFlow</h1>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-[#64748B]">
                <X size={24} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-medium ${
                    activeTab === item.id ? 'bg-[#2563EB]/5 text-[#2563EB]' : 'text-[#64748B]'
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-6 border-t border-[#E2E8F0]">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl text-red-500 bg-red-50 font-bold"
              >
                <LogOut size={20} />
                <span>Déconnexion</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header / Breadcrumb */}
        <header className="hidden md:flex h-16 bg-white border-b border-[#E2E8F0] items-center px-8 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <span className="hover:text-[#0F172A] cursor-pointer">Application</span>
            <ChevronRight size={14} />
            <span className="text-[#0F172A] font-medium">{activeItem?.label}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200" />
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
