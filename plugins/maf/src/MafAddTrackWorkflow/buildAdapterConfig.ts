import { makeIndex } from '@jbrowse/core/util/tracks'

import type { SampleConfig } from '../util/getSamples.ts'
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
 *
 * An array of `{id,label,color,assemblyName,…}` objects — what the box's
 * placeholder invites and what every adapter's `samples` slot accepts — passes
 * through as objects. Every entry used to go through `String()`, so each one
 * landed in the config as the literal text `[object Object]` and the track drew
 * that many nameless rows. Mixing the two forms is `normalizeSamples`' problem
 * and not this one's: it reads each entry on its own.
 */
export function parseSampleNames(input: string): SampleConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    // fall through to line split
  }
  const entries = Array.isArray(parsed) ? parsed : input.split(/\r\n|[\r\n]/)
  return entries
    .map(e => (typeof e === 'object' && e !== null ? e : String(e).trim()))
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
  samples: SampleConfig
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
    samples,
  } = args
  if (!loc) {
    throw new Error('Please supply a data file')
  }
  switch (fileTypeChoice) {
    case 'BigMafAdapter':
      return {
        type: fileTypeChoice,
        bigBedLocation: loc,
        samples,
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
      return {
        type: fileTypeChoice,
        bedGzLocation: loc,
        nhLocation: nhLoc,
        index: {
          indexType: indexTypeChoice,
          // The suffix follows the Index-type radio rather than the file name:
          // here the radio is the user's answer and there is no name to read
          // it off.
          location:
            indexLoc ??
            makeIndex(loc, indexTypeChoice === 'CSI' ? '.csi' : '.tbi'),
        },
        samples,
        ...bedTabixSummary(summaryLoc),
        ...framesAnnotation(framesLoc),
      }
    case 'BgzipTaffyAdapter':
      return {
        type: fileTypeChoice,
        tafGzLocation: loc,
        taiLocation: indexLoc ?? makeIndex(loc, '.tai'),
        nhLocation: nhLoc,
        samples,
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
      return {
        type: fileTypeChoice,
        mafGzLocation: loc,
        taiLocation: indexLoc ?? makeIndex(loc, '.tai'),
        nhLocation: nhLoc,
        samples,
        ...bedTabixSummary(summaryLoc),
        ...framesAnnotation(framesLoc),
      }
  }
}
