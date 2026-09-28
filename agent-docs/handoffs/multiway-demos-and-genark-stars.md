---
name: multiway-demos-and-genark-stars
description: "After the 2026-09-28 multi-way round: the two hosted-star tutorial sections and the 44 GenArk staging stars are live, and the Arabidopsis knob demo waits on a call, because the 1001 Genomes methylation bigWigs store every site as a zero-length record and so read zero at every zoom level."
---

The round landed the one lane-fetch bookkeeping with four fixes
(`bc85b6305b`), three comment trims and their docs regen, the
`genomes_synteny.md` sections on choosing a star's lanes (mouse strains at
Nnt, one person's haplotypes at 17q21.31) with their figures, and on jb2hubs
main (`af11f15ad39`, `fb8f3920786`) a multi-way star for every GenArk hub with
three or more liftOver mates.

## GenArk stars on staging

44 GenArk hubs serve a `config-staging.json` from the bucket, and
staging.genomes.jbrowse.org launches them. Each is its `config.json` plus the
one star track, and every PIF and index the stars name returns 200. They were
built on ada into a scratch tree (`buildConfigsBatch.ts --out-root`), uploaded
alone, and copied into ada's `hubs/` tree untracked, so an `--upload-only`
sync keeps them and the next full `run.sh` rebuilds the same bytes and commits
them.

The list was 47 until `fb8f3920786`. The synteny catalog holds a GenArk hub's
liftOver track twice (the UCSC side's row and the hub's own), and the star
index counted both, so three hubs with two mates were listed and got no
config.

A GenArk star opens on its first nine mates by accession, since GenArk carries
no curated species list, and names itself by accession ("GCA_028858775.2 vs 10
genomes"). A common name in the track name is the obvious next polish.

## Arabidopsis knob: the methylation files are malformed

The 1001 Genomes `<id>.{CG,CHG,CHH}meth.bw` files store each cytosine as a
zero-length record (start equals end, all 4,123,130 in 6909's CG file). A
zero-length record covers no bases, so the writer recorded zero bases covered
in every zoom record and in the header's total summary, and the sums with
them. Zoom levels keep only min and max. @gmod/bbi reads a zoom level from
80 bp/px (the 160 bp level; a window of about 80 kb at 1,000 px), so every
zoomed-out bin scores 0. That is the "solid strip"
and the `-1–1` domain the lane layer showed at 1.5 Mb, and it is true today of
the demo's own eleven methylation tracks. UCSC's `bigWigToBedGraph` prints
nothing for these files.

The data carries the knob. At base resolution, CG methylation over Chr4's
first 1.6 Mb averages 0.1 to 0.2 and jumps to about 0.8 from 1.7 to 2.4 Mb,
in 6909, 9728 and 10002 alike. Re-encoding with 1 bp intervals
(`bedGraphToBigWig`, 23 MB to 27 MB per file) gives zoom levels that match the
base data bin for bin.

The call: rehost re-encoded copies of the 33 files under
`jbrowse.org/demos/arabidopsis_pangenome/`, with the prep script in the demo's
README, which currently records not rehosting them as the choice. With that
done the knob page is buildable; the layer config generator is in the
2026-09-28 session's scratchpad as `arabidopsis_layers.cjs`.

## Also open

- **The hs1 orientation vote**, `multiway-orientation-few-groups.md`: the
  human figure leaves hs1 out until the fix there is measured.
- Drosophila's bithorax split on dm6 and the Bovini stack on bosTau9 were
  surveyed (both hosted in their stars) and not started.
