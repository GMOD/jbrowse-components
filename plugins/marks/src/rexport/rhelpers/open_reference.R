# A reference sequence handle for whichever format the assembly stores it in.
# Both answer getSeq(handle, GRanges) the same way, so callers need not care.
# An indexed FASTA wants its .fai beside it; a 2bit carries its own index.
open_reference <- function(path) {
  if (grepl("\\.2bit$", path, ignore.case = TRUE)) {
    rtracklayer::TwoBitFile(path)
  } else {
    FaFile(path)
  }
}
