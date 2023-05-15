---
id: variant_track
title: Variant tracks
---

import Figure from '../figure'

Visualizing variant tracks from the VCF format alongside the original alignment
evidence track is a common workflow for validating your results, shown below:

<Figure caption="Variant track indicating a SNP alongside the alignment track evidence." src="/img/variant_with_pileup.png" />

### Variant widget

The variant features have a specialized widget that contains a table indicating
all the calls that were made in a multi-sample VCF. Some VCF files, like the
1000 genomes VCF, can contain thousands of samples in a single file. This table
can display the details.

<Figure caption="Screenshot showing the variant feature sidebar with a filtered by genotype (with alternative allele '1'). Users can also filter by sample name or other attributes." src="/img/variant_panel.png" />
