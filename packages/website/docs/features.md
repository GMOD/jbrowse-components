---
id: code_organization
title: JBrowse 2 monorepo code organization
---

# JBrowse 2 code organization

To help orient users to the JBrowse 2 codebase we will look at the folder
organization and concepts that we use

One notable thing is that we organize our code using a "monorepo" setup

This makes it so that we have a "packages" folder and each sub-folder in this
directory is an "individual npm package"

This enables more code modularity in our project

Let's take the following as an example

We have our jbrowse-web package, which is defined in the folder
`packages/jbrowse-web/`. The folder jbrowse-web is essentially a `create-react-app`
instance and powers the main jbrowse 2 web application. In order to display BAM
and CRAM alignments, jbrowse-web depends on the package
`@gmod/jbrowse-plugin-alignments` which is defined in `packages/alignments`.

In jbrowse 2 terms, the `packages/alignments` folder is said to be a "jbrowse 2
plugin". It provides the following

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
things (see [pluggable elements](pluggableelements.md])
