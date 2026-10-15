# MANALA FEO — IA 4 pistes dans le navigateur

Cette version garde l’interface MANALA FEO et ajoute le moteur HTDemucs v4 via ONNX Runtime Web. Le traitement se fait dans le navigateur : aucun abonnement Gradio, aucune API de séparation et aucun envoi du fichier audio à un serveur de calcul.

## Prérequis Windows
- Node.js 18 ou plus récent : https://nodejs.org/
- Un navigateur récent, idéalement Chrome ou Microsoft Edge.
- Une connexion Internet pour installer les dépendances et télécharger le modèle lors de la compilation.
- Le modèle ONNX fait environ 166–172 Mo. Le dossier `docs/` après compilation sera volumineux.

## Lancer dans VS Code
1. Décompresse `manala_feo_ai.zip`.
2. Dans VS Code, ouvre le dossier `manala_feo_ai`.
3. Ouvre **Terminal → New Terminal**.
4. Exécute ces commandes, une par une :

```powershell
npm install
npm run build
npm run serve
```

5. Ouvre `http://localhost:8080` dans Chrome ou Edge.
6. Choisis un morceau audio puis clique sur **Séparer les pistes**. Le premier lancement télécharge le modèle et peut prendre plusieurs minutes. Garde l’onglet ouvert.

## Publier sur un hébergement statique
Après `npm run build`, le site prêt à publier est dans le dossier `docs/`. Publie le **contenu de `docs/`**, pas seulement les fichiers sources.

Important : le modèle `htdemucs.onnx` est très volumineux. Vérifie la limite de taille de fichier et de déploiement de ton hébergeur. Sur GitHub Pages, préfère un workflow GitHub Actions qui construit le projet et publie `docs/` comme artefact, au lieu d’ajouter directement le modèle volumineux dans un commit Git.

## Limites
- L’inférence dépend de la RAM, du CPU/GPU et du navigateur. Les morceaux longs peuvent être lents ou manquer de mémoire.
- Les résultats sont exportés en WAV. Le modèle et le format de sortie sont affichés dans l’interface ; l’encodage MP3 n’est pas inclus dans cette version.
- La séparation IA n’est pas garantie parfaite : des artefacts et des fuites entre pistes sont possibles.
- Le modèle est chargé depuis le fichier statique `docs/htdemucs.onnx` et mis en cache localement par le navigateur.

## Fichiers
- `index.html`, `style.css` : interface MANALA FEO.
- `src/main.js` : import audio, communication avec le worker, lecture et téléchargement des pistes.
- `src/worker.js` : chargement du modèle, inférence HTDemucs, encodage WAV.
- `build.mjs` : construit la version statique dans `docs/`.

Modèle et bibliothèques : voir le projet open source `mcfredrick/client-side-ml` et le paquet `demucs`. Respecte les licences et droits des enregistrements que tu traites.
