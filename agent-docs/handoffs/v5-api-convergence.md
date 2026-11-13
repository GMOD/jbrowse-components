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
surface on one page, its first table each path whose members differ between
displays or a display's parts, with the ruling on each.

- The last shared-path change is two beta-only retired keys leaving the
  schema (2026-11-13, −2 shared): `LinearMafDisplay.rowHeight` and
  `LinearVariantDisplay.referenceDrawingMode`, which the retired-keys gate
  below refuses; v4's `referenceDrawingModeSetting` state lifts straight to
  `genotypes.reference.show`. Before it, 2026-11-12 added +12 shared and +3
  mark display, both by reusing a spelling already on the surface: the mark
  family's `tooltip { field, show }`, `LinearBasic`'s shape, on
  LinearManhattan, LinearMark and LinearMultiRowFeature and their tracks'
  `displayDefaults` (5bb04298e1, 3ca6aecf29), and ChordVariant's
  `fetchSizeLimit` and `forceLoad`, the shared gate fields (47dbf6b1a1).
  Before those, the alignments mismatch fade lost `scale.clamp`
  (2026-11-11, −2 shared: LinearAlignments and LGVSynteny), beta-only and
  written by no config, since every scale clamps (ADR-238).
  The last respell before it is `encoding.y.scale.group` to `share`
  (3cc17821fb, 2026-11-07, +6 / −6 shared, +1 / −1 mark display). The key
  was beta-only, no writer outside the tree spelled it, and ggjbrowse's
  engine pin includes it. No shared path was respelled from 11-08 through 11-09, v5.0.0-beta.21
  included, but one was added: `rows.annotations` (946afc33db), since moved
  from the shared row arrangement to `Rows`, so MAF no longer declares it,
  and its entries reshaped as `RowAnnotation` with `legend.title`
  (ADR-260). An addition or a removal counts as a shared-path change, as a
  respell does, and is listed here.
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
   - The 2026-11-12 keys (the mark family's `tooltip`, the chord gate's
     `fetchSizeLimit` and `forceLoad`) owe ggjbrowse nothing: it draws static
     images, where neither a hover nor a fetch gate acts, and no R code or
     tutorial writes them. The canary passed on 4e00334d6b, which holds them.
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
   holds each path the displays share, each channel under a part's
   `encoding` and each part's `facet`, `tooltip`, `labels`, `mark` and
   `placement`, compared with the display's own. Any other word under a part
   meets only the same full path on another display.
   `scripts/configSpellingRulings.ts` names the ADR or schema comment ruling
   on each path, with its variant count, and `pnpm autogen` refuses a
   differing path with no entry or a changed count. The 2026-10-30 taste
   calls are among them (ChordColor's `scale`, HicColor's and LDColor's
   `scale`, WiggleColor's `legend`). The page's "Open differences" list holds
   the ones with no ruling.

## Release candidate gates

- CONFIG_SPELLINGS.md's "Open differences" list is empty, each entry ruled
  as kept or respelled, and the first table's rows are re-read against their
  whys since the last read: `git diff <sha> --
  agent-docs/reference/CONFIG_SPELLINGS.md` (read through 4e00334d6b,
  2026-11-13; whoever re-reads moves the sha). The count pin passes a
  display that moves between two existing variants and a variant whose
  members change in place.
- The meter shows no shared-path change, respell, addition or removal, past
  the last one "Measuring churn" lists.
- Every `retired` key, `retiredState` key and `retiredTypes` entry maps a
  name a v1–v4 release declared as that kind (config slot, display state,
  type), in the tree or in the last v4-compatible release of a plugin since
  folded in (jbrowse-plugin-mafviewer, jbrowse-plugin-gwas), checked in that
  plugin's repo. A word appearing in a tag is not a declaration: v4 spelled
  `referenceDrawingMode` as a renderer prop and a model getter, never a slot.
  Excepted: a display type a beta session names (the rule above). No test
  checks the gate, since v4 shipped no JSON schema and so
  `scripts/check-config-slot-paths.ts` has no v4 baseline; a check greps each
  key in every v1–v4 tag's config schemas (`git grep -w <key> <tag> --
  '*configSchema*' '*ConfigSchema*'`) and its state models. v1.3.1–v1.3.5 declared
  `textSearchIndexingAttributes`, and desktop's open-sequence dialog wrote
  `cytobandsLocation` from v2.10.0 through v4.3.0, so both stay. Rechecked
  2026-11-13 over the keys retired since 2026-10-30: two were beta-only
  and are gone (Measuring churn). The rest hold, the variant display's
  wiggle-scale keys (`maxScore`, `autoscale`, `scaleType` and the like)
  through v2.18.0–v3.x's `SharedVariantConfigSchema`, and every alignments
  state key `LGVSyntenyDisplay` lifts through a v4.3.0 alignments or wiggle
  model.
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
  counts from (swept through adce99d582 on 2026-11-09). The migration
  table it can point at is generated
  (`website/docs/config_guides/v4_config_migration.md`).
