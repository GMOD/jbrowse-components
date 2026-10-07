---
name: the-5-0-0-schema-is-the-slot-path-baseline
description: The published config schema at `https://jbrowse.org/jb2/schema/v5/config.json` is regenerated from main on every deploy, so after 5.0.0 a slot renamed or removed without a `retired` entry leaves the URL and a 5.0 config stops validating and loses the setting, with no gate saying so. Freeze the tag's slot paths as a baseline and have `pnpm autogen --check` refuse a missing one that no `retired` entry covers.
metadata:
  area: config, release
  category: ready
  order: 2
  first_move: "write the checker beside `scripts/configJsonSchema.ts`: walk `website/static/schema/v5/config.json` into one line per slot path (`LinearWiggleDisplay.scales.y.domainMin`), compare against a committed baseline file, and accept a missing path only where the owning schema's `retired` map names its first segment; wire it into `scripts/autogen.ts` with the baseline empty, then fill the baseline from the schema at the 5.0.0 tag commit"
---

# The 5.0.0 schema is the slot-path baseline

`pnpm autogen` writes `website/static/schema/v5/config.json` from the live
config schemas (ADR-120), and the website deploy publishes whatever main holds
at `https://jbrowse.org/jb2/schema/v5/config.json`. Every `v5` config that
names `$schema` validates against that one URL, whichever 5.x wrote it.

Before the tag that is harmless: v5 breaks configs freely, and the 2026-10-07
grammar audit renamed slots on eight displays in a day. After it, the same
rename is a silent break twice over. The app draws the track without the
setting and names the key on the console (ADR-217), and the published schema
stops listing the path, so an editor flags a config that was valid the day it
was written.

## The guard

A committed list of the slot paths 5.0.0 shipped, and a check under
`pnpm autogen --check` that each is still declared or is lifted by a `retired`
entry on the schema that owned it. A path can be added freely; one can leave
only by being retired, which is the rule ADR-171 already states and nothing
enforces. The enum half exists:
`products/jbrowse-web/src/schemaTests/ConfigSlotDefaults.test.ts` pins every
enum slot's vocabulary, and a dropped member shows there as a diff.

## Why at the tag

The baseline is the tag's schema, so it cannot be frozen earlier. The checker
can be written and wired in before then with an empty baseline, which leaves
one command to run on the release commit.
