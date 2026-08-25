---
id: trackmenuitemssessionmixin
title: TrackMenuItemsSessionMixin
sidebar_label: Mixin -> TrackMenuItemsSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/TrackMenu.ts).

The two track-menu wrappers (`getTrackListMenuItems` for the hierarchical
selector, `getTrackActionMenuItems` for the in-view label menu) shared by the
full web and desktop sessions. Both are pure functions of `getTrackActions`,
which each session supplies (web gates on edit rights; desktop adds indexing).

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-gettracklistmenuitems">**getTrackListMenuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, v…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, view?: TrackActionView &#124; undefined) =&gt; MenuItem[]</code></pre></dialog></span> | flattened menu items for use in hierarchical track selector |
| <span id="method-gettrackactionmenuitems">**getTrackActionMenuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({…}: { config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({…}: { config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;; view?: TrackActionView &#124; undefined; }) =&gt; MenuItem[]</code></pre></dialog></span> | track menu with About + "Track actions" submenu for the in-view label |
