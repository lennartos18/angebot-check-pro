-- =============================================
-- ANGEBOTSCHECK DATABASE SCHEMA
-- =============================================

-- 1. PROFILES TABLE (for user data)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'pro')),
  analyses_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. GEWERKE (Trade Categories)
CREATE TABLE public.gewerke (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert common German trades
INSERT INTO public.gewerke (name, description) VALUES
  ('Maler', 'Maler- und Lackierarbeiten'),
  ('Elektriker', 'Elektroinstallationen'),
  ('Sanitär', 'Sanitär- und Heizungsinstallationen'),
  ('Fliesenleger', 'Fliesen- und Plattenarbeiten'),
  ('Tischler', 'Tischler- und Schreinerarbeiten'),
  ('Dachdecker', 'Dachdeckerarbeiten'),
  ('Maurer', 'Maurer- und Betonarbeiten'),
  ('Trockenbau', 'Trockenbauarbeiten'),
  ('Bodenleger', 'Bodenbelagsarbeiten'),
  ('Garten-/Landschaftsbau', 'Garten- und Landschaftsbauarbeiten');

-- Gewerke is public readable
ALTER TABLE public.gewerke ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gewerke are publicly readable" 
  ON public.gewerke FOR SELECT 
  USING (true);

-- 3. ANGEBOTE (Quotes/Offers)
CREATE TABLE public.angebote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  handwerker_name TEXT,
  handwerker_firma TEXT,
  stadt TEXT,
  region TEXT,
  plz TEXT,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  original_file_url TEXT,
  original_file_name TEXT,
  gesamtpreis DECIMAL(12, 2),
  plausibility_score INTEGER CHECK (plausibility_score >= 0 AND plausibility_score <= 100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'error')),
  analysis_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on angebote
ALTER TABLE public.angebote ENABLE ROW LEVEL SECURITY;

-- Angebote policies
CREATE POLICY "Users can view their own angebote" 
  ON public.angebote FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own angebote" 
  ON public.angebote FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own angebote" 
  ON public.angebote FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own angebote" 
  ON public.angebote FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. POSITIONEN (Quote Line Items)
CREATE TABLE public.positionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  angebot_id UUID NOT NULL REFERENCES public.angebote(id) ON DELETE CASCADE,
  gewerk_id UUID REFERENCES public.gewerke(id),
  position_nummer INTEGER,
  beschreibung TEXT NOT NULL,
  material TEXT,
  menge DECIMAL(12, 3),
  einheit TEXT,
  einzelpreis DECIMAL(12, 2),
  gesamtpreis DECIMAL(12, 2),
  status TEXT DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
  plausibility_score INTEGER CHECK (plausibility_score >= 0 AND plausibility_score <= 100),
  hinweis TEXT,
  marktpreis_min DECIMAL(12, 2),
  marktpreis_max DECIMAL(12, 2),
  marktpreis_durchschnitt DECIMAL(12, 2),
  abweichung_prozent DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on positionen
ALTER TABLE public.positionen ENABLE ROW LEVEL SECURITY;

-- Positionen policies (inherit from angebote access)
CREATE POLICY "Users can view positionen of their angebote" 
  ON public.positionen FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.angebote 
      WHERE angebote.id = positionen.angebot_id 
      AND angebote.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert positionen to their angebote" 
  ON public.positionen FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.angebote 
      WHERE angebote.id = angebot_id 
      AND angebote.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update positionen of their angebote" 
  ON public.positionen FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.angebote 
      WHERE angebote.id = positionen.angebot_id 
      AND angebote.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete positionen of their angebote" 
  ON public.positionen FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.angebote 
      WHERE angebote.id = positionen.angebot_id 
      AND angebote.user_id = auth.uid()
    )
  );

-- 5. MARKTPREISE (Market Price Reference Data - anonymized)
CREATE TABLE public.marktpreise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gewerk_id UUID REFERENCES public.gewerke(id),
  position_kategorie TEXT NOT NULL,
  material TEXT,
  einheit TEXT,
  preis_min DECIMAL(12, 2),
  preis_max DECIMAL(12, 2),
  preis_durchschnitt DECIMAL(12, 2),
  region TEXT,
  datenpunkte INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Marktpreise is readable for analysis
ALTER TABLE public.marktpreise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marktpreise are readable by authenticated users" 
  ON public.marktpreise FOR SELECT 
  TO authenticated
  USING (true);

-- Insert some initial market price reference data
INSERT INTO public.marktpreise (gewerk_id, position_kategorie, material, einheit, preis_min, preis_max, preis_durchschnitt, region, datenpunkte) 
SELECT 
  g.id,
  kategorie,
  material,
  einheit,
  preis_min,
  preis_max,
  preis_durchschnitt,
  region,
  datenpunkte
FROM public.gewerke g
CROSS JOIN (VALUES
  ('Maler', 'Wandflächen grundieren', 'Tiefengrund', 'm²', 2.50, 4.50, 3.50, 'Deutschland', 150),
  ('Maler', 'Wände streichen 2x', 'Dispersionsfarbe', 'm²', 9.00, 15.00, 12.00, 'Deutschland', 200),
  ('Maler', 'Decke streichen 2x', 'Dispersionsfarbe', 'm²', 10.00, 18.00, 14.00, 'Deutschland', 180),
  ('Elektriker', 'Steckdose setzen', 'Standard UP', 'Stück', 45.00, 85.00, 65.00, 'Deutschland', 120),
  ('Elektriker', 'Lichtschalter setzen', 'Standard UP', 'Stück', 40.00, 75.00, 55.00, 'Deutschland', 100),
  ('Trockenbau', 'Decke abhängen', 'Rigips GK', 'm²', 55.00, 90.00, 72.00, 'Deutschland', 80),
  ('Trockenbau', 'Trennwand erstellen', 'Rigips GK', 'm²', 65.00, 110.00, 85.00, 'Deutschland', 90),
  ('Fliesenleger', 'Fliesen verlegen Wand', 'Standard Fliese', 'm²', 45.00, 80.00, 62.00, 'Deutschland', 130),
  ('Fliesenleger', 'Fliesen verlegen Boden', 'Standard Fliese', 'm²', 50.00, 90.00, 70.00, 'Deutschland', 140),
  ('Bodenleger', 'Vinyl-Klick verlegen', 'Vinyl-Klick', 'm²', 28.00, 48.00, 38.00, 'Deutschland', 110),
  ('Bodenleger', 'Laminat verlegen', 'Laminat Standard', 'm²', 25.00, 45.00, 35.00, 'Deutschland', 160),
  ('Sanitär', 'WC montieren', 'Standard WC', 'Stück', 180.00, 350.00, 260.00, 'Deutschland', 70),
  ('Sanitär', 'Waschbecken montieren', 'Standard Waschtisch', 'Stück', 150.00, 300.00, 220.00, 'Deutschland', 75)
) AS data(gewerk_name, kategorie, material, einheit, preis_min, preis_max, preis_durchschnitt, region, datenpunkte)
WHERE g.name = data.gewerk_name;

-- 6. STORAGE BUCKET for uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('angebote-uploads', 'angebote-uploads', false);

-- Storage policies
CREATE POLICY "Users can upload their own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'angebote-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'angebote-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'angebote-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. UPDATE TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_angebote_updated_at
  BEFORE UPDATE ON public.angebote
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. INDEX for better query performance
CREATE INDEX idx_angebote_user_id ON public.angebote(user_id);
CREATE INDEX idx_angebote_status ON public.angebote(status);
CREATE INDEX idx_positionen_angebot_id ON public.positionen(angebot_id);
CREATE INDEX idx_positionen_status ON public.positionen(status);
CREATE INDEX idx_marktpreise_gewerk ON public.marktpreise(gewerk_id);
CREATE INDEX idx_marktpreise_kategorie ON public.marktpreise(position_kategorie);