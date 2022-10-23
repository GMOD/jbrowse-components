---
id: quantitative_track
toplevel: true
title: Quantitative and multi-quantitative tracks
---

## Quantitative tracks

Visualizing genome signals, whether it is read depth-of-coverage or other
signal, can often be done by using BigWig or other quantitative feature files.

<Figure caption="A simple wiggle track with the XY plot renderer." src="/img/bigwig_xyplot.png" />

### Viewing whole-genome coverage for profiling CNV

You can refine the resolution of BigWig tracks, and view whole genome coverage
to get detailed global views of CNV, for example from whole-genome coverage
profiling.

Here is a short picture guide to setup a whole-genome view of a BigWig for CNV
coverage visualization:

1. Open your BigWig track
2. Go to the view menu and select "Show all assembly regions"
3. Adjust the "Autoscale type" to your liking, the new options for "Local +/-
   3sd" allows the autoscaling to avoid outliers
4. Go to the track menu and select "Turn off histogram fill", which then shows
   only a dot for each point on the graph
5. Go to the track menu and select "Resolution->Finer resolution" a couple
   times until resolution looks nice

:::info Note
All tracks have a drag handle on the bottom, which you can drag down to make the track taller.
:::

<Figure caption="A step-by-step guide to view a whole-genome CNV profile of coverage from a BigWig file." src="/img/bigwig/whole_genome_coverage.png" />

## Multi-quantitative tracks

In 2.1.0, we created the ability to have "Multi-quantitative tracks" which is a
single track composed of multiple quantitative signals, which have their
Y-scalebar synchronized. There are 5 rendering modes for the multi-quantitative
tracks.

- xyplot
- multirowxyplot
- multiline
- multirowline
- multidensity

You can interactively change these settings through the track menu.

<Figure caption="Track menu for the multi-quantitative tracks showing different renderer types." src="/img/multiwig/multi_renderer_types.png" />

With the "multi-row" settings (multirowxyplot, multirowline, multidensity) the
track colors are not modified. For the overlapping (xyplot, multiline), the
tracks will be autoassigned a color from the palette. You can manually
customize the subtrack colors from the track menu as well.

<Figure caption="The color/arrangement editor for multi-quantitative tracks let's you change individual subtrack colors, or their ordering in the row based layouts." src="/img/multiwig/multi_colorselect.png" />

Oftentimes, one of the outliers on one of the subtracks may affect the
Y-scalebar too much, so it is often helpful to use the "Autoscale type->Local
+/- 3SD" setting (3 standard deviations are displayed). Manually configuring
the min or max scores is available via the track menu also.

### Adding multi-quantitative tracks via the UI

There are several ways to create multi-quantitative tracks from scratch.

1. Using the add track panel to open up a list of URLs for bigwig files, or from several local tracks from your machine
2. Using the track selector to add multiple tracks to your current selection, and then creating a multi-wiggle track from the tracks in your selection
3. Hardcoding the multiwiggle track in your config file (see [multi-quantitative track configuration](../config_guide#multiquantitativetrack-config) for more info)

<Figure caption="Using the add track widget, you can use the select dropdown to access alternative 'add track workflows' including the multi-wiggle add track workflow. In the multiwiggle add track workflow, you can paste a list of bigWig file URLs, or open up multiple bigwig files from your computer." src="/img/multiwig/addtrack.png" />
<Figure caption="Using the track selector, you can add multiple tracks to your current selection. You can use the '...' dropdown menu to add a single track or a whole category of tracks to your selection. Then, the 'shopping cart' icon in the header of the add track widget let's you create a multi-wiggle track from your selection." src="/img/multiwig/trackselector.png" />
