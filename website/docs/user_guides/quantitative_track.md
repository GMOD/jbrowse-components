---
id: quantitative_track
title: Quantitative tracks
---

import Figure from '../figure'

Visualizing genome stopTokens, whether it is read depth-of-coverage or other
stopToken, can often be done by using BigWig or other quantitative feature
files.

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
5. Go to the track menu and select "Resolution->Finer resolution" a couple times
   until resolution looks nice

:::info Note

All tracks have a drag handle on the bottom, which you can drag down to make the
track taller.

:::

<Figure caption="A step-by-step guide to view a whole-genome CNV profile of coverage from a BigWig file." src="/img/bigwig/whole_genome_coverage.png" />
