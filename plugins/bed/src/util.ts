import type BED from '@gmod/bed'

export function defaultParser(fields: string[], splitLine: string[]) {
  let hasBlockCount = false
  const r = [] as [string, string][]

  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < splitLine.length; i++) {
    if (fields[i] === 'blockCount') {
      hasBlockCount = true
    }
    r.push([fields[i]!, splitLine[i]!] as const)
  }
  // heuristically try to determine whether to follow 'slow path' as there can
  // be many features in e.g. GWAS type data
  const obj = Object.fromEntries(r)
  // slow path
  if (hasBlockCount) {
    const {
      blockStarts,
      blockCount,
      chromStarts,
      thickEnd,
      thickStart,
      blockSizes,
      ...rest
    } = obj

    return {
      ...rest,
      blockStarts: arrayify(blockStarts),
      chromStarts: arrayify(chromStarts),
      blockSizes: arrayify(blockSizes),
      thickStart: thickStart ? +thickStart : undefined,
      thickEnd: thickEnd ? +thickEnd : undefined,
      blockCount: blockCount ? +blockCount : undefined,
    } as Record<string, unknown>
  }

  // fast path
  else {
    return obj
  }
}

export function makeBlocks({
  start,
  uniqueId,
  refName,
  chromStarts,
  blockCount,
  blockSizes,
  blockStarts,
}: {
  blockCount: number
  start: number
  uniqueId: string
  refName: string
  chromStarts?: number[]
  blockSizes?: number[]
  blockStarts?: number[]
}) {
  const subfeatures = []
  const starts = chromStarts || blockStarts || []
  for (let b = 0; b < blockCount; b++) {
    const bmin = (starts[b] || 0) + start
    const bsize = blockSizes?.[b]
    if (bsize && bsize > 0) {
      const bmax = bmin + bsize
      subfeatures.push({
        uniqueId: `${uniqueId}-${b}`,
        start: bmin,
        end: bmax,
        refName,
        type: 'block',
      })
    }
  }
  return subfeatures
}

export function arrayify(input?: string | number[]): number[] | undefined {
  if (input === undefined) {
    return undefined
  }

  return typeof input === 'string'
    ? input.split(',').map(value => +value)
    : input
}

export function featureData2({
  splitLine,
  parser,
  uniqueId,
  names,
}: {
  splitLine: string[]
  refName: string
  start: number
  end: number
  parser: BED
  uniqueId: string
  scoreColumn: string
  names?: string[]
}) {
  const data = names
    ? defaultParser(names, splitLine)
    : parser.parseLine(splitLine, { uniqueId })

  return data
}
