'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import KanbanBoard from '@/components/KanbanBoard';
import LeadForm from '@/components/LeadForm';
import ClientDetailPanel from '@/components/ClientDetailPanel';
import CalendarView from '@/components/CalendarView';
import ClientsList from '@/components/ClientsList';
import SettingsView from '@/components/SettingsView';
import { Client } from '@/lib/types';
import { 
  LayoutDashboard, 
  UserPlus, 
  Settings, 
  LogOut, 
  Bell, 
  Menu,
  X,
  Zap,
  Palette,
  Calendar,
  ExternalLink,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'kanban' | 'form' | 'calendar' | 'clients' | 'settings'>('kanban');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setIsCheckingAuth(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 flex flex-col shadow-sm md:relative"
          >
            <div className="p-6 flex items-center gap-3 border-b border-gray-50">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                <Palette className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="font-black text-xl tracking-tight">ROBBY FLOW</h1>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tattoo CRM</p>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <button
                onClick={() => { setActiveTab('kanban'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'kanban' 
                    ? 'bg-black text-white shadow-lg shadow-black/10' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="font-semibold">Pipeline</span>
              </button>
              <button
                onClick={() => { setActiveTab('clients'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'clients' 
                    ? 'bg-black text-white shadow-lg shadow-black/10' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-semibold">Clientes</span>
              </button>
              <button
                onClick={() => { setActiveTab('calendar'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'calendar' 
                    ? 'bg-black text-white shadow-lg shadow-black/10' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span className="font-semibold">Calendario</span>
              </button>
              <button
                onClick={() => { setActiveTab('form'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'form' 
                    ? 'bg-black text-white shadow-lg shadow-black/10' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
              >
                <UserPlus className="w-5 h-5" />
                <span className="font-semibold">Nuevo Lead</span>
              </button>

              <div className="pt-4 pb-2 px-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Enlaces Públicos</p>
              </div>

              <a 
                href="/cotizar" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-black transition-all"
              >
                <ExternalLink className="w-5 h-5" />
                <span className="font-semibold">Formulario Clientes</span>
              </a>
              
              <div className="pt-8 pb-4 px-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configuración</p>
              </div>
              
              <button
                onClick={() => { setActiveTab('settings'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'settings' 
                    ? 'bg-black text-white shadow-lg shadow-black/10' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="font-semibold">Ajustes</span>
              </button>
            </nav>

            <div className="p-4 border-t border-gray-50">
              <div className="bg-purple-50 p-4 rounded-2xl mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-purple-900">Robby IA Pro</span>
                </div>
                <p className="text-[10px] text-purple-700 leading-relaxed">
                  Tu asistente está analizando leads en tiempo real.
                </p>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-semibold">Cerrar Sesión</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-bold text-gray-900">
              {activeTab === 'kanban' ? 'Pipeline de Clientes' : activeTab === 'calendar' ? 'Agenda de Citas' : activeTab === 'clients' ? 'Listado de Clientes' : activeTab === 'settings' ? 'Configuración de Agenda' : 'Formulario de Cotización'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">Robby Art</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Pro Artist</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-full border-2 border-white shadow-sm"></div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'kanban' ? (
              <motion.div
                key="kanban"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <KanbanBoard onSelectClient={setSelectedClient} refreshTrigger={refreshTrigger} />
              </motion.div>
            ) : activeTab === 'clients' ? (
              <motion.div
                key="clients"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <ClientsList onSelectClient={setSelectedClient} />
              </motion.div>
            ) : activeTab === 'settings' ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <SettingsView />
              </motion.div>
            ) : activeTab === 'calendar' ? (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <CalendarView />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <LeadForm />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClient(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <ClientDetailPanel 
              client={selectedClient} 
              onClose={() => setSelectedClient(null)} 
              onUpdate={() => setRefreshTrigger(prev => prev + 1)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
