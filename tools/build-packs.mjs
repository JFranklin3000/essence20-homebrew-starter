// Compiles each compendium's JSON in packs/_source/<name> into the LevelDB folder Foundry reads, packs/<name>.
// Close the world using this module first - Foundry holds the compiled packs open.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePack } from '@foundryvtt/foundryvtt-cli';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'module.json'), 'utf8'));

for (const pack of manifest.packs) {
  const source = path.join(root, 'packs', '_source', pack.name);
  const target = path.join(root, pack.path);
  fs.rmSync(target, { recursive: true, force: true });
  await compilePack(source, target, { log: false });
  console.log(`${pack.name}: ${fs.readdirSync(source).filter(file => file.endsWith('.json')).length} documents`);
}
