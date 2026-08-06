A [LocusZoom](https://locuszoom.org/)-style view: genome-wide GIANT BMI GWAS
summary statistics as a Manhattan plot, colored by linkage disequilibrium (r²)
to the lead SNP. Both files are read straight from LocusZoom's hosted demo data
— the GWAS through a tabix-indexed `GWASAdapter`, the LD through a
`PlinkLDTabixAdapter` over PLINK `--r2` output.

The track is a `GWASTrack` whose `LinearManhattanDisplay` sets `colorBy: 'ld'`.
The index SNP auto-tracks the top genome-wide hit (rs1121980, at FTO), so
zooming to FTO shows the characteristic colored peak. **Right-click any SNP to
re-anchor LD to it.** GWAS rendering is built in — no plugin loading.

See [Pan-UKB GWAS](../pan-ukb-gwas/) for browsing many phenotypes, the
[GWAS track guide](https://jbrowse.org/jb2/docs/config_guides/gwas_track/) for
setup, and the two LD tutorials:
[at a selective sweep](https://jbrowse.org/jb2/docs/tutorials/ld_human/)
(computed live from phased genotypes) and
[across an inversion](https://jbrowse.org/jb2/docs/tutorials/ld_mosquitoes/)
(precomputed, as here).
