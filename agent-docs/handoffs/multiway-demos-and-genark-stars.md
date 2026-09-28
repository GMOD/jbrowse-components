---
name: multiway-demos-and-genark-stars
description: "After the 2026-09-28 multi-way round: the hosted-star tutorial sections and the 44 GenArk staging stars are live, ada holds those 44 configs untracked until the next full run commits them, and the Arabidopsis knob demo is parked."
---

The round landed the one lane-fetch bookkeeping with four fixes
(`bc85b6305b`), three comment trims and their docs regen, the
`genomes_synteny.md` sections on choosing a star's lanes (mouse strains at
Nnt, one person's haplotypes at 17q21.31) with their figures, the fix that
stopped hs1 drawing `[rev]` there (a fresh lane needs five shared groups to
vote its orientation, as a switch does), and on jb2hubs
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
no curated species list, and names its anchor by common name and accession
("chimpanzee (GCA_028858775.2) vs 10 genomes", jb2hubs `80999581704`).

## Arabidopsis knob: parked

The knob demo with CG methylation as a lane layer is parked (Colin,
2026-09-28, declining to rehost re-encoded copies). The 1001 Genomes
methylation bigWigs read zero once zoomed out, which the demo's README records.

## Also open

- Drosophila's bithorax split on dm6 and the Bovini stack on bosTau9 were
  surveyed (both hosted in their stars) and not started.
