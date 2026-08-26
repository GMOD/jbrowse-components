---
id: highlightsmixin
title: HighlightsMixin
sidebar_label: Mixin -> HighlightsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/HighlightsMixin.ts).

The `view.highlight` band state shared verbatim by the LinearGenomeView and
DotplotView: an array of translucent highlight regions plus the
`showHighlightChips` toggle for their interactive chips. Both views compose this
so the props and actions stay identical by construction rather than by two
hand-kept copies. Visibility across all views is the session-wide
`highlightsVisible` flag (on BaseSession), not a prop here.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-highlight">**highlight**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>highlight: types.stripDefault( types.array(types.frozen&lt;Highlig…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>highlight: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(types.frozen&lt;HighlightType&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | translucent highlight bands, seeded from URL params or session JSON and added interactively via the rubber-band menu |
| <span id="property-showhighlightchips">**showHighlightChips**</span><br><code>showHighlightChips: types.stripDefault(types.boolean, false)</code> | pins the interactive highlight chip (link icon + context menu) to every highlight band; off by default. In the LinearGenomeView a band then reveals its chip while the pointer is in its column, so this is what a screenshot needs — nothing hovers in one. The DotplotView draws its chips only when this is on |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-addtohighlights">**addToHighlights**</span><br><code>(highlight: HighlightType) =&gt; void</code> |  |
| <span id="action-sethighlight">**setHighlight**</span><br><code>(highlight?: HighlightType[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-removehighlight">**removeHighlight**</span><br><code>(highlight: HighlightType) =&gt; void</code> |  |
| <span id="action-updatehighlight">**updateHighlight**</span><br><code>(old: HighlightType, updates: Partial&lt;HighlightType&gt;) =&gt; void</code> |  |
| <span id="action-setshowhighlightchips">**setShowHighlightChips**</span><br><code>(arg: boolean) =&gt; void</code> |  |
