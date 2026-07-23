import type { FileLocation } from '@jbrowse/core/util'

export type AdapterTypeOptions =
  | 'BigMafAdapter'
  | 'MafTabixAdapter'
  | 'BgzipTaffyAdapter'
export type IndexTypeOptions = 'TBI' | 'CSI'

/**
 * Parse the free-form sample-names text box. Accepts a JSON array (which
 * must actually *be* an array — bare strings/numbers parse as valid JSON but
 * aren't sample lists) or one name per line. CRLF/CR/LF all split correctly
 * so pasted Windows/Mac text doesn't leave a trailing \r.
 */
export function parseSampleNames(input: string): string[] {
  try {
    const parsed: unknown = JSON.parse(input)
    if (Array.isArray(parsed)) {
      return parsed.map(s => String(s).trim()).filter(Boolean)
    }
  } catch {
    // fall through to line split
  }
  return input
    .split(/\r\n|[\r\n]/)
    .map(s => s.trim())
    .filter(Boolean)
}

interface BuildArgs {
  fileTypeChoice: AdapterTypeOptions
  indexTypeChoice: IndexTypeOptions
  loc: FileLocation | undefined
  indexLoc: FileLocation | undefined
  nhLoc: FileLocation | undefined
  summaryLoc: FileLocation | undefined
  sampleNames: string[]
}

export function buildAdapterConfig(args: BuildArgs) {
  const {
    fileTypeChoice,
    indexTypeChoice,
    loc,
    indexLoc,
    nhLoc,
    summaryLoc,
    sampleNames,
  } = args
  if (!loc) {
    throw new Error('Please supply a data file')
  }
  switch (fileTypeChoice) {
    case 'BigMafAdapter':
      return {
        type: fileTypeChoice,
        bigBedLocation: loc,
        samples: sampleNames,
        nhLocation: nhLoc,
        // Optional UCSC bigMafSummary.bb for cheap zoom-out rendering; no
        // standard suffix to guess, so it's an explicit field left null
        // when unset.
        ...(summaryLoc
          ? {
              summaryAdapter: {
                type: 'BigBedAdapter',
                bigBedLocation: summaryLoc,
              },
            }
          : {}),
      }
    case 'MafTabixAdapter':
      if (!indexLoc) {
        throw new Error('Please supply a MAF tabix index file')
      }
      return {
        type: fileTypeChoice,
        bedGzLocation: loc,
        nhLocation: nhLoc,
        index: {
          indexType: indexTypeChoice,
          location: indexLoc,
        },
        samples: sampleNames,
      }
    case 'BgzipTaffyAdapter':
      if (!indexLoc) {
        throw new Error('Please supply a TAF index (.tai) file')
      }
      return {
        type: fileTypeChoice,
        tafGzLocation: loc,
        taiLocation: indexLoc,
        nhLocation: nhLoc,
        samples: sampleNames,
      }
  }
}
