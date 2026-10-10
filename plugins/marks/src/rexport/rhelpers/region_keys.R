# Key each feature's id and parent by its '.region': a gene in view in two
# regions reads once per region, and a join on bare ids would hang one
# region's parts on the other's transcripts.
region_keys <- function(f) {
  key <- function(v) ifelse(is.na(v), NA_character_, paste0(f$.region, ":", v))
  f$id <- key(f$id)
  f$parent <- key(f$parent)
  f
}
