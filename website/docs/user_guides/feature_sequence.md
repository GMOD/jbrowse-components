---
id: feature_sequence
title: Feature sequence panel
---

import Figure from '../figure'

### Gene features

If you have a track with gene or transcript level features, then the feature
detail sidebar will automatically stitch together the sequence for that feature.
Options include:

- CDS - the coding sequences, spliced together
- Protein - performs protein translation on the CDS, currently assuming the
  default codon translation table
- cDNA - the CDS plus UTR, or just all exons if a non-coding gene
- Gene w/ introns - the entire gene region sequence with the introns included
- Gene w/ 10bp of introns - the spliced gene sequence with 10bp around the
  splice sites shown
- Gene w/ 500 up+down stream - the entire gene region with 500bp upstream and
  downstream (shown in light red)
- Gene w/ 500 up+down stream + 10bp of introns - the spliced gene sequence with
  10bp around the splice sites shown and the up/down stream shown

Some of the parameters such as 500bp and 10bp are arbitrarily chosen, if you are
interested in adjusting these default parameters [let us know](/contact/).

<Figure caption="The sequence for the upstream and downstream, exons, and intron sequences shown in the feature details." src="/img/feature_detail_sequence.png" />

### Other feature types

Clicking on other types of features will have the "Feature sequence" button in
the feature details widget, but will not automatically "stitch" together
subfeature sequences, instead just giving the literal sequence underlying a
feature. You can also configure the number of flanking bases upstream and
downstream to display with the gear icon
