---
name: remove-test-datas-kept-tbi-beside-their-csi
description: Commit 0dff85a30d kept test_data's old `.tbi` beside each new `.csi` so the deployed docs could still read them; once the docs site serves the CSI fences, `git rm` those `.tbi`.
---

# Remove test_data's kept .tbi beside their .csi

The CSI sweep re-indexed test_data's tabix files as `.csi`, but commit
0dff85a30d kept the old `.tbi` beside each one. The push deploy syncs
`code/jb2/main` with deletion, while the deployed tutorials (dog10k_lof,
dog10k_svs, dog10k_selection, local_ancestry, pangenome_cattle, syri_synteny,
alu_age) kept their pre-sweep fences, which name these files with no `csi` and
so read the `.tbi`.

The files are the ones that commit adds (`git show --name-only 0dff85a30d`):
`test_data/alu_age/Alu.young_share.bed.gz.tbi`, the `.tbi` under
`test_data/dog10k/`,
`test_data/graphgenomeview/omia_cattle_variants.gff3.gz.tbi` and
`test_data/syri/syri_regions.bed.gz.tbi`, each next to its `.csi`.
`test_data/volvox` keeps its `.tbi` on purpose, including the one beside
`volvox.sort.gff3.gz.csi`.

First move: fetch each of those tutorial pages from `jbrowse.org/jb2/docs/` and
check every fence naming one of the files carries `"csi": true`. When all do,
`git rm` the `.tbi` the commit lists, and grep the tree for each name with
`.tbi` appended before landing.
