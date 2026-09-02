---
name: rebuild-every-hosted-pif-with-the-coarse-cigar
description: every PIF in the HOSTING.md table predates the cr:Z: coarse CIGAR and the #pif header, so the coarse tier draws as plain ribbons on jbrowse.org until each is rebuilt; the sources are not on this machine
metadata:
  area: synteny, PIF, hosting
  category: ready
  order: 6
  first_move: "fetch the sources — ~/data has bison, horse, sunflower and yeast, not hs1ToMm39 or the hg38 liftOvers — then rebuild with the current make-pif and deploy with scripts/deploy-demo.sh, one file at a time, reading its header about byte ranges tearing for a minute on a size change"
---

# Rebuild every hosted PIF with the coarse CIGAR

The two-tier PIF format froze on 2026-09-02
([ADR-104](../architecture-decision-records/adr-104-pif-coarse-cigar.md)):
a coarse row carries a `cr:Z:` coarse CIGAR and the file opens with a `#pif`
header naming its tiers and the coarse bound. Every file in
[reference/HOSTING.md](../reference/HOSTING.md) §"Hosted PIFs and the coarse
tier" predates both, so on the hosted demos the coarse tier still draws as
plain ribbons and a 240 kb insertion that the rebuilt file draws as a wedge is
a white seam. The measurement that the rebuild pays is
[measurements/pif-coarse-fold-bytes.json](../measurements/pif-coarse-fold-bytes.json).

What is owed, per file in that table:

- Get the source. `~/data` holds bison, horse, sunflower and yeast; not
  hs1ToMm39 and not the hg38 liftOvers. `scripts/verify-hs1-mm39-dotplot.mjs`
  shows how the hs1/mm39 chain was handled, `scripts/build_hpylori_synteny.sh`
  and `scripts/build_ecoli_pangenome_graph.sh` build two of the others.
- Rebuild with the current `make-pif`. A hub that must serve a JBrowse older
  than 2026-09-02 builds with `--no-coarse`;
  `website/docs/developer_guides/pif_format.md` says why.
- Deploy only with `scripts/deploy-demo.sh`, never `aws s3 cp`, and read its
  header first: a size change tears byte ranges for about a minute.
- Update the row in HOSTING.md.

Verified once already: the hs1-vs-mm39 file was inverted to PAF and rebuilt
locally, and the browser pass against it is recorded in
[reference/SYNTENY_LOD.md](../reference/SYNTENY_LOD.md). Only the upload is
missing for that one.
