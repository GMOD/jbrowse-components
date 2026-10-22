---
name: launch-args
description: "One command-line grammar for jbrowse-img, jb2capture and JBrowse Desktop, in @jbrowse/launch-args. Landed: bare data files, the shared ADR-077 format table, Desktop opening 'jbrowse-desktop ref.fa reads.bam --loc ...', --genome, --view (view settings by their session-spec names), format-family track flags, batch --sites, genome modifiers in place of --aliases/--cytobands, jb2capture on the shared grammar (track settings, --view, data files refused), jb2export's read filter through the launch snapshot, Desktop opening synteny and dotplot views in jb2export's comparative grammar. Open: display-specific modifiers in Desktop and capture (both take height:, force:, slot writes and JSON), what of img's write path can still leave its live view, comparative views on hosted genomes."
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
  - `comparative.ts`: the comparative grammar both apps run
    (`buildComparative`, `syntenyTrack` and its query/target table)
  - `launchPlan.ts` (Desktop's plan), `genome.ts` (`--genome` URLs),
    `trackIds.ts` (`--track` lookup, node-free, the `./trackIds` subpath)
- Desktop: `electron/launchTarget.ts` (`findLaunchTarget`),
  `electron/electron.ts` (single-instance lock data, open-file),
  `src/components/StartScreen/launchFromLink.ts` (`launchFromPlan`).
- jb2capture: `args.ts` tokenizes with `parseArgv`/`standardizeArgv`, writes
  `--track id height:200` through `trackSettings` and `--view` through
  `viewSettings`; `url.ts` sends either as a one-view session spec and keeps
  the URL parameters otherwise. `resolveTrackId` runs against the config
  capture already fetches. Display-specific modifiers throw there, naming
  jb2export.
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

- **jb2capture drives the released instance of its own version**, so a spec key
  renamed on main fails against the instance a published capture loads until
  both ship together.
- **jb2capture cannot open data files.** file:// fails for workers, and a
  loopback server hits Chrome's local-network-access checks; it refuses a bare
  file or a track-file flag naming jb2export and Desktop.

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

1. **Display-specific modifiers in Desktop, then capture.** Desktop applies `trackSettings`
   and reports `color:`, `featureHeight:`, the read filters, `sort:` and member
   writes as not applied. Run img's translator (`buildDisplaySnapshot`) in
   Desktop's renderer, where `launchFromPlan` has the plugin manager (for
   `trackDisplayType`), and have the plan carry each track's modifiers instead
   of `unapplied` strings. The read filter needs no merge of its own: the
   alignments `filter` is a config namespace, so a spec entry's `filter` merges
   into the configured one member by member. Only `filterTag:`'s `tags` (a
   list, written whole) and member writes into a channel (`color.field=`) need
   the configured value, which img reads after the open. Capture has no plugin
   manager in node, so its route is the same translator inside the page, or a
   spec key the app resolves.
2. **img renders through `loadSessionSpec`**: mostly declined. A spec track
   entry and `applyDisplayOpts` already meet at `view.launchTrack(trackId, {},
   snapshot)`, and the read filter rides in on that snapshot. What stays:
   - `loadSessionSpec` itself: its `setSession` replaces the session a
     `--session` or `--defaultSession` supplied.
   - the LGV launch blob's `tracks`: `sort:` takes its pivot from the view
     centre after navigation, and the blob opens its tracks straight after
     navigating.
   - `writeMembers` and the tag append, until something reads a track's
     configured display before the open. Core's `resolveTrackDisplayChoice`
     holds that logic (display pick, stub displays, `displayDefaults`), needs
     a view, and is not exported.
   - `navToLocOrGene`, the refseq and highlight steps, and the read-backs
     (links, alt counts, manifest).
   - Breakpoint panels still write `filterTag:` over the configured tags,
     where a linear view adds to them.
3. **Comparative views on hosted genomes.** Desktop and jb2export stack
   genomes built from files only; `--genome hg38 --genome mm39 --chain ...`
   (or a `--config` holding both) has no grammar yet, and jb2export reaches a
   config's comparison tracks only through `--spec`.

## Comparative grammar decisions (2026-10-21)

- Both apps run launch-args' `comparative.ts`, which replaces jb2export's
  `comparativeArgs.ts` and `makeSyntenyTrackConfig`. The comparison
  adapter comes from the format table (ADR-077); the query/target orientation
  is a table keyed by adapter type.
- With no subcommand word, a second genome or a comparison file opens a
  synteny view. It stacks any number of genomes where a dotplot takes two, so
  it draws every command line; `dotplot` (or `synteny`, `lgv`) as the first
  word, jb2export's words, picks the view.
- Bare files open one too: `a.fa a_b.paf b.fa` reads as the flagged form,
  since the format table already types a FASTA as a genome and a `.paf` as a
  SyntenyTrack. jb2export takes them the same way.
- `LaunchPlan` is a union on `type`: `LinearLaunchPlan` (config, one
  assembly, show) and `ComparativeLaunchPlan` (assemblies, `views` rows,
  comparison tracks). Desktop reports a comparative plan's track files,
  `--loc` and `--track` as not applied, and refuses `--genome`/`--config`.
- A comparison file takes `name:` and throws on any other modifier. An
  MCScan file throws, since it needs each genome's BED.
- A lone `--chromSizes` opens a linear view in both apps.
