---
id: variantreviewpluginconfigschema
title: VariantReviewPluginConfigSchema
sidebar_label: Root -> VariantReviewPluginConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variant-review` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variant-review/src/configSchema.ts).

## Example usage

In the top-level `configuration`: a wider window, moving on after each
decision, and h/l in place of k/j:

```js
{
  VariantReviewPlugin: {
    reviewSpanBp: 200,
    advanceOnDecide: true,
    infoFields: ['AF', 'DP', 'SOMATIC'],
    shortcuts: { next: 'l', previous: 'h' },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

Settings for the keyboard-driven variant review a `LinearGenomeView` gains
from the "Review variants in this track" menu item, read from
`configuration.VariantReviewPlugin`.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationvariantreviewpluginreviewspanbp">**configuration.VariantReviewPlugin.reviewSpanBp**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | the width of the window each candidate is shown in, unless the session sets its own |
| <span id="slot-configurationvariantreviewpluginmaxreviewwindowbp">**configuration.VariantReviewPlugin.maxReviewWindowBp**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>50_000</code> | an event wider than this is not shown whole: the view centres on its start at the review span instead |
| <span id="slot-configurationvariantreviewpluginautosortonnavigate">**configuration.VariantReviewPlugin.autoSortOnNavigate**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | sort every alignments track at the candidate's column on each move |
| <span id="slot-configurationvariantreviewpluginadvanceondecide">**configuration.VariantReviewPlugin.advanceOnDecide**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | move to the next candidate after accept, reject or flag |
| <span id="slot-configurationvariantreviewpluginrestoresortonexit">**configuration.VariantReviewPlugin.restoreSortOnExit**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | put each alignments track's sort back the way it was when review stops |
| <span id="slot-configurationvariantreviewplugintargettrackids">**configuration.VariantReviewPlugin.targetTrackIds**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the alignments tracks review sorts; empty means every one in the view |
| <span id="slot-configurationvariantreviewplugininfofields">**configuration.VariantReviewPlugin.infoFields**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>['AF', 'DP']</code> | the INFO keys read for each candidate and shown in the review widget |
| <span id="slot-configurationvariantreviewpluginmaxcandidates">**configuration.VariantReviewPlugin.maxCandidates**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>50_000</code> | the candidate list stops here; a review set is a filtered call set, not a whole-genome VCF |
| <span id="slot-configurationvariantreviewpluginrecordtimestamps">**configuration.VariantReviewPlugin.recordTimestamps**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | store when each decision was made |
| <span id="slot-configurationvariantreviewpluginshortcuts">**configuration.VariantReviewPlugin.shortcuts**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>DEFAULT_REVIEW_KEYMAP</code> | key bindings by command id, merged over the defaults, e.g. `{ "next": "l", "previous": "h" }`; an empty string unbinds |
