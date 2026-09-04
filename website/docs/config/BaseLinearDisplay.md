---
id: baselineardisplay
title: BaseLinearDisplay
sidebar_label: Display -> BaseLinearDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/configSchema.ts).

## Overview

Shared base config for linear displays — its slots (`height`,
`fetchSizeLimit`, `mouseover`, `jexlFilters`) are common to all of them. The
GPU stack's `LinearCanvasBaseDisplay` config extends it, and third-party
plugins extend it too.

### BaseLinearDisplay - Identifier

Every BaseLinearDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Extended by:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)
- **Extended by:** [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)
- **Extended by:** [LinearMafDisplay](../linearmafdisplay)
- **Extended by:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Extended by:** [MultiWaySyntenyDisplay](../multiwaysyntenydisplay)
- **Extended by:** [SharedLDDisplay](../sharedlddisplay)
- **Extended by:** [SharedVariantDisplay](../sharedvariantdisplay)

## Config slots

`BaseLinearDisplay` is a shared base schema, not a type you name in a config. Set these slots on one of the configs under **Extended by** above, each of which lists them as inherited and shows the shape in its own example. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
