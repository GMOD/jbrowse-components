A [LocusZoom](https://locuszoom.org/)-style view: genome-wide GIANT BMI GWAS
summary statistics rendered as a Manhattan plot and colored by linkage
disequilibrium (LD r²) to the lead SNP. Both data files are read straight from
LocusZoom's hosted demo data — the GWAS via a tabix-indexed `GWASAdapter`, the
LD via a `PlinkLDTabixAdapter` (PLINK `--r2` output).

The track is a `GWASTrack` whose `LinearManhattanDisplay` sets `colorBy: 'ld'`,
which pulls r² values from the LD adapter and shades each SNP accordingly. The
index SNP auto-tracks the top genome-wide hit (rs1121980 at the FTO locus), so
zooming to FTO shows the characteristic colored peak. **Right-click any SNP to
re-anchor LD to it.**

GWAS rendering comes from the GWAS plugin, which is a core plugin of
`@jbrowse/react-linear-genome-view2` — no runtime plugin loading is needed. See
also [Pan-UKB GWAS](../pan-ukb-gwas/) for browsing many phenotypes.
