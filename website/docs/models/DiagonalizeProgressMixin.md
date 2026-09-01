---
id: diagonalizeprogressmixin
title: DiagonalizeProgressMixin
sidebar_label: Mixin -> DiagonalizeProgressMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/DiagonalizeProgressMixin.ts).

The auto-diagonalize lifecycle state shared by the comparative views
(LinearSyntenyView, DotplotView): the in-flight wait, its live RPC status and
stop token, and the flag that gates `settled` so a screenshot or browser test
can't capture a pre-reorder hairball.

`withDiagonalizeProgress` drives the wait and the status/token pair; the gate
is raised and lowered by the view's own init autorun, which is the only thing
that knows a reorder was asked for. Composed rather than duplicated so both
views report progress, cancel, and gate identically.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-awaitingautodiagonalize">**awaitingAutoDiagonalize**</span><br><code>awaitingAutoDiagonalize: false</code> | True while the init autorun is waiting on the diagonalize RPC. Gates the canvas off — otherwise the user watches an undiagonalized hairball flash before the reorder kicks in. |
| <span id="volatile-pendingautodiagonalize">**pendingAutoDiagonalize**</span><br><code>pendingAutoDiagonalize: false</code> | A reorder this init asked for that has not succeeded yet. Raised before any render can paint, and lowered only once the pass RESOLVES — a skipped or thrown reorder leaves it up, so the view's `settled` gate never reports done on an undiagonalized view and the capture fails loudly (times out) instead of committing a hairball.<br><br>One flag rather than a requested/complete pair: the two only ever moved together, and every state a pair can drift into either wedges the gate shut or opens it on the wrong pass. |
| <span id="volatile-diagonalizestatus">**diagonalizeStatus**</span><br><code>diagonalizeStatus: createStatusChannel()</code> | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; blank outside that wait.<br><br>A `StatusChannel` rather than a status field plus a setter: there is one operation to narrate here, and the channel is that pair with the message/fraction split already done, so the spinner reads `{ message, fraction }` instead of calling `statusMessageText` / `statusFraction` at every render site. |
| <span id="volatile-diagonalizestoptoken">**diagonalizeStopToken**</span><br><code>diagonalizeStopToken: undefined as StopToken &#124; undefined</code> | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setawaitingautodiagonalize">**setAwaitingAutoDiagonalize**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-beginautodiagonalize">**beginAutoDiagonalize**</span><br><code>(requested: boolean) =&gt; void</code> | Declare the gate at the top of one init apply pass: a reorder is pending iff THIS init asked for one. Assigning rather than raising is what hands the gate over cleanly — a superseded init that asked for a reorder and then skipped it would otherwise leave the flag up with nothing coming, wedging `settled` forever. |
| <span id="action-finishautodiagonalize">**finishAutoDiagonalize**</span><br><code>() =&gt; void</code> | The init-time reorder resolved, so the view on screen is the diagonalized one — open the gate. |
| <span id="action-setdiagonalizestoptoken">**setDiagonalizeStopToken**</span><br><code>(arg?: StopToken &#124; undefined) =&gt; void</code> |  |
| <span id="action-cancelautodiagonalize">**cancelAutoDiagonalize**</span><br><code>() =&gt; void</code> | Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears the wait flag, revealing the (undiagonalized) view.<br><br>Lowers the gate too. The abort reaches the caller as a throw, which skips its `finishAutoDiagonalize()` — right for a reorder that failed on its own (`settled` stays false and a capture times out loudly rather than committing a hairball), wrong for one the user stopped: cancelling IS the user settling for this view, and a gate nothing will lower again leaves `settled` false forever. |
