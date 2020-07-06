---
id: developer_pluggable_elements
title: Pluggable elements
---

What types of pluggable elements are there in our codebase?

Let's look at a basic example, the @gmod/jbrowse-plugin-alignments plugin, to
see what pluggable elements it instantiates

## Data adapters

Data adapters basically are parsers for a given data format. We will review
what data adapters the alignments plugin has (to write your own data adapter,
see [creating data adapters](creating_data_adapters))

- BamAdapter - a data adapter for the BAM data format. This adapter uses the
  `@gmod/cram` NPM module, and supplies a getFeatures function and a getRefNames
  function, which satisfies the needs of our BaseFeatureDataAdapter type
- CramAdapter - a data adapter for the CRAM data format. This adapter uses the
  @gmod/cram NPM module, and supplies a getFeatures function and a getRefNames
  function which satisfies our BaseFeatureDataAdapter type
- SNPCoverageAdapter - an adapter type that uses a BamAdapter/CramAdapter to
  calculate coverage depth and mismatch positions

## Renderers

- SNPCoverageRenderer - a renderer type that renders the data fetched from
  SNPCoverageAdapter, which itself uses subadapters to fetch data from BamAdapter/CramAdapter
- PileupRenderer - a renderer type that renders the data fetched from BamAdapter/
  CramAdapter (or any other adapter that supplies alignment-like features)

## Track types

- SNPCoverageTrack - a track type that renders the data rendered from the SNPCoverageRenderer
- PileupTrack - a track type that renders the results of PileupRenderer
- AlignmentsTrack - this is a "combination track", that contains a
  SNPCoverageTrack and PileupTrack as subtracks

This means that they add track types, data adapters, view types, or other
things (see [pluggable elements](developer_pluggable_elements])

## Drawer widgets

- AlignmentsFeatureDetailDrawerWidget - this provides a custom drawer widget
  for viewing the feature details of alignments features that customizes the
  basic feature detail widget
