Browse [Pan-UK Biobank](https://pan.ukbb.broadinstitute.org/) GWAS summary
statistics on hg38, with a phenotype picker that swaps the loaded sumstats file
and jumps to that trait's lead locus (height → _HMGA2_, BMI → _FTO_, LDL →
_PCSK9_, and so on). The flat sumstats files are read directly from the Pan-UKB
public S3 bucket as tabix-indexed GWAS tracks.

This demonstrates driving the view from an external control — selecting a
phenotype updates both the track and the view location. GWAS rendering is built
in (the GWAS plugin ships as a core plugin of the package). For LD-colored
Manhattan plots, see [LocusZoom-style LD](../locus-zoom-ld/).

See the
[GWAS track guide](https://jbrowse.org/jb2/docs/config_guides/gwas_track/) and
the [GWASTrack](https://jbrowse.org/jb2/docs/config/gwastrack/) /
[GWASAdapter](https://jbrowse.org/jb2/docs/config/gwasadapter/) config reference
for the underlying track setup.
