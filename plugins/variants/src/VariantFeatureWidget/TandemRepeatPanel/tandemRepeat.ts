import {
  IUPAC,
  TANDEM_REPEAT,
  numbers,
  runsBp,
  strings,
  tandemAlleles,
} from '../../shared/tandemRepeatRuns.ts'

import type { ParsedRun } from '../../shared/tandemRepeatRuns.ts'
import type { VCFFeatureSerialized } from '../types.ts'

// A tandem repeat's alleles as the view draws them, read off one VCF 4.5
// <CNV:TR> record's runs. A sample's GT picks its alleles.

// `count` copies of one unit, which indexes TandemRepeat.units
interface RepeatRun {
  unit: number
  count: number
  bp: number
  // each copy's bases (RUB), where the record states them
  copyBp?: number[]
}

export interface RepeatUnit {
  length: number
  // RUNAME's name for the unit, where the record gives one
  name?: string
  // copies across the record's alleles, which orders the units
  copies: number
  sequence?: string
}

// The reference allele states no runs. `altIndex` is the allele's GT index, 0
// for the reference; `count` is the called alleles carrying it, where the
// allele stands for every haplotype that does
export interface RepeatAllele {
  label: string
  bp: number
  altIndex: number
  runs?: RepeatRun[]
  count?: number
}

export interface TandemRepeat {
  name?: string
  refName: string
  start: number
  end: number
  // what the reference allele is ticked by
  unitLength?: number
  units: RepeatUnit[]
  // one per called haplotype, or one per ALT allele of a record with no samples
  alleles: RepeatAllele[]
  // one per allele the samples carry, most frequent first; undefined without
  // called samples
  byAllele?: RepeatAllele[]
  // called alleles across samples, the denominator of each allele's frequency
  calledAlleles: number
}

function info(f: VCFFeatureSerialized, name: string): unknown {
  return f.INFO?.[name]
}

function unitsOf(alleles: (ParsedRun[] | undefined)[]) {
  const units = new Map<string, RepeatUnit & { key: string }>()
  for (const { key, length, name, sequence, count } of alleles.flatMap(
    runs => runs ?? [],
  )) {
    const known = units.get(key)
    const copies = (known?.copies ?? 0) + count
    const named = known?.name ?? name
    units.set(key, {
      key,
      length,
      ...(named ? { name: named } : {}),
      copies,
      ...(sequence ? { sequence } : {}),
    })
  }
  return [...units.values()].sort(
    (a, b) =>
      b.copies - a.copies || a.length - b.length || a.key.localeCompare(b.key),
  )
}

// A stated unit length, else the length of the first unit sequence
function unitLengthOf(f: VCFFeatureSerialized) {
  const rul = numbers(info(f, 'RUL')).find(n => n !== undefined)
  if (rul) {
    return rul
  }
  const rus = strings(info(f, 'RUS'))[0]
  return rus && IUPAC.test(rus) ? rus.length : undefined
}

// A phased genotype's k-th allele is PanSN haplotype k, the order vg
// deconstruct writes an assembly's haplotypes in
function labelOf(sample: string, k: number, called: number, phased: boolean) {
  if (phased) {
    return `${sample}#${k + 1}`
  }
  return called > 1 ? `${sample} (${k + 1})` : sample
}

interface DrawnAllele {
  label: string
  bp: number
  altIndex: number
  runs?: ParsedRun[]
  count?: number
}

function sampleAlleles(
  f: VCFFeatureSerialized,
  alleles: (ParsedRun[] | undefined)[],
  referenceBp: number,
) {
  const out: DrawnAllele[] = []
  const counts = new Map<number, number>()
  let calledAlleles = 0
  for (const [sample, fields] of Object.entries(f.samples ?? {})) {
    const gt = strings(fields.GT)[0] ?? ''
    const phased = gt.includes('|')
    const called = gt.split(/[/|]/).flatMap((index, k) => {
      const i = Number(index)
      if (index === '' || !Number.isInteger(i)) {
        return []
      }
      counts.set(i, (counts.get(i) ?? 0) + 1)
      calledAlleles++
      const runs = i > 0 ? alleles[i - 1] : undefined
      if (i > 0 && !runs) {
        return []
      }
      return [
        runs
          ? { k, altIndex: i, bp: runsBp(runs), runs }
          : { k, altIndex: i, bp: referenceBp },
      ]
    })
    for (const { k, ...allele } of called) {
      out.push({ label: labelOf(sample, k, called.length, phased), ...allele })
    }
  }
  return { haplotypes: out, counts, calledAlleles }
}

function formatPercent(count: number, total: number) {
  const pct = (count / total) * 100
  return `${pct >= 10 ? pct.toFixed(0) : pct.toPrecision(2)}%`
}

function byAlleleOf(
  alleles: (ParsedRun[] | undefined)[],
  counts: Map<number, number>,
  calledAlleles: number,
  referenceBp: number,
) {
  const distinct: DrawnAllele[] = [
    { label: 'REF', bp: referenceBp, altIndex: 0 },
    ...alleles.flatMap((runs, i) =>
      runs
        ? [
            {
              label: `ALT ${i + 1}`,
              bp: runsBp(runs),
              altIndex: i + 1,
              runs,
            },
          ]
        : [],
    ),
  ]
  return distinct
    .map(allele => ({ ...allele, count: counts.get(allele.altIndex) ?? 0 }))
    .filter(allele => allele.count > 0)
    .sort((a, b) => b.count - a.count || a.altIndex - b.altIndex)
    .map(allele => ({
      ...allele,
      label: `${allele.label} · ${formatPercent(allele.count, calledAlleles)}`,
    }))
}

// The record's alleles, one per called haplotype, or the ALT alleles of a
// record with no samples; undefined when no <CNV:TR> allele states its runs.
// POS is the base before the array and SVLEN the reference allele's length,
// while a VCF feature starts at that padding base.
export function tandemRepeatOf(
  f: VCFFeatureSerialized,
): TandemRepeat | undefined {
  if (!f.ALT?.includes(TANDEM_REPEAT)) {
    return undefined
  }
  const alleles = tandemAlleles(f.ALT, f.INFO)
  if (!alleles.some(runs => runs !== undefined)) {
    return undefined
  }
  const refName = f.refName
  const start = f.start + 1
  const svlen = numbers(info(f, 'SVLEN'))[f.ALT.indexOf(TANDEM_REPEAT)]
  const end = svlen === undefined ? f.end : start + Math.abs(svlen)
  const { haplotypes, counts, calledAlleles } = sampleAlleles(
    f,
    alleles,
    end - start,
  )
  if (haplotypes.length === 0 && calledAlleles > 0) {
    return undefined
  }
  const drawn =
    haplotypes.length > 0
      ? haplotypes
      : alleles.flatMap((runs, i) =>
          runs
            ? [
                {
                  label: `ALT ${i + 1}`,
                  bp: runsBp(runs),
                  altIndex: i + 1,
                  runs,
                },
              ]
            : [],
        )
  const units = unitsOf(alleles)
  const index = new Map(units.map((u, i) => [u.key, i]))
  const withUnits = ({ runs, ...allele }: DrawnAllele): RepeatAllele => ({
    ...allele,
    ...(runs
      ? {
          runs: runs.map(
            ({ key, length: _length, name: _name, sequence: _s, ...run }) => ({
              unit: index.get(key)!,
              ...run,
            }),
          ),
        }
      : {}),
  })
  return {
    name: strings(f.name)[0],
    refName,
    start,
    end,
    unitLength: unitLengthOf(f),
    units: units.map(({ key: _key, ...unit }) => unit),
    alleles: drawn.map(withUnits),
    ...(calledAlleles > 0
      ? {
          byAllele: byAlleleOf(alleles, counts, calledAlleles, end - start).map(
            withUnits,
          ),
        }
      : {}),
    calledAlleles,
  }
}
