---
name: re-film-the-protein-launch-tour-once-protein3d-ships-the-a3m-removal
description: waits on a protein3d release; the a3m is gone for good
metadata:
  area: figures, protein3d
  category: ready
---

# Re-film the protein launch tour once protein3d ships the a3m removal

The AlphaFold a3m MSA launches are deleted in protein3d, merged as `7b70869`
(GMOD/jbrowse-plugin-protein3d#36). **The work left here waits on a protein3d
release**, not on a merge: until one ships, genomes.jbrowse.org still serves the
plugin that has them. Two things follow it.

**`proteins/annotation_1d` films a menu that is about to lose two rows.** The
tour opens the split button and holds on it, and the release leaves **Launch 3D
protein structure view** and **Launch 1D protein annotation view** where there
were four. It has since been re-filmed for an unrelated reason (`5a3ffee134`,
2026-08-21, `media.lock` committed with it), so the move is to check whether that
clip already shows the shipped menu rather than to film it again. The caption no
longer counts the rows, so it survives; nothing else on the page names the
removed entries.

**Two spec-side descriptions still say four, and they now contradict each
other.** `website/scripts/videos/proteins.ts:240-241,287` and
`website/scripts/specs/features.ts:137` both describe the four-destination menu
while `features.ts:96-99` already records that protein3d removed two. Worth
fixing in the same pass, whichever way the clip comes out.

**Then re-read the page against the shipped menu.** `genomes_proteins.md` has
had the two destinations, their caution and the third row of the "Where each MSA
comes from" table taken out already, so this is a check rather than an edit.

Why it went rather than getting fixed: the a3m AlphaFold's prediction API
advertises as `msaUrl` cannot be fetched by anyone, and no rewrite or mirror gets
around it. The whole `/files/msa/` path answers 403 at Google's edge — the
response carries none of the `x-goog-*`/`UploadServer` headers the bucket puts on
its own 404s and 200s, so it is rejected before reaching storage rather than
being a missing object. Every version suffix, AlphaFold's own documented example
(`AF-G1JSI4-F1-msa_v6.a3m`), a browser UA with a referer and a second network all
answer the same; the prediction API has no other MSA field and the OpenAPI has no
MSA endpoint; the GCS mirror carries model, confidence and PAE only; the EBI FTP
ships coordinate tars. It worked in January 2026
(google-deepmind/alphafold#1111 asks about bulk-downloading MSAs at scale), which
makes an anti-scraping rule that took individual access with it the likeliest
reading. **Colin decided not to report it to EBI** (2026-08-18) — deliberate or
not, the feature is gone either way, so don't open one.

The silent half was ours and is fixed: react-msaview `9d8af2e`
(GMOD/JBrowseMSA#111) shows a failed load instead of spinning on it forever,
which was never specific to AlphaFold and needs no release to matter here.
