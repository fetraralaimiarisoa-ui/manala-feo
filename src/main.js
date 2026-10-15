const input = document.getElementById('audio');
const drop = document.getElementById('drop');
const filebox = document.getElementById('filebox');
const filename = document.getElementById('filename');
const filesize = document.getElementById('filesize');
const preview = document.getElementById('preview');
const remove = document.getElementById('remove');
const notice = document.getElementById('notice');
const button = document.getElementById('separate');
const results = document.getElementById('results');
let chosen = null;
let objectUrl = null;
let audioCtx = null;
let busy = false;

const worker = new Worker('./worker.js');
worker.onerror = (event) => setNotice('Erreur du moteur IA : ' + (event.message || 'le worker ne démarre pas.'));

function setNotice(message) { notice.textContent = message; }
function prettySize(bytes) { return bytes < 1048576 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1048576).toFixed(1)} Mo`; }
function useFile(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|ogg|aac|webm)$/i.test(file.name)) {
    setNotice('Choisis un fichier audio compatible (MP3, WAV, FLAC, M4A, OGG ou AAC).'); return;
  }
  if (file.size > 150 * 1024 * 1024) {
    setNotice('Ce fichier dépasse 150 Mo. Essaie avec un morceau plus court ou compressé.'); return;
  }
  chosen = file;
  filename.textContent = file.name;
  filesize.textContent = prettySize(file.size);
  filebox.classList.remove('hidden');
  preview.classList.remove('hidden');
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  results.className = 'empty';
  results.innerHTML = '<span>♫</span><b>Aucune piste pour le moment</b><p>Lance la séparation IA pour obtenir tes fichiers.</p>';
  setNotice('Fichier chargé. La séparation se fera sur cet ordinateur ; le modèle IA doit être téléchargé lors de la première utilisation.');
}

input.addEventListener('change', e => useFile(e.target.files[0]));
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); useFile(e.dataTransfer.files[0]); });
remove.addEventListener('click', () => {
  chosen = null; input.value = ''; filebox.classList.add('hidden'); preview.classList.add('hidden'); preview.removeAttribute('src');
  if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null;
  setNotice('Choisis un morceau audio pour commencer.');
});
document.querySelectorAll('input[name="mode"]').forEach(radio => radio.addEventListener('change', () => {
  document.querySelectorAll('.mode').forEach(card => card.classList.remove('selected'));
  radio.closest('.mode').classList.add('selected');
}));

function displayTracks(tracks) {
  results.className = 'results-grid';
  results.innerHTML = '';
  const labels = { vocals: 'Voix', drums: 'Batterie', bass: 'Basse', other: 'Autres instruments', instrumental: 'Instrumental sans voix' };
  for (const [key, buffer] of Object.entries(tracks)) {
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const card = document.createElement('article'); card.className = 'track';
    const title = document.createElement('b'); title.textContent = labels[key] || key;
    const player = document.createElement('audio'); player.controls = true; player.preload = 'none'; player.src = url;
    const link = document.createElement('a'); link.href = url; link.download = `manala-feo-${key}.wav`; link.textContent = '↓ Télécharger en WAV';
    card.append(title, player, link); results.append(card);
  }
}

button.addEventListener('click', async () => {
  if (busy) return;
  if (!chosen) { setNotice('Importe d’abord un morceau audio.'); return; }
  busy = true; button.disabled = true; button.textContent = '⏳ Préparation…';
  results.className = 'empty'; results.innerHTML = '<span>♫</span><b>Préparation du moteur IA…</b><p>Garde cette page ouverte pendant le traitement.</p>';
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const bytes = await chosen.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(bytes);
    let channelData = [];
    for (let ch = 0; ch < Math.min(2, decoded.numberOfChannels); ch++) channelData.push(new Float32Array(decoded.getChannelData(ch)));
    if (channelData.length === 1) channelData.push(new Float32Array(channelData[0]));
    // The Demucs model expects 44.1 kHz. Resample when the browser did not honor AudioContext's requested rate.
    let sampleRate = decoded.sampleRate;
    if (sampleRate !== 44100) {
      const targetLength = Math.ceil(decoded.duration * 44100);
      const offline = new OfflineAudioContext(2, targetLength, 44100);
      const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start(0);
      const resampled = await offline.startRendering();
      channelData = [new Float32Array(resampled.getChannelData(0)), new Float32Array(resampled.getChannelData(1))];
      sampleRate = 44100;
    }
    worker.postMessage({ type: 'separate', mode: document.querySelector('input[name="mode"]:checked').value, rawAudio: { channelData, sampleRate } }, channelData.map(ch => ch.buffer));
  } catch (error) {
    setNotice('Impossible de lire ce fichier audio : ' + (error?.message || String(error)));
    busy = false; button.disabled = false; button.textContent = '✦ Séparer les pistes';
  }
});

worker.onmessage = event => {
  const msg = event.data;
  if (msg.type === 'status') setNotice(msg.text);
  if (msg.type === 'progress') {
    const percent = Math.round((msg.step / Math.max(1, msg.total)) * 100);
    button.textContent = `⏳ Séparation IA ${percent}%…`;
    setNotice(`Séparation en cours : étape ${msg.step}/${msg.total}. Ne ferme pas l’onglet.`);
  }
  if (msg.type === 'done') {
    displayTracks(msg.tracks);
    setNotice('Séparation terminée ! Les pistes sont calculées sur ton ordinateur. Écoute-les ou télécharge-les en WAV.');
    busy = false; button.disabled = false; button.textContent = '✦ Séparer les pistes';
  }
  if (msg.type === 'error') {
    setNotice('Échec de la séparation : ' + msg.message + ' Si le PC manque de mémoire, essaie un morceau plus court et relance.');
    results.className = 'empty'; results.innerHTML = '<span>!</span><b>La séparation a échoué</b><p>Consulte le message ci-dessus puis réessaie.</p>';
    busy = false; button.disabled = false; button.textContent = '✦ Séparer les pistes';
  }
};
