---
name: an-alphafold-msa-launch-from-the-a3m-the-prediction-api
description: An AlphaFold MSA launch, from the a3m the prediction API advertises as `msaUrl`
area: data-and-demos
---

# An AlphaFold MSA launch, from the a3m the prediction API advertises as `msaUrl`

removed from protein3d rather than fixed, shipped in 0.9.0 on
2026-08-25, and it cannot be brought back from any source anyone has found.
The whole `/files/msa/` path answers **403 at Google's edge**: the response
carries none of the `x-goog-*`/`UploadServer` headers the bucket puts on its
own 404s and 200s, so the request is rejected before it reaches storage rather
than naming a missing object. Every version suffix, AlphaFold's own documented
example (`AF-G1JSI4-F1-msa_v6.a3m`), a browser UA with a referer and a second
network all answer the same. There is no second source either — the prediction
API has no other MSA field, the OpenAPI declares no MSA endpoint, the GCS
mirror carries model, confidence and PAE only, and the EBI FTP ships
coordinate tars. It worked in January 2026
(google-deepmind/alphafold#1111 asks about bulk-downloading MSAs at scale),
which makes an anti-scraping rule that took individual access with it the
likeliest reading. **Colin decided not to report it to EBI** (2026-08-18), so
don't open one. What went with it: `Launch MSA view (AlphaFold a3m)` and
`Launch 3D structure + MSA view` from both the AlphaFold and Foldseek menus,
plus `launchMsaView`, `launch3DProteinViewWithMsa`, `getAlphaFoldMsaUrl` and
the `hasMsaViewPlugin` gate that existed only to offer them. What did **not**
go, because none of it read the a3m: `connectedMsaViewId` and the whole
AddHighlightModel hover sync — `findConnectedMsaView` pairs a structure with
an MSA by a second route, both views hanging off one genome view, which is
what the JBrowseMSA Gene Explorer and msaview's own ortholog launcher use.
The silent half was ours and is fixed: react-msaview `9d8af2e`
(GMOD/JBrowseMSA#111) shows a failed load instead of spinning forever.
