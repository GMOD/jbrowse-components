---
name: launch-args
description: "One command-line grammar for jbrowse-img, jb2capture and JBrowse Desktop, in @jbrowse/launch-args. Landed: bare data files, the shared ADR-077 format table, Desktop opening 'jbrowse-desktop ref.fa reads.bam --loc ...', --genome, --view (view settings by their session-spec names), format-family track flags, batch --sites, genome modifiers in place of --aliases/--cytobands. Open: display-specific modifiers in Desktop (it takes height:, force:, slot writes and JSON), img rendering through loadSessionSpec, jb2capture on the shared grammar, comparative views from Desktop."
---

# Launch arguments: one grammar for img, capture and Desktop

Started 2026-10-20 (GMOD/jbrowse-components#4303). The goal is docs that can
say "do this with jb2export, and launch Desktop the same way". None of the
packages is released, so breaking changes are fine.

## Where it lives

- `packages/launch-args/src/`:
  - `parseArgv.ts`: the tokenizer with the bare-file rule, and
    `standardizeArgv`, which owns the one-value rule (a repeat or a stray
    value throws) and joins `--loc`'s regions
  - `fileInput.ts`: file-to-config building through the add-track format table,
    the format-family track flags, and `genomeAssembly` (a genome file with its
    `aliases:`/`cytobands:`)
  - `slotPath.ts`: `path=value` writes, and `viewSettings` for `--view`
  - `trackSettings.ts`: the modifier-value parsers both apps use, and
    `trackSettings`, the settings a track's modifiers write on every display
    type (`height:`, `force:`, whole-setting slot writes, JSON), which Desktop
    puts on the spec's track entries
  - `launchPlan.ts` (Desktop's plan), `genome.ts` (`--genome` URLs),
    `trackIds.ts` (`--track` lookup, node-free, the `./trackIds` subpath)
- Desktop: `electron/launchTarget.ts` (`findLaunchTarget`),
  `electron/electron.ts` (single-instance lock data, open-file),
  `src/components/StartScreen/launchFromLink.ts` (`launchFromPlan`).
- jb2export: `readData.ts` builds the genome with `genomeAssembly` and tracks
  with `fileTrack`; `addLaunchView` in `renderRegion.ts` writes `--view` over
  every view it opens.

## Grammar decisions (2026-10-21)

- View settings are `--view` slot writes on the session spec's view object
  (`mark.interpolate=bump`, `filter.0.field=length`, JSON), replacing
  `--drawCurves`, `--minAlignmentLength`, `--colorBy`, `--opacity`,
  `--levelHeights`, `--cigarMode` and `--autoDiagonalize`.
- `--showGridlines` and `--trackLabels` stay: they are the export's options, the
  ones the app's Export SVG dialog has, not view settings.
- A track flag names a format family (`--vcf`, `--gff`, `--bed`); a `.gz` name
  or `index:` picks the tabix adapter.
- batch reads `--sites <file>`, a VCF or a `.bedpe`, typed by name.
- Cut: `--fasta2`/`--loc2`/`--aliases2`, `--aliases`/`--cytobands` (genome
  modifiers instead), `--assembly <json file>` (`--config` instead), the
  `properPairs:` refusal. An unknown track modifier throws.

## Traps

- **Chromium reorders a second launch's argv** in the `second-instance` event,
  switches first. The second instance sends its own `process.argv` and cwd as
  `requestSingleInstanceLock` data; `forwardedLaunch` reads it.
- **Unknown flags in Desktop's argv are Chromium or Electron switches**, which
  take values after `=`; `launchArgs` drops them before parsing, or a switch
  swallows the file after it. A jb2export-only flag goes with its value and the
  modifiers after it, all reported.
- **jb2export's integration tests run the built `esm/`** of every workspace
  package; a stale `packages/launch-args/esm` fails them with errors that look
  like real bugs. `pnpm build:esm` in `products/jbrowse-img` first.
- **A synteny figure's off-screen mate labels antialias differently between two
  checkouts of the same commit** (about 450 px on `yeast_synteny`). A baseline
  shoot run inside the branch's checkout matches; compare there.

## Next, in order

1. **Display-specific modifiers in Desktop.** Desktop applies `trackSettings`
   and reports `color:`, `featureHeight:`, the read filters, `sort:` and member
   writes as not applied. Run img's translator (`buildDisplaySnapshot`) in
   Desktop's renderer, where `launchFromPlan` has the plugin manager (for
   `trackDisplayType`) and the config (for the configured filter a modifier
   merges into), and have the plan carry each track's modifiers instead of
   `unapplied` strings. ADR-238 does not remove the merge: a written `filter`
   list replaces the default one, so `mapq:30` is the default list plus one
   predicate.
2. **img renders through `loadSessionSpec`** for the half that writes settings.
   img still reads links, alt counts and the manifest back off the drawn view,
   and a gene-name `--loc` must stay on `navToLocOrGene`, since a search with
   several hits opens a picker nothing answers headless.
3. **jb2capture on the shared grammar.** launch-args depends only on
   add-track-core, which has no dependencies, so capture can take it on. Its
   strict `parseArgs` rejects modifiers today, and it drives a pinned released
   instance, so a renamed key fails on an older one. Local files still need
   serving to its browser (file:// fails for workers; a loopback server hits
   Chrome's local-network checks).
4. **Comparative views from Desktop's command line** (`--fasta` twice, `--paf`):
   jb2export's `comparativeArgs.ts` has the grammar; Desktop's plan builds one
   linear view.
