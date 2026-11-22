// GILDED SHADOW — hand-in program (Node 22, standard library only).
// Copies the game and its screenshots into the output directory and writes
// the dossier the judge reads, using the kit's vendored library.
//
// Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
} else {
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
