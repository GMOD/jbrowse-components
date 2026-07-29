---
id: desktopsessiontrackmenumixin
title: DesktopSessionTrackMenuMixin
sidebar_label: Mixin -> DesktopSessionTrackMenuMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/TrackMenu.ts).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-gettrackactions">**getTrackActions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, view?: TrackActionView &#124; undefined) =&gt; MenuItem[]</code></pre></dialog></span> | raw track actions (Settings, Copy, Delete, Index) without submenu wrapper | DesktopSessionTrackMenuMixin |
| <span id="method-gettracklistmenuitems">**getTrackListMenuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, v…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, view?: TrackActionView &#124; undefined) =&gt; MenuItem[]</code></pre></dialog></span> | <span data-pagefind-ignore>flattened menu items for use in hierarchical track selector</span> | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin#method-gettracklistmenuitems) |
| <span id="method-gettrackactionmenuitems">**getTrackActionMenuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({…}: { config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({…}: { config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;; view?: TrackActionView &#124; undefined; }) =&gt; MenuItem[]</code></pre></dialog></span> | <span data-pagefind-ignore>track menu with About + "Track actions" submenu for the in-view label</span> | [TrackMenuItemsSessionMixin](../trackmenuitemssessionmixin#method-gettrackactionmenuitems) |
