import { ONNXHTDemucs } from 'demucs/dist/onnx-htdemucs.js';
import { separateTracks } from 'demucs/dist/apply.js';
import { samplesToWav } from 'demucs/dist/wav-utils.js';

let modelPromise = null;

async function getModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    self.postMessage({ type: 'status', text: 'Chargement du modèle IA (~170 Mo). Le premier téléchargement peut prendre quelques minutes…' });
    const cache = await caches.open('manala-feo-demucs-model-v1');
    const modelUrl = new URL('./htdemucs.onnx', self.location.href).href;
    let response = await cache.match(modelUrl);
    if (response) {
      const cached = await response.clone().arrayBuffer();
      if (cached.byteLength > 100 * 1024 * 1024) {
        self.postMessage({ type: 'status', text: 'Modèle retrouvé dans le cache. Initialisation du moteur IA…' });
        return ONNXHTDemucs.init(cached);
      }
      await cache.delete(modelUrl);
    }
    self.postMessage({ type: 'status', text: 'Téléchargement du modèle IA… ne ferme pas cette page.' });
    response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`Téléchargement du modèle impossible (HTTP ${response.status}). Vérifie que htdemucs.onnx est bien publié dans docs/.`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 100 * 1024 * 1024) throw new Error('Le fichier du modèle est incomplet ou trop petit. Relance npm run build.');
    await cache.put(modelUrl, new Response(buffer.slice(0), { headers: { 'content-type': 'application/octet-stream', 'content-length': String(buffer.byteLength) } }));
    self.postMessage({ type: 'status', text: 'Modèle téléchargé. Initialisation du moteur IA…' });
    return ONNXHTDemucs.init(buffer);
  })();
  try { return await modelPromise; } catch (error) { modelPromise = null; throw error; }
}

function makeInstrumental(tracks) {
  const parts = [tracks.drums, tracks.bass, tracks.other].filter(Boolean);
  if (parts.length !== 3) throw new Error('Le modèle n’a pas renvoyé les trois pistes instrumentales attendues.');
  const channels = parts[0].channelData.length;
  const length = Math.min(...parts.map(p => p.channelData[0].length));
  const channelData = Array.from({ length: channels }, (_, ch) => {
    const sum = new Float32Array(length);
    for (const part of parts) {
      const source = part.channelData[Math.min(ch, part.channelData.length - 1)];
      for (let i = 0; i < length; i++) sum[i] += source[i];
    }
    return sum;
  });
  return { channelData, sampleRate: parts[0].sampleRate };
}

self.onmessage = async (event) => {
  if (event.data?.type !== 'separate') return;
  try {
    const model = await getModel();
    self.postMessage({ type: 'status', text: 'Analyse et séparation IA en cours. Cela peut prendre du temps selon ton PC…' });
    const tracks = await separateTracks(model, event.data.rawAudio, (step, total) => {
      self.postMessage({ type: 'progress', step, total });
    });
    let output = tracks;
    if (event.data.mode === '2') {
      output = { vocals: tracks.vocals, instrumental: makeInstrumental(tracks) };
    }
    const encoded = {};
    for (const [name, audio] of Object.entries(output)) {
      if (!audio?.channelData) continue;
      const wav = samplesToWav(audio.channelData, audio.sampleRate);
      encoded[name] = wav.buffer;
    }
    if (!Object.keys(encoded).length) throw new Error('Aucune piste audio n’a été produite.');
    self.postMessage({ type: 'done', tracks: encoded }, Object.values(encoded));
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
};
