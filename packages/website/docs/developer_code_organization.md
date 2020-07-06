---
id: developer_code_organization
title: Monorepo code organization
---

JBrowse 2 code is organized using a "monorepo" setup. The top level packages
folder is filled with subdirectories that are each individual "npm type
packages" that can be re-used by other packages in the project.

This means that instead of having many different github repos for different
packages that exist inside our project, we have a single github repo that
conceptually is divided into multiple "npm style packages"

In addition to the modularity provided by the monorepo style, each of the
folders in the packages directory are also implemented as a jbrowse 2 plugin.
That means each package provides a variety of [pluggable
elements](developer_pluggable_elements).

Here is a brief overview of the packages we have, not comprehensive but
hopefully orients you to our codebase

## Monorepo overview

### packages/jbrowse-web

The jbrowse-web folder is essentially a `create-react-app` instance that is the
main JBrowse 2 web app

It includes many other packages as core plugins, can load other plugins at
runtime, and more

The tests in packages/jbrowse-web/src/tests are "integration tests" of the app

### packages/jbrowse-desktop

This is our electron based packaging of JBrowse 2, which contains all the
features of jbrowse-web but additionally has the ability to save sessions to
the desktop, be used offline, etc.

### packages/alignments

This package provides the "alignments" related features including

- BamAdapter - our BAM parser that wraps @gmod/bam NPM module
- CramAdapter - our CRAM parser that wraps the @gmod/cram NPM module
- PileupTrack type - draws alignments as boxes in a "pileup" style view
- SNPCoverageTrack - draws calculated coverage with mismatches drawn over the coverage
- AlignmentsTrack - a "supertrack" which contains a PileupTrack and
  SNPCoverageTrack "subtracks"
- AlignmentsFeatureDrawerWidget for alignments features

### packages/variants/

Provides variant features including

- VCF tabix parser
- VariantFeatureDrawerWidget
- VariantTrack that is basically just a normal track, but has logic to popup
  the VariantFeatureDrawerWidget on feature click

### packages/website

This provides the website you are currently looking at

### packages/hic

This provides a HicAdapter based on the .hic file format
([ref](https://github.com/aidenlab/juicer/wiki/Data#hic-files))

Also a track type and renderer to visualize these

### packages/bed

Provides BigBed and BEDTabix rendering of features

### packages/wiggle

Provides wiggle track types with different types of rendering formats including

- XYPlotRenderer
- LinePlotRenderer
- DensityRenderer

The WiggleTrack type can swap out these different rendering types, and
calculates stats such as max and min score over a region before the region is
rendered

### packages/svg

This is the main gene glyphs, which are rendered using SVG

### packages/spreadsheet-view

This provides a spreadsheet-in-the-browser that can be used as a data backend
to power other views

### packages/circular-view

This provides our 'Circos-style' whole-genome overview of data, especially
genomic translocations

### packages/sv-inspector

This is a "superview" type that contains a circular and spreadsheet view as
child views
