---
name: rebuild-every-hosted-pif-with-the-coarse-cigar
description: two eukaryote-scale hosted PIFs, hs1ToMm39 and the CGIAB HG008T one, predate the cr:Z: coarse CIGAR and the #pif header, so their coarse tier draws as plain ribbons on jbrowse.org until each is rebuilt; the hg38 liftOvers were rebuilt on 2026-09-11, and HOSTING.md's table holds every hosted file's state
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

**The file list is [reference/HOSTING.md](../reference/HOSTING.md) §"Hosted PIFs
and the coarse tier"**, audited 2026-09-13. The eight hg38 vertebrate liftOvers
and `hg38ToHs1` carry a version-2 header since their 2026-09-11 rebuild. Two
files still owed are at a scale where the coarse tier engages: `hs1ToMm39` and
`cgiab/HG008T_v3.2`, both with old-style coarse rows and no header. The E. coli
and H. pylori PIFs have no header either, but a bacterial genome never reaches
the coarse bound.

What is owed, per file:

- Get the source. On this machine (checked 2026-09-09) `~/data` holds
  `hs1ToMm39/hs1ToMm39.over.chain.gz`; `scripts/verify-hs1-mm39-dotplot.mjs`
  shows how that chain was handled.
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
