---
name: rebuild-every-hosted-pif-with-the-coarse-cigar
description: eight hosted PIFs predate the cr:Z: coarse CIGAR and the #pif header, so the coarse tier draws as plain ribbons on jbrowse.org until each is rebuilt; DEMO_DATASETS.md holds the current per-file measurement, and HOSTING.md's table is a month behind it
metadata:
  area: synteny, PIF, hosting
  category: ready
  order: 6
  first_move: "take hs1ToMm39 first — `~/data/hs1ToMm39` holds the source chain, and the `.pif.gz` beside it is the 2026-05-27 build with no `#pif` header, so the rebuild is local and needs no fetch — then deploy with scripts/deploy-demo.sh, reading its header about byte ranges tearing for a minute on a size change"
---

# Rebuild every hosted PIF with the coarse CIGAR

The two-tier PIF format froze on 2026-09-02
([ADR-104](../architecture-decision-records/adr-104-the-coarse-tier-is-a-coarsened-alignment.md)):
a coarse row carries a `cr:Z:` coarse CIGAR and the file opens with a `#pif`
header naming its tiers and the coarse bound. On a file predating both, the
coarse tier draws as plain ribbons and a 240 kb insertion that the rebuilt file
draws as a wedge is a white seam. The measurement that the rebuild pays is
[measurements/pif-coarse-fold-bytes.json](../measurements/pif-coarse-fold-bytes.json).

**Take the file list from
[reference/DEMO_DATASETS.md](../reference/DEMO_DATASETS.md) §`demos/hg38_vertebrates`,
not from [reference/HOSTING.md](../reference/HOSTING.md).** HOSTING.md's table
was audited 2026-08-02 and lists six files; DEMO_DATASETS.md measured the eight
hg38 liftOvers on 2026-09-05 and found three of them — calJac4, canFam6 and
bosTau9 — already carrying `coarse:i:10000 cigars:Z:all`. Four of the five that
do not (gorGor6, ponAbe3, rheMac10, mm39) appear in no HOSTING.md row at all, so
working from that table both re-does finished files and misses owed ones.
`MultiPairwiseSyntenyAdapter` offers the coarse tier only when every child
carries one, which is why those five hold the whole hg38 vertebrates track on
the fine tier at every zoom.

What is owed, per file:

- Get the source. On this machine (checked 2026-09-09) `~/data` holds
  `hs1ToMm39/hs1ToMm39.over.chain.gz` and nothing else on the list; the hg38
  liftOver chains are UCSC's and the rebuild is chain → PAF → `make-pif`.
  `scripts/verify-hs1-mm39-dotplot.mjs` shows how the hs1/mm39 chain was
  handled, `scripts/build_hpylori_synteny.sh` and
  `scripts/build_ecoli_pangenome_graph.sh` build two of the others.
- Rebuild with the current `make-pif`. A hub that must serve a JBrowse older
  than 2026-09-02 builds with `--no-coarse`;
  `website/docs/developer_guides/pif_format.md` says why.
- Deploy only with `scripts/deploy-demo.sh`, never `aws s3 cp`, and read its
  header first: a size change tears byte ranges for about a minute.
- Update the row in HOSTING.md, and re-measure with
  `tabix -H <url>` for the header and `tabix -l <url> | grep -c '^[TQ]'` for the
  tier.

**hs1ToMm39 is not one upload away, whatever an earlier note said.** The browser
pass recorded in [reference/SYNTENY_LOD.md](../reference/SYNTENY_LOD.md) was
against a rebuild that is not on this machine: `~/data/hs1ToMm39`'s `.pif.gz` is
dated 2026-05-27, carries the old uppercase `Q`/`T` coarse rows with no
alignment string, and holds no `cr:Z:` and no `#pif` header. The source chain is
there, so redoing it is cheap — but it is a rebuild, not an upload.
