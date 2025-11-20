export interface ParsedLocString {
  assemblyName?: string
  refName: string
  start?: number
  end?: number
  reversed?: boolean
}

export function parseLocStringOneBased(
  locString: string,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
): ParsedLocString {
  if (!locString) {
    throw new Error('no location string provided, could not parse')
  }
  let reversed = false
  if (locString.endsWith('[rev]')) {
    reversed = true
    locString = locString.replace(/\[rev]$/, '')
  }
  // remove any whitespace
  locString = locString.replace(/\s/, '')
  // refNames can have colons, refer to
  // https://samtools.github.io/hts-specs/SAMv1.pdf Appendix A
  const assemblyMatch = /^(?:\{([^}]+)\})?(.+)/.exec(locString)
  if (!assemblyMatch) {
    throw new Error(`invalid location string: "${locString}"`)
  }
  const [, assemblyName2, location2] = assemblyMatch
  const assemblyName = assemblyName2!
  const location = location2!
  if (!assemblyName && location.startsWith('{}')) {
    throw new Error(`no assembly name was provided in location "${location}"`)
  }
  const lastColonIdx = location.lastIndexOf(':')
  if (lastColonIdx === -1) {
    if (isValidRefName(location, assemblyName)) {
      return {
        assemblyName,
        refName: location,
        reversed,
      }
    }
    throw new Error(`Unknown reference sequence "${location}"`)
  }
  const prefix = location.slice(0, lastColonIdx)
  const suffix = location.slice(lastColonIdx + 1)
  if (
    isValidRefName(prefix, assemblyName) &&
    isValidRefName(location, assemblyName)
  ) {
    throw new Error(`ambiguous location string: "${locString}"`)
  } else if (isValidRefName(prefix, assemblyName)) {
    if (suffix) {
      // see if it's a range
      const rangeMatch =
        /^(-?(\d+|\d{1,3}(,\d{3})*))(\.\.|-)(-?(\d+|\d{1,3}(,\d{3})*))$/.exec(
          suffix,
        )
      // see if it's a single point
      const singleMatch = /^(-?(\d+|\d{1,3}(,\d{3})*))(\.\.|-)?$/.exec(suffix)
      if (rangeMatch) {
        const [, start, , , , end] = rangeMatch
        if (start !== undefined && end !== undefined) {
          return {
            assemblyName,
            refName: prefix,
            start: +start.replaceAll(',', ''),
            end: +end.replaceAll(',', ''),
            reversed,
          }
        }
      } else if (singleMatch) {
        const [, start, , , separator] = singleMatch
        if (start !== undefined) {
          if (separator) {
            // indefinite end
            return {
              assemblyName,
              refName: prefix,
              start: +start.replaceAll(',', ''),
              reversed,
            }
          }
          return {
            assemblyName,
            refName: prefix,
            start: +start.replaceAll(',', ''),
            end: +start.replaceAll(',', ''),
            reversed,
          }
        }
      } else {
        throw new Error(
          `could not parse range "${suffix}" on location "${locString}"`,
        )
      }
    } else {
      return {
        assemblyName,
        refName: prefix,
        reversed,
      }
    }
  } else if (isValidRefName(location, assemblyName)) {
    return {
      assemblyName,
      refName: location,
      reversed,
    }
  }
  throw new Error(`unknown reference sequence name in location "${locString}"`)
}

/**
 * Parse a 1-based location string into an interbase genomic location
 * @param locString - Location string
 * @param isValidRefName - Function that checks if a refName exists in the set
 * of all known refNames, or in the set of refNames for an assembly if
 * assemblyName is given
 * @example
 * ```ts
 * parseLocString('chr1:1..100', isValidRefName)
 * // ↳ { refName: 'chr1', start: 0, end: 100 }
 * ```
 * @example
 * ```ts
 * parseLocString('chr1:1-100', isValidRefName)
 * // ↳ { refName: 'chr1', start: 0, end: 100 }
 * ```
 * @example
 * ```ts
 * parseLocString(`{hg19}chr1:1..100`, isValidRefName)
 * // ↳ { assemblyName: 'hg19', refName: 'chr1', start: 0, end: 100 }
 * ```
 * @example
 * ```ts
 * parseLocString('chr1', isValidRefName)
 * // ↳ { refName: 'chr1' }
 * ```
 * @example
 * ```ts
 * parseLocString('chr1:1', isValidRefName)
 * // ↳ { refName: 'chr1', start: 0, end: 1 }
 * ```
 * @example
 * ```ts
 * parseLocString('chr1:1..', isValidRefName)
 * // ↳ { refName: 'chr1', start: 0}
 * ```
 */
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
