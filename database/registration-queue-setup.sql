-- =============================================================
-- MIGRATION: CONNECT REGISTRATION_QUEUE TO PROXY_REGISTRATIONS
-- =============================================================

-- 1. Add missing columns to proxy_registrations to support rich registration data
ALTER TABLE public.proxy_registrations 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC;

-- 2. Create trigger function to automatically sync queue inserts to proxy_registrations
CREATE OR REPLACE FUNCTION public.process_registration_queue()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        -- Perform upsert into proxy_registrations table
        INSERT INTO public.proxy_registrations (
            student_id,
            selected_ids,
            quantity,
            total_amount,
            bill_url,
            full_name,
            username,
            status,
            updated_at
        )
        VALUES (
            NEW.student_id,
            NEW.selected_ids,
            NEW.quantity,
            NEW.total_amount,
            NEW.bill_url,
            NEW.full_name,
            NEW.username,
            'pending', -- Defaults to pending waiting for admin approval
            now()
        )
        ON CONFLICT (student_id) DO UPDATE SET
            selected_ids = EXCLUDED.selected_ids,
            quantity = EXCLUDED.quantity,
            total_amount = EXCLUDED.total_amount,
            bill_url = EXCLUDED.bill_url,
            full_name = EXCLUDED.full_name,
            username = EXCLUDED.username,
            status = 'pending',
            updated_at = now();

        -- Mark as completed in the queue
        NEW.status := 'completed';
    EXCEPTION WHEN OTHERS THEN
        -- Mark as error in the queue
        NEW.status := 'error';
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to registration_queue table
DROP TRIGGER IF EXISTS trg_process_registration_queue ON public.registration_queue;
CREATE TRIGGER trg_process_registration_queue
BEFORE INSERT ON public.registration_queue
FOR EACH ROW EXECUTE FUNCTION public.process_registration_queue();

-- 4. Manual migration query to sync any existing data in registration_queue to proxy_registrations
INSERT INTO public.proxy_registrations (
    student_id,
    selected_ids,
    quantity,
    total_amount,
    bill_url,
    full_name,
    username,
    status,
    updated_at
)
SELECT 
    student_id,
    selected_ids,
    quantity,
    total_amount,
    bill_url,
    full_name,
    username,
    'pending',
    now()
FROM public.registration_queue
ON CONFLICT (student_id) DO UPDATE SET
    selected_ids = EXCLUDED.selected_ids,
    quantity = EXCLUDED.quantity,
    total_amount = EXCLUDED.total_amount,
    bill_url = EXCLUDED.bill_url,
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    status = 'pending',
    updated_at = now();

-- Update queue status for migrated rows
UPDATE public.registration_queue
SET status = 'completed'
WHERE status = 'pending' OR status IS NULL;

