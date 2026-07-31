---
id: diagonalizeprogressmixin
title: DiagonalizeProgressMixin
sidebar_label: Mixin -> DiagonalizeProgressMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/DiagonalizeProgressMixin.ts).

The auto-diagonalize lifecycle state shared by the comparative views
(LinearSyntenyView, DotplotView): the in-flight wait, its live RPC status and
stop token, and the two flags that gate `settled` so a screenshot or browser
test can't capture a pre-reorder hairball.

`withDiagonalizeProgress` drives the first three; the requested/complete pair is
set by the view's own init autorun, which is the only thing that knows a reorder
was asked for. Composed rather than duplicated so both views report progress,
cancel, and gate identically.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-awaitingautodiagonalize">**awaitingAutoDiagonalize**</span><br><code>awaitingAutoDiagonalize: false</code> | True while the init autorun is waiting on the diagonalize RPC. Gates the canvas off — otherwise the user watches an undiagonalized hairball flash before the reorder kicks in. |
| <span id="volatile-autodiagonalizerequested">**autoDiagonalizeRequested**</span><br><code>autoDiagonalizeRequested: false</code> | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint. Gates `diagonalizeSettled` so a capture can't commit the pre-reorder view during the view-building await window, before `awaitingAutoDiagonalize` flips. |
| <span id="volatile-autodiagonalizecomplete">**autoDiagonalizeComplete**</span><br><code>autoDiagonalizeComplete: false</code> | Set true only after the init-time diagonalize pass RESOLVES successfully. If the reorder is skipped or throws this stays false, so `diagonalizeSettled` never reports done on an undiagonalized view — the capture fails loudly (times out) instead of committing a hairball. |
| <span id="volatile-diagonalizestatus">**diagonalizeStatus**</span><br><code>diagonalizeStatus: undefined as RpcStatus &#124; undefined</code> | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait. |
| <span id="volatile-diagonalizestoptoken">**diagonalizeStopToken**</span><br><code>diagonalizeStopToken: undefined as StopToken &#124; undefined</code> | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-diagonalizesettled">**diagonalizeSettled**</span><br><code>boolean</code> | The diagonalize half of a view's `settled` gate: either no reorder was requested, or the one that was has completed. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setawaitingautodiagonalize">**setAwaitingAutoDiagonalize**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-beginautodiagonalize">**beginAutoDiagonalize**</span><br><code>(requested: boolean) =&gt; void</code> | Re-declare the gate at the top of one init apply pass: a reorder is pending iff THIS init asked for one, and nothing is complete until this pass completes it.<br><br>The pair has to move together, which is why this is one action rather than two setters. A superseded init that set `requested` and then skipped its reorder would otherwise leave the flag true with nothing coming, wedging `diagonalizeSettled` (and so `settled`) forever; and a previous init's `complete` would satisfy the gate for the next one's un-reordered view, which is the same capture bug the flags exist to prevent, in the other direction. |
| <span id="action-setautodiagonalizecomplete">**setAutoDiagonalizeComplete**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setdiagonalizestatus">**setDiagonalizeStatus**</span><br><code>(arg?: RpcStatus &#124; undefined) =&gt; void</code> |  |
| <span id="action-setdiagonalizestoptoken">**setDiagonalizeStopToken**</span><br><code>(arg?: StopToken &#124; undefined) =&gt; void</code> |  |
| <span id="action-cancelautodiagonalize">**cancelAutoDiagonalize**</span><br><code>() =&gt; void</code> | Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears the wait flag, revealing the (undiagonalized) view. |
