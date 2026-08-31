---
id: legendmixin
title: LegendMixin
sidebar_label: Mixin -> LegendMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/LegendMixin.ts).

#crossCuttingMixin A legend the user can turn off. A promotable `showLegend` config slot, whose `promotedBase` sets whether this display type's legend is on by default. Brings the resolved `showLegend` getter, the `showLegendDisplayTypeDefault` pin `showLegendCheckboxItem` takes, and `setShowLegend`

Six displays carried a character-identical copy of these three members —
alignments, Hi-C, multi-row features, multi-wiggle, the multi-sample variant
base and the shared LD model — reading and writing one slot name through the
promotable cascade. **Both ends of that were already shared**: the track-menu
row is `showLegendCheckboxItem` and the thing it shows is `FloatingLegend`,
so this was the middle link between two pieces of common code.

**The config slot stays per display, and deliberately** — `promotedBase`
legitimately differs (a Hi-C color scale is off by default, a variant
genotype key on) and each description describes a genuinely different legend.
That decision is `showLegendCheckboxItem`'s docstring and this does not
disturb it: the slot is what the composing display still supplies, and the
mixin only stops it hand-writing the accessors over it.

`setShowLegend` is overridable, and one display overrides it: the
multi-sample variant base also clears `dismissedLegendSections`, since
re-showing the whole legend is what un-dismisses the sections inside it.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> | Whether the legend is drawn. Resolved through the promotable-slot tiers (`resolveConf`): an explicit track value customizes it either way, otherwise it follows the session-wide default for this display type, falling back to the slot's `promotedBase`. |
| <span id="getter-showlegenddisplaytypedefault">**showLegendDisplayTypeDefault**</span><br><code>Pin</code> | The "apply the current legend visibility to the open tracks" control. Symmetric, so it carries whichever value the track currently shows. `showLegendCheckboxItem` takes this as its `pin`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(arg: boolean) =&gt; void</code> |  |
