// HEATLINE: Palm Cay — hand-in program for the make.fun gta6-01 bounty.
// The game itself is the plain static site under game/ (index.html plus its
// ES modules, no build step, no network). This program copies game/ and
// screenshots/ into the output directory and writes dossier.json there with
// buildDossier from the vendored make.fun library, capped exactly as the
// gate expects. Run it with: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own limits: dossier text capped at 160 KiB, at most four
// screenshots of 256 KiB each, game/ at most 993 entries and 48 MiB with
// no path longer than 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`HEATLINE: Palm Cay handed in to ${outputDir}`);
