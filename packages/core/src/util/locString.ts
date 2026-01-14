export interface ParsedLocString {
  assemblyName?: string
  refName: string
  start?: number
  end?: number
  reversed?: boolean
}

// matches coordinate strings: "100", "100-200", "100..200", "100.." (open-ended)
// groups: [1]=start [2]=end (if range) [3]=trailing separator (if open-ended)
const COORD_REGEX = /^(-?\d+)(?:(?:\.\.|[-–])(-?\d+))?(\.\.|[-–])?$/

// matches optional "{assemblyName}" prefix followed by the rest of the location
// groups: [1]=assemblyName (without braces) [2]=remainder
const ASSEMBLY_REGEX = /^(?:\{([^}]+)\})?(.+)/

function parseCoords(suffix: string, locString: string) {
  // strip commas before matching so regex only needs to handle plain digits
  const match = COORD_REGEX.exec(suffix.replaceAll(',', ''))
  if (!match) {
    throw new Error(
      `could not parse range "${suffix}" on location "${locString}"`,
    )
  }
  const [, startStr, endStr, trailing] = match
  const start = +startStr!
  return { start, end: endStr ? +endStr : trailing ? undefined : start }
}

export function parseLocStringOneBased(
  locString: string,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
): ParsedLocString {
  if (!locString) {
    throw new Error('no location string provided, could not parse')
  }

  // handle reverse strand notation e.g. "chr1:1-100[rev]"
  let reversed = false
  if (locString.endsWith('[rev]')) {
    reversed = true
    locString = locString.slice(0, -5)
  }
  locString = locString.replaceAll(/\s/g, '')

  // extract optional assembly name in braces e.g. "{hg19}chr1:1-100"
  const assemblyMatch = ASSEMBLY_REGEX.exec(locString)
  if (!assemblyMatch) {
    throw new Error(`invalid location string: "${locString}"`)
  }

  const [, assemblyName, location] = assemblyMatch
  // reject empty braces e.g. "{}chr1:1-100"
  if (!assemblyName && location!.startsWith('{}')) {
    throw new Error(`no assembly name was provided in location "${location}"`)
  }

  // refNames can contain colons (see SAM spec), so find the last colon to split
  const lastColonIdx = location!.lastIndexOf(':')
  // no colon means just a refName with no coordinates e.g. "chr1"
  if (lastColonIdx === -1) {
    if (isValidRefName(location!, assemblyName)) {
      return { assemblyName, refName: location!, reversed }
    }
    throw new Error(`Unknown feature or sequence "${location}"`)
  }

  // split into refName (prefix) and coordinate part (suffix) at the last colon
  const prefix = location!.slice(0, lastColonIdx)
  const suffix = location!.slice(lastColonIdx + 1)
  const prefixValid = isValidRefName(prefix, assemblyName)
  const locationValid = isValidRefName(location!, assemblyName)

  // both interpretations valid is ambiguous e.g. refName "chr1:1" and "chr1" both exist
  if (prefixValid && locationValid) {
    throw new Error(`ambiguous location string: "${locString}"`)
  }
  // the colon is part of the refName, not a coordinate separator
  if (locationValid) {
    return { assemblyName, refName: location!, reversed }
  }
  // standard case: prefix is refName, suffix is coordinates
  if (prefixValid) {
    // colon with no suffix means just refName e.g. "chr1:"
    if (!suffix) {
      return { assemblyName, refName: prefix, reversed }
    }
    const coords = parseCoords(suffix, locString)
    return { assemblyName, refName: prefix, reversed, ...coords }
  }
  throw new Error(`unknown reference sequence name in location "${locString}"`)
}

export function parseLocString(
  locString: string,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
) {
  const parsed = parseLocStringOneBased(locString, isValidRefName)
  if (typeof parsed.start === 'number') {
    parsed.start -= 1
  }
  return parsed
}
