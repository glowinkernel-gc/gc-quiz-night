const DB_NAME = 'quiz-battle-v2';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('quizzes')) db.createObjectStore('quizzes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveMedia(dataUrl) {
  const id = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await dbPut('media', { id, data: dataUrl });
  return id;
}

async function getMedia(id) {
  const item = await dbGet('media', id);
  return item?.data || null;
}

async function deleteMedia(id) {
  if (id) await dbDelete('media', id);
}

async function getAllQuizzes() {
  return dbGetAll('quizzes');
}

async function saveQuiz(quiz) {
  await dbPut('quizzes', quiz);
}

async function deleteQuizById(id) {
  const quiz = await dbGet('quizzes', id);
  if (quiz) {
    for (const q of quiz.questions) {
      if (q.imageId) await deleteMedia(q.imageId);
      if (q.audioId) await deleteMedia(q.audioId);
      if (q.videoId) await deleteMedia(q.videoId);
    }
  }
  await dbDelete('quizzes', id);
}

async function migrateFromLocalStorage() {
  const key = 'quiz-battle-data';
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    for (const quiz of data.quizzes || []) {
      for (const q of quiz.questions || []) {
        if (q.image && q.image.startsWith('data:')) {
          q.imageId = await saveMedia(q.image);
          delete q.image;
        }
        if (q.audio && q.audio.startsWith('data:')) {
          q.audioId = await saveMedia(q.audio);
          delete q.audio;
        }
        delete q.options;
        delete q.correctIndex;
        if (!q.answerText && q.options) q.answerText = q.options[q.correctIndex] || '';
      }
      if (!quiz.categoryType && quiz.questions[0]) quiz.categoryType = quiz.questions[0].type;
      await saveQuiz(quiz);
    }
    localStorage.removeItem(key);
  } catch { /* ignore */ }
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
