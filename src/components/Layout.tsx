import React, { ReactNode } from 'react';
import { Activity, LogOut, Shield, Stethoscope, LayoutDashboard, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AdminTab } from '../types';

interface LayoutProps {
  children: ReactNode;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm">BHAC IDR Revenue Portal</span>
                <p className="text-xs text-slate-400 leading-none">Insurance Procedure Reporting Dashboard</p>
              </div>
            </div>
            {isAdmin && onTabChange && (
              <nav className="hidden sm:flex items-center gap-1 ml-4">
                <button onClick={() => onTabChange('dashboard')} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <LayoutDashboard className="w-4 h-4" />Dashboard
                </button>
                <button onClick={() => onTabChange('users')} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <Users className="w-4 h-4" />Users
                </button>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                {isAdmin ? <Shield className="w-4 h-4 text-blue-600" /> : <Stethoscope className="w-4 h-4 text-blue-600" />}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-700 leading-tight">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        {isAdmin && onTabChange && (
          <div className="sm:hidden flex border-t border-slate-100">
            <button onClick={() => onTabChange('dashboard')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500'}`}>
              <LayoutDashboard className="w-4 h-4" />Dashboard
            </button>
            <button onClick={() => onTabChange('users')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${activeTab === 'users' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-slate-500'}`}>
              <Users className="w-4 h-4" />Users
            </button>
          </div>
        )}
      </header>
      <main className="max-w-screen-2xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
