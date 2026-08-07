# Read a Hi-C contact matrix (strawr - the reader from the .hic authors) over
# every displayed region and rotate it 45 degrees into diamond polygons, so the
# map shares the cumulative-bp x-axis with the other stacked tracks. This is
# JBrowse's triangular Hi-C view.
#
# It reads every PAIR of regions, not each region against itself, which is what
# a discontiguous view is for: the contacts BETWEEN two windows are the whole
# point of putting them side by side (the same geometry that puts a bright
# off-diagonal block over a translocation's partner loci), and a per-region read
# draws two separate triangles with the block between them simply missing.
#
# straw returns each block's upper triangle as data.frame(x, y, counts) of
# bin-start coords. A bin-bin square [x, x+binsize] x [y, y+binsize] becomes a
# diamond whose axis x is the contact midpoint and whose height is the
# interaction distance - taken on the CUMULATIVE axis, so a cross-region contact
# lands over the gap between its two regions and rises by their separation on
# screen rather than by their genomic distance.
#
# 'binsize' must be a resolution the file offers (strawr::readHicBpResolutions(
# uri)) and 'norm' a normalization it offers (strawr::readHicNormTypes(uri)) -
# both are editable script variables below (larger binsize = coarser/faster).
# 'regions' must have been through region_layout() (it reads $offset).
hic_regions <- function(uri, regions, binsize, norm) {
  chroms <- strawr::readHicChroms(uri)
  loc <- function(i) sprintf("%s:%d:%d", regions$chrom[i], regions$start[i], regions$end[i])
  # genomic bp -> the cumulative-bp axis position region i occupies
  on_axis <- function(v, i) v + regions$offset[i] - regions$start[i]
  # straw answers on the file's own axis order, transposing the block when the
  # second locus sorts first, so x is not always region i's coordinate
  transposed <- function(i, j) {
    if (regions$chrom[i] == regions$chrom[j]) regions$start[i] > regions$start[j]
    else match(regions$chrom[i], chroms$name) > match(regions$chrom[j], chroms$name)
  }
  block <- function(i, j) {
    # a pair the file has no matrix for at this resolution contributes nothing
    # rather than failing the figure: inter-chromosomal blocks commonly exist
    # only at the coarser binsizes, and many .hic files have none at all
    m <- tryCatch(strawr::straw(norm, uri, loc(i), loc(j), unit = "BP", binsize = binsize),
                  error = function(e) NULL)
    if (is.null(m) || !nrow(m)) return(NULL)
    if (transposed(i, j)) m[c("x", "y")] <- m[c("y", "x")]
    # the four corners of each bin-bin square, each end on its own region's axis
    cx <- on_axis(c(m$x, m$x + binsize, m$x + binsize, m$x), i)
    cy <- on_axis(c(m$y, m$y, m$y + binsize, m$y + binsize), j)
    data.frame(gx = (cx + cy) / 2, gy = (cy - cx) / 2, counts = rep(m$counts, 4),
               # one group per contact, per pair, so no two diamonds merge
               group = paste(i, j, rep(seq_len(nrow(m)), 4), sep = "-"))
  }
  n <- nrow(regions)
  ij <- subset(expand.grid(j = seq_len(n), i = seq_len(n)), i <= j)
  do.call(rbind, Map(block, ij$i, ij$j))
}
