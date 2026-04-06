'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-service';
import { toast } from 'sonner';
import { KanbanStatus, Client, KANBAN_COLUMNS } from '@/lib/types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Clock, 
  DollarSign, 
  Instagram, 
  Phone,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  Calendar,
  Euro,
  PoundSterling
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PaymentModal from './PaymentModal';

interface KanbanBoardProps {
  onSelectClient: (client: Client) => void;
  refreshTrigger?: number;
}

export default function KanbanBoard({ onSelectClient, refreshTrigger }: KanbanBoardProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientForPayment, setClientForPayment] = useState<Client | null>(null);

  useEffect(() => {
    fetchClients();

    // Realtime subscription (funciona si está habilitado en Supabase)
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients();
      })
      .subscribe();

    // Polling de respaldo (por si Realtime no está habilitado en la tabla)
    const intervalId = setInterval(() => {
      fetchClients();
    }, 5000); // Refresca cada 5 segundos

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [refreshTrigger]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, quotes(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Sort quotes by created_at descending for each client
      const clientsWithSortedQuotes = (data || []).map((client: any) => ({
        ...client,
        quotes: client.quotes?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || []
      }));
      
      setClients(clientsWithSortedQuotes);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.idea_tatuaje.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getClientsByStatus = (status: KanbanStatus) => {
    return filteredClients.filter(c => c.status === status);
  };

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    e.dataTransfer.setData('clientId', clientId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: KanbanStatus) => {
    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;

    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    // --- VALIDACIONES DE ARRASTRE ---
    if (newStatus === 'completed') {
      setClientForPayment(client);
      return;
    }

    if (newStatus === 'payment_confirmed' && client.status !== 'payment_confirmed') {
      toast.error('No puedes mover a "Pago Confirmado" arrastrando. Abre la tarjeta y usa el botón verde "Confirmar Pago Recibido".');
      return;
    }

    if (newStatus === 'scheduled') {
      if (!client.appointment_date) {
        toast.error('No puedes mover a "Agendado" sin haber definido una Fecha de Cita.');
        return;
      }
      if (!client.deposit_paid) {
        toast.error('No puedes agendar sin antes haber confirmado el pago de la seña.');
        return;
      }
    }
    // --------------------------------

    // Actualización optimista: movemos la tarjeta inmediatamente en la UI
    setClients(prevClients => 
      prevClients.map(c => 
        c.id === clientId ? { ...c, status: newStatus } : c
      )
    );

    try {
      // Si se mueve a "payment_pending", enviamos el correo de cotización
      if (newStatus === 'payment_pending' && client.status !== 'payment_pending') {
        const activeQuote = client.quotes?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const priceToUse = activeQuote?.price_artist || activeQuote?.ai_suggested_price || 0;
        await sendEmail(client.id, 'quote', priceToUse);
        toast.success('¡Cotización enviada automáticamente!');
      }

      // Si se mueve a "follow_up", enviamos el correo de seguimiento
      if (newStatus === 'follow_up' && client.status !== 'follow_up') {
        await sendEmail(client.id, 'followup');
        toast.success('¡Email de seguimiento enviado automáticamente!');
      }

      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);

      if (error) {
        // Si hay error, revertimos recargando los datos reales
        fetchClients();
        throw error;
      }
    } catch (err: any) {
      console.error('Error updating status or sending email:', err);
      // Revert optimistic update
      fetchClients();
      if (err.message === 'RESTRICTED_RECIPIENT') {
        toast.warning('Email no enviado: El correo del cliente no está verificado en Resend.');
      } else {
        toast.error('Error al mover la tarjeta o enviar el correo.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar clientes o ideas..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button className="p-2 bg-gray-100 hover:bg-gray-200 transition-colors">
              <LayoutGrid className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-50 transition-colors border-l border-gray-200">
              <ListIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-full min-h-[600px]">
        {KANBAN_COLUMNS.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-[280px] md:w-80 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-gray-700">{column.label}</h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {getClientsByStatus(column.id).length}
                </span>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 bg-gray-50/50 rounded-xl p-2 border border-dashed border-gray-200 overflow-y-auto">
              <div className="space-y-3">
                {getClientsByStatus(column.id).map((client) => (
                  <div
                    key={client.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, client.id)}
                    onClick={() => onSelectClient(client)}
                    className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 group-hover:text-black transition-colors">
                        {client.nombre}
                      </h4>
                      <button className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {client.idea_tatuaje}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded uppercase tracking-wider">
                        {client.channel}
                      </span>
                      {client.zona && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wider">
                          {client.zona}
                        </span>
                      )}
                      {client.quotes && client.quotes[0] && client.quotes[0].ai_difficulty && (
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${
                          client.quotes[0].ai_difficulty === 'Alta' ? 'bg-red-50 text-red-600' :
                          client.quotes[0].ai_difficulty === 'Media' ? 'bg-orange-50 text-orange-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {client.quotes[0].ai_difficulty}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-3 text-gray-400">
                        {client.instagram && <Instagram className="w-3.5 h-3.5" />}
                        {client.telefono && <Phone className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex items-center gap-2">
                        {client.quotes && client.quotes[0] && (
                          <>
                            {client.quotes[0].price_artist ? (
                              <div className="flex items-center text-xs font-semibold text-green-600">
                                {client.quotes[0].currency === 'EUR' ? <Euro className="w-3 h-3" /> : client.quotes[0].currency === 'GBP' ? <PoundSterling className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                                {client.quotes[0].price_artist}
                              </div>
                            ) : client.quotes[0].ai_suggested_price && (
                              <div className="flex items-center text-xs font-medium text-purple-600">
                                {client.quotes[0].currency === 'EUR' ? <Euro className="w-3 h-3" /> : client.quotes[0].currency === 'GBP' ? <PoundSterling className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                                {client.quotes[0].ai_suggested_price}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {client.appointment_date && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-600 font-bold">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(client.appointment_date), 'dd MMM', { locale: es })}
                        {client.appointment_time && (
                          <>
                            <span className="opacity-30 mx-1">•</span>
                            <Clock className="w-3 h-3" />
                            {client.appointment_time} hs
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {clientForPayment && (
          <PaymentModal
            client={clientForPayment}
            onClose={() => setClientForPayment(null)}
            onSuccess={() => {
              setClientForPayment(null);
              fetchClients();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
