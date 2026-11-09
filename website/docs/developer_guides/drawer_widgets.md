---
title: Drawer widgets
description: Launching sidebar or popup widgets in the embedded LGV
guide_category: Plugins
---

Set `tracklist: true` in the `view` option for the track selector, or call
`session.addWidget(...)` + `session.showWidget(...)` for any widget. Drawer
position and width are controlled via session actions.

In the embedded `@jbrowse/react-linear-genome-view2` component, widgets can show
as resizable side panels (drawers). Drawers resize by dragging the edge, sit on
the left or right, minimize while keeping widget state, and switch between open
widgets.

## Showing the track selector

The most common use is a hierarchical track selector panel. Set
`tracklist: true` in `view`, here on the managed `<LinearGenomeView>` component,
whose `view` prop is its whole declarative input. `height` bounds the view and
gives the drawer beside it a scroll region:

<!-- include: products/jbrowse-react-linear-genome-view/examples-site/src/examples/FixedHeight.tsx -->

```tsx
import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function FixedHeight() {
  return (
    <LinearGenomeView
      height="400px"
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          trackId: 'volvox_gff3',
          name: 'Volvox genes',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
        {
          trackId: 'volvox_microarray',
          name: 'Microarray (BigWig)',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
          displayDefaults: { height: 150 },
        },
        {
          trackId: 'volvox-long-reads-sv-bam',
          name: 'volvox-long reads with SV',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam',
          displayDefaults: { height: 200 },
        },
      ]}
      view={{
        loc: 'ctgA:1..50,000',
        tracks: [
          'volvox_gff3',
          'volvox_microarray',
          'volvox-long-reads-sv-bam',
        ],
        tracklist: true,
      }}
    />
  )
}
```

## Managing widgets programmatically

Code that opens a widget holds the engine, so it needs the `useCreateViewState`
form — the same object either way, see
[Show a track programmatically](https://jbrowse.org/storybook/lgv/show-track/).

Every drawer action is on the session, so they read
`state.session.setDrawerPosition('left')` and so on:

- [`showWidget`](/docs/models/drawerwidgetsessionmixin#action-showwidget) and
  [`hideWidget`](/docs/models/drawerwidgetsessionmixin#action-hidewidget) — one
  widget at a time. Showing a widget un-minimizes the drawer. Hiding one removes
  it from the session when its type sets `discardOnClose`; minimizing the drawer
  keeps every widget.
- [`minimizeWidgetDrawer`](/docs/models/drawerwidgetsessionmixin#action-minimizewidgetdrawer)
  and
  [`showWidgetDrawer`](/docs/models/drawerwidgetsessionmixin#action-showwidgetdrawer)
  — the drawer itself.
- [`setDrawerPosition`](/docs/models/drawerwidgetsessionmixin#action-setdrawerposition)
  — which side it sits on.

## What the view prop takes

The `view` prop accepts two sets of keys. `InitState` keys need resolving on
load (a locstring has to become regions, a track id has to become an open
track), so they go in a one-shot blob. `LinearGenomeViewLaunchProps` are plain
view props forwarded straight onto the snapshot, so they round-trip on save like
any other setting:

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
  // whether a `loc` that is a searched name also opens the track the name was
  // found in. Defaults to true only when `tracks` is empty; a host that opens
  // its own tracks outside the launch says false here.
  showHitTrack?: boolean
  assembly: string
  // restrict a whole-genome view to these assembly refNames (whole
  // chromosomes), in the order given. Names resolve through the assembly's
  // aliases, and may be globs or `genome` (see selectNamedRegions).
  // Ignored when `loc` is set (which navigates to a single region instead).
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  // a string entry is a locstring or a JSON-encoded HighlightType (the URL
  // wire-format); programmatic callers (createViewState/session JSON) can pass
  // an object directly. Each entry lands on the session's highlight list
  highlight?: (string | HighlightInput)[]
}

// Plain persisted view props a launch spec may set beside the launch keys.
// Unlike InitState these need no resolution — they stay on the view snapshot,
// where MST restores and validates them natively.
//
// Every declared property of the view, derived, minus the init keys (which mean
// something else here: `tracks` is trackIds to open, not built track models)
// and the view's identity. Nothing is listed, so a property is settable from a
// spec — and type-checked — from the line that declares it.
//
// That includes `hideHeader`, `hideHeaderOverview`, `hideNoTracksActive`,
// `labelsVisible`, `scalebarOnly`, `showCytobands`, `axis` and
// `showTrackOutlines`, which are settable from the menu and are most of what a
// figure or an embed wants to say. The partition reads the same set off the
// model at wrap time.
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

`drawerWidth` and `drawerPosition` do **not** travel together. `drawerWidth` is
an ordinary session property, so it round-trips through a saved or shared
session; `drawerPosition` is stripped out of the snapshot on the way out and is
stored only in that browser's localStorage, as a personal layout preference. A
host that wants a drawer position sets it after load, because a session cannot
hold one.

## Showing a custom widget

A widget you registered yourself opens exactly like a built-in one, by the
`name` its `WidgetType` has:
`session.showWidget(session.addWidget('MyCustomWidget', 'myWidgetId', {}))`. See
[](/docs/developer_guides/creating_widget) for the registration and the worked
call. Widgets are lazily loaded via React Suspense, so a custom widget's code is
only fetched when it first opens.

## Storybook example

See the `FixedHeight` example: https://jbrowse.org/storybook/lgv/fixed-height/

## See also

- [](/docs/developer_guides/creating_widget)
- [](/docs/developer_guides/extension_points)
- [](/docs/embedded_components)
