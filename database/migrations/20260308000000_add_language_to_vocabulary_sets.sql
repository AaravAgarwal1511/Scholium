-- Add language column to vocabulary_sets
-- Supported values: 'french', 'spanish'
ALTER TABLE public.vocabulary_sets
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'french';
