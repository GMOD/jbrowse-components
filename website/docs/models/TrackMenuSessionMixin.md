---
id: trackmenusessionmixin
title: TrackMenuSessionMixin
sidebar_label: Mixin -> TrackMenuSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/TrackMenuSessionMixin.ts).

The minimal track menus used by the embedded react views, which have no
track-editing actions to offer: just "About track" plus any plugin-contributed
items (`Core-extraTrackMenuItems`). Mirrors the shape of the full
`TrackMenuItemsSessionMixin` so both menu surfaces stay consistent across
products, minus the Settings/Copy/Delete actions.

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-gettracklistmenuitems">**getTrackListMenuItems**</span><br><details><summary><code>(config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, v…</code></summary><pre><code>(config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, view?: TrackActionView &#124; undefined) =&gt; MenuItem[]</code></pre></details> | flattened menu items for use in hierarchical track selector |
| <span id="method-gettrackactionmenuitems">**getTrackActionMenuItems**</span><br><details><summary><code>({…}: { config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></summary><pre><code>({…}: { config: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;; view?: TrackActionView &#124; undefined; }) =&gt; MenuItem[]</code></pre></details> |  |
