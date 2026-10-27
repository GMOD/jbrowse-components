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
- Writers: jbrowse-img's modifiers and README, the `jb` copies and the R
  export's reader tables each have a test against the committed schema, so a
  respell that misses one fails there.
- Conformance: `scripts/slotNames.test.ts` refuses a new `show*`, `hide*`,
  `min*` or `max*` slot outside its allowlist, and each exception
  `colorConformance.test.ts` still lists is intended, its config page saying
  why.

## Next

1. **Writers outside the tree.** jb2hubs with its hosted configs and both
   genomes sites, JBrowseR, ggjbrowse (engine and tutorials re-knit), the
   graph plugin (`facet.sort` from bandage-core 12) and the figure specs write
   main's spellings. Left:
   - The hosted apollo3 demo runs the `v5.0.0-beta.8` build and serves an
     older config (`featureHeight`, `layoutOrder`). Move the pin and deploy
     `demos/apollo3/config.json` together, never the config alone.
   - The Trix `textSearchAdapterId`/`metaFilePath` keys in jb2hubs' GenArk and
     UCSC writers wait on the config-merger lambda deduping by `ixFilePath`.
2. **Plugin ABI.** The served list leaves out render-core's shader subpaths.
   `@jbrowse/tables` and `@jbrowse/launch-args` ship with v5 at its version,
   betas included (Colin, 2026-10-27). Left: baseline
   `reExports.generated.json` and the exports map at the release candidate
   (`reference/PLUGIN_ABI_STABILITY.md`).
3. **Plugin displays go unchecked.** `jbrowse validate` warns on each
   plugin-registered type and checks none of its slots, so a plugin display
   that respells a shared word (`facet`, `encoding`, `rows`) fails nowhere.
   The graph plugin's `facet.domain` survived core's rename to `sort` that
   way. Every warning `demos/` raises is one of these: `GraphTrack`,
   `ArgTrack`, `ApolloPlugin`.

## Release candidate gates

- The meter shows no shared-path change since the last respell landed.
- Every `retired` entry maps a name a v1–v4 release declared, none a
  beta-only one. No test checks the gate, since v4 shipped no JSON schema and
  so `scripts/check-config-slot-paths.ts` has no v4 baseline. A `git grep -w <key>
  v4.3.0` over the legacy keys in `website/static/schema/v5/config.json` finds
  six missing from v4.3.0 on 2026-10-27, each from an earlier release. Three
  `retired` entries appear in no release tag, so they are beta-only and break
  this gate: `CytobandAdapter.cytobandsLocation`, a track's
  `textSearchIndexingAttributes` and `LinearWiggleDisplay.extent`.
- `jbrowse validate` reports no warning outside plugin-registered types on
  hosted configs, `demos/` and the tutorials (step 3).
- The v5 release draft and the schema use the same spellings, including the
  word "experimental" for `LinearMarkDisplay`.
- CHANGELOG has a v5 section. The migration table is generated
  (`website/docs/config_guides/v4_config_migration.md`, 146 rows).
