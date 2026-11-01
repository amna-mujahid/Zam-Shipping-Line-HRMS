// Copies the root shared/ folder into frontend/src/shared and backend/src/shared.
// shared/ is the single source of truth; the copies exist so each side can be
// deployed on its own (e.g. Vercel with Root Directory = frontend or backend).
//   npm run sync:shared   (also runs automatically before dev and build)
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'shared');
const targets = ['frontend/src/shared', 'backend/src/shared'];

for (const target of targets) {
  const dest = path.join(root, target);
  rmSync(dest, { recursive: true, force: true });
  cpSync(source, dest, { recursive: true, filter: (src) => path.basename(src) !== 'package.json' });
  writeFileSync(
    path.join(dest, 'README.md'),
    '# Generated copy - do not edit\n\nEdit the root `shared/` folder, then run `npm run sync:shared`.\n',
  );
  console.log(`  shared/ -> ${target}`);
}
