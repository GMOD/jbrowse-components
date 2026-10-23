---
name: launch-args
description: "One command-line grammar for jbrowse-img, jb2capture and JBrowse Desktop, in @jbrowse/launch-args. Landed: bare data files, the shared ADR-077 format table, Desktop opening 'jbrowse-desktop ref.fa reads.bam --loc ...', --genome, --view (view settings by their session-spec names), format-family track flags, batch --sites, genome modifiers in place of --aliases/--cytobands, jb2capture on the shared grammar (track settings, --view, data files refused), jb2export's read filter through the launch snapshot, Desktop opening synteny and dotplot views in jb2export's comparative grammar, every track modifier in Desktop and capture through a session spec track entry's `modifiers`. jb2export and Desktop stacking --genome rows from their hosted configs. Open: what of img's write path can still leave its live view, hosted comparative views in jb2capture."
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
  - `modifierValues.ts`: the modifier-value parsers
  - `displaySettings.ts` (the `./displaySettings` subpath, node-free, no
    plugin imports): the track modifier table, `buildDisplaySnapshot`,
    `memberWrites` and the display-category table. jb2export's
    `applyTrackOpts.ts` asserts its copied lists against the plugins'
  - `comparative.ts`: the comparative grammar both apps run
    (`buildComparative`, `syntenyTrack` and its query/target table)
  - `launchPlan.ts` (Desktop's plan), `genome.ts` (`--genome` URLs),
    `trackIds.ts` (`--track` lookup, node-free, the `./trackIds` subpath)
- the linear-genome-view plugin's `TrackModifiers/`: the view side.
  `launchTrackWithModifiers` (jb2export) opens a track with its modifiers;
  `launchTrackInit` opens a session spec track entry, applying its
  `modifiers` after the view navigates. The LGV's init and a synteny view's
  rows call it, so the ready marker waits on every modifier.
- `checkModifiers` (displaySettings) refuses a modifier no kind of track
  takes, so a bad one stops Desktop's plan and capture at the command line.
- Desktop: `electron/launchTarget.ts` (`findLaunchTarget`),
  `electron/electron.ts` (single-instance lock data, open-file),
  `src/components/StartScreen/launchFromLink.ts` (`launchFromPlan`). The plan
  lists each track's raw modifiers, and the renderer writes them into the
  view's `tracks` as `{ trackId, modifiers }`.
- jb2capture: `args.ts` tokenizes with `parseArgv`/`standardizeArgv`, writes
  `--track` modifiers as `{ trackId, modifiers }` and `--view` through
  `viewSettings`; `url.ts` sends either as a one-view session spec and keeps
  the URL parameters otherwise. `resolveTrackId` runs against the config
  capture already fetches.
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
- A track flag names a format family (`--gff` reads GFF3 and GTF, `--bed` BED,
  bedGraph and BEDPE), opens the member the name says, and throws on a name
  another flag reads; a `.gz` name or `index:` picks the tabix adapter.
- Two genome files of one basename throw: a genome takes its file's name, and
  the grammar has no `name:` for one.
- batch reads `--sites <file>`, a VCF or a `.bedpe`, typed by name.
- Cut: `--fasta2`/`--loc2`/`--aliases2`, `--aliases`/`--cytobands` (genome
  modifiers instead), `--assembly <json file>` (`--config` instead), the
  `properPairs:` refusal. An unknown track modifier throws.
- The last of a repeated modifier wins (`name:a name:b` names it b), so a
  script overrides a shared list by appending. `filterTag:` appends instead.

## Traps

- **jb2capture drives the released instance of its own version**, so a spec key
  renamed on main fails against the instance a published capture loads until
  both ship together. A release before `modifiers` (2026-10-22) drops a
  track's modifiers; test capture against a build of main with `--instance`.
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

1. **img renders through `loadSessionSpec`**: mostly declined. A spec track
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
2. **Hosted comparative views in jb2capture.** jb2export and Desktop stack
   `--genome` rows (`hostedGenomes.ts`); capture refuses a second `--genome`.
   It could fetch the configs as `catalog.ts` does and send the picked
   assemblies and tracks as a spec's `sessionAssemblies`/`sessionTracks`.
   Still open everywhere: `--track` choosing a hosted gap's comparison, and
   gene-name `loc:` on a hosted row, which needs its text search.

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
- One genome file named twice is one assembly in two rows, since an assembly's
  name is its config identifier and MST refuses a reference two assemblies
  share. A repeat row takes `loc:`, and throws on `aliases:` or `cytobands:`
  that differ from the first row's.
- A `--genome` is a row whose assembly and comparisons come from its hosted
  config; the apps take those pieces, never the whole config. A config holds
  the liftOvers its genome is the target of, so a pair is usually hosted in
  both directions, and a gap takes one, the upper row's config first.
