import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import { classifyTrio, mostSevereTrioClass } from './classifyTrio.ts'

import type {
  PedigreeSex,
  TransmissionEntry,
  TrioClass,
} from './classifyTrio.ts'
import type { Source } from './types.ts'

/**
 * The field a variant's Mendelian check is read under: its most severe trio
 * call, which the worker computes from the trios the display sends, so no
 * record carries it.
 */
export const MENDELIAN_FIELD = 'mendelian'

const MENDELIAN_PRESET = UNIVERSAL_FIELD_PRESETS.mendelian

/** A Mendelian check value as the key names it. */
export function mendelianName(value: TrioClass) {
  return MENDELIAN_PRESET.scale.names[
    MENDELIAN_PRESET.scale.domain.indexOf(value)
  ]!
}

/**
 * A child among the VCF's samples with a parent among them, as sample names,
 * and the child's sex. A parent the pedigree names that is no VCF sample is
 * left unset, which makes the trio a duo.
 */
export interface Trio {
  child: string
  father?: string
  mother?: string
  sex?: PedigreeSex
}

export const NO_TRANSMISSION: readonly TransmissionEntry[] = []

function pedigreeSexOf(value: unknown) {
  const lower = typeof value === 'string' ? value.toLowerCase() : ''
  return lower === 'male' || lower === 'm'
    ? 'male'
    : lower === 'female' || lower === 'f'
      ? 'female'
      : lower === 'other'
        ? 'other'
        : undefined
}

/**
 * The trios among `sources`, by child name: each sample whose `father` or
 * `mother` attribute names another sample, with its `sex` read as the
 * pedigree writes it.
 */
export function triosOf(sources: readonly Source[]): Trio[] {
  const names = new Set(sources.map(source => source.name))
  const present = (value: unknown) =>
    typeof value === 'string' && names.has(value) ? value : undefined
  return sources
    .flatMap(source => {
      const father = present(source.father)
      const mother = present(source.mother)
      const sex: PedigreeSex | undefined = pedigreeSexOf(source.sex)
      return father !== undefined || mother !== undefined
        ? [
            {
              child: source.name,
              ...(father === undefined ? {} : { father }),
              ...(mother === undefined ? {} : { mother }),
              ...(sex === undefined ? {} : { sex }),
            },
          ]
        : []
    })
    .sort((a, b) => a.child.localeCompare(b.child))
}

/**
 * Each trio's call at one record, from `genotypeOf`, a sample's genotype
 * there. A parent the trio names with no genotype at the record is a no-call,
 * and a child with none is no call to make.
 */
export function trioCalls(
  trios: readonly Trio[],
  genotypeOf: (sample: string) => string | undefined,
  rule: readonly TransmissionEntry[],
) {
  return trios.map(trio => {
    const child = genotypeOf(trio.child)
    const parent = (name: string | undefined) =>
      name === undefined ? undefined : (genotypeOf(name) ?? '.')
    const call: TrioClass | undefined =
      child === undefined
        ? undefined
        : classifyTrio(child, parent(trio.father), parent(trio.mother), {
            sex: trio.sex,
            rule,
          })
    return { ...trio, call }
  })
}

export type TrioCall = ReturnType<typeof trioCalls>[number]

const SEX_INDEX = { male: 1, female: 2, other: 3 } as const

// a code past this skips the memo, whose key packs the sex and three codes
// into a double's 53 bits
const CODE_LIMIT = 2 ** 17

/**
 * The Mendelian check over interned genotype codes, built once per fetch:
 * each trio's columns in the canonical sample order, and a classification per
 * (rule, child sex, code triple) remembered, so a site costs a lookup per
 * trio. A parent named but holding no column, or code 0, reads as a no-call;
 * a child with code 0 makes no call. `genotypeDict` grows as the fetch
 * interns, and is read when a site asks.
 */
export function makeMendelianCheck({
  trios,
  columnByName,
  genotypeDict,
}: {
  trios: readonly Trio[]
  columnByName: ReadonlyMap<string, number>
  genotypeDict: readonly string[]
}) {
  const parentColumn = (name: string | undefined) =>
    name === undefined ? undefined : (columnByName.get(name) ?? -1)
  const columns = trios.flatMap(trio => {
    const child = columnByName.get(trio.child)
    return child === undefined
      ? []
      : [
          {
            child,
            father: parentColumn(trio.father),
            mother: parentColumn(trio.mother),
            sex: trio.sex,
            sexIndex: trio.sex === undefined ? 0 : SEX_INDEX[trio.sex],
          },
        ]
  })
  const memos = new Map<
    readonly TransmissionEntry[],
    Map<number, TrioClass | undefined>
  >()
  const classes: (TrioClass | undefined)[] = columns.map(() => undefined)
  const genotypeOfKey = (key: number) =>
    key === 0 ? undefined : key === 1 ? '.' : genotypeDict[key - 2]!
  const parentKey = (codes: Uint32Array, column: number | undefined) =>
    column === undefined ? 0 : column < 0 ? 1 : codes[column]! + 1
  const classify = (
    child: number,
    father: number,
    mother: number,
    sex: PedigreeSex | undefined,
    rule: readonly TransmissionEntry[],
  ) =>
    classifyTrio(
      genotypeDict[child - 1]!,
      genotypeOfKey(father),
      genotypeOfKey(mother),
      { sex, rule },
    )

  return columns.length === 0
    ? undefined
    : (codes: Uint32Array, rule: readonly TransmissionEntry[]) => {
        let memo = memos.get(rule)
        if (memo === undefined) {
          memo = new Map()
          memos.set(rule, memo)
        }
        for (let i = 0; i < columns.length; i++) {
          const trio = columns[i]!
          const child = codes[trio.child]!
          const father = parentKey(codes, trio.father)
          const mother = parentKey(codes, trio.mother)
          if (child === 0) {
            classes[i] = undefined
          } else if (
            child < CODE_LIMIT &&
            father < CODE_LIMIT &&
            mother < CODE_LIMIT
          ) {
            const key =
              ((trio.sexIndex * CODE_LIMIT + child) * CODE_LIMIT + father) *
                CODE_LIMIT +
              mother
            if (memo.has(key)) {
              classes[i] = memo.get(key)
            } else {
              const value = classify(child, father, mother, trio.sex, rule)
              memo.set(key, value)
              classes[i] = value
            }
          } else {
            classes[i] = classify(child, father, mother, trio.sex, rule)
          }
        }
        return mostSevereTrioClass(classes)
      }
}

/** A record's `genotypes`, sample to genotype, as read off a full record. */
export function genotypeMap(genotypes: unknown) {
  return new Map(
    typeof genotypes === 'object' && genotypes !== null
      ? Object.entries(genotypes).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        )
      : [],
  )
}
