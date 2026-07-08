const SUPABASE_CONFIG = window.__SUPABASE_CONFIG__ || {};
const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
const MEDIA_BUCKET = SUPABASE_CONFIG.mediaBucket || 'quiz-media';
const AUTH_KEY = 'quiz-battle-authenticated';
const SUPPORTED_MEDIA_PREFIXES = ['image/', 'audio/', 'video/'];

let supabaseClient = null;
let currentUserId = null;

function ensureConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_PROJECT_REF') || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')) {
    throw new Error('Supabase тохиргоо дутуу байна. public/js/config.js дээр url болон anonKey-гээ оруулна уу.');
  }
}

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  ensureConfig();
  if (!window.supabase?.createClient) {
    throw new Error('Supabase SDK ачаалагдаагүй байна.');
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return supabaseClient;
}

async function ensureAuth() {
  const sb = getSupabase();
  if (currentUserId) return currentUserId;

  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError) throw sessionError;

  if (!sessionData.session?.user) {
    const { data: signInData, error: signInError } = await sb.auth.signInAnonymously();
    if (signInError) {
      throw new Error('Supabase anonymous auth амжилтгүй: ' + signInError.message);
    }
    currentUserId = signInData.user.id;
  } else {
    currentUserId = sessionData.session.user.id;
  }

  if (!localStorage.getItem(AUTH_KEY)) {
    localStorage.setItem(AUTH_KEY, '1');
  }
  return currentUserId;
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) throw new Error('Media format буруу байна');
  const mimeMatch = parts[0].match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const base64 = parts[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

function mediaExtension(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
  };
  return map[mimeType] || 'bin';
}

function toDbQuiz(row) {
  return {
    id: row.id,
    title: row.title,
    categoryType: row.category_type,
    questions: row.questions || [],
    author: row.author,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
  };
}

function toRowQuiz(quiz, userId) {
  return {
    id: quiz.id,
    user_id: userId,
    title: quiz.title,
    category_type: quiz.categoryType,
    questions: quiz.questions || [],
    author: quiz.author || 'Guest',
    created_at: quiz.createdAt ? new Date(quiz.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function dbGetAll(store) {
  if (store !== 'quizzes') throw new Error('Unsupported store: ' + store);
  return getAllQuizzes();
}

async function dbPut(store, item) {
  if (store !== 'quizzes') throw new Error('Unsupported store: ' + store);
  return saveQuiz(item);
}

async function dbDelete(store, id) {
  if (store !== 'quizzes') throw new Error('Unsupported store: ' + store);
  return deleteQuizById(id);
}

async function dbGet(store, id) {
  if (store !== 'quizzes') throw new Error('Unsupported store: ' + store);
  const sb = getSupabase();
  const userId = await ensureAuth();
  const { data, error } = await sb
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toDbQuiz(data);
}

async function saveMedia(dataUrl) {
  const sb = getSupabase();
  const userId = await ensureAuth();
  const { blob, mimeType } = dataUrlToBlob(dataUrl);
  if (!SUPPORTED_MEDIA_PREFIXES.some(prefix => mimeType.startsWith(prefix))) {
    throw new Error('Зөвхөн image/audio/video төрөлтэй файл дэмжинэ.');
  }

  const ext = mediaExtension(mimeType);
  const mediaId = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const path = `${userId}/${mediaId}.${ext}`;
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

async function getMedia(id) {
  if (!id) return null;
  const sb = getSupabase();
  const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(id);
  return data?.publicUrl || null;
}

async function deleteMedia(id) {
  if (!id) return;
  const sb = getSupabase();
  const { error } = await sb.storage.from(MEDIA_BUCKET).remove([id]);
  if (error && !String(error.message || '').includes('Not Found')) {
    throw error;
  }
}

async function getAllQuizzes() {
  const sb = getSupabase();
  const userId = await ensureAuth();
  const { data, error } = await sb
    .from('quizzes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(toDbQuiz);
}

async function saveQuiz(quiz) {
  const sb = getSupabase();
  const userId = await ensureAuth();
  const payload = toRowQuiz(quiz, userId);
  const { error } = await sb.from('quizzes').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function deleteQuizById(id) {
  const quiz = await dbGet('quizzes', id);
  if (quiz) {
    for (const q of quiz.questions || []) {
      if (q.imageId) await deleteMedia(q.imageId);
      if (q.audioId) await deleteMedia(q.audioId);
      if (q.videoId) await deleteMedia(q.videoId);
    }
  }

  const sb = getSupabase();
  const userId = await ensureAuth();
  const { error } = await sb.from('quizzes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

async function migrateFromLocalStorage() {
  // User requested a clean start, so we intentionally skip local import.
}

async function migrateQuoteQuizzes() {
  const quizzes = await getAllQuizzes();
  for (const quiz of quizzes) {
    let changed = false;
    if (quiz.categoryType === 'quote') {
      quiz.categoryType = 'quote-video';
      changed = true;
    }
    for (const q of quiz.questions || []) {
      if (q.type === 'quote') {
        q.type = 'quote-video';
        changed = true;
      }
    }
    if (changed) await saveQuiz(quiz);
  }
}

async function migratePosterFxTypes() {
  const quizzes = await getAllQuizzes();
  for (const quiz of quizzes) {
    let changed = false;
    if (quiz.categoryType === 'blur-poster') { quiz.categoryType = 'smoke-reveal'; changed = true; }
    if (quiz.categoryType === 'zoom-poster') { quiz.categoryType = 'movie-poster'; changed = true; }
    if (quiz.categoryType === 'tv-signal') { quiz.categoryType = 'movie-poster'; changed = true; }
    if (quiz.categoryType === 'color-splash') { quiz.categoryType = 'movie-poster'; changed = true; }
    for (const q of quiz.questions || []) {
      if (q.type === 'blur-poster') { q.type = 'smoke-reveal'; changed = true; }
      if (q.type === 'zoom-poster') { q.type = 'movie-poster'; changed = true; }
      if (q.type === 'tv-signal') { q.type = 'movie-poster'; changed = true; }
      if (q.type === 'color-splash') { q.type = 'movie-poster'; changed = true; }
    }
    if (changed) await saveQuiz(quiz);
  }
}
