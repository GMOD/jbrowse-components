/**
 * Whether a raw GFF3 line carries an `ID` attribute, which is the exact test for
 * whether it can have children: a child names its parent with `Parent=<ID>`, so
 * a record with no `ID` can be referenced by nothing.
 *
 * That makes it the honest bound for a redispatch. `dontRedispatch` approximates
 * the same question by naming landmark types, and can only ever approximate it —
 * every NCBI `GCF_*_genomic.gff.gz` opens each reference with a `match` record
 * spanning most of the chromosome, so a type list nobody thought to extend turns
 * every query on the most likely GFF3 a user brings into a chromosome-scale read.
 * None of those records has an `ID`. The list stays for the residual case this
 * cannot see — a wide record that has an `ID` nothing references, which hosted
 * hg19 RefSeq's chromosome-long `region` is.
 *
 * A scan of the attribute column rather than a parse, because it runs on every
 * line of every query ahead of the flanks. It anchors on the `;` separator so an
 * attribute merely ending in `ID` (`geneID=`) is not one, and tolerates space
 * after the separator, which the spec forbids and real files contain — the two
 * errors are not symmetric. A false positive only widens the bound to what it is
 * today; a false negative drops a flank a feature's children are in, which is
 * the truncated-gene rendering this whole mechanism exists to prevent.
 */
export function hasIdAttribute(line: string) {
  return /(^|;)\s*ID=/.test(line.slice(line.lastIndexOf('\t') + 1))
}
