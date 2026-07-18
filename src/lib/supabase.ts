// DEPRECATED: This file is no longer used.
// The application has been migrated from Supabase to AWS RDS PostgreSQL.
// All database operations now use the direct PostgreSQL connection in @/lib/db.ts
// 
// For reference, the old Supabase setup was:
// - createClient from @supabase/supabase-js
// - Used environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// New setup uses:
// - Direct PostgreSQL connection via 'pg' library in @/lib/db.ts
// - Environment variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL

export {}; // Keep file as a TypeScript module to avoid errors
