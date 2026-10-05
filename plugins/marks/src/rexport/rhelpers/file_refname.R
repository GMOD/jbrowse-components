# The name a file spells a contig with, where the assembly's alias for it
# differs from the view's name; a contig with no alias keeps its own name.
file_refname <- function(chrom, aliases) {
  if (chrom %in% names(aliases)) aliases[[chrom]] else chrom
}
