# Translate a canonical chromosome name to the one a particular track's file
# uses. JBrowse resolves refname aliases (chr1 vs 1 vs NC_000001.11) per file;
# 'aliases' is a named vector canonical -> file name for one track. A name not
# in it passes through unchanged, so the same plot_region() call reads correctly
# from files with different contig naming.
resolve_chrom <- function(chrom, aliases) {
  if (chrom %in% names(aliases)) aliases[[chrom]] else chrom
}
