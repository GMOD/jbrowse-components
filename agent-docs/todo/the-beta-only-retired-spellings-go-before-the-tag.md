---
name: the-beta-only-retired-spellings-go-before-the-tag
description: Four retired config spellings lift names only a v5 beta wrote (`linkedReads` on the alignments display, `useColorPercentile` on Hi-C, `displayCrossHatches` and `minimalTicks` on the mark display), and a spelling that ships in 5.0.0 is one the 5.x line has to keep loading. Delete them before the tag, after a last grep of the hosted configs.
metadata:
  area: config
  category: ready
  order: 1
  first_move: "grep `~/src/jb2hubs/hubs` and `~/src/JBrowseR` for `linkedReads`, `useColorPercentile`, `displayCrossHatches` and `minimalTicks`; where none writes one, delete the `linkedReads` entry in `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts`, the `useColorPercentile` entry in `plugins/hic/src/LinearHicDisplay/configSchema.ts` and `retiredAxisSpellings` from the mark display's `retired` in `plugins/marks/src/LinearMarkDisplay/configSchema.ts`, then `pnpm autogen`"
---

# The beta-only retired spellings go before the tag

A `retired` entry (ADR-171) keeps a config that spells a setting the old way
loading. It earns its place where a shipped release wrote the name, since
other people hold those configs and share links. Three entries lift names no
release shipped:

- `linkedReads` on `LinearAlignmentsDisplay`, the v5 betas' spelling of `unit`.
- `useColorPercentile` on `LinearHicDisplay`, the betas' spelling of
  `color.domainQuantile`.
- `displayCrossHatches` and `minimalTicks` on `LinearMarkDisplay`, through
  `retiredAxisSpellings`. v4.3.0 wrote both on the wiggle displays, which keep
  the lift; the mark display is new in v5.

`git grep` over the `v4.3.0` tag finds none of the three on those displays,
and jb2hubs' generator and JBrowseR write none of them (checked 2026-10-07).

## Why before the tag

A config written against 5.0.0 is one every later 5.x has to load, so a
spelling still lifted at the tag is permanent. Until then a beta config
carrying one loses that setting with a console line naming the key (ADR-217),
and nothing else.

## What stays

The wiggle display's `retiredAxisSpellings`, and every lift of a v4 name.
`scripts/generateConfigManifest.ts` reads `retired` off the schemas, so the
validator's list of legacy keys follows the deletion with `pnpm autogen`.
