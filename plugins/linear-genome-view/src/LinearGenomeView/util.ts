import {
  AssemblyManager,
  ParsedLocString,
  parseLocString,
  Region,
} from '@jbrowse/core/util'

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
    Number(minMajorPitchBp).toExponential().split(/e/i)[1],
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
  if (minBase === null || maxBase === null) {
    return []
  }

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

export async function generateLocations(
  regions: ParsedLocString[] = [],
  assemblyManager: AssemblyManager,
  assemblyName: string,
) {
  return Promise.all(
    regions.map(async region => {
      const asmName = region.assemblyName || assemblyName
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

export function parseLocStrings(
  inputs: string[],
  assemblyName: string,
  isValidRefName: (str: string, assemblyName: string) => boolean,
) {
  let parsedLocStrings
  // first try interpreting as a whitespace-separated sequence of
  // multiple locstrings
  try {
    parsedLocStrings = inputs.map(loc =>
      parseLocString(loc, ref => isValidRefName(ref, assemblyName)),
    )
  } catch (e) {
    // if this fails, try interpreting as a whitespace-separated refname,
    // start, end if start and end are integer inputs
    const [refName, start, end] = inputs
    if (
      `${e}`.match(/Unknown reference sequence/) &&
      Number.isInteger(+start) &&
      Number.isInteger(+end)
    ) {
      parsedLocStrings = [
        parseLocString(refName + ':' + start + '..' + end, ref =>
          isValidRefName(ref, assemblyName),
        ),
      ]
    } else {
      throw e
    }
  }
  return parsedLocStrings
}
