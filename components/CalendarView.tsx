'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment, Client } from '@/lib/types';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addWeeks, 
  subWeeks,
  parseISO,
  isToday,
  addHours
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User,
  Plus,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<(Appointment & { client: Client })[]>([]);
  const [loading, setLoading] = useState(true);

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start, end });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const queryStart = startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
    const queryEnd = endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
    
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, client:clients(*)')
        .gte('appointment_date', queryStart)
        .lte('appointment_date', queryEnd);

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const hours = Array.from({ length: 13 }, (_, i) => i + 9); // 9:00 to 21:00

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl">
            <CalendarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Agenda Semanal</h2>
            <p className="text-sm text-gray-400 font-medium capitalize">
              {format(start, "d 'de' MMMM", { locale: es })} - {format(end, "d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleToday}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
          >
            Hoy
          </button>
          <div className="flex bg-gray-50 p-1 rounded-xl">
            <button 
              onClick={handlePrevWeek}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button 
              onClick={handleNextWeek}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <button className="ml-2 bg-black text-white p-2.5 rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-black/10">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto relative bg-[#FAFAFA]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
          </div>
        )}

        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-100 bg-white sticky top-0 z-20">
            <div className="p-4" />
            {weekDays.map((day, i) => (
              <div 
                key={i} 
                className={`p-4 text-center border-l border-gray-50 ${isToday(day) ? 'bg-black/5' : ''}`}
              >
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  {format(day, 'EEE', { locale: es })}
                </p>
                <p className={`text-xl font-black ${isToday(day) ? 'text-black' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </p>
                {isToday(day) && (
                  <div className="w-1.5 h-1.5 bg-black rounded-full mx-auto mt-1" />
                )}
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] group">
                <div className="p-4 text-right border-r border-gray-100">
                  <span className="text-[10px] font-black text-gray-400">{hour}:00</span>
                </div>
                {weekDays.map((day, i) => (
                  <div 
                    key={i} 
                    className={`border-b border-gray-100 border-l border-gray-50 h-20 relative hover:bg-gray-50/50 transition-colors ${isToday(day) ? 'bg-black/[0.01]' : ''}`}
                  >
                    {/* Render Appointments for this day and hour */}
                    {appointments
                      .filter(appt => {
                        const apptDate = parseISO(appt.appointment_date);
                        return isSameDay(apptDate, day) && apptDate.getHours() === hour;
                      })
                      .map(appt => (
                        <motion.div
                          key={appt.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute inset-x-1 top-1 z-10 p-2 bg-black text-white rounded-xl shadow-xl shadow-black/20 overflow-hidden group/appt"
                          style={{ height: `${appt.duration * 80 - 8}px` }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[10px] font-black uppercase tracking-tighter truncate opacity-80">
                              {appt.client.nombre}
                            </p>
                            <MoreHorizontal className="w-3 h-3 opacity-0 group-hover/appt:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[9px] font-medium leading-tight line-clamp-2 opacity-60">
                            {appt.client.idea_tatuaje}
                          </p>
                          <div className="absolute bottom-2 left-2 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 opacity-50" />
                            <span className="text-[9px] font-bold opacity-50">{appt.duration}h</span>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
