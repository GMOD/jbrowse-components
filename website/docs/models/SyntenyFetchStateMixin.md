---
id: syntenyfetchstatemixin
title: SyntenyFetchStateMixin
sidebar_label: Mixin -> SyntenyFetchStateMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyFetchStateMixin.ts).

The fetch-lifecycle bookkeeping shared by the two comparative displays
(LinearSyntenyDisplay, DotplotDisplay): whether an RPC is in flight, the
signature of the inputs the held data was fetched for, and the one-shot
reversed-assembly flag.

Composed rather than duplicated so the two displays can't drift on what
"loading" versus "refetching" means — the difference decides whether the user
gets a full overlay or a corner spinner, and both views' `settled` gate (the one
screenshot capture waits on) is written against these same three pieces.

`loading`/`refetching`/`dataCurrent` themselves stay on each display: they need
`ready` (which display holds its data in a different field) and
`currentFetchKey` (whose inputs are view-specific), neither of which an
empty-model mixin can see. `refetching`/`dataCurrent` are one-liners over what's
here and are written identically in both; `loading` is not — synteny subtracts
`fetchInert` (below) and dotplot has no inert state to subtract.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fetching">**fetching**</span><br><code>fetching: false</code> | True while an RPC fetch is in-flight. Combined with `ready` it distinguishes a first load (no data yet — full overlay) from a refetch (stale content still on screen — corner indicator). |
| <span id="volatile-loadedfetchkey">**loadedFetchKey**</span><br><code>loadedFetchKey: undefined as string &#124; undefined</code> | Fetch-input signature the currently held data was fetched for (each display builds its own `currentFetchKey`). Compared against the live inputs in `dataCurrent` to catch data gone stale after a region/zoom change — including during the pre-refetch debounce gap, where `fetching` is still false and would otherwise report done on content drawn against the old viewport. |
| <span id="volatile-assembliesswapped">**assembliesSwapped**</span><br><code>assembliesSwapped: false</code> | Set once at view load by a refName-comparison check, independent of the per-render fetch, so it never re-fires or misfires on zoom. Surfaces through each display's `warnings`. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Overridable hook, default false: the states where this display's fetch autorun deliberately never runs, so it holds no data and none is coming. Anything waiting on data has to treat those as terminal rather than wait forever — which is why the answer lives in one place and is read by the autorun's own gate, the loading overlay, the SVG export's `extraTerminal`, and `displaysSettled` below.<br><br>`displaysSettled` is the reason this is a mixin hook rather than a display-local getter: it is the one reader outside the display, and without the hook it demanded `dataCurrent` from a display whose `loadedFetchKey` can never be set — wedging the view's `settled` gate, and with it the `*_canvas_done` testid screenshot capture waits on.<br><br>Default false is the strict answer, so a display that grows an inert state and forgets to say so keeps waiting for data (diagnosable) rather than reporting done without it (silently wrong). Dotplot leaves it: its `prepare` bails only before the view is initialized, which the view's own `canvasDrawn`/`canRender` gate already covers. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfetching">**setFetching**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setassembliesswapped">**setAssembliesSwapped**</span><br><code>(arg: boolean) =&gt; void</code> |  |
