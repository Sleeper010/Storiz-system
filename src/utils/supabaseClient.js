import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hamskbkgjfrmbqybgaxj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbXNrYmtnamZybWJxeWJnYXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjY1ODEsImV4cCI6MjA5MDkwMjU4MX0.pB9WW4WP9dJGdFCNytRMTf9SlMaPlvGlHpSnhD5sfao';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
