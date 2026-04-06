'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email-service';
import { useDropzone } from 'react-dropzone';
import { Channel } from '@/lib/types';
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre es muy corto'),
  email: z.string().email('Email inválido'),
  telefono: z.string().min(8, 'Teléfono inválido'),
  instagram: z.string().optional(),
  idea_tatuaje: z.string().min(10, 'Cuéntanos un poco más sobre tu idea'),
  zona: z.string().min(2, 'Indica la zona del cuerpo'),
  tamano_cm: z.string().min(1, 'Indica el tamaño aproximado'),
  estilo: z.string().optional(),
  currency: z.string(),
});

type FormData = z.infer<typeof formSchema>;

export default function LeadForm({ defaultChannel = 'Manual' }: { defaultChannel?: Channel }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currency: 'USD',
    },
  });

  const onDrop = (acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 3,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      let imageUrl = '';

      // 1. Upload image if exists
      if (files.length > 0) {
        const file = files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('references')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('references')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      // 2. Create Lead in Supabase
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          ...data,
          imagen_referencia: imageUrl,
          status: 'new_lead',
          deposit_paid: false,
          channel: defaultChannel,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Send Welcome Email
      if (newClient) {
        try {
          await sendEmail(newClient.id, 'welcome');
        } catch (e) {
          console.error('Error sending welcome email:', e);
          // Don't fail the whole process if email fails
        }
      }

      setIsSuccess(true);
      reset();
      setFiles([]);
      setPreviews([]);
    } catch (err) {
      console.error('Error submitting form:', err);
      toast.error('Hubo un error al enviar tu solicitud. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-xl text-center"
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud Enviada!</h2>
        <p className="text-gray-600 mb-8">
          Robby revisará tu idea y te contactará pronto con una cotización personalizada.
        </p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Enviar otra solicitud
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-10 rounded-2xl shadow-xl border border-gray-100">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Cotiza tu Tatuaje</h2>
        <p className="text-gray-500">Cuéntanos tu idea y recibe una estimación asistida por IA.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
            <input
              {...register('nombre')}
              className={`w-full px-4 py-4 rounded-xl border ${errors.nombre ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-black/5 outline-none transition-all`}
              placeholder="Ej: Juan Pérez"
            />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              {...register('email')}
              type="email"
              className={`w-full px-4 py-4 rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-black/5 outline-none transition-all`}
              placeholder="tu@email.com"
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Teléfono / WhatsApp</label>
            <input
              {...register('telefono')}
              className={`w-full px-4 py-4 rounded-xl border ${errors.telefono ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-black/5 outline-none transition-all`}
              placeholder="+54 9 11 ..."
            />
            {errors.telefono && <p className="text-xs text-red-500">{errors.telefono.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Instagram (Opcional)</label>
            <input
              {...register('instagram')}
              className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none transition-all"
              placeholder="@usuario"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Tu Idea</label>
          <textarea
            {...register('idea_tatuaje')}
            rows={4}
            className={`w-full px-4 py-4 rounded-xl border ${errors.idea_tatuaje ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-black/5 outline-none transition-all resize-none`}
            placeholder="Describe lo que quieres tatuarte, elementos, significado..."
          />
          {errors.idea_tatuaje && <p className="text-xs text-red-500">{errors.idea_tatuaje.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Zona del Cuerpo</label>
            <input
              {...register('zona')}
              className={`w-full px-4 py-4 rounded-xl border ${errors.zona ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-black/5 outline-none transition-all`}
              placeholder="Ej: Antebrazo"
            />
            {errors.zona && <p className="text-xs text-red-500">{errors.zona.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tamaño (cm)</label>
            <input
              {...register('tamano_cm')}
              className={`w-full px-4 py-4 rounded-xl border ${errors.tamano_cm ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-black/5 outline-none transition-all`}
              placeholder="Ej: 15x10"
            />
            {errors.tamano_cm && <p className="text-xs text-red-500">{errors.tamano_cm.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Estilo</label>
            <select
              {...register('estilo')}
              className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none transition-all bg-white"
            >
              <option value="">Seleccionar estilo</option>
              <option value="Realismo">Realismo</option>
              <option value="Blackwork">Blackwork</option>
              <option value="Tradicional">Tradicional</option>
              <option value="Minimalista">Minimalista</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Moneda Preferida</label>
            <select
              {...register('currency')}
              className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none transition-all bg-white"
            >
              <option value="USD">USD ($) - Dólares</option>
              <option value="EUR">EUR (€) - Euros</option>
              <option value="GBP">GBP (£) - Libras</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Imágenes de Referencia</label>
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragActive ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              Arrastra imágenes aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-gray-400 mt-1">Máximo 3 imágenes</p>
          </div>

          <AnimatePresence>
            {previews.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex gap-4 mt-4"
              >
                {previews.map((preview, index) => (
                  <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <Image 
                      src={preview} 
                      alt="Preview" 
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar Solicitud'
          )}
        </button>
      </form>
    </div>
  );
}
