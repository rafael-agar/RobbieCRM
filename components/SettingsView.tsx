'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppointmentConfig } from '@/lib/types';
import { 
  Save, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsView() {
  const [config, setConfig] = useState<AppointmentConfig>({
    working_days: [1, 2, 3, 4, 5, 6],
    start_time: '10:00',
    end_time: '19:00',
    slot_interval: 60
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'appointment_config')
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found
          throw error;
        }
      } else if (data) {
        setConfig(data.value);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'appointment_config',
          value: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setConfig(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort()
    }));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-black" />
      </div>
    );
  }

  const daysOfWeek = [
    { id: 0, label: 'Dom' },
    { id: 1, label: 'Lun' },
    { id: 2, label: 'Mar' },
    { id: 3, label: 'Mié' },
    { id: 4, label: 'Jue' },
    { id: 5, label: 'Vie' },
    { id: 6, label: 'Sáb' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <Clock className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-gray-900 uppercase tracking-tight">Configuración de Agenda</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Horarios y Disponibilidad</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-black/10 disabled:bg-gray-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>

        <div className="p-8 space-y-10">
          {/* Working Days */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-gray-900">Días Laborales</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Selecciona los días en los que estás disponible para tatuar.</p>
            <div className="flex flex-wrap gap-3">
              {daysOfWeek.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`w-14 h-14 rounded-2xl font-bold text-sm transition-all border-2 ${
                    config.working_days.includes(day.id)
                      ? 'bg-black text-white border-black shadow-lg shadow-black/10'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </section>

          {/* Hours */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <h3 className="font-bold text-gray-900">Horario de Inicio</h3>
              </div>
              <input
                type="time"
                value={config.start_time}
                onChange={(e) => setConfig({ ...config, start_time: e.target.value })}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 font-bold text-lg focus:border-black focus:ring-0 transition-all outline-none"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <h3 className="font-bold text-gray-900">Horario de Fin</h3>
              </div>
              <input
                type="time"
                value={config.end_time}
                onChange={(e) => setConfig({ ...config, end_time: e.target.value })}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 font-bold text-lg focus:border-black focus:ring-0 transition-all outline-none"
              />
            </div>
          </section>

          {/* Slot Interval */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-gray-900">Intervalo entre Citas (minutos)</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Define cada cuánto tiempo se puede agendar una nueva cita.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[30, 60, 90, 120].map((interval) => (
                <button
                  key={interval}
                  onClick={() => setConfig({ ...config, slot_interval: interval })}
                  className={`py-4 rounded-2xl font-bold text-sm transition-all border-2 ${
                    config.slot_interval === interval
                      ? 'bg-black text-white border-black shadow-lg shadow-black/10'
                      : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {interval} min
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex gap-4 items-start">
        <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
        <div>
          <h4 className="font-bold text-blue-900 mb-1">Nota sobre la Agenda</h4>
          <p className="text-xs text-blue-800 leading-relaxed">
            Estos ajustes afectarán directamente a los horarios que tus clientes ven al agendar su cita. 
            El sistema calculará automáticamente los bloques disponibles basándose en estas horas y la duración estimada de cada tatuaje.
          </p>
        </div>
      </div>
    </div>
  );
}
