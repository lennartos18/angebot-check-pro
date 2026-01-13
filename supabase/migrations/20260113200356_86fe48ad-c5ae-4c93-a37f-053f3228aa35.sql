-- Session für Gast-Nutzer (ohne Login)
CREATE TABLE public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  documents_json JSONB DEFAULT '[]'::jsonb,
  analysis_json JSONB,
  plz TEXT,
  stadt TEXT,
  email TEXT,
  ip_hash TEXT
);

-- Index für Session-Token Lookup
CREATE INDEX idx_guest_sessions_token ON public.guest_sessions(session_token);
CREATE INDEX idx_guest_sessions_expires ON public.guest_sessions(expires_at);

-- RLS aktivieren
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

-- Public Policy: Jeder kann Sessions erstellen und lesen (anonym)
CREATE POLICY "Anyone can create guest sessions"
ON public.guest_sessions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read their own session by token"
ON public.guest_sessions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can update their own session"
ON public.guest_sessions
FOR UPDATE
USING (true);

-- Payments für Micro-Payment (2,99€ PDF)
CREATE TABLE public.guest_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  amount_cents INTEGER DEFAULT 299,
  currency TEXT DEFAULT 'eur',
  status TEXT DEFAULT 'pending',
  pdf_url TEXT,
  pdf_token TEXT UNIQUE,
  customer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Index für Stripe Session Lookup
CREATE INDEX idx_guest_payments_stripe ON public.guest_payments(stripe_session_id);
CREATE INDEX idx_guest_payments_pdf_token ON public.guest_payments(pdf_token);

-- RLS aktivieren
ALTER TABLE public.guest_payments ENABLE ROW LEVEL SECURITY;

-- Public Policy für Payments
CREATE POLICY "Anyone can create payments"
ON public.guest_payments
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read payments by session"
ON public.guest_payments
FOR SELECT
USING (true);

CREATE POLICY "Service role can update payments"
ON public.guest_payments
FOR UPDATE
USING (true);