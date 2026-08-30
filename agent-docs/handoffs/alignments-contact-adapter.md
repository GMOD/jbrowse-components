---
name: alignments-contact-adapter
description: AlignmentsContactAdapter — computes Cue's four contact channels from a BAM/CRAM in a worker, so a Hi-C track needs no precomputed .hic. Written and tested on sv-contact-maps-tutorial, off a main 482 commits back; unrebased and unlanded.
---

# AlignmentsContactAdapter

The `sv_contact_maps` tutorial landed on 2026-08-30 without its last section.
That section taught the live route — four Hi-C tracks over one BAM, no `.hic`
built and nothing hosted — and the adapter it named is not in the tree.

## Where the code is

Branch `sv-contact-maps-tutorial` (also `origin/sv-contact-maps-tutorial`),
five commits between `f1116f9e0c` and `bdc0d0f2c2`:

| commit | what |
| --- | --- |
| `bc3a2313ed` | the adapter, its channel classifier, and three test files (~1200 lines) |
| `f2f38a6422` | regenerated manifests and `website/docs/config/AlignmentsContactAdapter.md` |
| `e40a94e459` | the `depthDifference` cap in `getHeader`, exact mate refName |
| `08e1c2c538` | comment pass |
| `35fef90f57` | the link from `HicTrack.md` |

`bc3a2313ed` also touches `HicAdapter.ts`, `executeRenderHicData.ts` and the
RPC's `types.ts` — the Hi-C render path had to accept a header the adapter
computes rather than reads.

## What it costs to land

The branch forks at `cf01732bae`, 482 commits behind main. Rebase it, don't
replay it: this worktree was a replay of the same thread and it silently lost
two of Colin's own corrections along with these five commits.

Regenerate rather than merge `configManifest.generated.ts` and
`trackTypes.generated.ts` — `pnpm autogen`. `ConfigSlotDefaults.test.ts.snap`
grows six lines, and per `configslotdefaults-goes-stale-unnoticed` that snapshot
does not fail loudly when it drifts.

## Restoring the tutorial section

`git show sv-contact-maps-tutorial:website/docs/tutorials/sv_contact_maps.md`
holds the section verbatim — `## Without the
preprocessing`, between `## Back to the reads` and `## Reproduce it end to end`.
Its `json addtrack` block names `channel`, `minSpan`, `binSizes` and a
`subadapter`; check those against the config schema as landed, because
`check-config-blocks` passes an unknown adapter type straight through and so
proved nothing about that block on either branch.
