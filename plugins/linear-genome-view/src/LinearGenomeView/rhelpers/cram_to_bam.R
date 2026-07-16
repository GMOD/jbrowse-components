# Rsamtools/GenomicAlignments is a BAM-only reader and cannot open CRAM, so
# decode the queried region to a temporary indexed BAM with samtools (the
# standard CRAM tool) and hand that back for the bam_* helpers to read. samtools
# restores the MD tag from the reference while decoding, so the reference-free
# bam_mismatches walk still works. 'ref' is the reference FASTA; when NULL/empty
# samtools resolves the reference from the CRAM's own UR header or a
# REF_PATH/REF_CACHE cache. A plain (non-.cram) path is returned unchanged, so
# the same script works for BAM and CRAM tracks. Requires samtools on PATH.
cram_to_bam <- function(uri, chrom, start, end, ref = NULL) {
  if (!grepl("\\.cram$", uri, ignore.case = TRUE)) return(uri)
  out <- tempfile(fileext = ".bam")
  region <- sprintf("%s:%d-%d", chrom, start + 1, end)
  args <- c("view", "-b", "-o", out,
            if (!is.null(ref) && nzchar(ref)) c("-T", ref), uri, region)
  if (system2("samtools", args) != 0) stop("samtools failed to decode CRAM: ", uri)
  Rsamtools::indexBam(out)
  out
}
