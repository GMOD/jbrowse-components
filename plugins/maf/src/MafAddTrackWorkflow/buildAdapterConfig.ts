import { makeIndex } from '@jbrowse/core/util/tracks'

import type { FileLocation } from '@jbrowse/core/util'

export type AdapterTypeOptions =
  | 'BigMafAdapter'
  | 'MafTabixAdapter'
  | 'BgzipTaffyAdapter'
  | 'BgzipMafAdapter'
export type IndexTypeOptions = 'TBI' | 'CSI'

/**
 * The zoom-out tier as the three bgzip/tabix formats take it: a
 * `BedTabixAdapter` over the BED `maf2bed --summary` writes. Its sibling `.tbi`
 * is derived rather than asked for — the same suffix assumption both these
 * adapters' and `BedTabixAdapter`'s own `uri` shorthands already make, and
 * making an optional feature cost two file pickers is what would stop people
 * turning it on. Omitted entirely when no summary was supplied, so the slot
 * stays at its `null` default.
 */
function bedTabixSummary(summaryLoc: FileLocation | undefined) {
  return summaryLoc
    ? {
        summaryAdapter: {
          type: 'BedTabixAdapter',
          bedGzLocation: summaryLoc,
          index: { location: makeIndex(summaryLoc, '.tbi') },
        },
      }
    : {}
}

/**
 * The CDS reading frames every format takes the same way: a `BigBedAdapter`
 * over a UCSC `multiz<N>wayFrames.bb`. It is what the "Show CDS frames"
 * overlay, the codon row coloring and the codon conservation band are all
 * gated on, and until now the form offered no way to supply it — so a track
 * added through the UI could never reach any of the three, whatever file the
 * user had. Optional, and omitted when unset so the slot keeps its `null`
 * default.
 */
function framesAnnotation(framesLoc: FileLocation | undefined) {
  return framesLoc
    ? {
        annotationAdapter: {
          type: 'BigBedAdapter',
          bigBedLocation: framesLoc,
        },
      }
    : {}
}

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
  framesLoc: FileLocation | undefined
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
    framesLoc,
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
        ...framesAnnotation(framesLoc),
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
        ...bedTabixSummary(summaryLoc),
        ...framesAnnotation(framesLoc),
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
        // The .tai keeps a read proportional to the span on screen, not to the
        // alignment — but a deep one still costs span x depth, so the zoom-out
        // tier is worth offering here too.
        ...bedTabixSummary(summaryLoc),
        ...framesAnnotation(framesLoc),
      }
    case 'BgzipMafAdapter':
      // A bgzip-compressed MAF with a sibling taffy `.tai` — the form
      // whole-genome alignments are actually published in (HPRC release 2 ships
      // a 53 GB `.maf.gz` + `.tai`). The adapter has been registered all along;
      // it just had no way in from the UI, so an HPRC alignment had to be
      // converted before it could be looked at.
      //
      // The index is derived rather than demanded, unlike the TAF branch above:
      // this adapter's own `uri` shorthand already resolves `${uri}.tai`, so a
      // published pair needs no second picker. The picker is still offered for
      // an index that isn't a sibling, and wins when filled in.
      return {
        type: fileTypeChoice,
        mafGzLocation: loc,
        taiLocation: indexLoc ?? makeIndex(loc, '.tai'),
        nhLocation: nhLoc,
        samples: sampleNames,
        ...bedTabixSummary(summaryLoc),
        ...framesAnnotation(framesLoc),
      }
  }
}
