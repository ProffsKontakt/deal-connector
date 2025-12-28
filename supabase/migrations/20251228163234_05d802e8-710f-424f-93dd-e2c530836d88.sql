-- Add credit_date column for admin to set custom credit request dates
ALTER TABLE public.credit_requests 
ADD COLUMN credit_date date DEFAULT CURRENT_DATE;

-- Add sold_to_partner column to contact_organizations to track when leads are sold to partner instead of sales consultant
ALTER TABLE public.contact_organizations 
ADD COLUMN sold_to_partner boolean NOT NULL DEFAULT false;

-- Update the comment for clarity
COMMENT ON COLUMN public.contact_organizations.sold_to_partner IS 'When true, this lead is sold to the partner rather than being a sales consultant lead';