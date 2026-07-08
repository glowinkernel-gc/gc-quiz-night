// Runtime config is served by /js/config.js from server env vars.
// This file is only a local fallback when the app is opened without the server.
window.__SUPABASE_CONFIG__ = window.__SUPABASE_CONFIG__ || {
  url: '',
  anonKey: '',
  mediaBucket: 'quiz-media',
};
