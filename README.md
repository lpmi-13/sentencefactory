# Sentence Factory

Sentence Factory is a static English-learning game for noticing incorrect verb forms in context.
Each source sentence reaches the production line with one tagged verb replaced by its lemma. The
learner finds the reset word, sees the original form, and earns quality points across an eight-item
shift.

The original Phaser 2 application depended on the retired Micromaterials API and its MongoDB
corpus. This version is an accessible TypeScript application with no runtime API, database,
credentials, or server process.

## Stack

- Node.js 24 and npm 11
- Vite 8 and strict TypeScript 7
- Vitest for corpus and game-domain tests
- Playwright with axe-core for desktop, mobile, interaction, and accessibility checks
- Biome for linting and formatting
- A deterministic Python standard-library corpus updater

## Development

Install the Node version declared in `.nvmrc`, then run:

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm run lint          # static analysis
npm test              # corpus and game unit tests
npm run test:e2e      # browser and accessibility checks
npm run build         # type-check and create dist/
npm run check         # lint, tests, build, and formatting
npm run corpus:update # refresh the pinned generated corpus
```

## Sentence corpus

`scripts/update_corpus.py` downloads the pinned Universal Dependencies English PUD 2.18
CoNLL-U file, verifies its SHA-256 checksum, and generates `src/data/corpus.generated.json`.
Because CoNLL-U already supplies word forms, lemmas, universal POS labels, and English Penn tags,
the updater needs no NLP model or third-party Python package.

The automated selection keeps lexical verbs tagged:

- `VBD` for simple past
- `VBG` for present participles and other verbal `-ing` forms
- `VBN` for past participles

It excludes unchanged lemmas, unusually short or long sentences, URLs, tagged typos and foreign
tokens, and a conservative list of unsuitable topics. Wikipedia-origin sentences are preferred,
then the remaining PUD news sentences are used to fill a balanced pool of 36 exercises per mode.

The generated corpus and its annotations are adapted from
[UD English PUD](https://universaldependencies.org/treebanks/en_pud/index.html), available under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The app retains the source sentence
ID and displays the source and licence with each exercise.

## Game behavior

- Starting a shift opens a dedicated viewport-sized factory screen; the landing page is not part of
  the activity's scroll area.
- Each sentence travels continuously from right to left. Reaching the exit unrepaired records a
  miss and loads the next sentence automatically.
- Each shift samples eight records from its 36-item feature pool.
- A first-try repair earns 10 points; incorrect inspections reduce that sentence's value and speed
  up the line.
- Learners can reveal any repair without a score penalty beyond receiving zero for that item.
- The line can be paused at any time. Reduced-motion preferences start each shift paused.
- The best score is stored locally when browser storage is available.

## Netlify

`netlify.toml` configures the production build, static publish directory, SPA fallback, immutable
hashed assets, and restrictive security headers. Normal deploys consume the committed generated
JSON and do not contact the corpus source.

The social preview is delivered as a real 1200 × 630 RGB PNG. `static/social-preview.svg` remains
the editable source artwork.

## Project layout

```text
scripts/       deterministic corpus updater
src/data/      generated corpus and typed source boundary
src/domain/    shift state, scoring, and feature definitions
src/ui/        DOM application and interaction state
tests/         Vitest corpus and domain checks
e2e/           Playwright browser and accessibility checks
static/        favicon and social-preview assets
```
