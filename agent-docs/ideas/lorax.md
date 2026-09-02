---
name: lorax arg
description: Ancestral recombination graphs
---
They help, and in a specific way: they answer the "no one tree" problem with the one object that is honest about it, and they have already done the JBrowse integration in their direction.

What lorax is, from the code: a Python backend (FastAPI plus Socket.IO, tskit, numba) and a deck.gl frontend. It reads tskit tree sequences and a Newick-per-interval CSV, preprocesses a tree sequence into an Arrow "CSR artifact" (shards of about 48 MB, a breakpoints array, a shard index with sizes and checksums), and serves local trees per viewport, decimating to about ten representative trees chosen by largest span. Trees carry mutations on branches and sample metadata, with descendant highlighting on hover and a "compare topologies" mode. They host a 1000 Genomes chr2 tree sequence in hg19 coordinates, and their worked use case is lactase persistence, the same locus as our LD tutorial.

The part you may not have seen: they ship a JBrowse plugin (lorax-plugin, a LoraxAdapter and a LoraxDisplay in the linear genome view) and embed JBrowse Web inside the lorax app with a widget drawer. So the ARG-as-a-track question is already answered on their side. Two caveats: the display talks to a lorax backend over a socket session, not to a static file, and the plugin pins @jbrowse/core 4.x, which our v5 break will strand.

How it bears on the clustering problem, in order of how much it changes:

- The row order at a position is the marginal tree's tip order. That is the local ordering the PBWT approximates, taken from a model that has already resolved the recombination structure. Our tree sidebar draws a hierarchy already, and a marginal tree is one, with branch lengths in generations instead of a distance.
- The breakpoints are the fraying, stated. The tree sequence's breakpoint array says exactly where the local tree changes. Ticks on the variant lane at those positions, or a re-derived row order as the anchor crosses one, is the answer to "where does this ordering stop applying" with no heuristic threshold.
- Carriers of a variant are a clade. A mutation sits on one branch of the local tree, so the alt-carrying cells in a column should be contiguous in the tip order. Where they are not, the display is showing recurrent mutation or inference error, which is a real finding rather than noise.

Two things keep this from replacing the genotype-side work:

- An inferred ARG is a model. tsinfer leaves polytomies, tsdate's times carry wide intervals, and the tree near a breakpoint is the least certain part. Their compare-topologies mode exists because of this. The PBWT divergence computed straight from genotypes makes no inference claim, and it exists for every VCF, where an ARG exists only where someone has run the pipeline. So genotype-derived blocks stay the default and the ARG is the upgrade when a tree sequence is present.
- Their format is one step from static. The CSR artifact is Arrow IPC shards plus a breakpoints index, which is nearly a range-request format already. Reading "the tree at position x" is a bisect on breakpoints, a shard lookup, and one record batch. If the shard index recorded per-batch byte offsets, a JBrowse adapter could read it with no Python backend, which is the version that fits our deployment model and theirs. That is the thing to ask them for.

The practical sequence would be: land the divergence painting off the existing sort, then a tree-sequence adapter for the marginal tree at the anchor, with lorax's artifact as the first format it reads.

