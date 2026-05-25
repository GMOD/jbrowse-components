---
id: config_guide
title: Introduction - Config guide
toplevel: true
---

The following guide provides comprehensive information regarding the anatomy and
usage of the `config.json` file that is critical for running a JBrowse 2
session.

## Getting started

- [Intro to the config.json format](/docs/config_guides/intro) - Overall structure and key fields of the config.json file

## Core configuration

- [Configuring assemblies](/docs/config_guides/assemblies) - Setting up reference genomes with sequence adapters and refname aliases
- [Configuring plugins](/docs/config_guides/plugins) - Adding first- and third-party plugins via config.json
- [Configuring tracks](/docs/config_guides/tracks) - Configuration options common to all track types

## Track types

- [Alignments track configuration](/docs/config_guides/alignments_track) - BAM/CRAM track config with BamAdapter and CramAdapter options
- [Hi-C track configuration](/docs/config_guides/hic_track) - Contact matrix track config using the HicAdapter
- [Multi-quantitative tracks](/docs/config_guides/multiquantitative_track) - Multiple BigWig/BedGraph signals combined into one display
- [Quantitative tracks](/docs/config_guides/quantitative_track) - BigWig/BedGraph signal track config and display options
- [Synteny track config](/docs/config_guides/synteny_track) - Synteny track config for dotplot and linear synteny views
- [Variant track configuration](/docs/config_guides/variant_track) - VCF variant track config and breakpoint split view options

## Callbacks and customization

- [Customizing feature colors with callbacks and plugins](/docs/config_guides/customizing_feature_colors) - Per-feature color callbacks using jexl or plugin code
- [Customizing feature details with callbacks and plugins](/docs/config_guides/customizing_feature_details) - Customizing feature detail panels with the formatDetails slot
- [FromConfig adapters](/docs/config_guides/from_config) - Inline data adapters for embedding small datasets directly in config
- [Using jexl callbacks](/docs/config_guides/jexl) - Dynamic configuration using jexl callback expressions

## Other features

- [Avoiding stale config](/docs/config_guides/avoiding_stale_config) - Cache-busting strategies for servers that aggressively cache config.json
- [Default session](/docs/config_guides/default_session) - Setting an initial session state loaded for all users
- [Disabling analytics](/docs/config_guides/disable_analytics) - Opt out of Google Analytics usage tracking
- [Text searching](/docs/config_guides/text_searching) - Per-track and aggregate full-text search indexes
- [Coloring/theming](/docs/config_guides/theme) - Customizing the application color theme
- [Hierarchical track selector](/docs/config_guides/track_selector) - Track grouping and display options for the hierarchical selector
