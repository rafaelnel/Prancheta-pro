import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createNewCareerSave } from '../data/careerFactory';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces Phase 0 Dirty Dozen security invariants and matches firebase-blueprint.json', () => {
  const rulesText = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  // 1. Default deny catch-all
  assert.ok(
    rulesText.includes('match /{document=**}') &&
      rulesText.includes('allow read, write: if false;'),
    'Must include global default-deny catch-all'
  );

  // 2. Blueprint entities and paths exist
  assert.ok(blueprint.entities.UserProfile, 'UserProfile entity must be defined');
  assert.ok(blueprint.entities.CareerCloudSlot, 'CareerCloudSlot entity must be defined');
  assert.ok(blueprint.firestore['/users/{userId}'], '/users/{userId} path must be defined');
  assert.ok(
    blueprint.firestore['/users/{userId}/careerSlots/{slotId}'],
    '/users/{userId}/careerSlots/{slotId} path must be defined'
  );

  // 3. Key whitelist (hasAll + hasOnly) for both entities
  assert.ok(
    rulesText.includes('data.keys().hasAll') && rulesText.includes('data.keys().hasOnly'),
    'Must enforce strict key whitelisting via hasAll and hasOnly'
  );

  // 4. Server timestamp equality and immutability of createdAt & ownerId
  assert.ok(
    rulesText.includes('incoming().createdAt == request.time') &&
      rulesText.includes('incoming().updatedAt == request.time'),
    'Must enforce request.time on creation'
  );
  assert.ok(
    rulesText.includes('incoming().ownerId == existing().ownerId') &&
      rulesText.includes('incoming().createdAt == existing().createdAt'),
    'Must enforce immutability of ownerId and createdAt on update'
  );

  // 5. diff().affectedKeys().hasOnly(...) on updates
  assert.ok(
    rulesText.includes('incoming().diff(existing()).affectedKeys().hasOnly'),
    'Must enforce affectedKeys whitelist on updates'
  );

  // 6. careerPayload key count limit accommodates actual CareerSaveData keys
  const sampleSave = createNewCareerSave(1, 'flamengo', 'Treinador Teste');
  const actualKeyCount = Object.keys(sampleSave).length;
  const maxKeysMatch = rulesText.match(/data\.careerPayload\.keys\(\)\.size\(\)\s*<=\s*(\d+)/);
  assert.ok(maxKeysMatch, 'Must enforce bounded careerPayload key count');
  const ruleMaxKeys = Number(maxKeysMatch[1]);
  assert.ok(
    ruleMaxKeys >= actualKeyCount + 2,
    `careerPayload key limit (${ruleMaxKeys}) must accommodate CareerSaveData keys (${actualKeyCount} + optional fields)`
  );
});
