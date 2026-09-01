// A guide whose title exactly matches another guide's needs a way to tell the
// two links apart — config_guides/hic_track.md and user_guides/hic_track.md
// are both titled "Hi-C track". Split out from autogen-links.ts (which needs
// astro:content, unavailable under jest) so this logic is unit-testable.

export interface CollidableDoc {
  id: string
  title: string
}

// A human label for a guide directory, used only to break a title collision
// between two guides that document the same thing from different angles.
// Never applied outside a collision, so an uncontested guide keeps its plain
// title everywhere.
export function guideDirLabel(dir: string): string {
  const labels: Record<string, string> = {
    user_guides: 'User guide',
    config_guides: 'Config guide',
    developer_guides: 'Developer guide',
    tutorials: 'Tutorial',
  }
  return labels[dir] ?? dir
}

function topDir(id: string): string {
  return id.split('/')[0]!
}

// doc id -> disambiguating label, for every doc whose title collides with
// another doc's among the non-autogen (guide) docs. A doc with no collision
// has no entry. `autogenDirs` (config/models/api) is excluded: those
// reference pages already disambiguate a shared type name through
// typeNameToUrl and their own "Kind:" related-links convention.
export function collisionLabels(
  docs: CollidableDoc[],
  autogenDirs: ReadonlySet<string>,
): Map<string, string> {
  const guideDocs = docs.filter(d => !autogenDirs.has(topDir(d.id)))
  const titleCounts = new Map<string, number>()
  for (const d of guideDocs) {
    titleCounts.set(d.title, (titleCounts.get(d.title) ?? 0) + 1)
  }
  const labels = new Map<string, string>()
  for (const d of guideDocs) {
    if ((titleCounts.get(d.title) ?? 0) > 1) {
      labels.set(d.id, guideDirLabel(topDir(d.id)))
    }
  }
  return labels
}
