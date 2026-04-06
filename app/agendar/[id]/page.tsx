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
  Info,
  ExternalLink
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
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [isValidStatus, setIsValidStatus] = useState(true);
  const [activeQuote, setActiveQuote] = useState<any | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, quotes(*)')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Error fetching client:', error);
      } else {
        setClient(data);
        
        // Get the latest quote
        const quote = data.quotes?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        setActiveQuote(quote);

        // Check if status is valid for scheduling
        const validStatuses = ['payment_confirmed', 'scheduled', 'completed'];
        if (!validStatuses.includes(data.status) && !data.deposit_paid) {
          setIsValidStatus(false);
        }

        // Fetch existing appointments for this client
        const { data: appts } = await supabase
          .from('appointments')
          .select('*')
          .eq('client_id', id)
          .order('appointment_date', { ascending: true });
        
        const apptsData = appts || [];
        setExistingAppointments(apptsData);

        // If all sessions are already scheduled, show success screen
        const scheduledAppts = apptsData.filter((a: any) => a.status === 'scheduled');
        const totalSessions = quote?.total_sessions || 1;
        if (scheduledAppts.length >= totalSessions) {
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
    const activeQuote = client.quotes?.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const [hours, minutes] = time.split(':').map(Number);
    const slotStart = hours + (minutes / 60);
    const duration = client.appointment_duration || Number(activeQuote?.ai_estimated_time) || 2;
    const slotEnd = slotStart + duration;

    // Check if this slot overlaps with any busy slot
    return !busySlots.some(busy => {
      // Overlap condition: start1 < end2 AND start2 < end1
      return slotStart < busy.end && busy.start < slotEnd;
    });
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !client) return;

    // Validation: Check if already reached total sessions
    const activeQuote = client.quotes?.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const totalSessions = activeQuote?.total_sessions || 1;
    const scheduledAppts = existingAppointments.filter(a => a.status === 'scheduled');
    if (scheduledAppts.length >= totalSessions) {
      toast.error('Ya has agendado el máximo de sesiones permitidas.');
      setIsSuccess(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const appointmentDate = format(selectedDate, 'yyyy-MM-dd');
      const duration = client.appointment_duration || Number(activeQuote?.ai_estimated_time) || 2;
      
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
      
      // 3. Sync next appointment on client
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
            appointment_duration: nextAppt[0].duration,
            status: 'scheduled'
          })
          .eq('id', client.id);
      }

      // 4. Log to messages table
      await supabase
        .from('messages')
        .insert({
          client_id: client.id,
          message_type: 'scheduling',
          channel: 'System',
          content: `Cita agendada por el cliente para el ${format(selectedDate, 'dd/MM/yyyy')} a las ${selectedTime} hs.`,
          sent_at: new Date().toISOString()
        });

      // Refresh existing appointments
      const { data: updatedAppts } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', id)
        .order('appointment_date', { ascending: true });
      setExistingAppointments(updatedAppts || []);

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

  if (!client || !isValidStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl text-center border border-gray-100"
        >
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Info className="w-12 h-12 text-blue-600" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">¡Un momento!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {!client ? 'No hemos podido encontrar tus datos.' : 'Todavía no puedes agendar tu cita. Debes completar el pago de la seña primero.'}
          </p>
          <p className="text-xs text-gray-400 font-medium">
            Si crees que esto es un error, por favor contacta a Robby por Instagram.
          </p>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    const scheduledAppts = existingAppointments.filter(a => a.status === 'scheduled');
    const totalSessions = activeQuote?.total_sessions || 1;
    const allSessionsScheduled = scheduledAppts.length >= totalSessions;

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
          <h2 className="text-3xl font-black text-gray-900 mb-4">
            {allSessionsScheduled ? '¡Proceso Completado!' : '¡Cita Agendada!'}
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {allSessionsScheduled 
              ? 'Has agendado todas tus sesiones. ¡Nos vemos pronto!' 
              : `Has agendado la sesión ${scheduledAppts.length}. Todavía te faltan sesiones por agendar.`}
          </p>
          
          <div className="space-y-4 mb-8">
            {scheduledAppts.map((appt, idx) => {
              const apptDate = new Date(appt.appointment_date);
              const [datePart, timePart] = appt.appointment_date.split('T');
              const duration = appt.duration || client.appointment_duration || 2;
              
              // Google Calendar Link logic
              const startDateTime = appt.appointment_date.replace(/-/g, '').replace(/:/g, '').replace('T', 'T');
              const endHour = Math.min(23, parseInt(timePart.split(':')[0]) + Number(duration));
              const endDateTime = datePart.replace(/-/g, '') + 'T' + endHour.toString().padStart(2, '0') + timePart.split(':')[1] + '00';
              
              const calendarLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=Tatuaje+con+Robby+Flow+(Sesión+${idx + 1})&dates=${startDateTime.replace(/:/g, '')}00/${endDateTime}&details=Sesión+de+tatuaje+agendada+con+Robby+Flow.+Idea:+${encodeURIComponent(client.idea_tatuaje)}&location=Robby+Flow+Studio&sf=true&output=xml`;

              return (
                <div key={appt.id} className="bg-gray-50 p-6 rounded-3xl text-left border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sesión {idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <CalendarIcon className="w-5 h-5 text-black" />
                    <p className="font-bold text-gray-900">
                      {format(apptDate, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <Clock className="w-5 h-5 text-black" />
                    <p className="font-bold text-gray-900">
                      {format(apptDate, 'HH:mm')} hs
                    </p>
                  </div>

                  <a 
                    href={calendarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-100 py-3 rounded-2xl text-sm font-black text-gray-900 hover:bg-gray-100 hover:border-gray-200 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Añadir a Google Calendar
                  </a>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            {!allSessionsScheduled && (
              <button
                onClick={() => setIsSuccess(false)}
                className="w-full bg-black text-white py-4 rounded-2xl font-black text-lg hover:bg-gray-800 transition-all shadow-xl shadow-black/10"
              >
                Agendar otra sesión
              </button>
            )}
            
            <p className="text-xs text-gray-400 font-medium mt-4">
              Si necesitas reprogramar, por favor contacta a Robby directamente.
            </p>
          </div>
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
          
          {activeQuote && activeQuote.total_sessions > 0 && (
            <div className="mt-4 inline-flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sesiones Totales</p>
                <p className="text-xl font-black text-gray-900">{activeQuote.total_sessions}</p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Agendadas</p>
                <p className="text-xl font-black text-blue-600">{existingAppointments.filter(a => a.status === 'scheduled').length}</p>
              </div>
              {activeQuote.total_sessions > existingAppointments.filter(a => a.status === 'scheduled').length && (
                <>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pendientes</p>
                    <p className="text-xl font-black text-purple-600">{activeQuote.total_sessions - existingAppointments.filter(a => a.status === 'scheduled').length}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {existingAppointments.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {existingAppointments.filter(a => a.status === 'scheduled').map((appt, idx) => (
                <div key={appt.id} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-bold border border-blue-100 flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3" />
                  Sesión {idx + 1}: {format(new Date(appt.appointment_date), 'dd/MM HH:mm')}
                </div>
              ))}
            </div>
          )}
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
                    Tu sesión durará aprox. <strong>{client.appointment_duration || activeQuote?.ai_estimated_time || 2} horas</strong>.
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
