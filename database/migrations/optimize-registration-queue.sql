-- 1. Drop the synchronous trigger from registration_queue
DROP TRIGGER IF EXISTS trg_process_registration_queue ON public.registration_queue;

-- 2. Create the asynchronous batch processing function
CREATE OR REPLACE FUNCTION public.process_registration_queue_batch(batch_size int)
RETURNS int AS $$
DECLARE
    r RECORD;
    processed_count int := 0;
BEGIN
    -- Loop through a batch of pending rows, locking them to prevent other workers from picking them up
    FOR r IN 
        SELECT id, student_id, selected_ids, bill_url, full_name, username, quantity, total_amount
        FROM public.registration_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    LOOP
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
                r.student_id,
                r.selected_ids,
                r.quantity,
                r.total_amount,
                r.bill_url,
                r.full_name,
                r.username,
                'pending',
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

            -- Update queue item status to completed
            UPDATE public.registration_queue
            SET status = 'completed', updated_at = now()
            WHERE id = r.id;

            processed_count := processed_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Update queue item status to error
            UPDATE public.registration_queue
            SET status = 'error', updated_at = now()
            WHERE id = r.id;
        END;
    END LOOP;

    RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create function to delete associated bill image from Supabase Storage on record deletion
CREATE OR REPLACE FUNCTION public.delete_registration_bill_files()
RETURNS TRIGGER AS $$
DECLARE
    url_item text;
    file_name text;
    bill_urls text[];
BEGIN
    IF OLD.bill_url IS NOT NULL AND OLD.bill_url <> '' THEN
        -- Split comma-separated URLs (in case multiple bills were uploaded)
        bill_urls := string_to_array(OLD.bill_url, ',');
        
        FOREACH url_item IN ARRAY bill_urls LOOP
            url_item := trim(url_item);
            
            -- Extract file path starting with 'bills/'
            -- E.g. 'https://.../storage/v1/object/public/tailieuhou/bills/abc.png' -> 'bills/abc.png'
            IF url_item LIKE '%/bills/%' THEN
                file_name := 'bills/' || split_part(url_item, '/bills/', 2);
                
                -- Remove any query parameters from filename if present
                file_name := split_part(file_name, '?', 1);
                
                -- Delete the object record from storage.objects
                DELETE FROM storage.objects
                WHERE bucket_id = 'tailieuhou' AND name = file_name;
            END IF;
        END LOOP;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach deletion triggers to proxy_registrations and registration_queue
DROP TRIGGER IF EXISTS trg_delete_proxy_registration_bill ON public.proxy_registrations;
CREATE TRIGGER trg_delete_proxy_registration_bill
AFTER DELETE ON public.proxy_registrations
FOR EACH ROW EXECUTE FUNCTION public.delete_registration_bill_files();

DROP TRIGGER IF EXISTS trg_delete_queue_registration_bill ON public.registration_queue;
CREATE TRIGGER trg_delete_queue_registration_bill
AFTER DELETE ON public.registration_queue
FOR EACH ROW EXECUTE FUNCTION public.delete_registration_bill_files();
