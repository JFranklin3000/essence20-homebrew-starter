import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'module.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
const zipped = /zip -r module\.zip ([^-\n]+)/.exec(workflow)[1].trim().split(/\s+/);

/** The collection each pack type's documents are keyed under in LevelDB. */
const COLLECTION = { Item: 'items', Actor: 'actors', JournalEntry: 'journal', RollTable: 'tables', Macro: 'macros' };

test('the manifest is ready to publish', () => {
  assert.equal(manifest.id, 'essence20-homebrew-starter');
  assert.match(manifest.version, /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/);
  assert.ok(manifest.manifest.endsWith('/releases/latest/download/module.json'));
  assert.ok(manifest.download.endsWith(`/releases/download/${manifest.version}/module.zip`));
  assert.ok(manifest.relationships.systems.some(system => system.id == 'essence20'));
  assert.ok(Number(manifest.compatibility.minimum) >= 14);
});

test('everything Foundry loads is in the release zip', () => {
  for (const file of ['module.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'scripts', 'packs']) {
    assert.ok(zipped.includes(file), `${file} is not in the release zip (${zipped.join(' ')})`);
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
  }
});

test('every compendium has its JSON source and a pack folder', () => {
  const inFolders = manifest.packFolders.flatMap(folder => folder.packs);
  for (const pack of manifest.packs) {
    assert.equal(pack.path, `packs/${pack.name}`);
    assert.ok(fs.existsSync(path.join(root, 'packs', '_source', pack.name)), `packs/_source/${pack.name} is missing`);
    assert.ok(inFolders.includes(pack.name), `${pack.name} is not in a pack folder`);
  }
});

test('every source document can be compiled', () => {
  const ids = new Set();
  for (const pack of manifest.packs) {
    const folder = path.join(root, 'packs', '_source', pack.name);
    for (const file of fs.readdirSync(folder).filter(name => name.endsWith('.json'))) {
      const doc = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
      assert.match(doc._id, /^[A-Za-z0-9]{16}$/, file);
      // A compendium's own documents, or a folder inside it.
      assert.ok([`!${COLLECTION[pack.type]}!${doc._id}`, `!folders!${doc._id}`].includes(doc._key), file);
      if (doc._key.startsWith('!folders!')) {
        assert.equal(doc.type, pack.type, file);
      }

      assert.ok(!ids.has(doc._id), `${file} reuses the id ${doc._id}`);
      ids.add(doc._id);
      assert.ok(doc.name, `${file} has no name`);
    }
  }
});
