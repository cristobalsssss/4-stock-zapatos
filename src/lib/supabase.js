import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://leifskqgupgsajgemgul.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlaWZza3FndXBnc2FqZ2VtZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MzEzMzksImV4cCI6MjEwMjQwNzMzOX0.qlxQRm4S5h205E8ZZ_Ns15rlGIWWbpfuDKtoqLXb16w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const BUCKET_NAME = 'productos-imagenes';
