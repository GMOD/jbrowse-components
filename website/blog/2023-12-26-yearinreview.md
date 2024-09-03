---
title: 2023 year in review
date: 2023-12-26
---

Hello all, as we wrap up the year, we can see that 2023 was a big year for
JBrowse 2!

## New "Faceted track selector" feature

We added a new "Faceted track selector" feature to JBrowse 2, similar to the
JBrowse 1 version! This provides a data grid view of your tracks, with multiple
levels of filtering capability

![](https://user-images.githubusercontent.com/6511937/216159433-e2ef2994-dd85-4283-a942-23cecbb75356.png)

## New theming features with dark mode support

We added the ability to choose between custom themes, which was specifically
beneficial for delivering better dark mode support

![](https://user-images.githubusercontent.com/6511937/221064203-d19352fe-915a-41bc-9ec3-dc22ae94c40f.png)

## SVG export of all view types

SVG export is a highly requested feature, as it enables publication quality
exports of the JBrowse 2 visualizations.

This made it so synteny views, dotplot views, breakpoint split view, and
circular view were all supported by the SVG export functionality!

![](https://user-images.githubusercontent.com/6511937/221062560-346cc4e7-1053-496f-80a8-bded420041a7.png)

## Publication of the JBrowse 2 paper

We finally published our JBrowse 2 paper! This followed our biorxiv pre-print
almost a year earlier
https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02914-z

## Mac M1/M2 builds for JBrowse Desktop

This let's JBrowse Desktop take advantage of speed improvements in Mac M1/M2.

Note: we only realized we weren't publishing the right builds after a user told
us that JBrowse Desktop required virtualization!

Moral of the story, feel free to let us know if you run into any problems :)

## New @jbrowse/react-app NPM package

The `@jbrowse/react-app` package enables the NPM installation of the
`jbrowse-web` (which is otherwise deployed as a folder of pre-built
js/css/html).

We still envision `jbrowse-web` to be the typical way that most users deploy the
app, but we think the availability of the NPM package is important for certain
use cases.

## Office hours and community meeting outreach effort

In Fall 2023, we created a new effort to do office hours where users can
schedule 1-on-1 meetings with the dev team.

We have already conducted

- 6 1-on-1 office hours meetings
- 3 community meetings

We met a diverse group of users via these sessions who we had not talked to
through other channels like GitHub issues/discussions. We look forward to
continuing these meetings through the new year!

## New structural variant visualization features

We have long had the 'circos' view of structural variants, but in 2023 we added
'arc style' rendering of SVs in the normal linear genome view from either
"breakend style" VCF, "symbolic style" VCF (`<INV>, <DEL>, <DUP>, <CNV>`), or
BEDPE

![](https://user-images.githubusercontent.com/6511937/281789167-aef6ccd2-c7e4-444e-b213-f3876fedabf9.png)

## Improved synteny scalability

In v2.10.0, we created a new way to load 'indexed PAF files' that we call PIF
files.

This greatly improves the speed and scalability of loading synteny data, since
it allows you to load just the alignment data in a region of interest instead of
the whole file!

![](https://user-images.githubusercontent.com/6511937/290839304-dc5a6abe-9258-4b94-8a2e-7a369ec7d249.png)

## Track selector improvements

We created a new feature for keeping track of your "Recently used tracks" and
"Favorite tracks", which we think will be helpful especially for instances with
large track lists!

![](https://user-images.githubusercontent.com/6511937/287035460-c5705fc9-d90c-4fe1-ad23-e05389047c53.png)

## New JBrowseR and jbrowse-jupyter releases

We have renewed our efforts and released new versions of JBrowseR and
jbrowse-jupyter.

Notebook style usages of JBrowse 2 with R and Python are very compelling for
certain use cases, and we look forward to seeing more usages of this in the new
year!

## New plugins

This year we introduced a new JBrowse 2 MAFViewer plugin
(https://github.com/cmdcolin/jbrowse-plugin-mafviewer), for viewing multiple
alignment format files. We have already seen integrations where a Cactus
pangenome can be exported into MAF and loaded into the MAFViewer track using
workflows from
https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/progressive.md#maf

## Looking forward!

We look forward to the new year, and thank everyone for their support, bug
reports, and participation
