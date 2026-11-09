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

- The last respell is `encoding.y.scale.group` to `share` (3cc17821fb,
  2026-11-07, +6 / −6 shared, +1 / −1 mark display). The key was beta-only,
  no writer outside the tree spelled it, and ggjbrowse's engine pin includes
  it. No shared path changed from 11-08 through 11-09, v5.0.0-beta.21
  included.
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
     engine now re-pins to main commits (`77dab43537` on 2026-11-08,
     ggjbrowse `1c3cdfc`), and the downstream canary runs ggjbrowse on every
     push to main (`.github/workflows/downstream-canary.yml`), so a rename
     that misses R goes red there on push.
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
3. **Plugin types are checked only with a plugin manifest.**
   `scripts/generateConfigManifest.ts --plugin <esm bundle> --out <file>`
   (`--umd-plugin` for UMD), given a path or the url a config's `plugins`
   entry names, writes the types the plugin adds and the top-level keys its
   `rootConfigurationSchema` declares (MsaView's `msa`);
   `jbrowse validate --plugin-manifest <file>` checks them as core's.
   - Keep no manifest anywhere: generate it from the bundle url with the tree
     whose validator reads it, since a main manifest does not load in
     beta.20's CLI.
   - On 2026-11-08 every `demos/` config declaring a plugin (graph, MsaView,
     ARG, AlphaGenome, Protein3d, Apollo) validated clean against manifests
     generated from its declared urls; Apollo's session names a track the
     plugin creates at runtime.
   - Apollo's own `jbrowse_config.json` carries `google` and `microsoft`
     blocks its internet account never declares; a coworker's repo, so that
     waits on him.
   - A plugin's own CI running the generator without a jbrowse-components
     checkout waits on a plugin asking for it; none runs it today.
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
- `jbrowse validate` reports no warning on hosted configs, `demos/` and the
  tutorials, plugin types checked against manifests from step 3, but for a
  track a plugin creates at runtime. On an adapter that
  derives no `svType`, validate reads `svtype` as the file's own column, so
  the gnomAD-SV bigBeds no longer warn. `demos/` held on 2026-11-08
  (`scripts/validate-built-config.ts --schema-only`).
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
