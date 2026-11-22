---
name: stack-the-trios-reads-under-the-vcf
description: Checking a Mendelian error means loading the trio's three CRAMs by hand; one gesture could stack them under the VCF, reading each sample's CRAM URL from a samples TSV column. Read before adding a reads shortcut to the variant display.
---

# Stack the trio's reads under the VCF in one gesture

`analyze_trio.md` checks a de novo candidate by loading the child's 30x CRAM,
then the mother's, each as an addtrack fence with its URL typed out. A reader
reviewing many flagged sites repeats that for every trio.

A gesture on a trio (a row's menu, or the feature details of a site bcftools
flagged in `INFO/MERR`) could open the child's and both parents' alignments under the VCF,
stacked in pedigree order and centered on the site.

The URLs come from a samples TSV column (`alignments`, say) naming each
sample's BAM or CRAM, which the pedigree attributes join. A pattern on the
track (`…/{sample}.final.cram`) was the other option, and it fits the 1000
Genomes layout poorly, since its related samples sit under a different
directory from the 2,504 unrelated ones.

The gesture is a menu item that adds three alignments
tracks.
