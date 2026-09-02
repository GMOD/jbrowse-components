---
title: Config and session JSON
sidebar_label: Config and session JSON
description:
  The one JSON document every JBrowse surface takes, the fields a view launches
  with, where the document comes from, and how to check it
---

A JBrowse session is a JSON document: the genomes loaded, the tracks and where
their data lives, and the views that are open, at what locus, with which
settings. You write or generate it and open it. Every surface takes the same
document:

| Surface                                            | How it takes the document                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| [jbrowse-web](/docs/quickstart_web)                | `config.json` beside the app, or `?config=` pointing at one     |
| a link to jbrowse-web                              | `&session=`, or the per-view parameters in [](/docs/urlparams)  |
| [jbrowse-desktop](/docs/quickstart_desktop)        | an opened `.jbrowse` file: the same format with a session in it |
| [embedded components](/docs/embedded_components)   | the object passed to `createViewState`                          |
| [](/docs/jbrowser) and [](/docs/jbrowse_anywidget) | what the helper functions assemble for you                      |
| [@jbrowse/img](/docs/jbrowse-img)                  | `--config`, and `--spec` for a whole session                    |

A running JBrowse also takes the document a piece at a time, an assembly or a
track at once, with no file to edit. Every config block in these docs carries
that route beside the file and the CLI command, on its own tab.

## What a session document contains

The genome, a track, and the view to open on:

```json
{
  "assemblies": [
    {
      "name": "hg38",
      "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "ncbi_genes",
      "name": "NCBI RefSeq genes",
      "assemblyNames": ["hg38"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "uri": "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz"
      }
    }
  ],
  "defaultSession": {
    "name": "BRCA1",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr17:43,044,295-43,170,245",
        "tracks": ["ncbi_genes"]
      }
    ]
  }
}
```

- **`assemblies` and `tracks` are the catalog.** A file with just those works.
  [](/docs/config_guides/intro) covers them and the optional top-level fields
  beside them (`plugins`, `connections`, `internetAccounts`,
  `aggregateTextSearchAdapters`, `configuration`).
- **The session says what is open.** A view names a track by the `trackId` the
  config gave it; the join above is the one string `"ncbi_genes"`.
  [](/docs/config_guides/default_session) covers the session object, the
  exported snapshot form, and shipping several named sessions.
- **Settings live on the track, state lives in the session.** Color, height,
  display mode and filters are [configuration slots](/docs/config_guides/tracks)
  under the track's `displayDefaults`. What is open and where it is scrolled to
  is session state. A view can still set a slot per launch by writing the track
  entry as an object: `{ "trackId": "ncbi_genes", "height": 250 }`.
- **A session can carry tracks of its own.** `sessionTracks` takes the same
  track configs as `tracks`, but they travel with the session and never reach
  the `config.json` the server hands every visitor. It is how a link adds a
  track to somebody else's instance.
- **On desktop the halves are one file.** A `.jbrowse` file is this document
  with the session saved into it.

## What a view takes

The settings that need resolving when the view attaches are the `InitState` set.
Beneath it is `LinearGenomeViewLaunchProps`: every plain view property, derived
from the model, so a setting you can reach from a menu is settable at launch
too. Both go on the view object, written the same way.

<!-- include: plugins/linear-genome-view/src/LinearGenomeView/types.ts#initState -->

```typescript
export interface InitState {
  /**
   * A locstring, or several separated by spaces to open a discontinuous view:
   * `'chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500'`. Multiple
   * regions are the only declarative way to frame something spread across loci
   * (a derivative allele against its sources, a gene's partners in a fusion) --
   * `displayedRegionNames` takes whole chromosomes, not intervals.
   */
  loc?: string
  // fractional zoom-out applied around `loc` for context (passed to
  // navToLocString's `grow`), e.g. 0.2 pads a region by 20% on each side.
  // Ignored without `loc`.
  grow?: number
  assembly: string
  // restrict a whole-genome view to these assembly refNames (whole
  // chromosomes), in the order given — e.g. the main chromosomes without the
  // unplaced/alt contigs. Names resolve through the assembly's aliases. Ignored
  // when `loc` is set (which navigates to a single region instead).
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  // a string entry is a locstring or a JSON-encoded HighlightType (the URL
  // wire-format); programmatic callers (createViewState/session JSON) can pass
  // a HighlightType object directly
  highlight?: (string | HighlightType)[]
}

// Plain persisted view props a launch spec may set beside the launch keys.
// Unlike InitState these need no resolution — they stay on the view snapshot,
// where MST restores and validates them natively.
//
// EVERY declared property of the view, derived, minus the init keys (which mean
// something else here: `tracks` is trackIds to open, not built track models)
// and the view's identity. Nothing is listed, so a property is settable from a
// spec — and type-checked — from the line that declares it.
//
// It used to be a hand-written eight, and the model has grown past it:
// `hideHeader`, `hideHeaderOverview`, `hideNoTracksActive`, `labelsVisible`,
// `scalebarOnly`, `showCytobands`, `showGridlines` and `showTrackOutlines` were
// all declared, all settable from the menu, and all dropped in silence by a
// spec that named them — which is most of what a figure or an embed wants to
// say. The partition reads the same set off the model at wrap time.
export type LinearGenomeViewLaunchProps = Partial<
  Omit<
    SnapshotIn<LinearGenomeViewStateModel>,
    keyof InitState | 'id' | 'type' | 'launch'
  >
>
```

A `TrackInit` is a track id string, or an object that also sets display options:

<!-- include: packages/core/src/util/tracks.ts#trackInit -->

```typescript
export type TrackInit =
  | string
  | {
      trackId: string
      // rarely-needed escape hatches: `trackSnapshot` applies to the track
      // config node, `displaySnapshot` explicitly to the display node. Any
      // OTHER key on this object is treated as a display-snapshot prop, so the
      // common case sets display options inline with no nesting:
      // `{ trackId, showDescriptions: false }` rather than
      // `{ trackId, displaySnapshot: { showDescriptions: false } }`.
      trackSnapshot?: Record<string, unknown>
      displaySnapshot?: Record<string, unknown>
      [key: string]: unknown
    }
```

- The init keys are applied once when the view attaches, then cleared, so a
  saved session never retains them.
- A `highlight` entry is a locstring, or a JSON object when it needs a color or
  label:
  `{"refName":"chr1","start":1000,"end":2000,"color":"#ff000055","label":"my region"}`.
  In a URL the JSON form must contain no spaces.
- Circular, dotplot, synteny, spreadsheet, breakpoint-split and SV-inspector
  views each take their own launch fields, listed per view type in the
  [session spec reference](/docs/urlparams#session-spec).

## Where the view object goes

The same object serves every launch route unchanged:

- **A config file**, as `defaultSession`:

  ```json session
  {
    "defaultSession": {
      "name": "My session",
      "views": [
        {
          "type": "LinearGenomeView",
          "assembly": "hg19",
          "loc": "chr1:1,000,000-2,000,000",
          "tracks": ["genes", "variants"]
        }
      ]
    }
  }
  ```

- **A link**, as query parameters mapped straight onto one linear view:

  ```
  ?assembly=hg19&loc=chr1:1,000-2,000&tracks=genes,variants&tracklist=true&nav=false&highlight=chr1:1,500-1,600
  ```

- **A session spec**, for several views, other view types, or tracks that exist
  only in that link: the whole session as JSON after `&session=spec-`, with
  every view type's fields on [](/docs/urlparams#session-spec).
- **An embedded component**, as the object passed to `createViewState`
  ([](/docs/embedded_components#driving-it-from-your-code)).

## Where the document comes from

- [`@jbrowse/cli`](/docs/cli) writes it. `jbrowse add-assembly` and
  `jbrowse add-track` append to `config.json`, inferring the track type and the
  adapter from the file you hand them; a track is an id, a uri and its assembly
  ([the shortest track](/docs/config_guides/tracks#the-shortest-track)).
- **The app tells you what to put in the session part.** Set the view up by
  clicking; the URL bar shows the assembly, locus and track ids a view needs,
  and `jbrowse set-default-session` installs a session file into a config.
- **A track hub needs no config file at all.** `&hubURL=` loads a
  [UCSC track hub](/docs/user_guides/hub_url) straight from a link, and
  [](/docs/config_guides/connections) makes that permanent in a file.
- **For a lot of tracks, generate it.** [](/docs/config_guides/deploying) covers
  building `config.json` from a script.
- **The generated reference** lists every slot of every type under
  [](/docs/config) and every state model under [](/docs/models), both from the
  release you are running. [](/docs/config_guides/file_types) maps a file format
  to its adapter, and [](/docs/config_guides/slot_types) says what a slot's type
  accepts.

## Checking a document

```bash
jbrowse validate config.json
```

The [validate command](/docs/cli#jbrowse-validate) checks a config or a saved
`.jbrowse` session against a manifest generated from the same schemas. It
catches what JBrowse itself ignores: a misspelled slot that leaves the setting
doing nothing, a track naming an assembly that is not defined, a
`defaultSession` naming a `trackId` that does not exist, and a slot written on a
snapshot's display node where only a state-model property is read.

## Drawing the document as a static image

The same document renders headlessly. `jb2export`, from
[@jbrowse/img](/docs/jbrowse-img), takes the same config, assembly, location and
tracks and writes SVG, PNG or PDF:

```bash
jb2export --config hg38.json --assembly hg38 \
  --loc chr17:43,044,295-43,170,245 --track ncbi_genes --out brca1.png
```

For a screenshot of the running app, a menu or a hover, see
[](/docs/agents_capture). Nearly every figure on this site is rendered from one
of these documents, which is why most carry an "Open this view in JBrowse" link:
the image and the live session come from the same spec.

## See also

- [](/docs/config_guide), how to configure each part of the file
- [](/docs/cookbook), recipes short enough to copy
- [](/docs/config_guides/default_session), the session object in full
- [](/docs/urlparams), the same session expressed in a link
- [](/docs/cli), the commands that write the file for you
