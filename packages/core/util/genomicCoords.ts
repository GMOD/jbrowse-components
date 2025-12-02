import { getSnapshot, isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { parseLocString } from './locString'
import { checkStopToken } from './stopToken'

import type { ParsedLocString } from './locString'
import type { Feature } from './simpleFeature'
import type { AssemblyManager, Region } from './types'
import type { Region as MUIRegion } from './types/mst'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Fast number formatter with thousand separators
// Benchmarked at 5-67x faster than toLocaleString('en-US')
export function toLocale(n: number) {
  if (n < 1000) {
    return String(n)
  }
  const str = String(n)
  const len = str.length
  let result = ''
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) {
      result += ','
    }
    result += str[i]
  }
  return result
}

/**
 * Assemble a 1-based "locString" from an interbase genomic location
 * @param region - Region
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', start: 0, end: 100 })
 * // ↳ 'chr1:1..100'
 * ```
 * @example
 * ```ts
 * assembleLocString({ assemblyName: 'hg19', refName: 'chr1', start: 0, end: 100 })
 * // ↳ '{hg19}chr1:1..100'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1' })
 * // ↳ 'chr1'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', start: 0 })
 * // ↳ 'chr1:1..'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', end: 100 })
 * // ↳ 'chr1:1..100'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', start: 0, end: 1 })
 * // ↳ 'chr1:1'
 * ```
 */
export function assembleLocString(region: ParsedLocString) {
  return assembleLocStringFast(region, toLocale)
}

// same as assembleLocString above, but does not perform toLocaleString which
// can slow down the speed of block calculations which use assembleLocString
// for block.key
export function assembleLocStringFast(
  region: ParsedLocString,
  cb = (n: number): string | number => n,
) {
  const { assemblyName, refName, start, end, reversed } = region
  const assemblyNameString = assemblyName ? `{${assemblyName}}` : ''
  let startString: string
  if (start !== undefined) {
    startString = `:${cb(start + 1)}`
  } else if (end !== undefined) {
    startString = ':1'
  } else {
    startString = ''
  }
  let endString: string
  if (end !== undefined) {
    endString = start !== undefined && start + 1 === end ? '' : `..${cb(end)}`
  } else {
    endString = start !== undefined ? '..' : ''
  }
  let rev = ''
  if (reversed) {
    rev = '[rev]'
  }
  return `${assemblyNameString}${refName}${startString}${endString}${rev}`
}

export function compareLocs(locA: ParsedLocString, locB: ParsedLocString) {
  const assemblyComp =
    locA.assemblyName || locB.assemblyName
      ? (locA.assemblyName || '').localeCompare(locB.assemblyName || '')
      : 0
  if (assemblyComp) {
    return assemblyComp
  }

  const refComp =
    locA.refName || locB.refName
      ? (locA.refName || '').localeCompare(locB.refName || '')
      : 0
  if (refComp) {
    return refComp
  }

  if (locA.start !== undefined && locB.start !== undefined) {
    const startComp = locA.start - locB.start
    if (startComp) {
      return startComp
    }
  }
  if (locA.end !== undefined && locB.end !== undefined) {
    const endComp = locA.end - locB.end
    if (endComp) {
      return endComp
    }
  }
  return 0
}

export function compareLocStrings(
  a: string,
  b: string,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
) {
  const locA = parseLocString(a, isValidRefName)
  const locB = parseLocString(b, isValidRefName)
  return compareLocs(locA, locB)
}

function roundToNearestPointOne(num: number) {
  return Math.round(num * 10) / 10
}

/**
 * @param bp -
 * @param region -
 * @param bpPerPx -
 */
export function bpToPx(
  bp: number,
  {
    reversed,
    end = 0,
    start = 0,
  }: { start?: number; end?: number; reversed?: boolean },
  bpPerPx: number,
) {
  return roundToNearestPointOne((reversed ? end - bp : bp - start) / bpPerPx)
}

interface MinimalRegion {
  start: number
  end: number
  reversed?: boolean
}

export function featureSpanPx(
  feature: Feature,
  region: MinimalRegion,
  bpPerPx: number,
) {
  return bpSpanPx(feature.get('start'), feature.get('end'), region, bpPerPx)
}

export function bpSpanPx(
  leftBp: number,
  rightBp: number,
  region: MinimalRegion,
  bpPerPx: number,
) {
  const start = bpToPx(leftBp, region, bpPerPx)
  const end = bpToPx(rightBp, region, bpPerPx)
  return region.reversed ? ([end, start] as const) : ([start, end] as const)
}

/**
 * Calculate layout bounds for a feature, accounting for reversed regions.
 *
 * When labels are wider than features, the layout needs extra space:
 * - Normal: extend towards higher genomic coords (visual right)
 * - Reversed: extend towards lower genomic coords (visual right when reversed)
 *
 * This ensures labels always extend towards visual right of the feature.
 *
 * @param featureStart - Feature's genomic start coordinate
 * @param featureEnd - Feature's genomic end coordinate
 * @param layoutWidthBp - Total layout width in base pairs (may include label space)
 * @param reversed - Whether the region is reversed
 * @returns [layoutStart, layoutEnd] in genomic coordinates
 */
export function calculateLayoutBounds(
  featureStart: number,
  featureEnd: number,
  layoutWidthBp: number,
  reversed?: boolean,
): [number, number] {
  const featureWidthBp = featureEnd - featureStart
  const labelOverhangBp = Math.max(0, layoutWidthBp - featureWidthBp)

  // When reversed, extend towards lower genomic coords (visual right when reversed)
  // When normal, extend towards higher genomic coords (visual right when normal)
  return reversed
    ? [featureStart - labelOverhangBp, featureEnd]
    : [featureStart, featureStart + layoutWidthBp]
}

export function renameRegionIfNeeded(
  refNameMap: Record<string, string> | undefined,
  region: Region | Instance<typeof MUIRegion>,
): Region & { originalRefName?: string } {
  if (isStateTreeNode(region) && !isAlive(region)) {
    return region
  }

  if (refNameMap?.[region.refName]) {
    // clone the region so we don't modify it
    region = isStateTreeNode(region)
      ? { ...getSnapshot(region) }
      : { ...region }

    // modify it directly in the container
    const newRef = refNameMap[region.refName]
    if (newRef) {
      return { ...region, refName: newRef, originalRefName: region.refName }
    }
  }
  return region
}

export async function renameRegionsIfNeeded<
  ARGTYPE extends {
    assemblyName?: string
    regions?: Region[]
    stopToken?: string
    adapterConfig: Record<string, unknown>
    sessionId: string
    statusCallback?: (arg: string) => void
  },
>(assemblyManager: AssemblyManager, args: ARGTYPE) {
  const { regions = [], adapterConfig } = args
  if (!args.sessionId) {
    throw new Error('sessionId is required')
  }

  const assemblyNames = regions.map(region => region.assemblyName)
  const assemblyMaps = Object.fromEntries(
    await Promise.all(
      [...new Set(assemblyNames)].map(async assemblyName => {
        return [
          assemblyName,
          await assemblyManager.getRefNameMapForAdapter(
            adapterConfig,
            assemblyName,
            args,
          ),
        ]
      }),
    ),
  )

  return {
    ...args,
    regions: regions.map((region, i) =>
      // note: uses assemblyNames defined above since region could be dead now
      renameRegionIfNeeded(assemblyMaps[assemblyNames[i]!], region),
    ),
  }
}

function r(s: number) {
  return toLocale(Number.parseFloat(s.toPrecision(3)))
}

export function getBpDisplayStr(total: number) {
  if (Math.floor(total / 1_000_000) > 0) {
    return `${r(total / 1_000_000)}Mbp`
  } else if (Math.floor(total / 1_000) > 0) {
    return `${r(total / 1_000)}Kbp`
  } else {
    return `${Math.floor(total)}bp`
  }
}

export function getProgressDisplayStr(current: number, total: number) {
  if (Math.floor(total / 1_000_000) > 0) {
    return `${r(current / 1_000_000)}/${r(total / 1_000_000)}Mb`
  } else if (Math.floor(total / 1_000) > 0) {
    return `${r(current / 1_000)}/${r(total / 1_000)}Kb`
  } else {
    return `${r(current)}/${r(total)}}bytes`
  }
}

export function getTickDisplayStr(totalBp: number, bpPerPx: number) {
  return Math.floor(bpPerPx / 1_000) > 0
    ? `${toLocale(Number.parseFloat((totalBp / 1_000_000).toFixed(2)))}M`
    : toLocale(Math.floor(totalBp))
}

export function bytesForRegions(
  regions: Region[],
  index: {
    blocksForRange: (
      ref: string,
      start: number,
      end: number,
    ) => Promise<{ minv: { blockPosition: number }; maxv: { blockPosition: number } }[]>
  },
) {
  return Promise.all(
    regions.map(r => index.blocksForRange(r.refName, r.start, r.end)),
  ).then(blockResults =>
    blockResults
      .flat()
      .reduce(
        (sum, block) =>
          sum + block.maxv.blockPosition + 65535 - block.minv.blockPosition,
        0,
      ),
  )
}

export function shorten(name: string, max = 70, short = 30) {
  return name.length > max
    ? `${name.slice(0, short)}...${name.slice(-short)}`
    : name
}

export function shorten2(name: string, max = 70) {
  return name.length > max ? `${name.slice(0, max)}...` : name
}

export function stringify(
  {
    refName,
    coord,
    assemblyName,
    oob,
  }: {
    assemblyName?: string
    coord: number
    refName?: string
    oob?: boolean
  },
  useAssemblyName?: boolean,
) {
  return [
    assemblyName && useAssemblyName ? `{${assemblyName}}` : '',
    refName
      ? `${shorten(refName)}:${toLocale(coord)}${oob ? ' (out of bounds)' : ''}`
      : '',
  ].join('')
}

export async function updateStatus<U>(
  msg: string,
  cb: (arg: string) => void,
  fn: () => U | Promise<U>,
) {
  cb(msg)
  const res = await fn()
  cb('')
  return res
}

export async function updateStatus2<U>(
  msg: string,
  cb: (arg: string) => void,
  stopToken: string | undefined,
  fn: () => U | Promise<U>,
) {
  cb(msg)
  const res = await fn()
  checkStopToken(stopToken)
  cb('')
  return res
}
