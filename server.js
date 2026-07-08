const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/js/config.js', (_req, res) => {
  const config = {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    mediaBucket: process.env.SUPABASE_MEDIA_BUCKET || 'quiz-media',
  };

  res.type('application/javascript');
  res.set('Cache-Control', 'no-store');
  res.send(`window.__SUPABASE_CONFIG__ = ${JSON.stringify(config)};`);
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Quiz Battle: http://localhost:${PORT}`);
});
