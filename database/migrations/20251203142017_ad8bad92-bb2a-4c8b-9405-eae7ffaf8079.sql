-- Create vocabulary_sets table
CREATE TABLE public.vocabulary_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vocabulary_items table for individual terms
CREATE TABLE public.vocabulary_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES public.vocabulary_sets(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create set_progress table to track learning progress
CREATE TABLE public.set_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES public.vocabulary_sets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.vocabulary_items(id) ON DELETE CASCADE,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_practiced TIMESTAMP WITH TIME ZONE,
  mastered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(set_id, item_id)
);

-- Enable RLS
ALTER TABLE public.vocabulary_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for this app)
CREATE POLICY "Anyone can view vocabulary sets" ON public.vocabulary_sets FOR SELECT USING (true);
CREATE POLICY "Anyone can create vocabulary sets" ON public.vocabulary_sets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update vocabulary sets" ON public.vocabulary_sets FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete vocabulary sets" ON public.vocabulary_sets FOR DELETE USING (true);

CREATE POLICY "Anyone can view vocabulary items" ON public.vocabulary_items FOR SELECT USING (true);
CREATE POLICY "Anyone can create vocabulary items" ON public.vocabulary_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update vocabulary items" ON public.vocabulary_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete vocabulary items" ON public.vocabulary_items FOR DELETE USING (true);

CREATE POLICY "Anyone can view set progress" ON public.set_progress FOR SELECT USING (true);
CREATE POLICY "Anyone can create set progress" ON public.set_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update set progress" ON public.set_progress FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete set progress" ON public.set_progress FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_vocabulary_items_set_id ON public.vocabulary_items(set_id);
CREATE INDEX idx_set_progress_set_id ON public.set_progress(set_id);
CREATE INDEX idx_set_progress_item_id ON public.set_progress(item_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_vocabulary_sets_updated_at
  BEFORE UPDATE ON public.vocabulary_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_set_progress_updated_at
  BEFORE UPDATE ON public.set_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();