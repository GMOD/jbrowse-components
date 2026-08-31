---
title: Drawer widgets
description: Launching sidebar or popup widgets in the embedded LGV
guide_category: Plugins
---

**TL;DR:** Set `tracklist: true` in the view `init` for the track selector, or
call `session.addWidget(...)` + `session.showWidget(...)` for any widget. Drawer
position and width are controlled via session actions.

In the embedded `@jbrowse/react-linear-genome-view2` component, widgets can show
as resizable side panels (drawers). Drawers resize by dragging the edge, sit on
the left or right, minimize while keeping widget state, and switch between open
widgets.

## Showing the track selector

The most common use is a hierarchical track selector panel. Set
`tracklist: true` in the view's `init` — here on the managed
`<LinearGenomeView>` component, whose `init` prop is its whole declarative
input:

<!-- include: products/jbrowse-react-linear-genome-view/examples-site/src/examples/WithInitAdvanced.tsx -->

```tsx
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// managed API: the `init` blob is the component's whole declarative input —
// loc, which tracks to open (with per-display snapshots), tracklist/nav
// visibility, and highlights
export default function WithInitAdvanced() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'ncbi-refseq-genes',
          name: 'NCBI RefSeq Genes',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
          },
        },
      ]}
      init={{
        loc: 'chr1:11,106,077-11,261,675',
        tracklist: true,
        nav: true,
        tracks: [
          { trackId: 'ncbi-refseq-genes', displaySnapshot: { height: 200 } },
        ],
        highlight: ['chr1:11,170,000-11,190,000'],
      }}
    />
  )
}
```

## Managing widgets programmatically

Opening a widget from your own code means holding the engine, so it needs the
`useCreateViewState` form — the same object either way, see
[useCreateViewState](https://jbrowse.org/storybook/lgv/setting-up-the-view#use-create-view-state).

Every drawer action is on the session, so they read
`state.session.setDrawerPosition('left')` and so on:

- [`showWidget`](/docs/models/drawerwidgetsessionmixin#action-showwidget) and
  [`hideWidget`](/docs/models/drawerwidgetsessionmixin#action-hidewidget) — one
  widget at a time. Showing a widget un-minimizes the drawer.
- [`minimizeWidgetDrawer`](/docs/models/drawerwidgetsessionmixin#action-minimizewidgetdrawer)
  and
  [`showWidgetDrawer`](/docs/models/drawerwidgetsessionmixin#action-showwidgetdrawer)
  — the drawer itself.
- [`setDrawerPosition`](/docs/models/drawerwidgetsessionmixin#action-setdrawerposition)
  — which side it sits on.

## Init state options

The `init` prop accepts two sets of keys. `InitState` keys need resolving on
load (a locstring has to become regions, a track id has to become an open
track), which is why they live in a one-shot blob. `LinearGenomeViewLaunchProps`
are plain view props forwarded straight onto the snapshot, so they round-trip on
save like any other setting:

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

## Drawer position and width

- **`updateDrawerWidth(500)`** sets the width in CSS pixels (default 384),
  clamped so the drawer cannot take the whole viewport (minimum drawer width
  128px, minimum main view width 150px). It returns the width actually applied,
  so a caller can tell it asked for more than it got.
- **`resizeDrawer(distance)`** is the edge drag's action, moving the width by a
  delta, flipping the sign for a left-positioned drawer and returning the delta
  that fitted.
- **`drawerPosition`** (default `'right'`, set with `setDrawerPosition`)
  persists to localStorage and restores on the next page load.

The two do **not** travel together. `drawerWidth` is an ordinary session
property, so it round-trips through a saved or shared session; `drawerPosition`
is stripped out of the snapshot on the way out and lives only in that browser's
localStorage, as a personal layout preference. A session cannot carry a drawer
position, so a host that wants one sets it after load.

## Showing a custom widget

A widget you registered yourself opens exactly like a built-in one, by the
`name` its `WidgetType` carries:
`session.showWidget(session.addWidget('MyCustomWidget', 'myWidgetId', {}))`. See
[](/docs/developer_guides/creating_widget) for the registration and the worked
call. Widgets are lazily loaded via React Suspense, so a custom widget's code is
only fetched when it first opens.

## Storybook example

See the `WithDrawerWidget` example:
https://jbrowse.org/storybook/lgv/default-session/#with-drawer-widget

## See also

- [](/docs/developer_guides/creating_widget)
- [](/docs/developer_guides/extension_points)
- [](/docs/embedded_components)
