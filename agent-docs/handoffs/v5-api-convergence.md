---
name: v5-api-convergence
description: "How the v5 API surface settles without a freeze date: a conformance suite, a settling meter, and which compat shims stay. Read before respelling a setting, amending ADR-238, or cutting a release candidate."
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
- **Beta share links and display state may break**, with no migration, except
  that a retired display type a beta session names stays declared, so the
  session still loads (Colin, 2026-11-03, keeping
  `LinearMultiSampleVariantDisplay`: "we still need to load old snapshots from
  sessions").
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
[reference/CONFIG_SPELLINGS.md](../reference/CONFIG_SPELLINGS.md) is today's
surface on one page, its first table each shared path whose members differ
between displays.

- 2026-10-15 to 10-26 net: +1754 / −979 shared, +168 / −79 mark display.
  10-22 alone moved about 3000 paths each way in one sub-schema move.
- 2026-10-30 to 11-05 net: +279 / −319 shared, +30 / −17 mark display, 11-02
  most of it; 11-03 and 11-04 +31 / −4 shared, 11-05 none.
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
   main's spellings. ggjbrowse tags its releases on GitHub from v0.10.0
   (2026-10-30, CONTRIBUTING.md's Releases), and the wiggle display's beta
   `extent` lift went with that tag.
   - ggjbrowse's closed-schema bundle drops an old key silently, so every
     rename, and every new key, needs an engine re-pin, an R respell and a
     tutorial re-knit (memory `a-config-rename-reaches-ggjbrowse`). The
     engine now re-pins to main commits (`bccd4b0d5b` on 2026-11-05,
     ggjbrowse `fc2f1e7`), and the downstream canary runs ggjbrowse on every
     push to main (`.github/workflows/downstream-canary.yml`), so a rename
     that misses R goes red there on push. `dog10k_lof` keeps its
     `557791197f` knit until the callset host's certificate is renewed.
   - jb2hubs checks its configs against v4.3.0, v5.0.0-beta.20 and `main`
     (`HOST_VERSIONS`, `jb2hubs/scripts/checkConfigCompat.mjs`). Its Trix
     adapters keep writing `textSearchAdapterId`, which v4.3.0 needs to boot
     and v5 retires; the merge lambda dedupes them by resolved `ixFilePath`.
   - In-tree writers fail loudly on a dead key: `pnpm check-specs` (in
     `website/`) for figure specs, `pnpm verify --full` and the pre-commit
     config check for tutorials and `demos/`. A jexl filter trips none of
     them; the jexl filters left are negations, arithmetic and function
     calls.
2. **Plugin ABI.** The served list leaves out render-core's shader subpaths.
   `@jbrowse/tables` and `@jbrowse/launch-args` ship with v5 at its version,
   betas included (Colin, 2026-10-27). Left: baseline
   `reExports.generated.json` and the exports map at the release candidate
   (`reference/PLUGIN_ABI_STABILITY.md`).
3. **Plugin displays are checked only with a plugin manifest.**
   `scripts/generateConfigManifest.ts --plugin <esm bundle> --out <file>`
   (`--umd-plugin` for a UMD bundle) loads a plugin's built bundle beside
   core, as the browser does, and
   writes the types it adds with their slots and schema definitions;
   `jbrowse validate --plugin-manifest <file>` then checks them as it checks
   core's. On the graph plugin (2026-10-30) it found two things core's
   warnings hid: `LinearGraphDisplay.facet` is `frozen`, so the old
   `facet.domain` respelling passes unread, and `RgfaTabixAdapter`'s
   `coarse.uri` and `coarse.format` are shorthand its normalizer applies to
   the nested object, which no probe sees, so they report as unknown slots.
   On 2026-11-06 it ran on the graph plugin 8.8.0, the ARG plugin and
   Apollo3's `v2` branch (UMD; its `.esm.js` imports bare `@jbrowse/*`, the
   npm form). The graph plugin (8.9.0) and the ARG plugin (`94085aa`) then
   moved their floor and pins to beta.20 and write main's spellings, clean
   under main's validator with their manifests (Colin, 2026-11-06: plugins
   target the latest beta). Apollo's `jbrowse_config.json` carries `google`
   and `microsoft` blocks its internet account never declares; it is a
   coworker's repo, so that waits on him. A manifest generated on main does
   not load in beta.20's CLI (`can't resolve reference
   #/$defs/LGVSyntenyDisplaySlots/properties/tooltip`): generate with the
   tree whose validator reads it. Left: plugin urls (local files only), a way
   for a plugin's own CI to run the generator without a jbrowse-components
   checkout, and where each plugin keeps its manifest.
4. **Member differences left as taste.** CONFIG_SPELLINGS.md's first table
   holds them, each ruled in ADR-238, ADR-240 or the schema's own comment,
   or left by Colin (2026-10-30: the chord and matrix ramps and wiggle's key
   direction).

## Release candidate gates

- The meter shows no shared-path change since the last respell landed.
- Every `retired` entry maps a name a v1–v4 release declared, none a
  beta-only one, except a display type a beta session names (the rule above).
  No test checks the gate, since v4 shipped no JSON schema and
  so `scripts/check-config-slot-paths.ts` has no v4 baseline. A `git grep -w <key>
  v4.3.0` over the legacy keys in `website/static/schema/v5/config.json` finds
  six missing from v4.3.0 on 2026-10-27, each from an earlier release, so
  the check greps every v1–v4 tag. Rechecked 2026-10-30 over every retired
  top-level key: none is beta-only once `LinearWiggleDisplay.extent` went
  with ggjbrowse v0.10.0. v1.3.1–v1.3.5 declared
  `textSearchIndexingAttributes`, and desktop's open-sequence dialog wrote
  `cytobandsLocation` from v2.10.0 through v4.3.0, so both stay.
- `jbrowse validate` reports no warning outside plugin-registered types on
  hosted configs, `demos/` and the tutorials (step 3). On an adapter that
  derives no `svType`, validate reads `svtype` as the file's own column, so
  the gnomAD-SV bigBeds no longer warn. `demos/` held on 2026-10-30.
- The v5 release draft and the schema use the same spellings, including the
  word "experimental" for `LinearMarkDisplay`. Held on 2026-10-30: the draft
  quotes no retired key, and the display's config page and guide say
  experimental.
- The v5 changelog draft
  (`website/release_announcement_drafts/v5.0.0.changelog.md`, which
  `release.ts` prepends to `CHANGELOG.md`) reaches main. Sessions edit it as
  features land; a sweep at the release candidate adds what never got a line
  and moves its `changelog-through` marker, which `check-release-drafts.ts`
  counts from (swept through c329ae816d on 2026-10-30). The migration
  table it can point at is generated
  (`website/docs/config_guides/v4_config_migration.md`).
