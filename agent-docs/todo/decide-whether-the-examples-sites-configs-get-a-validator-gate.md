---
name: decide-whether-the-examples-sites-configs-get-a-validator-gate
description: the file is fixed; what is open is the copy and where a gate lives
metadata:
  area: embedded, config
  category: ready
---

# Decide whether the examples sites' configs get a validator gate

The react-app site's `volvox-config.json` is fixed — it was a copy forked before
the config migration, and its eight pre-slot spellings (`pileupDisplay`,
`renderers`, singular `renderer`, `get(feature,'x')` jexl, the
`showLabels`/`showDescriptions` pair) each loaded, appeared and silently did
nothing. Each block took the canonical config's own value for the same trackId;
`lollipop_track` went with it, following `fb1fd404b3`.

Two things did not get decided, and they are the entry:

- **Should it be a copy at all.** Nothing regenerates it from
  `test_data/volvox/config.json`, so it can fork again the same way, silently.
- **Where the check lives.** The lineargenomeview site's generator refuses to
  write an invalid config (`gen-nextstrain-demos.mjs`, `assertConfigValid`); this
  site has no generator. Doing every site at once means
  `runExamplesSiteChecks` (`@jbrowse/browser-test-utils`), which would put
  `@jbrowse/cli` in all four sites' installs for one function — weigh that
  against two fixtures.

Note the validator's two remaining errors on that file are **not** bugs to fix:
`wombat` is the deliberate `volvox_wrong_assembly` fixture and `volvox_del2` is
missing in the canonical config too, so both are inherited rather than drift. A
gate has to exempt them, which is its own small design question. Nor are the two
surviving `"showLabels": "auto"` reads in that file drift: that is the current
slot name under a current value, so nobody should "fix" those either.
