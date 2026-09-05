import { makeIndex } from '@jbrowse/core/util/tracks'

import type { SampleConfig, SampleConfigEntry } from '../util/getSamples.ts'
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
 * The alignment file's own sibling index, for the two branches that used to
 * demand a picker for it. Every one of these adapters' `uri` shorthands already
 * resolves the same sibling — `taiIndexSlot` for the two `.tai` formats,
 * `tabixIndexSlot` for the tabix one — and the form derives the *summary* BED's
 * `.tbi` two fields down, so demanding it here made the required field the odd
 * one out rather than the safe one. The picker is still offered for an index
 * that is not a sibling, and wins when filled in.
 *
 * The suffix follows the Index-type radio rather than the file name, because
 * here the radio is the user's answer and there is no name to read it off.
 */
function siblingIndex(loc: FileLocation, indexType: IndexTypeOptions) {
  return makeIndex(loc, indexType === 'CSI' ? '.csi' : '.tbi')
}

/**
 * One entry of a JSON `samples` array, kept only when it names an id — the
 * `samples` slot is frozen, so an `{ label: 'hg38' }` with no id reaches
 * `normalizeSamples` as an unnamed row and trims `undefined`.
 */
function sampleEntry(entry: unknown) {
  const { id } = entry as { id?: unknown }
  return typeof id === 'string' && id.trim() ? [entry as SampleConfigEntry] : []
}

/**
 * Parse the free-form sample-names text box. Accepts a JSON array (which
 * must actually *be* an array — bare strings/numbers parse as valid JSON but
 * aren't sample lists) or one name per line. CRLF/CR/LF all split correctly
 * so pasted Windows/Mac text doesn't leave a trailing \r.
 *
 * An array of `{id,label,color,assemblyName,…}` objects — what the box's
 * placeholder invites and what every adapter's `samples` slot accepts — comes
 * back as objects. Every entry used to go through `String()`, so each one
 * landed in the config as the literal text `[object Object]`, and the track
 * drew one unnamed row per sample. A mixed array normalizes to objects,
 * because `normalizeSamples` types the whole array off its first element.
 */
export function parseSampleNames(input: string): SampleConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    // fall through to line split
  }
  const entries = Array.isArray(parsed) ? parsed : input.split(/\r\n|[\r\n]/)
  return entries.some(e => typeof e === 'object' && e !== null)
    ? entries.flatMap(e =>
        typeof e === 'object' && e !== null
          ? sampleEntry(e)
          : sampleEntry({ id: String(e).trim() }),
      )
    : entries.map(e => String(e).trim()).filter(Boolean)
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
          location: indexLoc ?? siblingIndex(loc, indexTypeChoice),
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
