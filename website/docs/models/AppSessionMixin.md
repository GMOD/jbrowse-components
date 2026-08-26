---
id: appsessionmixin
title: AppSessionMixin
sidebar_label: Mixin -> AppSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppSession/AppSessionMixin.ts).

Session getters shared by the "app" products (desktop + web) that simply
delegate to the root model — `version`, `history`, `menus`,
`assemblyManager` — plus `renameCurrentSession`. Centralized here so the
products compose one mixin instead of re-declaring (and diverging on) the
same root delegations. The root must satisfy AppRootModel.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-root">**root**</span><br><code>AppRootModel</code> |  |
| <span id="getter-version">**version**</span><br><code>string</code> |  |
| <span id="getter-gitcommit">**gitCommit**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-history">**history**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ canUndo: boolean; canRedo: boolean; undo(): void; redo(): voi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; } &#124; undefined</code></pre></dialog></span> |  |
| <span id="getter-assemblymanager">**assemblyManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menus">**menus**</span><br><code>() =&gt; Menu[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(sessionName: string) =&gt; void</code> |  |
