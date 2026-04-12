export interface FeatureLike {
  get(key: string): unknown
  id(): string
}

class MergedFeature implements FeatureLike {
  private props: Record<string, unknown>
  private _id: string

  constructor(props: Record<string, unknown>, id: string) {
    this.props = props
    this._id = id
  }

  get(key: string) {
    return this.props[key]
  }

  id() {
    return this._id
  }
}

interface AlignmentInfo {
  index: number
  refName: string
  start: number
  end: number
  strand: number
  mateRefName: string
  mateStart: number
  mateEnd: number
}

function isCollinear(prev: AlignmentInfo, curr: AlignmentInfo, maxGap: number) {
  const refGap = curr.start - prev.end
  if (refGap < 0 || refGap > maxGap) {
    return false
  }
  const queryGap =
    curr.strand === -1
      ? prev.mateStart - curr.mateEnd
      : curr.mateStart - prev.mateEnd
  return queryGap >= 0 && queryGap <= maxGap
}

export function chainCollinearAlignments(
  features: FeatureLike[],
  maxGap: number,
) {
  if (features.length <= 1) {
    return features
  }

  const infos: AlignmentInfo[] = features.map((f, i) => {
    const mate = f.get('mate') as {
      start: number
      end: number
      refName: string
    }
    return {
      index: i,
      refName: f.get('refName') as string,
      start: f.get('start') as number,
      end: f.get('end') as number,
      strand: f.get('strand') as number,
      mateRefName: mate.refName,
      mateStart: mate.start,
      mateEnd: mate.end,
    }
  })

  const groups = new Map<string, AlignmentInfo[]>()
  for (const info of infos) {
    const key = `${info.refName}\t${info.mateRefName}\t${info.strand}`
    let group = groups.get(key)
    if (!group) {
      group = []
      groups.set(key, group)
    }
    group.push(info)
  }

  const result: FeatureLike[] = []
  let chainId = 0

  for (const group of groups.values()) {
    group.sort((a, b) => a.start - b.start)

    let chainStart = 0
    for (let i = 1; i < group.length; i++) {
      if (!isCollinear(group[i - 1]!, group[i]!, maxGap)) {
        emitChain(group, chainStart, i, features, result, chainId++)
        chainStart = i
      }
    }
    emitChain(group, chainStart, group.length, features, result, chainId++)
  }

  return result
}

function emitChain(
  group: AlignmentInfo[],
  start: number,
  end: number,
  features: FeatureLike[],
  result: FeatureLike[],
  chainId: number,
) {
  if (end - start === 1) {
    result.push(features[group[start]!.index]!)
    return
  }

  const first = group[start]!
  const last = group[end - 1]!
  const firstFeat = features[first.index]!

  let mergedMateStart = Infinity
  let mergedMateEnd = -Infinity
  let totalWeight = 0
  let weightedIdentity = 0

  for (let i = start; i < end; i++) {
    const c = group[i]!
    mergedMateStart = Math.min(mergedMateStart, c.mateStart)
    mergedMateEnd = Math.max(mergedMateEnd, c.mateEnd)
    const identity = features[c.index]!.get('identity') as number | undefined
    const len = c.end - c.start
    if (identity !== undefined && identity >= 0) {
      weightedIdentity += identity * len
      totalWeight += len
    }
  }

  const firstMate = firstFeat.get('mate') as {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }

  result.push(
    new MergedFeature(
      {
        refName: first.refName,
        start: first.start,
        end: last.end,
        strand: first.strand,
        mate: {
          ...firstMate,
          start: mergedMateStart,
          end: mergedMateEnd,
        },
        name: firstFeat.get('name'),
        assemblyName: firstFeat.get('assemblyName'),
        identity:
          totalWeight > 0 ? weightedIdentity / totalWeight : undefined,
        CIGAR: '',
        syriType: undefined,
      },
      `chain-${chainId}`,
    ),
  )
}
