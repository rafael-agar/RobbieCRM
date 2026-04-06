'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-service';
import { toast } from 'sonner';
import { Client } from '@/lib/types';
import { 
  Palette, 
  CheckCircle2, 
  CreditCard, 
  ShieldCheck, 
  Clock, 
  DollarSign,
  Euro,
  PoundSterling,
  AlertCircle,
  Loader2,
  User,
  Calendar,
  FileText,
  Building2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

export default function PagoPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [quote, setQuote] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    method: '',
    amount: ''
  });

  useEffect(() => {
    const fetchClientAndQuote = async () => {
      // 1. Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (!clientError && clientData) {
        setClient(clientData);
        if (clientData.deposit_paid) setIsPaid(true);
        if (
          clientData.status === 'accepted' || 
          clientData.status === 'payment_review' || 
          clientData.status === 'payment_confirmed' || 
          clientData.status === 'scheduled' || 
          clientData.status === 'completed'
        ) {
          setIsAccepted(true);
        }

        // 2. Fetch the most recent quote for this client
        const { data: quoteData, error: quoteError } = await supabase
          .from('quotes')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!quoteError && quoteData) {
          setQuote(quoteData);
        }
      }
      setLoading(false);
    };

    if (id) fetchClientAndQuote();
  }, [id]);

  const handleAcceptQuote = async () => {
    if (!client) return;
    setAccepting(true);
    
    const { error } = await supabase
      .from('clients')
      .update({ 
        status: 'accepted'
      })
      .eq('id', client.id);

    if (!error) {
      setIsAccepted(true);
    }
    setAccepting(false);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setLoading(true);
    
    // 1. Registrar el pago en la tabla de pagos
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        client_id: client.id,
        amount: Number(paymentData.amount),
        payment_type: 'deposit',
        payment_method: paymentData.method,
        notes: `Pago enviado por el cliente. Ref: ${paymentData.reference}. Nombre: ${paymentData.name}`
      });

    if (paymentError) {
      console.error('Error al registrar pago:', paymentError);
    }

    // 2. Actualizar el estado del cliente
    const { error } = await supabase
      .from('clients')
      .update({ 
        deposit_paid: true,
        status: 'payment_review',
        payment_name: paymentData.name,
        payment_date: paymentData.date,
        payment_reference: paymentData.reference,
        payment_method: paymentData.method,
        deposit_amount: Number(paymentData.amount)
      })
      .eq('id', client.id);

    if (!error) {
      setIsPaid(true);
      setShowPaymentForm(false);
      
      // Enviar email de confirmación de reserva
      try {
        await sendEmail(client.id, 'confirmation');
      } catch (e) {
        console.error('Error al enviar email de confirmación:', e);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-black" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Enlace no válido</h1>
          <p className="text-gray-500">No pudimos encontrar los detalles de esta cotización. Por favor, solicita un nuevo enlace.</p>
        </div>
      </div>
    );
  }

  const depositAmount = client.deposit_amount || 100;
  const totalAmount = quote?.price_artist || quote?.ai_suggested_price || 0;
  const remainingAmount = Math.max(0, totalAmount - depositAmount);

  const currency = quote?.currency || client.currency || 'USD';
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const CurrencyIcon = currency === 'EUR' ? Euro : currency === 'GBP' ? PoundSterling : DollarSign;

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-6 shadow-xl shadow-black/10">
            <Palette className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-3">ROBBY FLOW</h1>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Confirmación de Reserva</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Project Details */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-8 text-gray-900">Resumen de tu Proyecto</h2>
              
              <div className="flex flex-col sm:flex-row gap-8 mb-10">
                <div className="w-full sm:w-48 h-48 bg-gray-100 rounded-3xl overflow-hidden flex-shrink-0 relative shadow-inner">
                  {client.imagen_referencia ? (
                    <Image 
                      src={client.imagen_referencia} 
                      alt="Referencia" 
                      fill 
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Palette className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4 leading-snug">{client.idea_tatuaje}</h3>
                  <div className="flex flex-wrap gap-3 mb-5">
                    <span className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl">
                      {client.zona}
                    </span>
                    <span className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl">
                      {client.tamano_cm} cm
                    </span>
                  </div>
                  <span className="inline-block px-4 py-2 bg-black text-white text-sm font-bold rounded-xl uppercase tracking-wider w-fit">
                    {client.estilo || 'Estilo Personalizado'}
                  </span>
                </div>
              </div>

              {quote?.ai_notes && (
                <div className="mb-10 p-6 bg-purple-50 rounded-3xl border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h4 className="font-bold text-purple-900 uppercase tracking-widest text-[10px]">Notas del Artista</h4>
                  </div>
                  <p className="text-sm text-purple-800 leading-relaxed italic">
                    &quot;{quote.ai_notes}&quot;
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Duración</p>
                  </div>
                  <p className="text-2xl font-black text-gray-900 ml-13">{client.appointment_duration || quote?.ai_estimated_time || 0} hrs</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Sesiones</p>
                  </div>
                  <p className="text-2xl font-black text-gray-900 ml-13">{quote?.total_sessions || 1}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CurrencyIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Precio Total</p>
                  </div>
                  <p className="text-2xl font-black text-gray-900 ml-13">{currencySymbol}{totalAmount}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 p-6 md:p-8 rounded-[2rem] border border-blue-100 flex gap-5 items-start">
              <div className="bg-blue-100 p-3.5 rounded-2xl flex-shrink-0">
                <ShieldCheck className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-lg mb-2">Reserva Segura</h4>
                <p className="text-sm text-blue-800/80 leading-relaxed">
                  Tu seña garantiza la fecha de tu sesión y se descuenta íntegramente del precio final del tatuaje.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Checkout Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 sticky top-8">
              {isPaid ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 mb-4">¡Seña Recibida!</h3>
                  <p className="text-gray-500 mb-10 leading-relaxed text-lg">
                    Robby revisará el pago y te contactará para agendar la fecha definitiva de tu sesión.
                  </p>
                  <div className="p-6 bg-gray-50 rounded-3xl text-left border border-gray-100">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Estado Actual</p>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                      <p className="text-lg font-bold text-green-700">Pago en Revisión</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="mb-10">
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-3">Monto a Pagar (Seña)</p>
                    <h3 className="text-6xl font-black text-gray-900 tracking-tight">
                      {currencySymbol}{depositAmount}
                    </h3>
                  </div>

                  <div className="space-y-5 mb-10">
                    <div className="flex items-center justify-between text-lg">
                      <span className="text-gray-500">Precio Total Tatuaje</span>
                      <span className="font-bold text-gray-900">{currencySymbol}{totalAmount}</span>
                    </div>
                    <div className="flex items-center justify-between text-lg">
                      <span className="text-gray-500">Reserva (Seña)</span>
                      <span className="font-bold text-green-600">-{currencySymbol}{depositAmount}</span>
                    </div>
                    <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-lg">Saldo a pagar en estudio</span>
                      <span className="font-black text-3xl text-gray-900">{currencySymbol}{remainingAmount}</span>
                    </div>
                  </div>

                  {!isAccepted ? (
                    <button 
                      onClick={handleAcceptQuote}
                      disabled={accepting}
                      className="w-full bg-black text-white py-5 rounded-2xl font-bold text-lg hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/20"
                    >
                      {accepting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                      Aceptar Cotización
                    </button>
                  ) : (
                    <AnimatePresence mode="wait">
                      {!showPaymentForm ? (
                        <motion.button 
                          key="btn-report"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          onClick={() => setShowPaymentForm(true)}
                          className="w-full bg-green-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-600/20"
                        >
                          <CreditCard className="w-6 h-6" />
                          Reportar Pago de Reserva
                        </motion.button>
                      ) : (
                        <motion.form 
                          key="form-report"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          onSubmit={handleSubmitPayment} 
                          className="text-left space-y-5 overflow-hidden"
                        >
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <h5 className="font-bold text-gray-900 text-xl">Datos de Transferencia</h5>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Monto de la Seña ({currencySymbol})</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                {client.currency === 'EUR' ? <span className="h-5 w-5 text-gray-400 flex items-center justify-center font-bold">€</span> : 
                                 client.currency === 'GBP' ? <span className="h-5 w-5 text-gray-400 flex items-center justify-center font-bold">£</span> : 
                                 <DollarSign className="h-5 w-5 text-gray-400" />}
                              </div>
                              <input 
                                required
                                type="number" 
                                value={paymentData.amount}
                                onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-4 focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-base"
                                placeholder="Ej: 100"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Nombre de quien transfiere</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                              </div>
                              <input 
                                required
                                type="text" 
                                value={paymentData.name}
                                onChange={e => setPaymentData({...paymentData, name: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-4 focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-base"
                                placeholder="Ej: Juan Pérez"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Banco / Método de Pago</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Building2 className="h-5 w-5 text-gray-400" />
                              </div>
                              <input 
                                required
                                type="text" 
                                value={paymentData.method}
                                onChange={e => setPaymentData({...paymentData, method: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-4 focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-base"
                                placeholder="Ej: Zelle, BBVA, MercadoPago..."
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Fecha del Pago</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Calendar className="h-5 w-5 text-gray-400" />
                              </div>
                              <input 
                                required
                                type="date" 
                                value={paymentData.date}
                                onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-4 focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-base"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Nro. de Referencia</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <FileText className="h-5 w-5 text-gray-400" />
                              </div>
                              <input 
                                required
                                type="text" 
                                value={paymentData.reference}
                                onChange={e => setPaymentData({...paymentData, reference: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-4 focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-base"
                                placeholder="Ej: 123456789"
                              />
                            </div>
                          </div>

                          <div className="pt-6 flex flex-col sm:flex-row gap-3">
                            <button
                              type="button"
                              onClick={() => setShowPaymentForm(false)}
                              className="w-full sm:w-1/3 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all text-base"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full sm:w-2/3 bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-lg shadow-black/10 text-base"
                            >
                              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                  Enviar Comprobante
                                  <ArrowRight className="w-5 h-5" />
                                </>
                              )}
                            </button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  )}

                  {!showPaymentForm && (
                    <div className="mt-10 flex items-center justify-center gap-8 grayscale opacity-30">
                      <CreditCard className="w-8 h-8" />
                      <Building2 className="w-8 h-8" />
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
