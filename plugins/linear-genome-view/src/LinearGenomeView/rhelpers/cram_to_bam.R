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
  decode <- function(extra, env = character(0)) system2("samtools",
    c("view", "-b", "-o", out, extra, uri, region), env = env) == 0
  have_ref <- !is.null(ref) && nzchar(ref)
  ok <- decode(if (have_ref) c("-T", ref) else character(0))
  if (!ok) {
    # Two ways a perfectly readable CRAM fails here, and a public one usually
    # hits both:
    #
    #  - given -T, samtools uses ONLY that fasta, so a reference whose contigs
    #    are named differently from the CRAM header ("1" vs "chr9") fails. A
    #    JBrowse assembly routinely pairs a no-prefix fasta with refname
    #    aliases, and that fasta is where `ref` comes from.
    #  - unaided, samtools resolves each sequence by MD5 - starting from the
    #    CRAM's UR header, which for a published file is typically the
    #    producer's own cluster path and long gone. Modern htslib does not fall
    #    back to a remote lookup by itself.
    #
    # So retry unaided with the ENA md5 service as REF_PATH, htslib's documented
    # recipe for precisely this. An existing REF_PATH (a local REF_CACHE, an
    # offline mirror) is left alone.
    message("samtools could not decode ", uri,
            if (have_ref) paste0(" against ", ref) else "",
            " - retrying by MD5 reference lookup")
    ok <- decode(character(0),
      if (nzchar(Sys.getenv("REF_PATH"))) character(0)
      else "REF_PATH=https://www.ebi.ac.uk/ena/cram/md5/%s")
  }
  if (!ok) stop("samtools failed to decode CRAM: ", uri)
  Rsamtools::indexBam(out)
  out
}
