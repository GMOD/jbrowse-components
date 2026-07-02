import type { TagQuickPick } from '@jbrowse/core/ui'

// One-click shortcuts for the two tags that are near-universal across aligners
// and almost always what people group/color by. Deliberately short — the free
// text field still accepts any tag, so this is a convenience, not a whitelist.
export const COMMON_READ_TAGS: TagQuickPick[] = [
  { tag: 'HP', label: 'Haplotype' },
  { tag: 'RG', label: 'Read group' },
]
