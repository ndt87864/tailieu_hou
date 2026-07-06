-- =============================================================
-- AUTOMATIC STORAGE CLEANUP TRIGGER
-- Tự động xóa file trong storage.objects khi không còn câu hỏi nào sử dụng
-- =============================================================

-- 1. Hàm trích xuất path file trong bucket từ URL public của Supabase Storage
CREATE OR REPLACE FUNCTION public.extract_storage_path(url text)
RETURNS text AS $$
DECLARE
  prefix text := '/storage/v1/object/public/tailieuhou/';
  pos integer;
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;
  pos := position(prefix in url);
  IF pos > 0 THEN
    RETURN substring(url from pos + char_length(prefix));
  END IF;
  -- Hỗ trợ trường hợp URL dạng tương đối nếu có
  IF position('question_url/' in url) = 1 OR position('answer_url/' in url) = 1 THEN
    RETURN url;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Hàm dọn dẹp ảnh khi không còn tham chiếu
CREATE OR REPLACE FUNCTION public.delete_unused_storage_file(file_url text, current_question_id uuid)
RETURNS void AS $$
DECLARE
  file_path text;
  has_reference boolean;
BEGIN
  IF file_url IS NULL OR file_url = '' THEN
    RETURN;
  END IF;

  file_path := public.extract_storage_path(file_url);
  IF file_path IS NULL THEN
    RETURN;
  END IF;

  -- Kiểm tra xem có câu hỏi nào khác vẫn đang sử dụng URL này không
  SELECT EXISTS (
    SELECT 1 FROM public.questions
    WHERE id <> current_question_id
      AND (url_question = file_url OR url_answer = file_url OR url_choices = file_url)
  ) INTO has_reference;

  -- Nếu không còn câu hỏi nào tham chiếu, thực hiện xóa file trong storage.objects
  IF NOT has_reference THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'tailieuhou'
      AND name = file_path;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage;

-- 3. Trigger function xử lý sau khi UPDATE hoặc DELETE câu hỏi
CREATE OR REPLACE FUNCTION public.on_question_url_change()
RETURNS trigger AS $$
BEGIN
  -- Trường hợp DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.url_question IS NOT NULL THEN
      PERFORM public.delete_unused_storage_file(OLD.url_question, OLD.id);
    END IF;
    IF OLD.url_answer IS NOT NULL THEN
      PERFORM public.delete_unused_storage_file(OLD.url_answer, OLD.id);
    END IF;
    IF OLD.url_choices IS NOT NULL THEN
      PERFORM public.delete_unused_storage_file(OLD.url_choices, OLD.id);
    END IF;
  -- Trường hợp UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Nếu thay đổi hoặc xóa url_question
    IF OLD.url_question IS NOT NULL AND (NEW.url_question IS NULL OR NEW.url_question <> OLD.url_question) THEN
      PERFORM public.delete_unused_storage_file(OLD.url_question, OLD.id);
    END IF;
    -- Nếu thay đổi hoặc xóa url_answer
    IF OLD.url_answer IS NOT NULL AND (NEW.url_answer IS NULL OR NEW.url_answer <> OLD.url_answer) THEN
      PERFORM public.delete_unused_storage_file(OLD.url_answer, OLD.id);
    END IF;
    -- Nếu thay đổi hoặc xóa url_choices
    IF OLD.url_choices IS NOT NULL AND (NEW.url_choices IS NULL OR NEW.url_choices <> OLD.url_choices) THEN
      PERFORM public.delete_unused_storage_file(OLD.url_choices, OLD.id);
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage;

-- 4. Tạo trigger trên bảng public.questions
DROP TRIGGER IF EXISTS trg_cleanup_question_storage ON public.questions;
CREATE TRIGGER trg_cleanup_question_storage
AFTER UPDATE OR DELETE ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.on_question_url_change();
