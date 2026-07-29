---
id: snackbarmodel
title: SnackbarModel
sidebar_label: Session -> SnackbarModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ui/SnackbarModel.tsx).

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-snackbarmessages">**snackbarMessages**</span><br><code>snackbarMessages: observable.array&lt;SnackbarMessage&gt;()</code> |  |
| <span id="volatile-errordialog">**errorDialog**</span><br><code>errorDialog: undefined as ErrorDialogState &#124; undefined</code> | the error currently shown in the stack-trace dialog. Kept off the dialog queue so it can stack on top of an already-open dialog (e.g. the one whose action raised the error) instead of waiting behind it |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-snackbarmessageset">**snackbarMessageSet**</span><br><code>Map&lt;string, SnackbarMessage&gt;</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-notify">**notify**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(message: string, level?: NotificationLevel &#124; undefined, action…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(message: string, level?: NotificationLevel &#124; undefined, action?: SnackAction &#124; SnackAction[] &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-notifyerror">**notifyError**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(errorMessage: string, error?: unknown, extra?: unknown, action…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(errorMessage: string, error?: unknown, extra?: unknown, action?: SnackAction &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-seterrordialog">**setErrorDialog**</span><br><code>(state: ErrorDialogState &#124; undefined) =&gt; void</code> |  |
| <span id="action-pushsnackbarmessage">**pushSnackbarMessage**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(message: string, level?: NotificationLevel &#124; undefined, action…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(message: string, level?: NotificationLevel &#124; undefined, actions?: SnackAction[] &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-popsnackbarmessage">**popSnackbarMessage**</span><br><code>() =&gt; SnackbarMessage &#124; undefined</code> |  |
| <span id="action-removesnackbarmessage">**removeSnackbarMessage**</span><br><code>(message: string) =&gt; void</code> |  |
