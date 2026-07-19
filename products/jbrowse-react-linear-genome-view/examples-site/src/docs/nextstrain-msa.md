The Nextstrain view is fundamentally a **tree + multiple sequence alignment**.
This demo renders exactly that with [react-msaview](https://gmod.org/JBrowseMSA)
(the JBrowse MSA viewer), reusing the same Nextstrain datasets as the
[genome-browser demos](../nextstrain-pathogens/).

All the data prep is server-side in `scripts/gen-nextstrain-demos.mjs`. Because
Nextstrain sequences are aligned to the reference (insertions relative to it are
dropped), each phylogeny tip's sequence is just the reference with that tip's
nucleotide mutations applied, so a **gap-free MSA needs no aligner**. The
generator reconstructs that MSA for a subsample of tips (`<slug>_msa.fasta`) and
prunes the tree to the same tips (`<slug>.nwk`), both hosted on
`jbrowse.org/demos`.

The client is a thin embed: it points the hosted react-msaview app at those two
files through its `?data=` snapshot param (`treeFilehandle` + `msaFilehandle`),
so there is no local MSA dependency to bundle. The tree and alignment stay
row-linked, so collapsing a clade in the tree makes the alignment follow.
