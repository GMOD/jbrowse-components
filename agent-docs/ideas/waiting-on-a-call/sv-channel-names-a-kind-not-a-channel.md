---
name: sv-channel-names-a-kind-not-a-channel
description: The `svChannel` read field bands `svSignal`'s evidence by the kind of SV it points at, but "channel" means an encoding channel everywhere else in the grammar (ADR-131, 173, 236), so `facet: { field: 'svChannel' }` reads as faceting by a channel. It is beta-only since 2026-11-02, so a rename now costs a spelling; after the 5.0.0 tag it costs a `retired` entry kept for good. The call is the name.
---

# `svChannel` names a kind, not a channel

Raised by the grammar-spelling review of the SV channels redesign
(2026-11-04), which otherwise kept every spelling: two fields (`svSignal`, the
yes/no evidence test the filter, the sort and the split view read, and
`svChannel`, its refinement into kinds), `{ field: 'svSignal', equal: true }`,
and the menu words "Presets" and "SV channels".

- **What reads wrong**: in the config grammar a channel is `encoding.color`,
  `encoding.y` and their kin, so a reader of `facet: { field: 'svChannel' }`
  meets a facet over a channel. The band labels never say "channel"; the
  preset's menu row does ("SV channels").
- **Candidates**: `svKind` (the ADR-258 table's own word, "the kind of SV it
  points at"), `svType` (collides with a VCF's `SVTYPE`, which these bands are
  read against). The menu row could stay "SV channels" or become "SV kinds";
  the row is a label, not a config word.
- **Cost now**: the field name in `readFieldLevels.ts`, `groupFeatures.ts`,
  `facetLabels.ts`, the preset, the sample-data link, two figure specs and
  four docs. No migration (beta-only state).
