import { capitalizeFirst } from '@jbrowse/core/util'

import type { TagQuickPick } from '@jbrowse/core/ui'

// The two tags that are near-universal across aligners and almost always what
// people group, color, sort or filter by. Deliberately short — the tag dialogs
// still accept any tag, so this is a convenience, not a whitelist.
//
// The noun is held lower-case because it also lands mid-label, in the read
// context menu's "Filter for this haplotype (HP:1)" rows; the chip row
// capitalizes through `capitalizeFirst`, the same split the sort menu's `noun`
// option makes. One list rather than two, so a third tag is one entry.
export const COMMON_READ_TAGS = [
  { tag: 'HP', noun: 'haplotype' },
  { tag: 'RG', noun: 'read group' },
]

export const COMMON_READ_TAG_PICKS: TagQuickPick[] = COMMON_READ_TAGS.map(
  ({ tag, noun }) => ({ tag, label: capitalizeFirst(noun) }),
)
