'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, CreditCard, CheckCircle2, Loader2, Info } from 'lucide-react';
import { Client } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface PaymentModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ client, onClose, onSuccess }: PaymentModalProps) {
  const activeQuote = client.quotes?.sort((a: any, b: any) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  const totalPrice = activeQuote?.price_artist || activeQuote?.ai_suggested_price || 0;

  const [amount, setAmount] = useState<number>(
    totalPrice - (client.deposit_amount || 0)
  );
  const [method, setMethod] = useState('Efectivo');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currencySymbol = client.currency === 'EUR' ? '€' : client.currency === 'GBP' ? '£' : '$';

  const handleSavePayment = async () => {
    if (amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Registrar el pago final en la tabla de pagos
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          client_id: client.id,
          amount: amount,
          payment_type: 'final_payment',
          payment_method: method,
          notes: notes
        });

      if (paymentError) throw paymentError;

      // 2. Actualizar el estado del cliente a 'completed'
      const { error: clientError } = await supabase
        .from('clients')
        .update({ status: 'completed' })
        .eq('id', client.id);

      if (clientError) throw clientError;

      toast.success('¡Pago registrado y tatuaje completado!');
      onSuccess();
    } catch (err: any) {
      console.error('Error saving payment:', err);
      toast.error('Error al registrar el pago: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
      >
        {/* Header - Fixed */}
        <div className="p-6 md:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="text-green-600 w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-gray-900 uppercase tracking-tight">Finalizar Tatuaje</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Registro de Pago Final</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <div className="bg-blue-50 p-5 rounded-2xl flex gap-3 items-start border border-blue-100">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 leading-relaxed">
              <p className="font-bold mb-1 text-sm">Resumen de Cuenta</p>
              <div className="space-y-1 opacity-90">
                <p className="flex justify-between">Precio Total: <span className="font-bold">{currencySymbol}{totalPrice}</span></p>
                <p className="flex justify-between">Seña Pagada: <span className="font-bold">-{currencySymbol}{client.deposit_amount || 0}</span></p>
                <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between text-sm">
                  <span>Restante Sugerido:</span>
                  <span className="font-black">{currencySymbol}{totalPrice - (client.deposit_amount || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Monto a Pagar ({currencySymbol})</label>
              <div className="relative group">
                {client.currency === 'EUR' ? <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors font-bold flex items-center justify-center">€</span> :
                 client.currency === 'GBP' ? <span className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors font-bold flex items-center justify-center">£</span> :
                 <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />}
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-4 font-black text-2xl focus:border-black focus:bg-white focus:ring-0 transition-all outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Método de Pago</label>
              <div className="grid grid-cols-2 gap-3">
                {['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`py-4 rounded-xl text-xs font-bold border transition-all ${
                      method === m 
                        ? 'bg-black text-white border-black shadow-lg shadow-black/10 scale-[1.02]' 
                        : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Notas Adicionales</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-4 text-sm focus:border-black focus:bg-white focus:ring-0 transition-all outline-none min-h-[100px] resize-none"
                placeholder="Ej: Pago dividido, propina incluida..."
              />
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="p-6 md:p-8 bg-white border-t border-gray-50 shrink-0">
          <button
            onClick={handleSavePayment}
            disabled={isSaving}
            className="w-full bg-black text-white py-5 rounded-2xl font-black text-lg hover:bg-gray-800 active:scale-[0.98] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 disabled:bg-gray-200 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
            REGISTRAR Y COMPLETAR
          </button>
        </div>
      </motion.div>
    </div>
  );
}
