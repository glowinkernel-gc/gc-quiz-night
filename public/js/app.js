const GUEST_KEY = 'quiz-battle-guest';

const QUIZ_TYPES = {
  'movie-poster': {
    label: 'Кино таавар',
    icon: '🎬',
    desc: 'Киног poster зургаар таах',
    color: '#e94560',
    defaultQuestion: 'Энэ ямар киноны постер вэ?',
  },
  'smoke-reveal': {
    label: 'Жүжигчин, дуучид',
    icon: '💨',
    desc: 'Бүрсгэр дүрсээс түрүүлж таах',
    color: '#ff7675',
    defaultQuestion: 'Зурган дээрх дуучин хэн бэ?',
    legacyTypes: ['blur-poster'],
  },
  music: {
    label: 'Аяыг таах',
    icon: '🎵',
    desc: 'Дууны аяыг сонсоод нэрийг таах',
    color: '#1368ce',
    defaultQuestion: 'Энэ дууны нэр юу вэ?',
  },
  'reverse-audio': {
    label: 'Урвуу таавар',
    icon: '🔁',
    desc: 'Урвуу болгосон дууг таана',
    color: '#00b894',
    defaultQuestion: 'Урвуу дууны нэр юу вэ?',
  },
  'quote-video': {
    label: 'Ишлэлт таавар',
    icon: '🎥',
    desc: 'Ишлэлийг уншаад киноны нэрийг таана',
    color: '#ffa502',
    defaultQuestion: 'Энэ ишлэл аль киноных вэ?',
    legacyTypes: ['quote'],
  },
  'emoji-movie': {
    label: 'Киног эможигоор таах',
    icon: '😎',
    desc: 'Эможи дээрх илэрхийлэгдсэн утгаар киног таана',
    color: '#9b59b6',
    defaultQuestion: 'Эможигоор илэрхийлсэн киноны нэр юу вэ?',
  },
  'text-fill': {
    label: 'Дууны мөр нөхөх',
    icon: '✏️',
    desc: 'Дууны үгний дутуу үлдсэн хэсгийг гүйцээнэ',
    color: '#26890c',
    defaultQuestion: '',
  },
};

function matchesCategoryType(quiz, type) {
  if (quiz.categoryType === type) return true;
  const legacy = QUIZ_TYPES[type]?.legacyTypes;
  return legacy?.includes(quiz.categoryType);
}

function getTypeInfo(categoryType) {
  if (QUIZ_TYPES[categoryType]) return QUIZ_TYPES[categoryType];
  for (const val of Object.values(QUIZ_TYPES)) {
    if (val.legacyTypes?.includes(categoryType)) return val;
  }
  return { label: categoryType, icon: '❓' };
}

function normalizeType(type) {
  if (type === 'quote') return 'quote-video';
  if (type === 'blur-poster') return 'smoke-reveal';
  if (type === 'zoom-poster' || type === 'tv-signal' || type === 'color-splash') return 'movie-poster';
  return type;
}

let state = {
  view: 'home',
  currentType: null,
  editingQuizId: null,
  playingQuiz: null,
  playIndex: 0,
  timerId: null,
  timerPaused: false,
  answerRevealed: false,
  timerRemaining: 0,
  timerTotal: 0,
  timerOnDone: null,
  mediaCache: {},
  audioCtx: null,
  reverseSource: null,
  currentQuestion: null,
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getGuestName() {
  let name = localStorage.getItem(GUEST_KEY);
  if (!name) {
    name = prompt('Таны нэр (Guest):', 'Guest')?.trim() || 'Guest';
    localStorage.setItem(GUEST_KEY, name);
  }
  return name;
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  state.view = name;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── Home ─────────────────────────────────────────────────

function renderHome() {
  const grid = document.getElementById('type-grid');
  const entries = Object.entries(QUIZ_TYPES)
    .filter(([key]) => key !== 'quote')
    .map(([key, t]) => [normalizeType(key), t]);
  grid.innerHTML = entries.map(([key, t]) => `
    <button class="type-card" data-type="${key}">
      <span class="type-card-icon">${t.icon}</span>
      <span class="type-card-label">${t.label}</span>
      <span class="type-card-desc">${t.desc}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.type-card').forEach(btn =>
    btn.addEventListener('click', () => openTypeHub(btn.dataset.type)));
}

// ── Type Hub ─────────────────────────────────────────────

async function openTypeHub(type) {
  const normalizedType = normalizeType(type);
  state.currentType = normalizedType;
  const info = QUIZ_TYPES[normalizedType];
  document.getElementById('hub-title').textContent = info.label;

  const all = await getAllQuizzes();
  const quizzes = all.filter(q => matchesCategoryType(q, normalizedType));
  const list = document.getElementById('type-quiz-list');
  const empty = document.getElementById('empty-type-hub');
  list.innerHTML = '';

  if (quizzes.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    quizzes.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = `
        <div class="quiz-card-info">
          <h3>${esc(q.title)}</h3>
          <p>${q.questions.length} асуулт · ${esc(q.author || 'Guest')}</p>
        </div>
        <div class="quiz-card-actions">
          <button class="btn btn-primary" data-play="${q.id}">Тоглуулах</button>
          <button class="btn btn-secondary btn-icon" data-edit="${q.id}" title="Засах" aria-label="Засах">✎</button>
          <button class="btn btn-danger btn-icon" data-delete="${q.id}" title="Устгах" aria-label="Устгах">×</button>
        </div>`;
      list.appendChild(card);
    });

    list.querySelectorAll('[data-play]').forEach(b =>
      b.addEventListener('click', () => startPlay(b.dataset.play)));
    list.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openCreator(b.dataset.edit)));
    list.querySelectorAll('[data-delete]').forEach(b =>
      b.addEventListener('click', () => handleDeleteQuiz(b.dataset.delete)));
  }
  showView('type-hub');
}

async function handleDeleteQuiz(id) {
  if (!confirm('Энэ quiz-ийг устгах уу?')) return;
  await deleteQuizById(id);
  openTypeHub(state.currentType);
}

// ── Creator ──────────────────────────────────────────────

async function openCreator(quizId) {
  state.editingQuizId = quizId || null;
  const type = state.currentType;
  const info = QUIZ_TYPES[type];
  document.getElementById('creator-title').textContent = (quizId ? 'Засах: ' : 'Шинэ ') + info.label;

  const container = document.getElementById('questions-container');
  container.innerHTML = '';

  if (quizId) {
    const quiz = await dbGet('quizzes', quizId);
    if (!quiz) return;
    document.getElementById('quiz-title').value = quiz.title;
    for (let i = 0; i < quiz.questions.length; i++) {
      container.appendChild(await buildQuestionCard(quiz.questions[i], i, type));
    }
  } else {
    document.getElementById('quiz-title').value = '';
    container.appendChild(await buildQuestionCard(null, 0, type));
  }
  showView('creator');
}

async function buildQuestionCard(data, index, type) {
  const card = document.createElement('div');
  card.className = 'q-card';
  card.dataset.index = index;
  let imagePreview = '';
  if (data?.imageId) {
    const src = await resolveMedia(data.imageId);
    imagePreview = `<img class="preview-img q-image-preview" src="${src}">`;
    card.dataset.imageId = data.imageId;
  } else {
    imagePreview = '<img class="preview-img q-image-preview hidden">';
  }

  let audioPreview = '';
  if (data?.audioId) {
    const src = await resolveMedia(data.audioId);
    audioPreview = `<audio class="preview-audio q-audio-preview" controls src="${src}"></audio>`;
    card.dataset.audioId = data.audioId;
  } else {
    audioPreview = '<audio class="preview-audio q-audio-preview hidden" controls></audio>';
  }

  let videoPreview = '';
  if (data?.videoId) {
    const src = await resolveMedia(data.videoId);
    videoPreview = `<video class="preview-video q-video-preview" controls src="${src}"></video>`;
    card.dataset.videoId = data.videoId;
  } else {
    videoPreview = '<video class="preview-video q-video-preview hidden" controls></video>';
  }

  const commonFields = `
    <div class="form-group">
      <label>Хариулах хугацаа (сек)</label>
      <input type="number" class="q-time" value="${data?.timeLimit ?? 10}" min="3" max="180">
    </div>
    <div class="form-group">
      <label>Зөв хариулт *</label>
      <input type="text" class="q-answer" value="${escAttr(data?.answerText || '')}" placeholder="Зөв хариултаа бичнэ үү">
    </div>
    <div class="form-group">
      <label>Тайлбар (заавал биш)</label>
      <input type="text" class="q-explanation" value="${escAttr(data?.explanation || '')}" placeholder="Нэмэлт мэдээлэл">
    </div>`;

  let typeFields = '';

  if (
    type === 'movie-poster' ||
    type === 'smoke-reveal'
  ) {
    typeFields = `
      <p class="type-hint">Poster зураг оруулаад, киноныхоо зөв нэрийг "Зөв хариулт" хэсэгт бичнэ үү!</p>
      <div class="form-group">
        <label>Poster зураг *</label>
        <input type="file" class="q-image-file" accept="image/*">
        ${imagePreview}
      </div>
      <div class="form-group">
        <label>Асуулт (заавал биш)</label>
        <textarea class="q-question" rows="2" placeholder="${QUIZ_TYPES[type].defaultQuestion}">${esc(data?.question || QUIZ_TYPES[type].defaultQuestion)}</textarea>
      </div>`;
  } else if (type === 'music') {
    typeFields = `
      <p class="type-hint">Дууны файл хавсаргаад, дууныхаа зөв нэрийг бичнэ үү!</p>
      <div class="form-group">
        <label>Audio файл *</label>
        <input type="file" class="q-audio-file" accept="audio/*">
        ${audioPreview}
      </div>
      <div class="form-group">
        <label>Асуулт (заавал биш)</label>
        <textarea class="q-question" rows="2" placeholder="${QUIZ_TYPES[type].defaultQuestion}">${esc(data?.question || QUIZ_TYPES[type].defaultQuestion)}</textarea>
      </div>`;
  } else if (type === 'reverse-audio') {
    typeFields = `
      <p class="type-hint">Audio файл оруулна. Тоглуулахад дуу урвуугаар явна.</p>
      <div class="form-group">
        <label>Audio файл *</label>
        <input type="file" class="q-audio-file" accept="audio/*">
        ${audioPreview}
      </div>
      <div class="form-group">
        <label>Асуулт (заавал биш)</label>
        <textarea class="q-question" rows="2" placeholder="${QUIZ_TYPES[type].defaultQuestion}">${esc(data?.question || QUIZ_TYPES[type].defaultQuestion)}</textarea>
      </div>`;
  } else if (type === 'quote-video') {
    typeFields = `
      <p class="type-hint">Ишлэл бичих, нэмэлтээр видео хавсаргаж болно</p>
      <div class="form-group">
        <label>Ишлэл / Quote *</label>
        <textarea class="q-quote" rows="3" placeholder="&quot;I'll be back&quot;">${esc(data?.quote || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Видео бичлэг (заавал биш)</label>
        <input type="file" class="q-video-file" accept="video/*">
        ${videoPreview}
      </div>
      <div class="form-group">
        <label>Асуулт (заавал биш)</label>
        <textarea class="q-question" rows="2" placeholder="${QUIZ_TYPES[type].defaultQuestion}">${esc(data?.question || QUIZ_TYPES[type].defaultQuestion)}</textarea>
      </div>`;
  } else if (type === 'emoji-movie') {
    typeFields = `
      <p class="type-hint">Киног илэрхийлсэн эможи оруулна уу! (жишээ: 🦁👑🌍)</p>
      <div class="form-group">
        <label>Эможи *</label>
        <input type="text" class="q-emojis" value="${escAttr(data?.emojis || '')}" placeholder="🦁👑🌍">
      </div>
      <div class="form-group">
        <label>Асуулт (заавал биш)</label>
        <textarea class="q-question" rows="2" placeholder="${QUIZ_TYPES[type].defaultQuestion}">${esc(data?.question || QUIZ_TYPES[type].defaultQuestion)}</textarea>
      </div>`;
  } else if (type === 'text-fill') {
    typeFields = `
      <p class="type-hint">Асуултад <code>___</code> гэж бичвэл эхлэх үед хоосон харагдана</p>
      <div class="form-group">
        <label>Асуулт *</label>
        <textarea class="q-question" rows="2" placeholder="Hasta la vista ___ ">${esc(data?.question || '')}</textarea>
      </div>`;
  }

  card.innerHTML = `
    <div class="q-card-header">
      <span>#${index + 1}</span>
      <button type="button" class="btn btn-danger btn-remove-q">Устгах</button>
    </div>
    <div class="q-type-fields">${typeFields}${commonFields}</div>`;

  card.querySelector('.btn-remove-q').addEventListener('click', () => {
    card.remove();
    reindexQuestions();
  });

  if (type === 'movie-poster' || type === 'smoke-reveal') wireImageUpload(card);
  if (type === 'music' || type === 'reverse-audio') wireAudioUpload(card);
  if (type === 'quote-video') wireVideoUpload(card);

  return card;
}

function wireImageUpload(card) {
  const fileInput = card.querySelector('.q-image-file');
  const preview = card.querySelector('.q-image-preview');
  fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      preview.src = dataUrl;
      preview.classList.remove('hidden');
      card.dataset.pendingImage = dataUrl;
      delete card.dataset.imageId;
    } catch (err) {
      alert('Зураг ачааллахад алдаа: ' + err.message);
    }
  });
}

function wireAudioUpload(card) {
  const fileInput = card.querySelector('.q-audio-file');
  const preview = card.querySelector('.q-audio-preview');
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Audio файл 15MB-аас бага байх ёстой');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.classList.remove('hidden');
      card.dataset.pendingAudio = reader.result;
      delete card.dataset.audioId;
    };
    reader.readAsDataURL(file);
  });
}

function wireVideoUpload(card) {
  const fileInput = card.querySelector('.q-video-file');
  const preview = card.querySelector('.q-video-preview');
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('Видео файл 50MB-аас бага байх ёстой');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.classList.remove('hidden');
      card.dataset.pendingVideo = reader.result;
      delete card.dataset.videoId;
    };
    reader.readAsDataURL(file);
  });
}

function compressImage(file, maxW = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Зураг уншиж чадсангүй'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Файл уншиж чадсангүй'));
    reader.readAsDataURL(file);
  });
}

function reindexQuestions() {
  document.querySelectorAll('.q-card').forEach((card, i) => {
    card.dataset.index = i;
    card.querySelector('.q-card-header span').textContent = `#${i + 1}`;
  });
}

async function collectQuestions(type) {
  const cards = document.querySelectorAll('.q-card');
  const questions = [];

  for (const card of cards) {
    const answerText = card.querySelector('.q-answer')?.value.trim();
    const question = card.querySelector('.q-question')?.value.trim() || QUIZ_TYPES[type].defaultQuestion;
    const timeLimit = parseInt(card.querySelector('.q-time').value) || 10;
    const explanation = card.querySelector('.q-explanation')?.value.trim() || '';

    if (!answerText) { alert('Зөв хариултыг оруулна уу (#' + (questions.length + 1) + ')'); return null; }

    const q = { type, answerText, question, timeLimit, explanation };

    if (type === 'movie-poster' || type === 'smoke-reveal') {
      if (card.dataset.pendingImage) {
        q.imageId = await saveMedia(card.dataset.pendingImage);
      } else if (card.dataset.imageId) {
        q.imageId = card.dataset.imageId;
      } else {
        alert('Poster зураг оруулна уу (#' + (questions.length + 1) + ')');
        return null;
      }
    }

    if (type === 'music' || type === 'reverse-audio') {
      if (card.dataset.pendingAudio) {
        q.audioId = await saveMedia(card.dataset.pendingAudio);
      } else if (card.dataset.audioId) {
        q.audioId = card.dataset.audioId;
      } else {
        alert('Audio файл оруулна уу (#' + (questions.length + 1) + ')');
        return null;
      }
    }

    if (type === 'quote-video') {
      q.quote = card.querySelector('.q-quote')?.value.trim() || '';
      if (!q.quote) { alert('Quote оруулна уу (#' + (questions.length + 1) + ')'); return null; }
      if (card.dataset.pendingVideo) {
        q.videoId = await saveMedia(card.dataset.pendingVideo);
      } else if (card.dataset.videoId) {
        q.videoId = card.dataset.videoId;
      }
    }

    if (type === 'emoji-movie') {
      q.emojis = card.querySelector('.q-emojis')?.value.trim() || '';
      if (!q.emojis) { alert('Эможи оруулна уу (#' + (questions.length + 1) + ')'); return null; }
    }

    if (type === 'text-fill') {
      const qText = card.querySelector('.q-question')?.value.trim();
      if (!qText) { alert('Асуулт оруулна уу (#' + (questions.length + 1) + ')'); return null; }
      q.question = qText;
    }

    questions.push(q);
  }
  return questions;
}

async function handleSaveQuiz() {
  const title = document.getElementById('quiz-title').value.trim();
  if (!title) { alert('Quiz-ийн нэрийг оруулна уу!'); return; }

  const type = state.currentType;
  const questions = await collectQuestions(type);
  if (!questions || questions.length === 0) { alert('Хамгийн багадаа 1 асуулт нэмнэ үү!'); return; }

  const author = getGuestName();
  const btn = document.getElementById('btn-save-quiz');
  btn.disabled = true;
  btn.textContent = 'Хадгалж байна...';

  try {
    if (state.editingQuizId) {
      const old = await dbGet('quizzes', state.editingQuizId);
      const quiz = { ...old, title, questions, author, updatedAt: Date.now() };
      await saveQuiz(quiz);
    } else {
      await saveQuiz({
        id: uid(),
        title,
        categoryType: type,
        questions,
        author,
        createdAt: Date.now(),
      });
    }
    alert('Quiz амжилттай хадгалагдлаа!');
    openTypeHub(type);
  } catch (err) {
    alert('Хадгалахад алдаа гарлаа: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Хадгалах';
  }
}

// ── Media cache ──────────────────────────────────────────

async function resolveMedia(id) {
  if (!id) return null;
  if (state.mediaCache[id]) return state.mediaCache[id];
  const data = await getMedia(id);
  if (data) state.mediaCache[id] = data;
  return data;
}

// ── Player ───────────────────────────────────────────────

async function startPlay(quizId) {
  const quiz = await dbGet('quizzes', quizId);
  if (!quiz) return;

  state.playingQuiz = quiz;
  state.playIndex = 0;
  clearTimers();
  resetPauseUI();

  const info = getTypeInfo(quiz.categoryType);
  document.getElementById('play-type-badge').textContent = (info.icon || '') + ' ' + (info.label || '');
  document.getElementById('play-quiz-title').textContent = quiz.title;
  document.getElementById('play-quiz-info').textContent = `${quiz.questions.length} асуулт · ${quiz.author || 'Guest'}`;

  document.getElementById('player-intro').classList.remove('hidden');
  document.getElementById('player-game').classList.add('hidden');
  document.getElementById('player-done').classList.add('hidden');
  showView('player');
}

function beginGame() {
  document.getElementById('player-intro').classList.add('hidden');
  document.getElementById('player-game').classList.remove('hidden');
  state.playIndex = 0;
  showQuestion();
}

async function showQuestion() {
  clearTimers();
  resetPauseUI();
  state.answerRevealed = false;
  hideNavButtons();

  const quiz = state.playingQuiz;
  const q = quiz.questions[state.playIndex];
  state.currentQuestion = q;

  stopPlayMedia();
  document.getElementById('answer-reveal').classList.add('hidden');
  document.getElementById('question-quote').classList.add('hidden');
  document.getElementById('question-image').classList.add('hidden');
  document.getElementById('question-emojis').classList.add('hidden');

  document.getElementById('question-counter').textContent =
    `${state.playIndex + 1} / ${quiz.questions.length}`;

  const qText = document.getElementById('question-text');
  qText.classList.remove('hidden');

  if (q.type === 'emoji-movie') {
    qText.textContent = q.question || QUIZ_TYPES['emoji-movie'].defaultQuestion;
    const emojiEl = document.getElementById('question-emojis');
    emojiEl.textContent = q.emojis || '';
    emojiEl.classList.remove('hidden');
  } else if (q.type === 'text-fill') {
    qText.innerHTML = renderFillBlank(q.question);
  } else {
    qText.textContent = q.question || '';
  }

  if ((q.type === 'quote-video' || q.type === 'quote') && q.quote) {
    const quoteEl = document.getElementById('question-quote');
    quoteEl.textContent = `"${q.quote}"`;
    quoteEl.classList.remove('hidden');
  }

  const qType = normalizeType(q.type);
  q.type = qType;

  if ((q.type === 'movie-poster' || q.type === 'smoke-reveal') && q.imageId) {
    const imgEl = document.getElementById('question-image');
    imgEl.src = await resolveMedia(q.imageId);
    imgEl.classList.remove('hidden');
    applyPosterVisualProgress(0);
  }

  if (q.type === 'music' && q.audioId) {
    const audio = document.createElement('audio');
    audio.id = 'play-audio';
    audio.className = 'audio-player';
    audio.controls = true;
    audio.src = await resolveMedia(q.audioId);
    audio.autoplay = true;
    document.getElementById('question-area').appendChild(audio);
  }

  if (q.type === 'reverse-audio' && q.audioId) {
    const src = await resolveMedia(q.audioId);
    const hint = document.createElement('p');
    hint.id = 'reverse-hint';
    hint.className = 'type-hint';
    hint.textContent = 'Урвуу аудиог тоглуулж байна…';
    document.getElementById('question-area').appendChild(hint);
    await playReverseAudio(src);
  }

  if ((q.type === 'quote-video' || q.type === 'quote') && q.videoId) {
    const video = document.createElement('video');
    video.id = 'play-video';
    video.className = 'video-player';
    video.controls = true;
    video.src = await resolveMedia(q.videoId);
    video.autoplay = true;
    document.getElementById('question-area').appendChild(video);
  }

  document.getElementById('btn-pause').classList.remove('hidden');
  showRuntimeNextButton();
  startTimer(q.timeLimit || 10, () => revealAnswer(q));
}

function stopPlayMedia() {
  document.getElementById('play-audio')?.pause();
  document.getElementById('play-audio')?.remove();
  const video = document.getElementById('play-video');
  if (video) { video.pause(); video.remove(); }
  stopReversePlayback();
  document.getElementById('reverse-hint')?.remove();
}

function hideNavButtons() {
  document.getElementById('btn-prev').classList.add('hidden');
  document.getElementById('btn-next').classList.add('hidden');
  document.getElementById('btn-finish').classList.add('hidden');
}

function showRuntimeNextButton() {
  const isLast = state.playIndex >= state.playingQuiz.questions.length - 1;
  if (isLast) {
    document.getElementById('btn-finish').classList.remove('hidden');
    document.getElementById('btn-next').classList.add('hidden');
  } else {
    document.getElementById('btn-next').classList.remove('hidden');
    document.getElementById('btn-finish').classList.add('hidden');
  }
}

function updateNavButtons() {
  const total = state.playingQuiz.questions.length;
  const isFirst = state.playIndex === 0;
  const isLast = state.playIndex >= total - 1;

  document.getElementById('btn-prev').classList.toggle('hidden', isFirst);
  document.getElementById('btn-next').classList.toggle('hidden', isLast);
  document.getElementById('btn-finish').classList.toggle('hidden', !isLast);
}

function renderFillBlank(text) {
  return esc(text).replace(/_{2,}|___+/g, '<span class="blank">______</span>');
}

function startTimer(seconds, onDone) {
  state.timerTotal = seconds;
  state.timerRemaining = seconds;
  state.timerOnDone = onDone;
  state.timerPaused = false;

  updateTimerUI();
  document.getElementById('btn-pause').textContent = 'Түр зогсоох';
  document.getElementById('btn-pause').classList.remove('paused');

  state.timerId = setInterval(() => {
    if (state.timerPaused) return;
    state.timerRemaining -= 0.1;
    if (state.timerRemaining <= 0) {
      state.timerRemaining = 0;
      updateTimerUI();
      clearTimerInterval();
      onDone();
      return;
    }
    updateTimerUI();
  }, 100);
}

function updateTimerUI() {
  const bar = document.getElementById('timer-bar');
  const text = document.getElementById('timer-text');
  const pct = state.timerTotal > 0 ? (state.timerRemaining / state.timerTotal) * 100 : 0;
  const progress = state.timerTotal > 0 ? 1 - (state.timerRemaining / state.timerTotal) : 1;
  bar.style.width = pct + '%';
  text.textContent = Math.ceil(state.timerRemaining);
  applyPosterVisualProgress(progress);
}

function togglePause() {
  if (state.answerRevealed || state.timerRemaining <= 0) return;
  state.timerPaused = !state.timerPaused;
  const btn = document.getElementById('btn-pause');
  if (state.timerPaused) {
    btn.textContent = 'Үргэлжлүүлэх';
    btn.classList.add('paused');
    document.getElementById('play-audio')?.pause();
    document.getElementById('play-video')?.pause();
    state.audioCtx?.suspend().catch(() => {});
  } else {
    btn.textContent = 'Түр зогсоох';
    btn.classList.remove('paused');
    document.getElementById('play-audio')?.play().catch(() => {});
    document.getElementById('play-video')?.play().catch(() => {});
    state.audioCtx?.resume().catch(() => {});
  }
}

async function playReverseAudio(src) {
  try {
    stopReversePlayback();
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    await state.audioCtx.resume();
    const arrayBuffer = await fetch(src).then(r => r.arrayBuffer());
    const decoded = await state.audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const reversed = state.audioCtx.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const from = decoded.getChannelData(c);
      const to = reversed.getChannelData(c);
      for (let i = 0, j = from.length - 1; i < from.length; i++, j--) to[i] = from[j];
    }
    const source = state.audioCtx.createBufferSource();
    source.buffer = reversed;
    source.connect(state.audioCtx.destination);
    source.start(0);
    state.reverseSource = source;
  } catch {
    const hint = document.getElementById('reverse-hint');
    if (hint) hint.textContent = 'Reverse audio-г тоглуулахад алдаа гарлаа.';
  }
}

function stopReversePlayback() {
  if (!state.reverseSource) return;
  try { state.reverseSource.stop(0); } catch {}
  try { state.reverseSource.disconnect(); } catch {}
  state.reverseSource = null;
}

function resetPauseUI() {
  state.timerPaused = false;
  const btn = document.getElementById('btn-pause');
  btn.textContent = 'Түр зогсоох';
  btn.classList.remove('paused');
}

function revealAnswer(q) {
  state.answerRevealed = true;
  stopPlayMedia();
  document.getElementById('btn-pause').classList.add('hidden');

  const reveal = document.getElementById('answer-reveal');
  const revealAnswerEl = document.getElementById('reveal-answer');
  const revealExplanation = document.getElementById('reveal-explanation');

  if (q.type === 'text-fill') {
    const qText = document.getElementById('question-text');
    qText.innerHTML = esc(q.question).replace(/_{2,}|___+/g,
      `<span class="filled-answer">${esc(q.answerText)}</span>`);
  }

  revealAnswerEl.textContent = q.answerText;
  revealExplanation.textContent = q.explanation || '';
  reveal.classList.remove('hidden');
  applyPosterVisualProgress(1);
  updateNavButtons();
}

function applyPosterVisualProgress(progress) {
  const q = state.currentQuestion;
  const img = document.getElementById('question-image');
  const fx = document.getElementById('poster-fx');
  if (!q || img.classList.contains('hidden')) return;

  const p = Math.max(0, Math.min(1, progress));
  img.classList.remove('poster-blur', 'poster-zoom');
  img.style.filter = '';
  img.style.transform = '';
  fx.classList.add('hidden');
  fx.classList.remove('smoke');
  fx.style.opacity = '0';

  if (q.type === 'smoke-reveal') {
  
    const blurPx = (1 - p) * 36;
    const dim = 0.45 + 0.55 * p;
    const contrast = 0.75 + 0.25 * p;
    img.style.filter = `blur(${blurPx.toFixed(2)}px) brightness(${dim.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
  }
}

function prevQuestion() {
  if (state.playIndex <= 0) return;
  clearTimers();
  state.playIndex--;
  showQuestion();
}

function nextQuestion() {
  clearTimers();
  state.playIndex++;
  if (state.playIndex >= state.playingQuiz.questions.length) finishGame();
  else showQuestion();
}

function finishGame() {
  clearTimers();
  document.getElementById('player-game').classList.add('hidden');
  document.getElementById('player-intro').classList.add('hidden');
  document.getElementById('player-done').classList.add('hidden');
  state.playingQuiz = null;
  state.playIndex = 0;
  showView('home');
}

function clearTimerInterval() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

function clearTimers() {
  clearTimerInterval();
}

// ── Init ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await migrateFromLocalStorage();
    await migrateQuoteQuizzes();
    await migratePosterFxTypes();
  } catch (err) {
    console.error(err);
    alert(err?.message || 'DB холболтын алдаа гарлаа. Supabase тохиргоогоо шалгана уу.');
  }
  getGuestName();
  renderHome();

  document.querySelector('[data-action="home"]')?.addEventListener('click', () => showView('home'));

  document.getElementById('btn-create-in-type').addEventListener('click', () => openCreator(null));
  document.getElementById('btn-back-from-creator').addEventListener('click', () => openTypeHub(state.currentType));
  document.getElementById('btn-back-from-player').addEventListener('click', () => openTypeHub(state.currentType));
  document.getElementById('btn-back-done').addEventListener('click', () => openTypeHub(state.currentType));

  document.getElementById('btn-save-quiz').addEventListener('click', handleSaveQuiz);
  document.getElementById('btn-add-question').addEventListener('click', async () => {
    const container = document.getElementById('questions-container');
    container.appendChild(await buildQuestionCard(null, container.children.length, state.currentType));
  });

  document.getElementById('btn-start-play').addEventListener('click', beginGame);
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-prev').addEventListener('click', prevQuestion);
  document.getElementById('btn-next').addEventListener('click', nextQuestion);
  document.getElementById('btn-finish').addEventListener('click', finishGame);
  document.getElementById('btn-replay').addEventListener('click', () => {
    document.getElementById('player-done').classList.add('hidden');
    beginGame();
  });
});
