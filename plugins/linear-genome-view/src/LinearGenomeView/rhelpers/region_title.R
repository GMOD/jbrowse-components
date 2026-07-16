# Figure title: the locus for a single region, else a region count.
region_title <- function(regions) {
  if (nrow(regions) == 1)
    sprintf("%s:%s-%s", regions$chrom[1], format(regions$start[1] + 1, big.mark = ","),
            format(regions$end[1], big.mark = ","))
  else sprintf("%d regions \u00b7 %s bp", nrow(regions),
               format(sum(regions$end - regions$start), big.mark = ","))
}
