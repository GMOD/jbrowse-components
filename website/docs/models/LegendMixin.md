---
id: legendmixin
title: LegendMixin
description: "The legend, whole."
sidebar_label: Mixin -> LegendMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/LegendMixin.ts).

The legend, whole. A display declares the color scales it paints with (`colorScales`, a getter hook, and `colorScalesIn` where they follow the theme) and the mixin derives the key from them (`legendSpec`, and `legendSpecIn` for the SVG export, through `legendSpecOf`), keeps the `legend.show` slot's getter and setter (`showLegend`, `setShowLegend`), dismisses sections one at a time (`dismissLegendSection`, undone by re-showing the legend), and answers whether there is a key to offer (`hasLegendKey`). `DisplayChrome` draws the on-screen key and the exporting view the exported one, in a gutter right of the plot, so a display places neither

A key derived from the scales the painter resolves colors through lists only
colors that were painted. A legend hand-built from a second copy of the rules
can list a color nothing painted. Each display declares the `legend` slot,
`legendConfigSchema` or `hiddenLegendConfigSchema` by its default, so this
mixin supplies the accessors over it and never the slot.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-dismissedlegendsections">**dismissedLegendSections**</span><br><code>string[]</code> | Ids of the scales whose section the reader closed; cleared when the whole legend is shown again. Volatile where `legend.show` is config: which sections a reader collapsed in one sitting is not how the track is configured. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> | Whether the legend is drawn. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | Overridable hook (default none): the color scales this display paints with, in the order the key lists them. Each becomes one section of the legend, so a display with two vocabularies (genotype colors and sample groups) declares two. |
| <span id="getter-legendright">**legendRight**</span><br><code>number</code> | Overridable hook (default 0): px the on-screen key is pushed left from the key's inset, for a display that draws a column of text down its right edge — the multi-way lanes' scales. Not read by the export. |
| <span id="getter-legendtop">**legendTop**</span><br><code>number</code> | Overridable hook (default 0): px the on-screen key is pushed down from the key's inset, for a display whose top rows hold the data a reader reads the rest against — the multi-way anchor lane. Not read by the export. |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | The key, derived from `colorScales` less the sections the reader dismissed. `DisplayChrome` renders it on screen and `renderDisplaySvg` flattens it for the export, so the two describe one set of colors. |
| <span id="getter-haslegendkey">**hasLegendKey**</span><br><code>boolean</code> | Whether the display has a key at all. The "Legend" row is offered only when it does. Overridable for a display whose key is only waiting for data: a scale that stays empty until a region lands must not remove the toggle in the meantime. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-colorscalesin">**colorScalesIn**</span><br><code>(_palette: JBrowsePalette) =&gt; ColorScale[]</code> | Overridable hook (default `colorScales`): the scales in another theme, the SVG export's, which need not be the session's. Only a display whose key takes colors from the theme answers it. |
| <span id="method-legendspecin">**legendSpecIn**</span><br><code>(palette: JBrowsePalette) =&gt; LegendSpec</code> | `legendSpec` in the SVG export's theme. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(arg: boolean) =&gt; void</code> | Writes the slot, and showing the legend again restores the sections closed inside it. |
| <span id="action-dismisslegendsection">**dismissLegendSection**</span><br><code>(id: string) =&gt; void</code> | Close one section of the legend, leaving the others up. |
