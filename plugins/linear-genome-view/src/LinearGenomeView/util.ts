import {
  UnknownRefNameError,
  assembleLocString,
  parseLocString,
} from '@jbrowse/core/util'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'

import type { AssemblyManager, ParsedLocString } from '@jbrowse/core/util'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'

/**
 * Expand a region by a grow factor, adding padding on each side.
 *
 * @param start - region start coordinate
 * @param end - region end coordinate
 * @param grow - multiplier for expansion (e.g., 0.2 adds 20% padding on each
 * side)
 * @param minBound - minimum bound to clamp start to (default 0)
 * @param maxBound - maximum bound to clamp end to (default Infinity)
 * @returns object with expanded start and end coordinates
 */
export function expandRegion(
  start: number,
  end: number,
  grow: number,
  minBound = 0,
  maxBound = Infinity,
) {
  const len = end - start
  const margin = len * grow
  return {
    start: Math.max(minBound, start - margin),
    end: Math.min(maxBound, end + margin),
  }
}

/**
 * Generate tick positions for the overview scalebar. Anchors at the first neat
 * majorPitch multiple strictly inside the block so ticks land on round numbers
 * regardless of where the block starts/ends.
 */
export function makeOverviewTicks(
  start: number,
  end: number,
  overviewScale: number,
  reversed = false,
) {
  const { majorPitch } = chooseGridPitch(overviewScale, 120, 15)
  const firstTick = reversed
    ? Math.floor((end - 1) / majorPitch) * majorPitch
    : Math.ceil((start + 1) / majorPitch) * majorPitch
  const numTicks = reversed
    ? Math.floor((firstTick - start - 1) / majorPitch) + 1
    : Math.floor((end - firstTick) / majorPitch) + 1
  return Array.from({ length: Math.max(0, numTicks) }, (_, i) => {
    const genomicCoord = reversed
      ? firstTick - i * majorPitch
      : firstTick + i * majorPitch
    const offsetPx = reversed
      ? (end - genomicCoord) / overviewScale
      : (genomicCoord - start) / overviewScale
    return { genomicCoord, offsetPx }
  })
}

export function makeTicks(
  start: number,
  end: number,
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)

  let minBase = start
  let maxBase = end

  if (bpPerPx < 0) {
    ;[minBase, maxBase] = [maxBase, minBase]
  }

  // add 20px additional on the right and left to allow us to draw the ends
  // of labels that lie a little outside our region
  minBase -= Math.abs(20 * bpPerPx) - 1
  maxBase += Math.abs(20 * bpPerPx) + 1

  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  let index = 0
  const ticks = []
  for (
    let base = Math.floor(minBase / iterPitch) * iterPitch;
    base < Math.ceil(maxBase / iterPitch) * iterPitch + 1;
    base += iterPitch
  ) {
    if (emitMinor && base % (gridPitch.majorPitch * 2)) {
      ticks.push({ type: 'minor', base: base - 1, index })
      index++
    } else if (emitMajor && !(base % (gridPitch.majorPitch * 2))) {
      ticks.push({ type: 'major', base: base - 1, index })
      index++
    }
  }
  return ticks
}

/**
 * For blocks in display order, returns whether each block's refName should be
 * labeled: true only for the first block of each run of same-refName regions,
 * so a refName is shown once instead of repeated at every region boundary (e.g.
 * collapsed introns produce many adjacent same-refName regions). Blocks whose
 * getRefName is undefined (non-content) map to false without breaking a run.
 */
/** A block's refName, or undefined for non-content (elided/padding) blocks. */
export function getBlockRefName(block: BaseBlock) {
  return block.type === 'ContentBlock' ? block.refName : undefined
}

export function showRefNameLabels<T>(
  blocks: T[],
  getRefName: (block: T) => string | undefined,
) {
  let prev: string | undefined
  return blocks.map(block => {
    const refName = getRefName(block)
    const show = refName !== undefined && refName !== prev
    if (refName !== undefined) {
      prev = refName
    }
    return show
  })
}

/**
 * Whether a label occupying [leftPx, leftPx + labelWidth] fits within a block
 * of the given pixel width, used to skip tick labels that would be clipped at a
 * region edge (common with small collapsed-intron regions).
 */
export function labelFitsInBlock(
  leftPx: number,
  labelWidth: number,
  widthPx: number,
) {
  return leftPx >= 0 && leftPx + labelWidth <= widthPx
}

/**
 * makeTicks plus each tick's pixel x within its block, accounting for reversed
 * regions. Single source of the tick→px formula shared by gridlines, the
 * scalebar coordinate labels, and SVG export so their positions can't drift.
 */
export function makeBlockTicks(
  {
    start,
    end,
    reversed = false,
  }: { start: number; end: number; reversed?: boolean },
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  return makeTicks(start, end, bpPerPx, emitMajor, emitMinor).map(tick => ({
    ...tick,
    x: (reversed ? end - tick.base : tick.base - start) / bpPerPx,
  }))
}

/**
 * Generate location objects for a set of parsed locstrings, which includes
 * translating the refNames to assembly-canonical refNames and adding the
 * 'parentRegion'
 *
 * Used by navToLocations and navToLocString
 *
 * @param regions - array of parsed location strings to generate locations for
 * @param assemblyManager - the assembly manager instance
 * @param assemblyName - optional assembly name to use for regions that don't
 * specify one
 * @param grow - optional multiplier to expand regions by (e.g., 0.2 adds 20%
 * padding on each side of the region). Useful for adding visual padding when
 * navigating to a feature
 */
export async function generateLocations({
  regions,
  assemblyManager,
  assemblyName,
  grow,
}: {
  regions: ParsedLocString[]
  assemblyManager: AssemblyManager
  assemblyName?: string
  grow?: number
}) {
  return Promise.all(
    regions.map(async region => {
      const asmName = region.assemblyName || assemblyName
      if (!asmName) {
        throw new Error('no assembly provided')
      }
      const asm = await assemblyManager.waitForAssembly(asmName)
      const { refName } = region
      if (!asm) {
        throw new Error(`assembly ${asmName} not found`)
      }
      const { regions } = asm
      if (!regions) {
        throw new Error(`regions not loaded yet for ${asmName}`)
      }
      const canonicalRefName = asm.getCanonicalRefName(refName)
      if (!canonicalRefName) {
        throw new Error(`Could not find refName ${refName} in ${asm.name}`)
      }
      const parentRegion = regions.find(r => r.refName === canonicalRefName)
      if (!parentRegion) {
        throw new Error(`Could not find refName ${refName} in ${asmName}`)
      }

      const { start, end } = region
      const expanded =
        grow && start !== undefined && end !== undefined
          ? expandRegion(start, end, grow)
          : undefined
      return {
        ...region,
        ...(expanded ? { start: expanded.start, end: expanded.end } : {}),
        assemblyName: asmName,
        parentRegion,
      }
    }),
  )
}

/**
 * Parses locString or space separated set of locStrings into location objects
 * Example inputs:
 * "chr1"
 * "chr1:1-100"
 * "chr1:1..100"
 * "chr1 chr2"
 * "chr1:1-100 chr2:1-100"
 * "chr1 100 200" equivalent to "chr1:1-100"
 *
 * Used by navToLocString
 */
export function parseLocStrings(
  input: string,
  assemblyName: string,
  isValidRefName: (str: string, assemblyName: string) => boolean,
) {
  const inputs = input
    .split(/(\s+)/)
    .map(f => f.trim())
    .filter(f => !!f)
  // first try interpreting as a whitespace-separated sequence of
  // multiple locstrings
  try {
    return inputs.map(loc =>
      parseLocString(loc, ref => isValidRefName(ref, assemblyName)),
    )
  } catch (e) {
    // if this fails, try interpreting as a whitespace-separated refname,
    // start, end if start and end are integer inputs
    const [refName, start, end] = inputs
    if (
      e instanceof UnknownRefNameError &&
      Number.isInteger(+start!) &&
      Number.isInteger(+end!)
    ) {
      return [
        parseLocString(`${refName}:${start}..${end}`, ref =>
          isValidRefName(ref, assemblyName),
        ),
      ]
    }
    throw e
  }
}

export function calculateVisibleLocStrings(contentBlocks: ContentBlock[]) {
  if (!contentBlocks.length) {
    return ''
  }
  const isSingleAssemblyName = contentBlocks.every(
    b => b.assemblyName === contentBlocks[0]!.assemblyName,
  )
  return contentBlocks
    .map(block =>
      assembleLocString({
        refName: block.refName,
        start: Math.round(block.start),
        end: Math.round(block.end),
        assemblyName: isSingleAssemblyName ? undefined : block.assemblyName,
        reversed: block.reversed,
      }),
    )
    .join(' ')
}
