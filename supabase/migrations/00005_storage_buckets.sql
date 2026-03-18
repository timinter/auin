-- Create storage buckets for freelancer file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('freelancer-files', 'freelancer-files', false)
ON CONFLICT (id) DO NOTHING;

-- Freelancers can upload to their own folder
CREATE POLICY "Freelancers can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'freelancer-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Freelancers can read own files
CREATE POLICY "Freelancers can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'freelancer-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all files
CREATE POLICY "Admins can read all freelancer files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'freelancer-files'
    AND public.get_my_role() = 'admin'
  );
