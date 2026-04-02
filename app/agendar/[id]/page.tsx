'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Client, AppointmentConfig } from '@/lib/types';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  AlertCircle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  isBefore, 
  startOfDay,
  getDay,
  setHours,
  setMinutes,
  isAfter
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AgendarPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [busySlots, setBusySlots] = useState<{start: number, end: number}[]>([]);
  const [config, setConfig] = useState<AppointmentConfig>({
    working_days: [1, 2, 3, 4, 5, 6],
    start_time: '10:00',
    end_time: '19:00',
    slot_interval: 60
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchClient = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Error fetching client:', error);
      } else {
        setClient(data);
        // Si ya tiene cita agendada, mostrar éxito o redirigir
        if (data.status === 'scheduled' || data.status === 'completed') {
          setIsSuccess(true);
        }
      }
      setLoading(false);
    };

    if (id) fetchClient();
    fetchConfig();
  }, [id]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'appointment_config')
        .single();
      
      if (!error && data) {
        setConfig(data.value);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Generar horarios disponibles dinámicamente
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const [startH, startM] = config.start_time.split(':').map(Number);
    const [endH, endM] = config.end_time.split(':').map(Number);
    
    let current = new Date();
    current.setHours(startH, startM, 0, 0);
    
    const end = new Date();
    end.setHours(endH, endM, 0, 0);
    
    while (current < end) {
      slots.push(format(current, 'HH:mm'));
      current = new Date(current.getTime() + config.slot_interval * 60000);
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDateSelect = async (date: Date) => {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return;
    setSelectedDate(date);
    setSelectedTime(null);
    
    // Fetch existing appointments for this date to check for overlaps
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_date, duration')
      .gte('appointment_date', `${dateStr}T00:00:00`)
      .lte('appointment_date', `${dateStr}T23:59:59`)
      .neq('status', 'canceled');

    if (!error && data) {
      const busy = data.map(appt => {
        const start = new Date(appt.appointment_date).getHours() + (new Date(appt.appointment_date).getMinutes() / 60);
        return {
          start,
          end: start + Number(appt.duration)
        };
      });
      setBusySlots(busy);
    } else {
      setBusySlots([]);
    }
  };

  const isTimeSlotAvailable = (time: string) => {
    if (!client) return true;
    const [hours, minutes] = time.split(':').map(Number);
    const slotStart = hours + (minutes / 60);
    const duration = client.appointment_duration || Number(client.ai_estimated_time) || 2;
    const slotEnd = slotStart + duration;

    // Check if this slot overlaps with any busy slot
    return !busySlots.some(busy => {
      // Overlap condition: start1 < end2 AND start2 < end1
      return slotStart < busy.end && busy.start < slotEnd;
    });
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !client) return;

    setIsSubmitting(true);
    try {
      const appointmentDate = format(selectedDate, 'yyyy-MM-dd');
      const duration = client.appointment_duration || Number(client.ai_estimated_time) || 2;
      
      // FINAL OVERLAP CHECK (Race Condition Prevention)
      const { data: existingAppts, error: fetchError } = await supabase
        .from('appointments')
        .select('appointment_date, duration')
        .gte('appointment_date', `${appointmentDate}T00:00:00`)
        .lte('appointment_date', `${appointmentDate}T23:59:59`)
        .neq('status', 'canceled');

      if (fetchError) throw fetchError;

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const slotStart = hours + (minutes / 60);
      const slotEnd = slotStart + duration;

      const isOverlapping = existingAppts?.some(appt => {
        const aStart = new Date(appt.appointment_date).getHours() + (new Date(appt.appointment_date).getMinutes() / 60);
        const aEnd = aStart + Number(appt.duration);
        return slotStart < aEnd && aStart < slotEnd;
      });

      if (isOverlapping) {
        toast.error('Lo sentimos, este horario acaba de ser reservado. Por favor selecciona otro.');
        await handleDateSelect(selectedDate); // Refresh busy slots
        setIsSubmitting(false);
        return;
      }

      // 1. Update client status
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          status: 'scheduled',
          appointment_date: appointmentDate,
          appointment_time: selectedTime,
          appointment_duration: duration
        })
        .eq('id', client.id);

      if (clientError) throw clientError;

      // Update local state
      setClient(prev => prev ? { 
        ...prev, 
        status: 'scheduled', 
        appointment_date: appointmentDate, 
        appointment_time: selectedTime, 
        appointment_duration: duration 
      } : null);

      // 2. Create official appointment record
      const { error: apptError } = await supabase
        .from('appointments')
        .insert({
          client_id: client.id,
          appointment_date: `${appointmentDate}T${selectedTime}:00`,
          duration: duration,
          status: 'scheduled'
        });

      if (apptError) throw apptError;
      
      // 3. Log to messages table
      await supabase
        .from('messages')
        .insert({
          client_id: client.id,
          message_type: 'scheduling',
          channel: 'System',
          content: `Cita agendada para el ${format(selectedDate, 'dd/MM/yyyy')} a las ${selectedTime} hs.`,
          sent_at: new Date().toISOString()
        });

      setIsSuccess(true);
      toast.success('¡Cita agendada con éxito!');
    } catch (err) {
      console.error('Error scheduling:', err);
      toast.error('Hubo un error al agendar tu cita. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
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
          <p className="text-gray-500">No pudimos encontrar tu solicitud. Por favor, contacta al artista.</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl text-center border border-gray-100"
        >
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">¡Cita Confirmada!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Tu sesión de tatuaje ha sido agendada. Recibirás un recordatorio por email antes de la cita.
          </p>
          <div className="bg-gray-50 p-6 rounded-3xl text-left mb-8 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <CalendarIcon className="w-5 h-5 text-black" />
              <p className="font-bold text-gray-900">
                {client.appointment_date ? format(new Date(client.appointment_date), 'EEEE d "de" MMMM', { locale: es }) : 'Fecha confirmada'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-black" />
              <p className="font-bold text-gray-900">
                {client.appointment_time || 'Hora confirmada'} hs
              </p>
            </div>
          </div>

          <a 
            href={`https://www.google.com/calendar/render?action=TEMPLATE&text=Tatuaje+con+Robby+Flow&dates=${client.appointment_date?.replace(/-/g, '')}T${client.appointment_time?.replace(':', '')}00/${client.appointment_date?.replace(/-/g, '')}T${Math.min(23, parseInt(client.appointment_time?.split(':')[0] || '0') + Number(client.appointment_duration || 2)).toString().padStart(2, '0')}${client.appointment_time?.split(':')[1] || '00'}00&details=Sesión+de+tatuaje+agendada+con+Robby+Flow.+Idea:+${encodeURIComponent(client.idea_tatuaje)}&location=Robby+Flow+Studio&sf=true&output=xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white border-2 border-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-all mb-8"
          >
            <CalendarIcon className="w-5 h-5 text-blue-500" />
            Añadir a mi Google Calendar
          </a>

          <p className="text-xs text-gray-400 font-medium">
            Si necesitas reprogramar, por favor contacta a Robby directamente.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-3 uppercase">Agendar mi Sesión</h1>
          <p className="text-gray-500 font-medium">Selecciona el día y la hora que mejor te queden para tu tatuaje.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Calendario */}
          <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-gray-900 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Espacios vacíos para el inicio del mes */}
              {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              
              {days.map((day, i) => {
                const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                const isWorkingDay = config.working_days.includes(getDay(day));
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                return (
                  <button
                    key={i}
                    disabled={isPast || !isWorkingDay}
                    onClick={() => handleDateSelect(day)}
                    className={`
                      aspect-square rounded-2xl flex flex-col items-center justify-center transition-all relative
                      ${isPast || !isWorkingDay ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-700'}
                      ${isSelected ? 'bg-black text-white hover:bg-black shadow-lg shadow-black/20 scale-105 z-10' : ''}
                    `}
                  >
                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                    {!isPast && !isWorkingDay && (
                      <span className="text-[6px] text-gray-300 font-black uppercase absolute bottom-2">Cerrado</span>
                    )}
                    {isSelected && (
                      <motion.div 
                        layoutId="active-day"
                        className="absolute inset-0 border-2 border-black rounded-2xl"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horarios */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 h-full flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horarios Disponibles
              </h3>

              {!selectedDate ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <CalendarIcon className="w-10 h-10 text-gray-300 mb-4" />
                  <p className="text-sm text-gray-400 font-medium">Selecciona un día para ver los horarios</p>
                </div>
              ) : (
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                  {timeSlots.map(time => {
                    const available = isTimeSlotAvailable(time);
                    return (
                      <button
                        key={time}
                        disabled={!available}
                        onClick={() => available && setSelectedTime(time)}
                        className={`
                          w-full py-4 rounded-2xl font-bold text-sm transition-all border
                          ${selectedTime === time 
                            ? 'bg-black text-white border-black shadow-lg shadow-black/10 scale-[1.02]' 
                            : available 
                              ? 'bg-white text-gray-600 border-gray-100 hover:border-gray-300'
                              : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'}
                        `}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {time} hs
                          {!available && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-widest">Ocupado</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start mb-6">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Tu sesión durará aprox. <strong>{client.appointment_duration || client.ai_estimated_time} horas</strong>.
                  </p>
                </div>

                <button
                  disabled={!selectedDate || !selectedTime || isSubmitting}
                  onClick={handleSchedule}
                  className="w-full bg-black text-white py-5 rounded-2xl font-black text-lg hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-xl shadow-black/10 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirmar Cita'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
