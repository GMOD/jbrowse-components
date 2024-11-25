import { parseLocString } from '@jbrowse/core/util'
import type { AssemblyManager, ParsedLocString } from '@jbrowse/core/util'

/**
 * Given a scale ( bp/px ) and minimum distances (px) between major and minor
 * gridlines, return an object like `{ majorPitch: bp, minorPitch: bp }` giving
 * the gridline pitches to use.
 */
export function chooseGridPitch(
  scale: number,
  minMajorPitchPx: number,
  minMinorPitchPx: number,
) {
  scale = Math.abs(scale)
  const minMajorPitchBp = minMajorPitchPx * scale
  const majorMagnitude = Number.parseInt(
    Number(minMajorPitchBp).toExponential().split(/e/i)[1]!,
    10,
  )

  let majorPitch = 10 ** majorMagnitude
  while (majorPitch < minMajorPitchBp) {
    majorPitch *= 2
    if (majorPitch >= minMajorPitchBp) {
      break
    }
    majorPitch *= 2.5
  }

  majorPitch = Math.max(majorPitch, 5)

  const majorPitchPx = majorPitch / scale

  let minorPitch = 0
  if (!(majorPitch % 10) && majorPitchPx / 10 >= minMinorPitchPx) {
    minorPitch = majorPitch / 10
  } else if (!(majorPitch % 5) && majorPitchPx / 5 >= minMinorPitchPx) {
    minorPitch = majorPitch / 5
  } else if (!(majorPitch % 2) && majorPitchPx / 2 >= minMinorPitchPx) {
    minorPitch = majorPitch / 2
  }

  return { majorPitch, minorPitch }
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
      index += 1
    } else if (emitMajor && !(base % (gridPitch.majorPitch * 2))) {
      ticks.push({ type: 'major', base: base - 1, index })
      index += 1
    }
  }
  return ticks
}

/**
 * Generate location objects for a set of parsed locstrings, which includes
 * translating the refNames to assembly-canonical refNames and adding the
 * 'parentRegion'
 *
 * Used by navToLocations and navToLocString
 */
export async function generateLocations(
  regions: ParsedLocString[],
  assemblyManager: AssemblyManager,
  assemblyName?: string,
) {
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
      const canonicalRefName = asm.getCanonicalRefName(region.refName)
      if (!canonicalRefName) {
        throw new Error(`Could not find refName ${refName} in ${asm.name}`)
      }
      const parentRegion = regions.find(r => r.refName === canonicalRefName)
      if (!parentRegion) {
        throw new Error(`Could not find refName ${refName} in ${asmName}`)
      }

      return {
        ...(region as Omit<typeof region, symbol>),
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
      /Unknown reference sequence/.exec(`${e}`) &&
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
