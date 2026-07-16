# Read a Hi-C contact matrix region (strawr - the reader from the .hic authors)
# and rotate it 45 degrees into diamond polygons so the map shares the genomic
# x-axis with the other stacked tracks (this is JBrowse's triangular Hi-C view).
# straw returns the upper triangle as data.frame(x, y, counts) of bin-start
# coords; each bin-bin square [x, x+binsize] x [y, y+binsize] becomes a diamond
# whose genomic x is the contact midpoint (x + y) / 2 and whose height gy is the
# interaction distance (y - x) / 2 (0 on the diagonal). Returns a long
# data.frame of polygon vertices with a 'group' per contact for geom_polygon.
# 'binsize' must be a resolution the file offers (strawr::readHicBpResolutions(
# uri)) and 'norm' a normalization it offers (strawr::readHicNormTypes(uri)) -
# both are editable script variables below (larger binsize = coarser/faster).
hic_triangle <- function(uri, chrom, start, end, binsize, norm) {
  loc <- sprintf("%s:%d:%d", chrom, start, end)
  m <- strawr::straw(norm, uri, loc, loc, unit = "BP", binsize = binsize)
  b <- binsize
  # four corners of each bin-bin square, rotated: gx = midpoint, gy = half-distance
  cx <- c(m$x, m$x + b, m$x + b, m$x)
  cy <- c(m$y, m$y, m$y + b, m$y + b)
  data.frame(gx = (cx + cy) / 2, gy = (cy - cx) / 2,
             counts = rep(m$counts, 4), group = rep(seq_len(nrow(m)), 4))
}
