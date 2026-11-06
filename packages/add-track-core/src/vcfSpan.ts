export interface VcfSpanRecord {
  POS: number
  REF?: string
  ALT?: string[]
  INFO: Record<string, unknown>
}

// Coerce a VCF INFO value (which may be a string like '5', a number, '.', or
// undefined) to a finite number, or undefined when it isn't numeric. VCF uses
// '.' for missing values, which would otherwise coerce to NaN and leak into
// feature coordinates / descriptions. null and '' are excluded before the
// coercion because Number() calls both 0 rather than NaN, and a missing entry is
// absent, not zero: @gmod/vcf parses '.' to undefined, which a snapshot
// round-trip (the feature widget's frozen prop, session storage) hands back as
// null, and that read as an SVLEN of 0bp / a mate at position 0.
export function parseFiniteNumber(value: unknown) {
  const n =
    value === null || value === undefined || value === ''
      ? Number.NaN
      : Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** The first entry of an INFO field as a number, when it holds one. */
export function firstNumericInfo(
  info: Record<string, unknown> | undefined,
  key: string,
) {
  const value = info?.[key]
  return Array.isArray(value) ? parseFiniteNumber(value[0]) : undefined
}

// INFO.END states the span of a record with no ALT (a gVCF reference block) and
// of one with a symbolic ALT. A translocation is single-breakpoint, and a
// breakend or a sequence allele takes its length from REF: callers put a
// mate's position, possibly on another contig, in END. No record draws shorter
// than its REF. The SVLEN fallback is for symbolic (angle-bracket) ALTs.
function vcfRecordEnd(record: VcfSpanRecord, start: number) {
  const { REF = '', ALT = [], INFO } = record
  const hasSymbolic = ALT.some(a => a.startsWith('<'))
  const hasTRA = ALT.includes('<TRA>')
  const statesSpan = ALT.length === 0 || hasSymbolic
  if (!hasTRA) {
    // an END at or before POS describes no span on this contig; real SV
    // callsets do emit them, and trusting one inserts an inverted interval into
    // the adapter's IntervalTree. Treat it as absent and keep falling back.
    const end = firstNumericInfo(INFO, 'END')
    if (statesSpan && end !== undefined && end > start) {
      return Math.max(end, start + REF.length)
    }
    if (hasSymbolic && Array.isArray(INFO.SVLEN)) {
      // the END the spec computes, |SVLEN| bases past POS, as core's
      // spannedEnd places the mate; an insertion consumes no reference, so its
      // END is POS. Missing ('.') and zero lengths drop out.
      const ends = INFO.SVLEN.map((len: unknown, i) => {
        if (ALT[i]?.startsWith('<INS')) {
          return start + 1
        }
        const n = parseFiniteNumber(len)
        return n ? start + 1 + Math.abs(n) : undefined
      }).filter(v => v !== undefined)
      if (ends.length > 0) {
        return Math.max(...ends, start + REF.length)
      }
    }
  }
  return start + REF.length
}

/** A VCF record's 0-based, half-open span on its own contig. */
export function vcfRecordSpan(record: VcfSpanRecord) {
  const start = record.POS - 1
  return { start, end: vcfRecordEnd(record, start) }
}
