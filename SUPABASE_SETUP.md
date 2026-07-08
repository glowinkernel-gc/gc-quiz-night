# Supabase Setup

1. Create a Supabase project.
2. In Supabase dashboard, open SQL Editor and run `supabase/schema.sql`.
3. In Authentication -> Providers, enable **Anonymous Sign-Ins**.
4. In Project Settings -> API, copy:
   - Project URL
   - `anon` public key
5. In Vercel -> Project -> Settings -> Environment Variables, add:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon public key
   - `SUPABASE_MEDIA_BUCKET` = `quiz-media` (or your bucket name)
6. Deploy to Vercel (this project now serves through `server.js`, not static-only output).

## Important

- This app is fully client-side. Do **not** put service role key in client files.
- `anonKey` is safe to expose in browser.
- This project is configured as a **shared quiz library** (everyone can read/write quizzes).
- Runtime config is delivered from `/js/config.js` using server environment variables.
