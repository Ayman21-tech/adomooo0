
-- Add extracted_text column to book_pages for OCR content
ALTER TABLE public.book_pages
ADD COLUMN IF NOT EXISTS extracted_text text DEFAULT NULL;

-- Add structured_content JSONB column for parsed chapter/section structure
ALTER TABLE public.book_pages
ADD COLUMN IF NOT EXISTS structured_content jsonb DEFAULT NULL;

-- Add ocr_status column to track processing state
ALTER TABLE public.book_pages
ADD COLUMN IF NOT EXISTS ocr_status text DEFAULT 'pending';

-- Index for faster OCR content search
CREATE INDEX IF NOT EXISTS idx_book_pages_ocr_status ON public.book_pages(ocr_status);
CREATE INDEX IF NOT EXISTS idx_book_pages_extracted_text ON public.book_pages USING gin(to_tsvector('simple', coalesce(extracted_text, '')));
