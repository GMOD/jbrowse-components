# Vertical lines marking the boundary between consecutive regions on the
# cumulative axis (drawn in the middle of each inter-region gap). Nothing for a
# single region.
region_dividers <- function(regions) {
  if (nrow(regions) <= 1) return(geom_blank())
  geom_vline(xintercept = head(regions$cum_end, -1) + regions$gap[1] / 2,
             color = "grey70", linewidth = 0.4)
}
