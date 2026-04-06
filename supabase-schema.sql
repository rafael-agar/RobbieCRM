-- Esquema de base de datos para TattooFlow CRM (Supabase)

-- Tabla: clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  instagram TEXT,
  idea_tatuaje TEXT NOT NULL,
  zona TEXT NOT NULL,
  tamano_cm TEXT NOT NULL,
  estilo TEXT,
  imagen_referencia TEXT,
  status TEXT DEFAULT 'new_lead',
  appointment_date TEXT,
  appointment_time TEXT,
  appointment_duration NUMERIC,
  deposit_paid BOOLEAN DEFAULT false,
  deposit_amount NUMERIC,
  payment_name TEXT,
  payment_date TEXT,
  payment_reference TEXT,
  payment_method TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  idea_tatuaje TEXT NOT NULL,
  zona TEXT NOT NULL,
  tamano_cm TEXT NOT NULL,
  estilo TEXT,
  imagen_referencia TEXT,
  ai_suggested_price NUMERIC,
  ai_estimated_time TEXT,
  ai_difficulty TEXT,
  ai_notes TEXT,
  price_artist NUMERIC,
  total_sessions INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'accepted', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  appointment_date TEXT NOT NULL,
  duration NUMERIC,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL, -- 'welcome', 'quote', 'reminder', 'followup'
  channel TEXT NOT NULL, -- 'WhatsApp', 'Instagram', 'SMS', 'Email'
  content TEXT,
  sent_at TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (Permitir todo por ahora para desarrollo, ajustar luego)
CREATE POLICY "Allow all for now" ON clients FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON quotes FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON appointments FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON messages FOR ALL USING (true);

-- Tabla: payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'final_payment', 'extra')),
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla: settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Allow all for now" ON payments FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON settings FOR ALL USING (true);

-- Insertar configuración inicial de citas
INSERT INTO settings (key, value) VALUES (
  'appointment_config',
  '{
    "working_days": [1, 2, 3, 4, 5, 6],
    "start_time": "10:00",
    "end_time": "19:00",
    "slot_interval": 60
  }'
) ON CONFLICT (key) DO NOTHING;

-- CONFIGURACIÓN DE STORAGE (Para las imágenes de referencia)
-- 1. Crear el bucket 'references'
INSERT INTO storage.buckets (id, name, public)
VALUES ('references', 'references', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir subidas públicas al bucket 'references'
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'references');

-- 3. Permitir lectura pública del bucket 'references'
CREATE POLICY "Allow public select"
ON storage.objects FOR SELECT
USING (bucket_id = 'references');
