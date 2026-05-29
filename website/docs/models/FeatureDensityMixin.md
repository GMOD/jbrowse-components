---
id: featuredensitymixin
title: FeatureDensityMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/shared/FeatureDensityMixin.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/FeatureDensityMixin.md)

## Docs

Block-based display mixin that adds reactive density-stats checking
on top of RegionTooLargeMixin.

Runs autorunFeatureDensityStats to RPC for density stats, then computes
regionTooLarge reactively from bytes/density thresholds.

For canvas/GPU displays, use MultiRegionDisplayMixin instead (which
also composes RegionTooLargeMixin but uses an imperative check path).
