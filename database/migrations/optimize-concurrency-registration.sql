-- 1. Helper function to merge two comma-separated lists of values (removing duplicates and empty items)
CREATE OR REPLACE FUNCTION public.merge_comma_separated_strings(str1 text, str2 text)
RETURNS text AS $$
DECLARE
    arr1 text[];
    arr2 text[];
    merged text[];
BEGIN
    arr1 := string_to_array(coalesce(str1, ''), ',');
    arr2 := string_to_array(coalesce(str2, ''), ',');
    
    SELECT array_agg(DISTINCT x ORDER BY x)
    INTO merged
    FROM unnest(array_cat(arr1, arr2)) AS x
    WHERE x IS NOT NULL AND x <> '';
    
    RETURN array_to_string(merged, ',');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Optimize process_registration_queue_batch to perform deduplicated merges on conflict
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
                selected_ids = public.merge_comma_separated_strings(proxy_registrations.selected_ids, EXCLUDED.selected_ids),
                quantity = cardinality(string_to_array(public.merge_comma_separated_strings(proxy_registrations.selected_ids, EXCLUDED.selected_ids), ',')),
                total_amount = coalesce(proxy_registrations.total_amount, 0) + coalesce(EXCLUDED.total_amount, 0),
                bill_url = public.merge_comma_separated_strings(proxy_registrations.bill_url, EXCLUDED.bill_url),
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

-- 3. Create indexes to speed up queue selection and conflict resolution under high concurrent load
CREATE INDEX IF NOT EXISTS idx_registration_queue_status_created_at 
ON public.registration_queue (status, created_at);

CREATE INDEX IF NOT EXISTS idx_proxy_registrations_student_id 
ON public.proxy_registrations (student_id);
