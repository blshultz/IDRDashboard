import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import DoctorDashboard from './components/DoctorDashboard';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import { LoadingSpinner, ErrorBanner } from './components/DataState';
import { useProcedures } from './hooks/useProcedures';
import { AdminTab } from './types';

function AppContent() {
  const { user, loading: authLoading, needsPasswordUpdate } = useAuth();
  const { procedures, loading: dataLoading, error, refetch } = useProcedures();
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (!user || needsPasswordUpdate) return <Login />;

  if (user.role === 'admin') {
    return (
      <Layout activeTab={adminTab} onTabChange={setAdminTab}>
        {adminTab === 'users' ? (
          <UserManagement />
        ) : dataLoading ? (
          <LoadingSpinner message="Loading procedure data from Google Sheets…" />
        ) : error ? (
          <ErrorBanner message={error} onRetry={refetch} />
        ) : (
          <AdminDashboard procedures={procedures} onRefetch={refetch} />
        )}
      </Layout>
    );
  }

  const doctorProcedures = user.providerName
    ? procedures.filter(p => p.providerName === user.providerName)
    : [];

  return (
    <Layout>
      {dataLoading ? (
        <LoadingSpinner message="Loading procedure data from Google Sheets…" />
      ) : error ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : (
        <DoctorDashboard
          procedures={doctorProcedures}
          providerName={user.providerName ?? user.name}
          onRefetch={refetch}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
