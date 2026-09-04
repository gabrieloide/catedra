-- Esquema de base de datos para Recordatorios en Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase

CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    notify_before_minutes INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para acelerar las consultas de recordatorios pendientes del scheduler
CREATE INDEX IF NOT EXISTS idx_reminders_status_due_date 
ON public.reminders (status, due_date);

-- Habilitar Row Level Security (RLS) opcional
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Politica permisiva para desarrollo personal
CREATE POLICY "Permitir acceso completo al servicio personal"
ON public.reminders
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);
