'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Client, KanbanStatus, KANBAN_COLUMNS, MessageLog, Quote, Payment, Appointment } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-service';
import { analyzeTattooRequest } from '@/lib/ai-service';
import { 
  X, 
  Instagram, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  DollarSign, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  Save,
  Edit,
  Trash2,
  Send,
  Loader2,
  History,
  Euro,
  PoundSterling,
  Plus,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';

interface ClientDetailPanelProps {
  client: Client;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function ClientDetailPanel({ client, onClose, onUpdate }: ClientDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Client>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [newApptDate, setNewApptDate] = useState('');
  const [newApptTime, setNewApptTime] = useState('');
  const [newApptDuration, setNewApptDuration] = useState(2);

  const currentCurrency = activeQuote?.currency || editedClient.currency || 'USD';
  const CurrencyIcon = currentCurrency === 'EUR' ? Euro : currentCurrency === 'GBP' ? PoundSterling : DollarSign;
  const currencySymbol = currentCurrency === 'EUR' ? '€' : currentCurrency === 'GBP' ? '£' : '$';

  const fetchPayments = useCallback(async () => {
    setIsLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoadingPayments(false);
    }
  }, [client.id]);

  const fetchAppointments = useCallback(async () => {
    setIsLoadingAppointments(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', client.id)
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setIsLoadingAppointments(false);
    }
  }, [client.id]);

  const handleAddAppointment = async (date: string, time: string, duration: number) => {
    if (!date || !time) {
      toast.error('Fecha y hora son obligatorias.');
      return;
    }

    const fullDateTime = `${date}T${time}:00`;
    
    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          client_id: client.id,
          appointment_date: fullDateTime,
          duration: duration,
          status: 'scheduled'
        });

      if (error) throw error;
      toast.success('Sesión agendada correctamente.');
      fetchAppointments();
      syncNextAppointment();
      
      // Log to messages
      await supabase.from('messages').insert({
        client_id: client.id,
        message_type: 'scheduling',
        channel: 'System',
        content: `Nueva sesión agendada para el ${format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')} a las ${time} hs.`,
        sent_at: new Date().toISOString()
      });
      fetchMessages();
    } catch (error) {
      console.error('Error adding appointment:', error);
      toast.error('Error al agendar la sesión.');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Sesión eliminada.');
      fetchAppointments();
      syncNextAppointment();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('Error al eliminar la sesión.');
    }
  };

  const handleToggleAppointmentStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'scheduled' ? 'completed' : 'scheduled';
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Sesión marcada como ${newStatus === 'completed' ? 'completada' : 'pendiente'}.`);
      fetchAppointments();
      syncNextAppointment();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast.error('Error al actualizar el estado de la sesión.');
    }
  };

  const syncNextAppointment = async () => {
    try {
      const { data: nextAppt } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', client.id)
        .eq('status', 'scheduled')
        .gte('appointment_date', new Date().toISOString())
        .order('appointment_date', { ascending: true })
        .limit(1);

      if (nextAppt && nextAppt.length > 0) {
        const [date, time] = nextAppt[0].appointment_date.split('T');
        await supabase
          .from('clients')
          .update({
            appointment_date: date,
            appointment_time: time.substring(0, 5),
            appointment_duration: nextAppt[0].duration
          })
          .eq('id', client.id);
        
        // Update local state too
        setEditedClient(prev => ({
          ...prev,
          appointment_date: date,
          appointment_time: time.substring(0, 5),
          appointment_duration: nextAppt[0].duration
        }));
      } else {
        // No scheduled future appointments
        await supabase
          .from('clients')
          .update({
            appointment_date: null,
            appointment_time: null,
            appointment_duration: null
          })
          .eq('id', client.id);
        
        setEditedClient(prev => ({
          ...prev,
          appointment_date: undefined,
          appointment_time: undefined,
          appointment_duration: undefined
        }));
      }
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error syncing next appointment:', error);
    }
  };

  const fetchQuotes = useCallback(async () => {
    setIsLoadingQuotes(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
      if (data && data.length > 0) {
        setActiveQuote(data[0]);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [client.id]);

  const fetchMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('client_id', client.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [client.id]);

  useEffect(() => {
    fetchMessages();
    fetchQuotes();
    fetchPayments();
    fetchAppointments();
  }, [fetchMessages, fetchQuotes, fetchPayments, fetchAppointments]);

  const handleEstimate = async () => {
    setIsEstimating(true);
    try {
      let base64 = undefined;
      if (client.imagen_referencia) {
        try {
          const res = await fetch(client.imagen_referencia);
          const blob = await res.blob();
          base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("Error fetching image for AI", e);
        }
      }

      const aiResult = await analyzeTattooRequest(
        client.idea_tatuaje,
        client.tamano_cm,
        client.zona,
        client.estilo || 'No especificado',
        base64 as string | undefined
      );

      const newStatus = client.status === 'new_lead' ? 'ai_generated' : client.status;

      // 1. Create a new quote record
      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          client_id: client.id,
          idea_tatuaje: client.idea_tatuaje,
          zona: client.zona,
          tamano_cm: client.tamano_cm,
          estilo: aiResult.style_detected !== 'No especificado' ? aiResult.style_detected : client.estilo,
          imagen_referencia: client.imagen_referencia,
          ai_suggested_price: aiResult.recommended_price || 0,
          ai_estimated_time: (aiResult.estimated_hours || 0).toString(),
          ai_difficulty: aiResult.complexity,
          ai_notes: aiResult.notes,
          total_sessions: aiResult.total_sessions || 1,
          currency: currentCurrency,
          status: 'draft'
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // 2. Update client status and style
      await supabase
        .from('clients')
        .update({
          estilo: aiResult.style_detected !== 'No especificado' ? aiResult.style_detected : client.estilo,
          status: newStatus,
          currency: currentCurrency
        })
        .eq('id', client.id);

      // Update local state
      setActiveQuote(newQuote);
      setQuotes(prev => [newQuote, ...prev]);
      setEditedClient(prev => ({
        ...prev,
        estilo: aiResult.style_detected !== 'No especificado' ? aiResult.style_detected : prev.estilo,
        status: newStatus,
        currency: currentCurrency
      }));

      if (onUpdate) onUpdate();
      toast.success('¡Análisis completado y nueva cotización generada!');
    } catch (error: any) {
      console.error('Error estimating:', error);
      toast.error('Error al estimar con IA: ' + error.message);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSendQuote = async () => {
    if (!client.email) {
      toast.error('El cliente no tiene un email registrado.');
      return;
    }

    if (!activeQuote) {
      toast.error('No hay una cotización generada para enviar.');
      return;
    }
    
    setIsSendingEmail(true);
    try {
      // 1. First, save any pending changes to the quote
      const { error: saveError } = await supabase
        .from('quotes')
        .update({
          price_artist: activeQuote.price_artist,
          ai_estimated_time: activeQuote.ai_estimated_time,
          ai_suggested_price: activeQuote.ai_suggested_price,
          estilo: activeQuote.estilo,
          ai_notes: activeQuote.ai_notes,
          total_sessions: activeQuote.total_sessions,
          currency: activeQuote.currency
        })
        .eq('id', activeQuote.id);

      if (saveError) throw saveError;

      // 2. Then send the email
      await sendEmail(client.id, 'quote', activeQuote.price_artist || activeQuote.ai_suggested_price);
      
      // 3. Update quote status to 'sent'
      const { error: quoteUpdateError } = await supabase
        .from('quotes')
        .update({ 
          status: 'sent',
        })
        .eq('id', activeQuote.id);
      
      if (quoteUpdateError) {
        console.error('Error updating quote status:', quoteUpdateError);
        throw quoteUpdateError;
      }
      
      // Update client currency
      await supabase
        .from('clients')
        .update({ 
          currency: activeQuote.currency
        })
        .eq('id', client.id);
      
      setActiveQuote(prev => prev ? { ...prev, status: 'sent' } : null);
      setQuotes(prev => prev.map(q => q.id === activeQuote.id ? { ...q, status: 'sent' } : q));

      toast.success('¡Cotización enviada con éxito!');
      fetchMessages(); // Refrescar historial
      
      const currentStatusIndex = KANBAN_COLUMNS.findIndex(c => c.id === editedClient.status);
      const paymentPendingIndex = KANBAN_COLUMNS.findIndex(c => c.id === 'payment_pending');
      
      if (currentStatusIndex < paymentPendingIndex) {
        const newStatus = 'payment_pending';
        setEditedClient(prev => ({ 
          ...prev, 
          status: newStatus, 
          currency: activeQuote.currency
        }));
        // Also update in Supabase
        await supabase.from('clients').update({ status: newStatus }).eq('id', client.id);
        if (onUpdate) onUpdate();
      }
    } catch (err: any) {
      if (err.message === 'RESTRICTED_RECIPIENT') {
        toast.warning('Restricción de Resend: No se pudo enviar el email al cliente porque tu dominio no está verificado.');
      } else {
        toast.error('Error al enviar el email: ' + err.message);
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirmPayment = async () => {
    setIsSaving(true);
    try {
      const newStatus = 'payment_confirmed';
      
      // Check if a payment record already exists for this client and type 'deposit'
      const { data: existingPayment, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', client.id)
        .eq('payment_type', 'deposit')
        .maybeSingle(); // Use maybeSingle to handle no rows returned gracefully
        
      if (fetchError) throw fetchError;

      if (existingPayment) {
        // Update existing payment
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            notes: `Seña confirmada por el artista. Ref: ${editedClient.payment_reference || 'N/A'}`
          })
          .eq('id', existingPayment.id);
          
        if (updateError) throw updateError;
      } else {
        // 1. Registrar el depósito en la tabla de pagos
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            client_id: client.id,
            amount: editedClient.deposit_amount || 100,
            payment_type: 'deposit',
            payment_method: editedClient.payment_method || 'Transferencia',
            notes: `Seña confirmada por el artista. Ref: ${editedClient.payment_reference || 'N/A'}`
          });
  
        if (paymentError) throw paymentError;
      }

      // 2. Actualizar el estado del cliente
      setEditedClient(prev => ({ ...prev, status: newStatus, deposit_paid: true }));
      
      const { error: clientError } = await supabase
        .from('clients')
        .update({ status: newStatus, deposit_paid: true })
        .eq('id', client.id);

      if (clientError) throw clientError;
      
      toast.success('Pago confirmado y registrado exitosamente');
      fetchPayments(); // Recargar historial de pagos
      if (onUpdate) onUpdate();
    } catch (err: any) {
      toast.error('Error al confirmar pago: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      let finalStatus = editedClient.status;

      // Auto-move to 'reviewed' if price is set and status is early
      if (
        activeQuote?.price_artist && 
        activeQuote.price_artist > 0 && 
        (finalStatus === 'new_lead' || finalStatus === 'ai_generated')
      ) {
        finalStatus = 'reviewed';
      }

      // Auto-move to 'payment_confirmed' if deposit is paid manually by artist
      if (
        editedClient.deposit_paid && 
        (finalStatus === 'payment_pending' || finalStatus === 'accepted' || finalStatus === 'reviewed')
      ) {
        finalStatus = 'payment_confirmed';
      }

      // Auto-move to 'scheduled' if appointment date is set and deposit is paid
      if (
        editedClient.appointment_date && 
        editedClient.deposit_paid &&
        (finalStatus === 'payment_confirmed' || finalStatus === 'payment_review' || finalStatus === 'payment_pending' || finalStatus === 'accepted')
      ) {
        finalStatus = 'scheduled';
      }

      // Trigger follow-up email if status is changed to follow_up
      if (finalStatus === 'follow_up' && client.status !== 'follow_up') {
        try {
          await sendEmail(client.id, 'followup');
          toast.success('Email de seguimiento enviado.');
          fetchMessages();
        } catch (e) {
          console.error('Error sending follow-up email:', e);
        }
      }

      setEditedClient(prev => ({ ...prev, status: finalStatus }));

      // 1. Update client
      const { error } = await supabase
        .from('clients')
        .update({
          nombre: editedClient.nombre,
          email: editedClient.email,
          telefono: editedClient.telefono,
          instagram: editedClient.instagram,
          idea_tatuaje: editedClient.idea_tatuaje,
          zona: editedClient.zona,
          tamano_cm: editedClient.tamano_cm,
          estilo: editedClient.estilo,
          status: finalStatus,
          appointment_date: editedClient.appointment_date,
          appointment_time: editedClient.appointment_time,
          appointment_duration: editedClient.appointment_duration,
          deposit_paid: editedClient.deposit_paid,
          deposit_amount: editedClient.deposit_amount !== undefined ? editedClient.deposit_amount : 100,
          currency: currentCurrency,
        })
        .eq('id', client.id);

      if (error) throw error;

      // 2. Update active quote if it exists
      if (activeQuote) {
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            price_artist: activeQuote.price_artist,
            status: activeQuote.status,
            ai_estimated_time: activeQuote.ai_estimated_time,
            ai_suggested_price: activeQuote.ai_suggested_price,
            estilo: activeQuote.estilo,
            ai_notes: activeQuote.ai_notes,
            total_sessions: activeQuote.total_sessions,
            currency: currentCurrency
          })
          .eq('id', activeQuote.id);
        
        if (quoteError) {
          console.error('Error updating quote:', quoteError);
          throw quoteError;
        }
      }

      setEditedClient(prev => ({ 
        ...prev, 
        currency: currentCurrency
      }));

      // Sincronizar con la tabla appointments si hay fecha y hora manual
      if (editedClient.appointment_date && editedClient.appointment_time) {
        const fullDateTime = `${editedClient.appointment_date}T${editedClient.appointment_time}:00`;
        
        const { data: existingAppts } = await supabase
          .from('appointments')
          .select('id')
          .eq('client_id', client.id)
          .eq('status', 'scheduled')
          .limit(1);

        if (existingAppts && existingAppts.length > 0) {
          await supabase
            .from('appointments')
            .update({
              appointment_date: fullDateTime,
              duration: editedClient.appointment_duration || 2
            })
            .eq('id', existingAppts[0].id);
        } else {
          await supabase
            .from('appointments')
            .insert({
              client_id: client.id,
              appointment_date: fullDateTime,
              duration: editedClient.appointment_duration || 2,
              status: 'scheduled'
            });
        }
      }

      // Después de guardar, refrescamos las citas para asegurar que el estado local esté al día
      await fetchAppointments();
      await syncNextAppointment();

      fetchMessages(); // Refrescar historial
      if (onUpdate) onUpdate();
      setIsEditing(false);
      toast.success('Cambios guardados con éxito');
    } catch (err) {
      console.error('Error updating client:', err);
      toast.error('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    // Para confirmaciones críticas seguimos usando confirm o un modal, 
    // pero toast no es para confirmaciones interactivas.
    // Usaremos toast para el resultado.
    if (!window.confirm('¿Estás seguro de que quieres eliminar este lead?')) return;
    
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;
      toast.success('Lead eliminado correctamente');
      onClose();
    } catch (err) {
      console.error('Error deleting client:', err);
      toast.error('Error al eliminar el lead');
    }
  };

  const isPaymentConfirmed = 
    editedClient.status === 'payment_confirmed' || 
    editedClient.status === 'scheduled' || 
    editedClient.status === 'completed' ||
    editedClient.deposit_paid;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold text-lg">
            {client.nombre.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-xl text-gray-900">{client.nombre}</h2>
            <p className="text-xs text-gray-500">Lead creado el {format(new Date(client.created_at), 'dd MMM yyyy', { locale: es })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            {isEditing ? <Save className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Status Selector */}
        <section>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Estado del Pipeline</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {KANBAN_COLUMNS.map((col) => (
              <button
                key={col.id}
                onClick={() => setEditedClient({ ...editedClient, status: col.id })}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  editedClient.status === col.id 
                    ? 'bg-black text-white border-black' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {col.label}
              </button>
            ))}
          </div>
        </section>

        {/* Contact Info */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
            <Instagram className="w-5 h-5 text-pink-500" />
            <div className="overflow-hidden">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Instagram</p>
              <p className="text-sm font-medium truncate">{client.instagram || 'N/A'}</p>
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
            <Phone className="w-5 h-5 text-green-500" />
            <div className="overflow-hidden">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Teléfono</p>
              <p className="text-sm font-medium truncate">{client.telefono}</p>
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-500" />
            <div className="overflow-hidden">
              <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
              <p className="text-sm font-medium truncate">{client.email}</p>
            </div>
          </div>
        </section>

        {/* AI Assessment */}
        <section className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-purple-900">Análisis de Robby IA</h3>
            </div>
            <div className="flex gap-2">
              {quotes.length > 1 && (
                <button 
                  onClick={() => {/* TODO: Show history modal */}}
                  className="p-1.5 hover:bg-purple-100 rounded-lg transition-colors text-purple-400"
                  title="Ver historial de cotizaciones"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleEstimate}
                disabled={isEstimating}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:bg-purple-400"
              >
                {isEstimating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {activeQuote ? 'Re-estimar' : 'Estimar ahora'}
              </button>
            </div>
          </div>
          
          {!activeQuote && !isEstimating ? (
            <div className="text-center py-6 bg-white/30 rounded-xl border border-dashed border-purple-200">
              <Sparkles className="w-8 h-8 text-purple-200 mx-auto mb-2" />
              <p className="text-xs text-purple-400 font-medium">No hay análisis generado aún</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs text-purple-400 font-bold uppercase mb-1">Dificultad</p>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    activeQuote?.ai_difficulty === 'Alta' ? 'bg-red-100 text-red-700' :
                    activeQuote?.ai_difficulty === 'Media' ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {activeQuote?.ai_difficulty || 'Pendiente'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-purple-400 font-bold uppercase mb-1">Tiempo Estimado</p>
                  <p className="text-lg font-bold text-purple-900">{activeQuote?.ai_estimated_time || '0'} hrs</p>
                </div>
                <div>
                  <p className="text-xs text-purple-400 font-bold uppercase mb-1">Precio Sugerido</p>
                  <p className="text-lg font-bold text-purple-900">{currencySymbol}{activeQuote?.ai_suggested_price || '0'}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-400 font-bold uppercase mb-1">Estilo Detectado</p>
                  <p className="text-sm font-bold text-purple-900">{activeQuote?.estilo || 'General'}</p>
                </div>
              </div>

              <div className="bg-white/50 p-4 rounded-xl">
                <p className="text-xs text-purple-400 font-bold uppercase mb-2">Notas Técnicas</p>
                <p className="text-sm text-purple-800 leading-relaxed italic">
                  &quot;{activeQuote?.ai_notes || 'Sin notas adicionales.'}&quot;
                </p>
              </div>
            </>
          )}
        </section>

        {/* Tattoo Details */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Idea del Tatuaje</label>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm leading-relaxed">
                {client.idea_tatuaje}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Zona</label>
                <p className="font-semibold text-gray-900">{client.zona}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Tamaño</label>
                <p className="font-semibold text-gray-900">{client.tamano_cm} cm</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Imagen de Referencia</label>
            {client.imagen_referencia ? (
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 group">
                <Image 
                  src={client.imagen_referencia} 
                  alt="Referencia" 
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                <a 
                  href={client.imagen_referencia} 
                  target="_blank" 
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ExternalLink className="text-white w-6 h-6" />
                </a>
              </div>
            ) : (
              <div className="aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-xs">Sin imagen</p>
              </div>
            )}
          </div>
        </section>

        {/* Artist Adjustments */}
        <section className="bg-gray-900 text-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Cotización y Cita (Ajustes de Robby)
            </h3>
            {editedClient.status === 'payment_review' && (
              <button
                onClick={handleConfirmPayment}
                disabled={isSaving}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 disabled:bg-gray-600"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Pago Recibido
              </button>
            )}
          </div>

          {editedClient.payment_reference && (
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl mb-6 text-orange-200">
              <h4 className="font-bold mb-3 flex items-center gap-2 text-orange-400">
                <AlertCircle className="w-4 h-4" /> 
                Datos del Pago Reportado por el Cliente
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><span className="font-bold text-orange-300">Monto:</span> {currencySymbol}{editedClient.deposit_amount || '-'}</p>
                <p><span className="font-bold text-orange-300">Nombre:</span> {editedClient.payment_name || '-'}</p>
                <p><span className="font-bold text-orange-300">Método/Banco:</span> {editedClient.payment_method || '-'}</p>
                <p><span className="font-bold text-orange-300">Referencia:</span> {editedClient.payment_reference || '-'}</p>
                <p><span className="font-bold text-orange-300">Fecha:</span> {editedClient.payment_date || '-'}</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Moneda de Cotización</label>
              <select
                value={currentCurrency}
                onChange={(e) => {
                  const newCurrency = e.target.value;
                  setEditedClient(prev => ({ ...prev, currency: newCurrency }));
                  setActiveQuote(prev => prev ? { ...prev, currency: newCurrency } : null);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none text-white font-bold"
              >
                <option value="USD">USD ($) - Dólares</option>
                <option value="EUR">EUR (€) - Euros</option>
                <option value="GBP">GBP (£) - Libras</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Precio Sugerido ({currencySymbol})</label>
              <div className="relative">
                <CurrencyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  value={activeQuote?.ai_suggested_price || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setActiveQuote(prev => prev ? { ...prev, ai_suggested_price: val } : null);
                  }}
                  className="w-full bg-gray-800 border-none rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-green-400 outline-none text-white"
                  placeholder="Ej: 350"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Precio Final ({currencySymbol})</label>
              <div className="relative">
                <CurrencyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  value={activeQuote?.price_artist || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setActiveQuote(prev => prev ? { ...prev, price_artist: val } : null);
                  }}
                  className="w-full bg-gray-800 border-none rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-green-400 outline-none text-white"
                  placeholder="Ej: 400"
                />
              </div>
              {activeQuote?.status === 'sent' && (
                <p className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Cotización enviada
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Duración IA (Horas)</label>
              <input
                type="text"
                value={activeQuote?.ai_estimated_time || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveQuote(prev => prev ? { ...prev, ai_estimated_time: val } : null);
                }}
                className="w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none text-white"
                placeholder="Ej: 4"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Total de Sesiones</label>
              <input
                type="number"
                value={activeQuote?.total_sessions || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setActiveQuote(prev => prev ? { ...prev, total_sessions: val } : null);
                }}
                className="w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
                placeholder="Ej: 1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Estilo Detectable</label>
              <input
                type="text"
                value={activeQuote?.estilo || ''}
                onChange={(e) => setActiveQuote(prev => prev ? { ...prev, estilo: e.target.value } : null)}
                className="w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
                placeholder="Ej: Blackwork"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Nota Adicional</label>
              <textarea
                value={activeQuote?.ai_notes || ''}
                onChange={(e) => setActiveQuote(prev => prev ? { ...prev, ai_notes: e.target.value } : null)}
                className="w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 outline-none text-white"
                placeholder="Notas adicionales sobre la cotización..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Seña Pagada</label>
              <button
                onClick={() => setEditedClient({ ...editedClient, deposit_paid: !editedClient.deposit_paid })}
                className={`w-full py-2 rounded-lg font-bold text-xs transition-all ${
                  editedClient.deposit_paid ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {editedClient.deposit_paid ? 'SÍ, PAGADA' : 'NO PAGADA'}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Monto Seña ({currencySymbol})</label>
              <div className="relative">
                <CurrencyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  value={editedClient.deposit_amount ?? 100}
                  onChange={(e) => setEditedClient({ ...editedClient, deposit_amount: Number(e.target.value) })}
                  className="w-full bg-gray-800 border-none rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-green-400 outline-none text-white"
                  placeholder="Ej: 100"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Fecha de Cita</label>
              <input
                type="date"
                value={editedClient.appointment_date || ''}
                onChange={(e) => setEditedClient({ ...editedClient, appointment_date: e.target.value })}
                disabled={!isPaymentConfirmed}
                className={`w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none text-white ${!isPaymentConfirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Hora de Cita</label>
              <input
                type="time"
                value={editedClient.appointment_time || ''}
                onChange={(e) => setEditedClient({ ...editedClient, appointment_time: e.target.value })}
                disabled={!isPaymentConfirmed}
                className={`w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none text-white ${!isPaymentConfirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Duración (Horas)</label>
              <input
                type="number"
                value={editedClient.appointment_duration || ''}
                onChange={(e) => setEditedClient({ ...editedClient, appointment_duration: Number(e.target.value) })}
                disabled={!isPaymentConfirmed}
                className={`w-full bg-gray-800 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none text-white ${!isPaymentConfirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
        </section>

        {/* Sessions Management */}
        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Gestión de Sesiones</h3>
            </div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {appointments.length} Sesiones
            </div>
          </div>

          {!isPaymentConfirmed ? (
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center">
              <Info className="w-8 h-8 text-blue-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-blue-900 mb-1">Pago no confirmado</h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                Debes confirmar el pago de la seña antes de poder agendar sesiones para este cliente.
              </p>
            </div>
          ) : (
            <>
              {/* Add New Session Form */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Agendar Nueva Sesión</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Fecha</label>
                    <input
                      type="date"
                      value={newApptDate}
                      onChange={(e) => setNewApptDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Hora</label>
                    <input
                      type="time"
                      value={newApptTime}
                      onChange={(e) => setNewApptTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Duración (h)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newApptDuration}
                        onChange={(e) => setNewApptDuration(Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => {
                          handleAddAppointment(newApptDate, newApptTime, newApptDuration);
                          setNewApptDate('');
                          setNewApptTime('');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-3">
                {isLoadingAppointments ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 font-medium">No hay sesiones agendadas aún.</p>
                  </div>
                ) : (
                  appointments.map((appt) => {
                    const apptDate = new Date(appt.appointment_date);
                    const isPast = apptDate < new Date() && appt.status === 'scheduled';
                    
                    return (
                      <div 
                        key={appt.id}
                        className={`bg-white p-4 rounded-xl border transition-all flex items-center justify-between ${
                          appt.status === 'completed' ? 'border-green-100 bg-green-50/30' : 
                          isPast ? 'border-red-100 bg-red-50/30' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            appt.status === 'completed' ? 'bg-green-100 text-green-600' : 
                            isPast ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {format(apptDate, "eeee d 'de' MMMM", { locale: es })}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(apptDate, 'HH:mm')} hs ({appt.duration}h)
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                appt.status === 'completed' ? 'bg-green-200 text-green-800' : 
                                appt.status === 'canceled' ? 'bg-gray-200 text-gray-800' : 
                                isPast ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                              }`}>
                                {appt.status === 'completed' ? 'Completada' : 
                                 appt.status === 'canceled' ? 'Cancelada' : 
                                 isPast ? 'Pendiente (Atrasada)' : 'Programada'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleAppointmentStatus(appt.id, appt.status)}
                            className={`p-2 rounded-lg transition-colors ${
                              appt.status === 'completed' ? 'text-gray-400 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={appt.status === 'completed' ? 'Marcar como pendiente' : 'Marcar como completada'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAppointment(appt.id)}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar sesión"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {/* Payments History */}
        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-gray-900">Historial de Pagos</h3>
            </div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Total: {currencySymbol}{payments.reduce((acc, p) => acc + Number(p.amount), 0)}
            </div>
          </div>
          <div className="space-y-3">
            {isLoadingPayments ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : payments.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center border border-dashed border-gray-200">
                <p className="text-xs text-gray-400 font-medium">No hay pagos registrados aún.</p>
              </div>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      payment.payment_type === 'deposit' ? 'bg-blue-50 text-blue-600' : 
                      payment.payment_type === 'final_payment' ? 'bg-green-50 text-green-600' : 
                      'bg-purple-50 text-purple-600'
                    }`}>
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {payment.payment_type === 'deposit' ? 'Seña / Depósito' : 
                         payment.payment_type === 'final_payment' ? 'Pago Final' : 'Pago Extra'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {format(new Date(payment.created_at), 'dd MMM, yyyy', { locale: es })} • {payment.payment_method}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-black text-gray-900">
                    {currencySymbol}{payment.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Message History */}
        <section className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">Historial de Mensajes</h3>
          </div>

          <div className="space-y-3">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : messages.length > 0 ? (
              messages.map((msg) => (
                <div key={msg.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      msg.message_type === 'quote' ? 'bg-purple-100 text-purple-700' :
                      msg.message_type === 'welcome' ? 'bg-blue-100 text-blue-700' :
                      msg.message_type === 'scheduling' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {msg.message_type}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {format(new Date(msg.sent_at), 'dd MMM, HH:mm', { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{msg.content}</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span>Enviado vía {msg.channel}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs italic">No hay mensajes registrados aún.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
        <button 
          onClick={handleSendQuote}
          disabled={isSendingEmail || !activeQuote}
          className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:bg-gray-400"
        >
          {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {activeQuote?.status === 'sent' ? 'Re-enviar Cotización' : 'Enviar Cotización'}
        </button>
        <button 
          onClick={handleUpdate}
          disabled={isSaving}
          className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:bg-gray-400"
        >
          {isSaving ? 'Guardando...' : (
            <>
              <Save className="w-4 h-4" />
              Guardar Cambios
            </>
          )}
        </button>
        <button className="px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <MessageSquare className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </motion.div>
  );
}
