import type { Sample } from '../types.ts'

/**
 * A block can hold several rows of one sample: Cactus writes one per copy of a
 * duplicated segment, so HPRC's MAF gives a haplotype up to eight rows in a
 * block at the amylase locus. The first keeps the sample's id and each later
 * one becomes `sample~2`, `sample~3` in file order, which keeps a copy on the
 * same row from block to block (99.4% at amylase).
 */
const COPY_REGEX = /^(.+)~(\d+)$/

export function copyRowId(sampleId: string, copy: number) {
  return `${sampleId}~${copy}`
}

/** The sample a copy row belongs to, or undefined for a sample's own row. */
export function copyParent(rowId: string) {
  return COPY_REGEX.exec(rowId)?.[1]
}

/** `sampleId`, or its first copy id `taken` does not hold this block. */
export function freeRowId(sampleId: string, taken: (id: string) => boolean) {
  if (!taken(sampleId)) {
    return sampleId
  }
  let copy = 2
  while (taken(copyRowId(sampleId, copy))) {
    copy++
  }
  return copyRowId(sampleId, copy)
}

export function isRowVisible(rowId: string, visible: Set<string> | undefined) {
  if (!visible || visible.has(rowId)) {
    return true
  }
  const parent = copyParent(rowId)
  return parent !== undefined && visible.has(parent)
}

/**
 * `rows` with each copy row moved after its sample and that sample's earlier
 * copies; a copy whose sample is not a row keeps its place.
 */
export function placeCopyRows<T extends { name: string }>(rows: readonly T[]) {
  const copiesOf = new Map<string, T[]>()
  for (const row of rows) {
    const parent = copyParent(row.name)
    if (parent !== undefined) {
      const copies = copiesOf.get(parent)
      if (copies) {
        copies.push(row)
      } else {
        copiesOf.set(parent, [row])
      }
    }
  }
  if (!copiesOf.size) {
    return [...rows]
  }
  const names = new Set(rows.map(r => r.name))
  return rows.flatMap(row => {
    const parent = copyParent(row.name)
    return parent === undefined
      ? [row, ...(copiesOf.get(row.name) ?? [])]
      : names.has(parent)
        ? []
        : [row]
  })
}

/**
 * The rows for `samples` with each discovered copy row placed after its
 * sample, labelled and coloured as it. A copy of a sample `samples` does not
 * list joins the end.
 */
export function withCopyRows(
  samples: readonly Sample[],
  discovered: Iterable<string>,
): Sample[] {
  const copiesOf = new Map<string, string[]>()
  for (const id of discovered) {
    const parent = copyParent(id)
    if (parent !== undefined) {
      const copies = copiesOf.get(parent)
      if (copies) {
        copies.push(id)
      } else {
        copiesOf.set(parent, [id])
      }
    }
  }
  if (!copiesOf.size) {
    return [...samples]
  }
  const listed = new Set(samples.map(s => s.id))
  const out: Sample[] = []
  const placeCopies = (sample: Sample | undefined, parent: string) => {
    for (const id of copiesOf.get(parent) ?? []) {
      out.push({
        ...sample,
        id,
        label: `${sample?.label ?? parent} copy ${id.slice(parent.length + 1)}`,
      })
    }
  }
  for (const sample of samples) {
    if (copyParent(sample.id) === undefined) {
      out.push(sample)
      placeCopies(sample, sample.id)
    }
  }
  for (const parent of copiesOf.keys()) {
    if (!listed.has(parent)) {
      placeCopies(undefined, parent)
    }
  }
  return out
}
