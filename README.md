# 🦜 Psittacus

**Psittacus** est une PWA mobile-first pour apprendre ses répliques de théâtre. L'application lit les répliques des autres personnages via Text-to-Speech, écoute les vôtres via Speech Recognition, et vous aide à les corriger avec une comparaison à tolérance souple.

> *Psittacus* = genre de perroquet — l'animal qui répète et apprend.

---

## Architecture

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout + inscription SW
│   ├── manifest.ts             # PWA manifest (route spéciale Next.js)
│   ├── globals.css             # Tailwind v4 + thème + animations
│   ├── page.tsx                # Bibliothèque de scripts
│   └── scripts/
│       ├── new/page.tsx        # Import & édition d'un script
│       ├── [id]/page.tsx       # Configuration (personnage, vitesse, langue)
│       └── [id]/rehearse/page.tsx  # Répétition (TTS + STT + comparaison)
│
├── components/
│   ├── Logo.tsx                # Logo 🦜 avec gradient
│   ├── PageHeader.tsx          # En-tête avec retour et action
│   ├── EmptyState.tsx          # États vides
│   └── ui/
│       ├── Button.tsx          # Bouton polymorphe (primary/secondary/ghost/danger)
│       ├── Card.tsx            # Carte avec variantes
│       └── Badge.tsx           # Badge coloré
│
├── lib/
│   ├── storage.ts              # CRUD localStorage (scripts, session, stats, settings)
│   ├── parser.ts               # Parseur "PERSONNAGE: réplique"
│   ├── compare.ts              # Comparaison souple (Levenshtein + Jaccard)
│   ├── tts.ts                  # Web Speech API — synthèse vocale
│   ├── stt.ts                  # Web Speech API — reconnaissance vocale
│   └── nanoid.ts               # Générateur d'ID sans dépendance
│
├── types/index.ts              # Types TypeScript partagés
│
public/
├── sw.js                       # Service Worker (cache-first + network-first)
└── icons/
    ├── icon.svg                # Logo SVG source
    ├── icon-192.png            # Icône PWA
    └── icon-512.png            # Icône PWA maskable
```

---

## Structure de fichiers complète

```
psittacus/
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts              # Headers HTTP + sw.js
├── postcss.config.mjs          # @tailwindcss/postcss pour v4
├── public/
│   ├── sw.js
│   └── icons/
│       ├── icon.svg
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    └── … (voir ci-dessus)
```

---

## Instructions de lancement

### Prérequis
- Node.js 18+
- npm 9+

### Développement

```bash
cd psittacus
npm install
npm run dev
# → http://localhost:3000
```

### Production

```bash
npm run build
npm start
# → http://localhost:3000
```

### Installation en PWA

1. Ouvrez `http://localhost:3000` dans Chrome / Edge / Safari iOS
2. Menu → « Ajouter à l'écran d'accueil » (iOS/Android) ou icône d'installation dans la barre d'adresse (Chrome Desktop)

---

## Fonctionnement

### Format d'import

```
HAMLET: Être ou ne pas être, telle est la question.
OPHÉLIE: Comme votre esprit a changé !
HAMLET: Et qui m'a rendu fou ?
```

- Chaque ligne commence par `NOM_PERSONNAGE:` (majuscule, suivi de deux-points)
- Les lignes sans ce format sont considérées comme la continuation de la réplique précédente
- Le titre est libre

### Flux de répétition

1. **Réplique d'un autre personnage** → TTS lit à voix haute, avance automatiquement
2. **Votre réplique** → le texte est flouté, le micro s'affiche
3. **Appui sur le micro** → STT écoute
4. **Résultat "exact" ou "proche"** → validation, passage à la suite
5. **Résultat "faux"** × 2 → indice affiché (texte révélé), option de réessayer
6. **Fin du script** → écran de félicitations, stats sauvegardées

### Algorithme de comparaison

Score hybride (mode "normal" par défaut) :
- 50% similarité caractère (distance de Levenshtein normalisée)
- 50% recouvrement de mots (Jaccard)

| Mode    | Seuil "proche" | Seuil "exact" |
|---------|----------------|---------------|
| strict  | 90%            | 97%           |
| normal  | 70%            | 90%           |
| loose   | 50%            | 75%           |

---

## Limites connues du navigateur

| Fonctionnalité | Chrome Android | Safari iOS | Firefox | Chrome Desktop |
|---|---|---|---|---|
| Text-to-Speech (`speechSynthesis`) | ✅ | ✅ | ✅ | ✅ |
| Speech Recognition (`SpeechRecognition`) | ✅ | ✅ (iOS 14.5+) | ❌ | ✅ |
| PWA installable | ✅ | ✅ (iOS 16.4+) | ❌ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |

**Fallback Firefox / absence STT :** l'application affiche un bandeau d'avertissement et remplace l'écoute vocale par un bouton "Passer à la suite".

**Safari iOS quirks :**
- `speechSynthesis` est interrompu si l'écran se verrouille
- Le micro nécessite une interaction utilisateur (bouton tap), ce que l'app respecte
- `SpeechRecognition` peut nécessiter d'activer "Siri & Dictée" dans les réglages

**Stockage localStorage :**
- Limite ~5–10 Mo selon les navigateurs
- Pas de synchronisation cross-device
- Effacé si l'utilisateur vide le cache

---

## Stack technique

| Technologie | Version | Rôle |
|---|---|---|
| Next.js | 15.x | Framework React App Router |
| React | 19.x | UI |
| Tailwind CSS | 4.x | Styles utility-first (CSS-based config) |
| TypeScript | 5.x | Types |
| Web Speech API | native | TTS + STT |
| localStorage | native | Persistance |
| Service Worker | native | PWA offline |

---

## Personnalisation

- **Couleurs** : éditez les `--color-parrot-*` dans `src/app/globals.css`
- **Langues** : ajoutez des `<option>` dans `/scripts/[id]/page.tsx`
- **Seuils de comparaison** : ajustez `THRESHOLDS` dans `src/lib/compare.ts`
- **Voix TTS** : la lib `tts.ts` expose `getVoices()` pour choisir une voix spécifique
