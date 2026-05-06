---
id: hic_track
title: Hi-C track
description: Contact matrix display
guide_category: Track types
---

import Figure from '../figure'

Hi-C captures genome-wide chromatin interaction frequencies. Regions that
interact often appear as bright spots in the contact matrix; the diagonal
represents self-interactions within a region, while off-diagonal signal
indicates contacts between distal loci. Topologically associating domains (TADs)
appear as triangular blocks along the diagonal.

JBrowse reads .hic files, a format produced by Juicer/Juicebox and many other
Hi-C pipelines, using the hic-straw module developed by the Juicebox/igv.js
team.

Currently configuration options are basic for Hi-C tracks, see
[the comprehensive config guide](/docs/config_guides/hic_track/) for info about
configuring Hi-C tracks.

<Figure caption="Screenshot of a Hi-C track." src="/img/hic_track.png" />
