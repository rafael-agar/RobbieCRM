export type KanbanStatus = 
  | 'new_lead' 
  | 'ai_generated' 
  | 'reviewed' 
  | 'accepted' 
  | 'payment_pending' 
  | 'payment_review' 
  | 'payment_confirmed' 
  | 'scheduled' 
  | 'completed' 
  | 'follow_up';

export type Channel = 'Website' | 'Manual' | 'WhatsApp' | 'Instagram' | 'Facebook';

export interface Client {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  instagram?: string;
  idea_tatuaje: string;
  zona: string;
  tamano_cm: string;
  estilo?: string;
  imagen_referencia?: string;
  status: KanbanStatus;
  channel: Channel;
  // Appointment/Payment fields
  appointment_date?: string;
  appointment_time?: string;
  appointment_duration?: number;
  deposit_paid: boolean;
  deposit_amount?: number;
  payment_name?: string;
  payment_date?: string;
  payment_reference?: string;
  payment_method?: string;
  currency?: string;
  created_at: string;
  quotes?: Quote[];
}

export interface Quote {
  id: string;
  client_id: string;
  idea_tatuaje: string;
  zona: string;
  tamano_cm: string;
  estilo?: string;
  imagen_referencia?: string;
  ai_suggested_price: number;
  ai_estimated_time: string;
  ai_difficulty: 'Baja' | 'Media' | 'Alta';
  ai_notes?: string;
  price_artist?: number;
  total_sessions?: number;
  currency?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  appointment_date: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'canceled';
  created_at: string;
}

export interface MessageLog {
  id: string;
  client_id: string;
  message_type: 'welcome' | 'quote' | 'reminder' | 'followup' | 'scheduling';
  channel: 'WhatsApp' | 'Instagram' | 'SMS' | 'Email' | 'System';
  content?: string;
  sent_at: string;
  created_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  amount: number;
  payment_type: 'deposit' | 'final_payment' | 'extra';
  payment_method?: string;
  notes?: string;
  created_at: string;
}

export interface AppointmentConfig {
  working_days: number[]; // 0 for Sunday, 1 for Monday, etc.
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"
  slot_interval: number; // in minutes
}

export interface AIAssessment {
  complexity: 'Baja' | 'Media' | 'Alta';
  estimated_hours: number;
  price_range: string;
  recommended_price: number;
  notes: string;
  style_detected: string;
  total_sessions: number;
}

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string; color: string }[] = [
  { id: 'new_lead', label: 'Nuevo Lead', color: 'bg-blue-100 text-blue-800' },
  { id: 'ai_generated', label: 'Cotización IA', color: 'bg-purple-100 text-purple-800' },
  { id: 'reviewed', label: 'Revisada', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'payment_pending', label: 'Pago Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'accepted', label: 'Aceptado', color: 'bg-green-100 text-green-800' },
  { id: 'payment_review', label: 'En Revisión', color: 'bg-orange-100 text-orange-800' },
  { id: 'payment_confirmed', label: 'Pago Confirmado', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'scheduled', label: 'Agendado', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'completed', label: 'Completado', color: 'bg-gray-100 text-gray-800' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-pink-100 text-pink-800' },
];
