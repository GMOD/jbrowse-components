---
id: legendmixin
title: LegendMixin
sidebar_label: Mixin -> LegendMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/LegendMixin.ts).

#crossCuttingMixin The legend, whole. A display declares the color scales it paints with (`colorScales`, a getter hook) and the mixin derives the key from them (`legendSpec`, through `legendSpecOf`), keeps the promotable `showLegend` slot's resolved getter, display-type pin and setter, dismisses sections one at a time (`dismissLegendSection`, undone by re-showing the legend), answers whether there is a key to offer (`hasLegendKey`) and whether the export parks it beside the plot (`svgLegendWidth`). `DisplayChrome` draws the on-screen key and `renderDisplaySvg` the exported one, so a display places neither

A key derived from the scales the painter resolves colors through cannot
list a color nothing painted, which is what a legend hand-built from a second
copy of the rules used to do. The config slot stays per display: the
composing schemas set `promotedBase` differently (a Hi-C color scale is off
by default, a variant genotype key on) and describe different legends, so
this mixin supplies the accessors over the slot and never the slot.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-dismissedlegendsections">**dismissedLegendSections**</span><br><code>dismissedLegendSections: [] as string[]</code> | Ids of the scales whose section the reader closed on its own; cleared when the whole legend is shown again. Volatile where `showLegend` is config: which sections a reader collapsed in one sitting is not how the track is configured. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> | Whether the legend is drawn. Resolved through the promotable-slot tiers (`resolveConf`): an explicit track value customizes it either way, otherwise it follows the session-wide default for this display type, falling back to the slot's `promotedBase`. |
| <span id="getter-showlegenddisplaytypedefault">**showLegendDisplayTypeDefault**</span><br><code>TogglePin</code> | The legend checkbox over every open track of this type. `showLegendCheckboxItem` takes this as its `pin`. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | Overridable hook (default none): the color scales this display paints with, in the order the key lists them. Each becomes one section of the legend, so a display with two vocabularies (genotype colors and sample groups) declares two. |
| <span id="getter-legendtop">**legendTop**</span><br><code>number</code> | Overridable hook (default 0): px the key is pushed down from its own inset, on screen and in the export alike. A display that already draws something of its own in that corner — Hi-C's resolution box — answers that thing's height; the chrome adds its own axis captions on top. |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | The key, derived from `colorScales` less the sections the reader dismissed. `DisplayChrome` renders it on screen and `renderDisplaySvg` flattens it for the export, so the two describe one set of colors. |
| <span id="getter-haslegendkey">**hasLegendKey**</span><br><code>boolean</code> | Whether the display has a key at all, which is what the "Show legend" row is offered on. Overridable for a display whose key is only waiting for data: a scale that fills in once a region lands must not take the way back to the toggle with it. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-svglegendwidth">**svgLegendWidth**</span><br><code>() =&gt; number</code> | Overridable hook (default 0): the width the LGV export reserves beside the plot for this legend. A display whose plot fills its band — the contact matrix, the LD triangle — answers `svgLegendGutterWidth(self)` so the key does not cover it. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(arg: boolean) =&gt; void</code> | Writes the slot, and showing the legend again restores the sections closed inside it. |
| <span id="action-dismisslegendsection">**dismissLegendSection**</span><br><code>(id: string) =&gt; void</code> | Close one section of the legend, leaving the others up. |
