// Loot: side valuables scattered through each floor. The diamond is the job;
// everything else is bonus score and next level's tool budget.

export function createLootItems(defs) {
  return defs.map((d) => ({ ...d, taken: false }));
}

export function collectLootItem(player, item) {
  item.taken = true;
  player.lootValue += item.value;
  player.lootCount += 1;
  return item.value;
}

export function createKeycards(defs) {
  return defs.map((d) => ({ ...d, taken: false }));
}
