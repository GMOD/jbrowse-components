---
title: 2022 Year end roundup
date: 2022-12-26 22:20:37
---

2022 was a big year for JBrowse 2!

We started the year with v1.5.5 and ended with v2.3.2. Some big things happened
in between!

Let's check some new features out

## New pre-prints

In 2022, we published preprints for our main JBrowse 2 paper
https://www.biorxiv.org/content/10.1101/2022.07.28.501447v1 and JBrowse Jupyter
https://www.biorxiv.org/content/10.1101/2022.05.11.491552v1

## More plugins for the plugin store!

We have continued see new plugins in the plugin ecosystem, including

- MultiLevelLinearView - a plugin that synchronizes multiple linear genome views
  at multiple zoom levels, by @carolinebridge-oicr

- Reactome - showing pathways using Reactome's pathway viewer, by
  @carolinebridge-oicr

- RefGet API for fetching sequence info from external contributer Emilio Righi,
  who has also contributed in making Vue adapters for our React code

See more here, as well as screenshots below
https://jbrowse.org/jb2/plugin_store/

![](https://github.com/GMOD/jbrowse-plugin-multilevel-linear-view/raw/main/img/mllv.gif)

Video of the MultiLevelLinearView

![](https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/reactome-screenshot-fs8.png)

Screenshot of the Reactome plugin, showing the pathway viewer

## Adding curvy lines to the synteny view

In v1.6.4, we added curvy lines to our synteny view following our PAG 2021
remote update

https://jbrowse.org/jb2/blog/2022/01/29/v1.6.4-release/

![](https://user-images.githubusercontent.com/6511937/151449824-8993a755-cc44-440f-bd98-8d251f144c58.png)

The curves are both visually fun, and may also help reveal patterns better than
straight lines can

## Improved ability to display synteny from more data types, including MCScan, MUMmer, UCSC liftover chain files, and more

In v1.6.6 we added the ability to render synteny from ".delta" (MUMmer), ".out"
(MashMap), and ".anchors"/".simple.anchors" files from MCScan (python version)

![](https://user-images.githubusercontent.com/6511937/157134881-732f0e4b-d811-4515-8b41-6b44f0668611.png)

We can also plot multiple "synteny tracks" at the same time, producing a useful
overlay of different types of synteny data. In v2.3.0, we ensured that the
synteny was rendered to base-pair exactness, showing that a "deletion relative
to one genome" is an "insertion relative to the other"

![](https://user-images.githubusercontent.com/6511937/208767035-90f1fb23-0fa4-468a-8095-14dc597014b2.png)

## Floating labels adding to gene glyphs

Earlier versions of jbrowse, the label for a feature would not be visible if you
were zoomed e.g. into the middle of the gene. In v1.7.0 we adding "floating
labels" so that the feature label was always visible as you scroll

![](https://user-images.githubusercontent.com/6511937/163470981-cfbd4464-bd5a-4421-8d9c-c8e6bb2d19bc.png)

## Improved SVG export using canvas2svg

We switched to a battle tested canvas2svg library in v1.7.9 for exporting SVGs
which improved exporting our 'sashimi-style' arcs on RNA-seq

![](https://user-images.githubusercontent.com/6511937/171530346-8466465f-fbae-49bd-a099-1acb2baddf1d.png)

## Feature detail panel customization

In v1.7.10, we added the ability to customize the feature details panel with
custom links. This is very useful to add links to external resources or gene
pages for different features.

![](https://user-images.githubusercontent.com/6511937/173461279-1afebb28-5928-47c1-8157-ecd2427a7fb2.png)

## Upgrading to webpack 5 and reducing bundle sizes, and MUI v5 upgrade

In v1.7.0, we upgraded to webpack 5 which improved our bundle sizes, which makes
the app load faster! In fact, over the lifetime og jbrowse 2, we have decreased
our bundle size. In fact, the initial load of v2.3.2 is 2.5x smaller than
v1.0.0! We also upgraded to MUI v5, which kept us on track with the latest and
greatest from MUI, who continues to improve their UI widgets like the data grid.

![](https://user-images.githubusercontent.com/6511937/209866358-a4d11fc9-e829-48b2-aa09-0ed567ba19c6.png)

## Multi-wiggle tracks

We added the ability to have "multi-wiggle" tracks in v2.1.0, which let's you
see multiple quantitative signals on the same Y-scalebar easily

![](https://user-images.githubusercontent.com/6511937/181639797-69294456-cbe6-403a-9131-98af27c849f3.png)

"Overlaid" multi-wiggle track

![](https://user-images.githubusercontent.com/6511937/181639088-9159d60d-a49d-4601-bfb8-6201a26dc185.png)

"Multi-row" multi-wiggle track

## Viewing synteny tracks in the linear genome view

In v2.2.1, we added the ability to view "SyntenyTracks" in a regular linear
genome view. This means that you can be navigating to your gene of interest on
e.g. hg19, open a synteny track, and launch a synteny view which shows the gene
on both hg19 and hg38 in a synteny view.

![](https://user-images.githubusercontent.com/6511937/203133899-7449b4fe-048d-46e6-836f-ddff7643646b.png)

## Arc and "read cloud" rendering of paired-end and split long reads

In v2.3.1, we introduced the ability to render the connection between paired-end
and split-long reads using arcs! This style of view is similar to what we
offered in the "breakpoint split view" but is more easily accessible being
simply a linear genome view track rather than a custom view type! We also
created the "read cloud view" which statifies the reads according to "insert
size". Each of these features is similar to ones available in JBrowse 1, but has
the added ability in JBrowse 2 to be able to connect across discontinuous
regions (xref https://jbrowse.org/docs/paired_reads.html for JBrowse 1)

The arcs will color themselves according to read orientation (e.g. blue, teal,
and green indicate various types of inversions or duplications) as well as
insert size (pink is dynamically added if the insert size is statistically too
small, which read is added if the insert size is statistically too large, each
using +/- 3sd as a measure)

![](https://user-images.githubusercontent.com/6511937/205730944-07347472-a9e6-44b9-8c8c-ca4380a3c75a.png)

## Looking forward

In 2023, we will start to see beta versions of the new Apollo rewrite with
JBrowse 2 integration. A new single cell data viewer plugin is also in the
works.

Many of our team members will be at the Plant and Animal Genome conference 2023,
so we look forward to seeing you there!

- Colin Diesh (@cmdcolin)
- Garrett Stevens (@garrettjstevens)
- Scott Cain (@scottcain)
- Caroline Bridge (@carolinebridge-oicr)
- Robert Buels (@rbuels)
- Teresa De Jesus Martinez (@teresam856)

![](https://user-images.githubusercontent.com/6511937/209866326-f14c9f15-0d00-48a3-966f-ce8c5eb26af2.png)
