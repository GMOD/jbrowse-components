---
name: v5-api-convergence
description: "How the v5 API surface settles: no freeze date and no calendar window, a conformance suite and a settling meter, beta-only compat shims deleted, v4.3.0 configs loading where a mapping exists, and `LinearMarkDisplay` allowed to keep evolving. Read before respelling a setting, amending ADR-238, or cutting a release candidate."
---

# v5 API convergence

- **In:** the config slots, session spec, jbrowse-img and `jb` arguments, and
  plugin ABI that v5 ships.
- **Out:** a surface that stops changing once the work is done.

Claim a step here before starting it.

## Rules

- **No freeze date and no quiet window.** Churn continues while a rename still
  improves the surface. The release candidate waits on the gates below, which
  close when the work does, not on a calendar.
- **A respell is a complete sweep.** One change updates every display, the
  docs, the figure specs and each writer. A partial respell leaves the next
  session a divergence to fix.
- **Beta share links and display state may break.** No migration exists for
  them.
- **v4.3.0 configs load where a mapping exists.** An edge-case slot may drop
  with a warning naming it.
- **Built-in display types converge as far as they can.** The shared
  vocabulary (`encoding`, `scale`, `legend`, `axis`, `filter`, parts with
  `show`) is the surface that settles.
- **`LinearMarkDisplay` may keep evolving.** Its own words (`marks`, the
  transform steps, facet bands) change additively, and a mark-display change
  never respells a shared-vocabulary slot.
- **Review rounds test conformance.** A taste item goes to `ideas/`.

## Measuring churn

`node scripts/settling-meter.ts [--days 30]` prints the config slot paths the
committed schema gained and lost per day, shared and `LinearMarkDisplay` apart,
with a net line; `--list <day>` names them. One shared sub-schema change counts
once per display that embeds it, so read the trend, not the size.

- 2026-10-15 to 10-26 net: +1754 / −979 shared, +168 / −79 mark display.
  10-22 alone moved about 3000 paths each way in one sub-schema move.
- Stable already: CLI commands and flags, session-spec format, registered type
  names, the MCP tool set.

## Next

1. **Delete the beta-only shims** (claimed 2026-10-27, agent branch). Remove
   each `retired*`/`lift*` entry whose spelling never shipped in v4.3.0 (or in
   the v4-era `jbrowse-plugin-mafviewer`). Keep those that map a shipped
   spelling.
2. **Conformance suite.** `scripts/slotNames.test.ts` refuses a new `show*`,
   `hide*`, `min*` or `max*` slot outside its allowlist. Left: empty
   `colorConformance.test.ts`'s `EXCEPTIONS`, or document each entry as
   intended on the config page.
3. **Generate the writers.** The jbrowse-img modifier tables, the `jb`
   surface description and the R export lag every rename because hand-kept
   copies drift. Derive each from the schema.
4. **v4.3.0 validate gaps.** `reference/V4_CONFIG_COVERAGE.md` holds the
   count and the unmapped spellings. Every v4.3.0 config opens in the app, but
   `jbrowse validate` fails 17 of 34 files, mostly on keys the app accepts:
   - Give the Trix adapter dropped entries for `textSearchAdapterId` and
     `metaFilePath`, which every v4 `jbrowse text-index` run wrote.
   - Teach validate the lifts it misses: `minorAlleleFrequencyFilter`, the
     session's flat `LinearSyntenyView.tracks`, and the dropped
     `LinearGCContentDisplay`.
   - Lifts that keep a color or height, ranked last: multi-variant `colorBy`
     to `rowColor`, session `trackDisplayMode` to `displayMode`, session
     `snpCovHeight` to `coverage.height`.
5. **Writers outside the tree.** jb2hubs and its hosted configs, the ggjbrowse
   pin, the graph plugin, the `apollo3` demo and the figure specs
   (`handoffs/screenshot-spec-elegance.md`).
6. **Plugin ABI.** Curate the served list so internals nobody reads (shader
   constants) stop reaching plugins. Baseline `reExports.generated.json` and
   the exports map at the release candidate
   (`reference/PLUGIN_ABI_STABILITY.md`). Decide whether `@jbrowse/tables` and
   `@jbrowse/launch-args` ship at 5.0.0 or 0.x.

## Release candidate gates

- The meter shows no shared-path change since the last respell landed.
- Every `retired` entry maps a v4.3.0 name.
- `jbrowse validate` reports no warning on hosted configs, `demos/` and the
  tutorials.
- The v5 release draft and the schema use the same spellings, including the
  word "experimental" for `LinearMarkDisplay`.
- A migration page generated from the `retired` maps exists, and CHANGELOG has
  a v5 section.
