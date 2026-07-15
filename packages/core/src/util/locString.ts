import { toLocale } from './numericUtils.ts'

export interface ParsedLocString {
  assemblyName?: string
  refName: string
  start?: number
  end?: number
  reversed?: boolean
}

// Thrown when the input doesn't resolve to any known refName. Callers
// (e.g. the LGV locstring path) catch this to fall back to alternative
// interpretations like "refname start end" triplets — string-matching
// the error message would be brittle.
export class UnknownRefNameError extends Error {
  name = 'UnknownRefNameError'
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
    throw new UnknownRefNameError(`Unknown feature or sequence "${location}"`)
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
  throw new UnknownRefNameError(
    `unknown reference sequence name in location "${locString}"`,
  )
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
