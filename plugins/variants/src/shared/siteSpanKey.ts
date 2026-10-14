/**
 * The site a variant record belongs to. Records spanning the same reference
 * interval are alleles of one site, which is how `bcftools norm -m-` or vcfwave
 * writes a multiallelic site: one record per ALT. The anchored sort and the
 * phased clustering matrix both read a split site as the one record it was.
 */
export function siteSpanKey(refName: unknown, start: unknown, end: unknown) {
  return `${refName}:${start}:${end}`
}
