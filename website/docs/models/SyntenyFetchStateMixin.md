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
gets a full overlay or a corner spinner. What is computed FROM these pieces —
each display's `displayPhase` and each view's `settled` gate — lives in
`comparativeReadiness.ts`, as functions rather than as members here, for the
`error` reason below.

`loading`/`refetching`/`dataCurrent`/`svgReady` themselves stay on each display,
and the reason is **`error`**, not the inputs you would guess. `ready` (each
display holds its data in a different field) and `currentFetchKey`
(view-specific inputs) could both be default-false hooks here, exactly as
`fetchInert` is. `error` could not: it is a `BaseDisplay` volatile, and three of
those four getters read it. Declaring it here to make them type-check would put
a second `error` in the compose chain, where one set silently wins by argument
order — the hazard `FetchMixin` documents against ADR-041 and the thing this
mixin exists to avoid, not reproduce.

Note what is _not_ the reason, since an earlier version of this comment said it
was: `loading` is **not** genuinely different between the two. Synteny's
subtracts `fetchInert` and dotplot's doesn't, but the hook's default is `false`,
so the two expressions have the same value — as do the two `svgReady`s, which
differ only by passing that same getter as `extraTerminal`. If `error` ever
becomes visible here, all four move up together and dotplot loses nothing by
inheriting the `fetchInert` term.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fetching">**fetching**</span><br><code>fetching: false</code> | True while an RPC fetch is in-flight. Combined with `ready` it distinguishes a first load (no data yet — full overlay) from a refetch (stale content still on screen — corner indicator). |
| <span id="volatile-loadedfetchkey">**loadedFetchKey**</span><br><code>loadedFetchKey: undefined as string &#124; undefined</code> | Fetch-input signature the currently held data was fetched for (each display builds its own `currentFetchKey`). Compared against the live inputs in `dataCurrent` to catch data gone stale after a region/zoom change — including during the pre-refetch debounce gap, where `fetching` is still false and would otherwise report done on content drawn against the old viewport. |
| <span id="volatile-assembliesswapped">**assembliesSwapped**</span><br><code>assembliesSwapped: false</code> | Set once at view load by a refName-comparison check, independent of the per-render fetch, so it never re-fires or misfires on zoom. Surfaces through each display's `warnings`. |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>reloadCounter: 0</code> | Bumped by `reload()`. Read unconditionally by `installComparativeFetchAutorun`, so it is always in the autorun's dependency set — which is the whole point: after an error the fetch inputs are unchanged, so nothing else would ever refire the autorun and the error banner's Retry would be a button that does nothing. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Overridable hook, default false: the states where this display's fetch autorun deliberately never runs, so it holds no data and none is coming. Anything waiting on data has to treat those as terminal rather than wait forever — which is why the answer lives in one place and is read by the autorun's own gate, the loading overlay, the SVG export's `extraTerminal`, and `displaysSettled` below.<br><br>`displaysSettled` is the reason this is a mixin hook rather than a display-local getter: it is the one reader outside the display, and without the hook it demanded `dataCurrent` from a display whose `loadedFetchKey` can never be set — wedging the view's `settled` gate, and with it the `data-display-drawn` screenshot capture waits on.<br><br>Default false is the strict answer, so a display that grows an inert state and forgets to say so keeps waiting for data (diagnosable) rather than reporting done without it (silently wrong). Dotplot leaves it: its `prepare` bails only before the view is initialized, which the view's own `canvasDrawn`/`canRender` gate already covers. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfetching">**setFetching**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setassembliesswapped">**setAssembliesSwapped**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | Re-run the fetch. The display's half of the retry contract (agent-docs/reference/DISPLAYCHROME.md §"The retry contract"): every state that can raise an error banner must be one this actually undoes. Clearing the error is not enough on its own — the autorun re-clears it at the start of each run anyway — so this bumps a counter the autorun tracks, which is what makes the refetch happen. |
