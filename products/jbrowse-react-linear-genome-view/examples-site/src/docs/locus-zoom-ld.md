A [LocusZoom](https://locuszoom.org/)-style view: genome-wide GIANT BMI GWAS
summary statistics rendered as a Manhattan plot and colored by linkage
disequilibrium (LD r²) to the lead SNP. Both data files are read straight from
LocusZoom's hosted demo data: the GWAS via a tabix-indexed `GWASAdapter`, the LD
via a `PlinkLDTabixAdapter` (PLINK `--r2` output).

The track is a `GWASTrack` whose `LinearManhattanDisplay` sets `colorBy: 'ld'`,
which pulls r² values from the LD adapter and shades each SNP accordingly. The
index SNP auto-tracks the top genome-wide hit (rs1121980 at the FTO locus), so
zooming to FTO shows the characteristic colored peak. **Right-click any SNP to
re-anchor LD to it.**

GWAS rendering is built in, so no runtime plugin loading is needed. See
[Pan-UKB GWAS](../pan-ukb-gwas/) for browsing many phenotypes, and the
[GWAS track guide](https://jbrowse.org/jb2/docs/config_guides/gwas_track/) for
setup end to end.

Reference: [GWASTrack](https://jbrowse.org/jb2/docs/config/gwastrack/),
[GWASAdapter](https://jbrowse.org/jb2/docs/config/gwasadapter/),
[PlinkLDTabixAdapter](https://jbrowse.org/jb2/docs/config/plinkldtabixadapter/),
the
[LinearManhattanDisplay](https://jbrowse.org/jb2/docs/config/linearmanhattandisplay/)
`colorBy` slot, and the
[Linkage disequilibrium tutorial](https://jbrowse.org/jb2/docs/tutorials/linkage_disequilibrium/),
which covers reading an LD triangle, spotting a selective sweep, and when LD is
the wrong tool.
