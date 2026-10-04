// A VCF 4.5 <CNV:TR> allele's runs: RN says how many RUS/RUL/RUC/RB entries
// each allele takes, and RUB holds one entry per copy of every run.

export const TANDEM_REPEAT = '<CNV:TR>'

export const IUPAC = /^[ACGTURYSWKMBDHVN]+$/i

// A list field parsed, or as the comma-joined text a VCF column holds
export function numbers(value: unknown) {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : String(value ?? '').split(',')
  return raw.map(one => {
    const n =
      one === '' || one === null || one === undefined ? NaN : Number(one)
    return Number.isFinite(n) ? n : undefined
  })
}

export function strings(value: unknown) {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : String(value ?? '').split(',')
  return raw.map(one => {
    const text = String(one ?? '').trim()
    return text === '' || text === '.' ? undefined : text
  })
}

export interface ParsedRun {
  key: string
  length: number
  sequence?: string
  count: number
  bp: number
  copyBp?: number[]
}

// Each ALT allele's runs; undefined for an allele that is not <CNV:TR> or has a
// run stating no unit
export function tandemAlleles(
  alt: unknown,
  info: Record<string, unknown> | undefined,
) {
  const alts = strings(alt)
  const rn = numbers(info?.RN)
  const rus = strings(info?.RUS)
  const rul = numbers(info?.RUL)
  const ruc = numbers(info?.RUC)
  const rb = numbers(info?.RB)
  const rub = numbers(info?.RUB).filter(bp => bp !== undefined)
  const counted = ruc.every(Number.isInteger)
  let k = 0
  let copy = 0
  return alts.map((alt, i) => {
    const n = rn[i] ?? (alt === TANDEM_REPEAT ? 1 : 0)
    const runs: ParsedRun[] = []
    for (let j = 0; j < n; j++, k++) {
      const stated = rus[k]
      const sequence = stated && IUPAC.test(stated) ? stated : undefined
      const length = rul[k] ?? sequence?.length
      const bp = rb[k]
      const count =
        ruc[k] ?? (length && bp !== undefined ? bp / length : undefined)
      if (length && count !== undefined && count > 0) {
        const copyBp =
          counted && rub.length > 0 ? rub.slice(copy, copy + count) : undefined
        runs.push({
          key: sequence ?? String(length),
          length,
          ...(sequence ? { sequence } : {}),
          count,
          bp: bp ?? Math.round(length * count),
          ...(copyBp?.length === count ? { copyBp } : {}),
        })
      }
      copy += count ?? 0
    }
    return alt === TANDEM_REPEAT && runs.length === n ? runs : undefined
  })
}

export function runsBp(runs: ParsedRun[]) {
  return runs.reduce((s, r) => s + r.bp, 0)
}
