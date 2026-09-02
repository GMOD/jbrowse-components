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
 * What counts as an `ID` here has to be what counts as one to gff-nostream's
 * linker, or the bound and the tree disagree: a line this admits but the linker
 * ignores only widens the bound, but a line the linker registers and this
 * rejects drops a flank a feature's children are in, which is the truncated
 * gene this mechanism exists to prevent. The linker lowercases tags (`id=` is
 * an ID) and, from 5.4.0, trims the space real files put after a `;`, so this
 * scan does both. gff-nostream 5.4.0 exports `hasIdAttribute` from that same
 * scan; this regex stands in until the dependency moves.
 */
export function hasIdAttribute(line: string) {
  return /(^|;)\s*ID\s*=[^;]/i.test(line.slice(line.lastIndexOf('\t') + 1))
}
