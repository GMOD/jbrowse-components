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

export function chainCollinearAlignments(
  features: FeatureLike[],
  maxGap: number,
) {
  if (features.length <= 1) {
    return features
  }

  const infos = features.map((f, i) => {
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

  const groups = new Map<string, (typeof infos)[number][]>()
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

    let chainStartIdx = 0
    for (let i = 1; i <= group.length; i++) {
      let shouldBreak = i === group.length

      if (!shouldBreak) {
        const prev = group[i - 1]!
        const curr = group[i]!
        const refGap = curr.start - prev.end
        const queryGap =
          curr.strand === -1
            ? prev.mateStart - curr.mateEnd
            : curr.mateStart - prev.mateEnd
        shouldBreak =
          refGap < 0 || refGap > maxGap || queryGap < 0 || queryGap > maxGap
      }

      if (shouldBreak) {
        const chain = group.slice(chainStartIdx, i)
        chainStartIdx = i

        if (chain.length === 1) {
          result.push(features[chain[0]!.index]!)
        } else {
          const firstFeat = features[chain[0]!.index]!
          const mergedStart = chain[0]!.start
          const mergedEnd = chain.at(-1)!.end

          let mergedMateStart = Infinity
          let mergedMateEnd = -Infinity
          let totalWeight = 0
          let weightedIdentity = 0

          for (const c of chain) {
            mergedMateStart = Math.min(mergedMateStart, c.mateStart)
            mergedMateEnd = Math.max(mergedMateEnd, c.mateEnd)
            const f = features[c.index]!
            const identity = f.get('identity') as number | undefined
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
                refName: chain[0]!.refName,
                start: mergedStart,
                end: mergedEnd,
                strand: chain[0]!.strand,
                mate: {
                  ...firstMate,
                  start: mergedMateStart,
                  end: mergedMateEnd,
                },
                name: firstFeat.get('name'),
                assemblyName: firstFeat.get('assemblyName'),
                identity:
                  totalWeight > 0
                    ? weightedIdentity / totalWeight
                    : undefined,
                CIGAR: '',
                syriType: undefined,
              },
              `chain-${chainId++}`,
            ),
          )
        }
      }
    }
  }

  return result
}
