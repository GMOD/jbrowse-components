---
id: breakpointalignmentswidget
title: BreakpointAlignmentsWidget
description: "The two alignments either side of a breakpoint split view's read curve, each an AlignmentsFeatureWidget with its row's view and track, so each persists by that widget's rules."
sidebar_label: Widget -> BreakpointAlignmentsWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/BreakpointAlignmentsFeatureDetail/stateModelFactory.ts).

The two alignments either side of a breakpoint split view's read curve, each
an `AlignmentsFeatureWidget` with its row's view and track, so each persists
by that widget's rules. Each read's id derives from the widget's, so the next
pair opened into the widget reconciles onto the same two reads. A snapshot
whose `featureData` holds `feature1` and `feature2` loads as the two reads.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>types.literal('BreakpointAlignmentsWidget')</code> |  |
| <span id="property-read1">**read1**</span><br><code>types.optional(Read, { type: 'AlignmentsFeatureWidget' })</code> |  |
| <span id="property-read2">**read2**</span><br><code>types.optional(Read, { type: 'AlignmentsFeatureWidget' })</code> |  |
