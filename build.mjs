import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'docs');
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src/worker.js')],
  bundle: true,
  outfile: join(out, 'worker.js'),
  alias: { 'onnxruntime-node': 'onnxruntime-web' },
  define: { 'process.env.NODE_ENV': '"production"' },
  target: ['chrome113', 'firefox115'],
});

await esbuild.build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  outfile: join(out, 'app.js'),
  target: ['chrome113', 'firefox115'],
});

cpSync(join(root, 'index.html'), join(out, 'index.html'));
cpSync(join(root, 'style.css'), join(out, 'style.css'));
const ortDist = join(root, 'node_modules/onnxruntime-web/dist');
for (const file of [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.mjs'
]) {
  if (existsSync(join(ortDist, file))) cpSync(join(ortDist, file), join(out, file));
}
const model = join(root, 'node_modules/demucs/htdemucs.onnx');
if (!existsSync(model)) throw new Error('Modèle Demucs introuvable. Lance d’abord npm install.');
cpSync(model, join(out, 'htdemucs.onnx'));
console.log('Compilation terminée : le site statique prêt à publier se trouve dans le dossier docs/.');
