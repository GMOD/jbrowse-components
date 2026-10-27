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

1. **The last beta-only lifts.** The 2026-10-27 sweep deleted every other one;
   these four wait on a writer:
   - MAF adapters' `annotationAdapter`: the hosted genark `mouseStrains`
     configs carry it until jb2hubs regenerates them.
   - Facet and rows `domain` → `sort`: jb2hubs' `bovine-arsucd12.json` and
     `arabidopsis-tair10.json` pangenome configs write it.
   - `retiredDisplayColor`/`liftFlatColor`: no carrier found in local or
     hosted hub configs; it goes with `liftViewColor`, a view key.
   - The synteny view keys' `cigarMode`, beta-only.
2. **Conformance suite.** _Claimed 2026-10-27 (`color-conformance`)._ `scripts/slotNames.test.ts` refuses a new `show*`,
   `hide*`, `min*` or `max*` slot outside its allowlist. Left: empty
   `colorConformance.test.ts`'s `EXCEPTIONS`, or document each entry as
   intended on the config page.
3. **Generate the writers.** _Claimed 2026-10-27 (agent worktree)._ The jbrowse-img modifier tables, the `jb`
   surface description and the R export lag every rename because hand-kept
   copies drift. Derive each from the schema.
4. **v4.3.0 validate gaps.** _Claimed 2026-10-27 (`color-conformance`)._ `reference/V4_CONFIG_COVERAGE.md` holds the
   count and the unmapped spellings. Every v4.3.0 config opens in the app;
   `jbrowse validate` fails 14 of 34 files, mostly on keys v4.3.0 never
   declared. Left:
   - Validate resolves a retired display type's old name without running its
     `migrate`, so `LinearArcDisplay.renderer` still fails.
   - `test_data/yeast_synteny/config.json` and
     `test_data/config_synteny_grape_peach.json` write the flat synteny
     `tracks` layout, now a warning; move them to `levels[0].tracks`.
   - Lifts that keep a color or height, ranked last: multi-variant `colorBy`
     to `rowColor`, session `trackDisplayMode` to `displayMode`, session
     `snpCovHeight` to `coverage.height`.
5. **Writers outside the tree.** _Claimed 2026-10-27 (agent, jb2hubs/JBrowseR/ggjbrowse)._ jb2hubs and its hosted configs, the ggjbrowse
   pin, the graph plugin, the `apollo3` demo and the figure specs
   (`handoffs/screenshot-spec-elegance.md`). Known stale spellings:
   - jb2hubs: `hubtools/src/enhanceConfig.test.ts` writes `scales.y`, plus
     the two writers in step 1.
   - JBrowseR: `README.Rmd`, `vignettes/JBrowseR.Rmd` and
     `vignettes/articles/live-browser.Rmd` write `scales = list(y = …)` on a
     `LinearMarkDisplay`, now `encoding.y`; its bundled htmlwidgets need a
     re-pin.
   - ggjbrowse: re-pin the bundled `inst/js/jbrowse-tables.js`.
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
