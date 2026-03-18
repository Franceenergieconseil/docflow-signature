import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Clients from './pages/Clients';
import Documents from './pages/Documents';
import Templates from './pages/Templates';
import Users from './pages/Users';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [documentsFilter, setDocumentsFilter] = useState<'all' | 'pending' | 'signed' | 'archived'>('all');

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleNavigateToDocuments = (filter: 'all' | 'pending' | 'signed' | 'archived') => {
    setDocumentsFilter(filter);
    setActiveTab('documents');
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard onNavigateToDocuments={handleNavigateToDocuments} />}
      {activeTab === 'admin-dashboard' && <AdminDashboard />}
      {activeTab === 'clients' && <Clients />}
      {activeTab === 'documents' && <Documents initialFilter={documentsFilter} />}
      {activeTab === 'templates' && <Templates />}
      {activeTab === 'users' && <Users />}
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
