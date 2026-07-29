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
empty-model mixin can see. The three are one-liners over what's here, written
identically in both.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fetching">**fetching**</span><br><code>fetching: false</code> | True while an RPC fetch is in-flight. Combined with `ready` it distinguishes a first load (no data yet — full overlay) from a refetch (stale content still on screen — corner indicator). |
| <span id="volatile-loadedfetchkey">**loadedFetchKey**</span><br><code>loadedFetchKey: undefined as string &#124; undefined</code> | Fetch-input signature the currently held data was fetched for (each display builds its own `currentFetchKey`). Compared against the live inputs in `dataCurrent` to catch data gone stale after a region/zoom change — including during the pre-refetch debounce gap, where `fetching` is still false and would otherwise report done on content drawn against the old viewport. |
| <span id="volatile-assembliesswapped">**assembliesSwapped**</span><br><code>assembliesSwapped: false</code> | Set once at view load by a refName-comparison check, independent of the per-render fetch, so it never re-fires or misfires on zoom. Surfaces through each display's `warnings`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfetching">**setFetching**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setassembliesswapped">**setAssembliesSwapped**</span><br><code>(arg: boolean) =&gt; void</code> |  |
