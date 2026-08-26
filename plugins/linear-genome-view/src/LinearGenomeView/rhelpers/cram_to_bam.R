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
    # That lookup returns a WHOLE reference sequence, so it is minutes per
    # chromosome, and this helper runs once per panel per region - a coverage +
    # pileup view of one CRAM region fetched the same ~200 Mb chromosome twice,
    # and a multi-region view once more per region. REF_CACHE is htslib's own
    # answer: it stores what it fetched and reuses it, so only the first call
    # pays. Scoped to the R session's tempdir, which keeps a large download off
    # the user's disk for good; point REF_CACHE at a persistent directory (or
    # populate one with samtools' seq_cache_populate.pl) to keep it across runs.
    cache <- Sys.getenv("REF_CACHE")
    if (!nzchar(cache)) {
      dir.create(file.path(tempdir(), "hts-ref"), showWarnings = FALSE, recursive = TRUE)
      cache <- file.path(tempdir(), "hts-ref", "%2s", "%2s", "%s")
    }
    ok <- decode(character(0), c(
      if (nzchar(Sys.getenv("REF_PATH"))) character(0)
      else "REF_PATH=https://www.ebi.ac.uk/ena/cram/md5/%s",
      paste0("REF_CACHE=", cache)))
  }
  if (!ok) stop("samtools failed to decode CRAM: ", uri)
  Rsamtools::indexBam(out)
  out
}
