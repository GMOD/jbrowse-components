import fs from 'node:fs'
import path from 'node:path'

import { indexCandidateNames } from '@jbrowse/core/util/indexCandidates'

import type { Assembly, Track } from './types.ts'

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

// Turn a CLI file argument into a JBrowse location: a URL scheme (http/s3/ftp/…)
// becomes a `uri`, anything else a local path.
export function makeLocation(file: string) {
  return URL_SCHEME.test(file) ? { uri: file } : { localPath: file }
}

/**
 * The index sitting next to a data file: whichever conventional spelling is
 * actually on disk, else the first candidate so the error names the file that
 * was expected.
 *
 * The candidate list is core's, shared with the add-track widget, so the CLI and
 * the app look for the same things. `conventional` is the fallback for a name
 * core does not recognize — a track flag knows the file type even when the
 * extension does not say so.
 *
 * Probed only for a LOCAL path. A URL cannot be checked without a request and
 * this builder is synchronous, so a remote `.csi` still wants `index:`.
 */
function siblingIndex(file: string, conventional: 'tbi' | 'bai' | 'crai') {
  const candidates = indexCandidateNames(file)
  const primary = candidates[0] ?? `${file}.${conventional}`
  if (URL_SCHEME.test(file)) {
    return primary
  }
  return candidates.find(c => fs.existsSync(c)) ?? primary
}

// Case-insensitive, like core's makeIndexType: a `--index` the user typed can
// be spelled `.CSI`, and reading that as TBI opens no index at all.
const isCsi = (name: string) => /\.csi$/i.test(name)

// The index type follows the file that was CHOSEN, not the one the user typed,
// so an autodetected `.csi` is opened as one.
function makeTabixIndex(file: string, index: string | undefined) {
  const chosen = index || siblingIndex(file, 'tbi')
  return {
    location: makeLocation(chosen),
    indexType: isCsi(chosen) ? 'CSI' : 'TBI',
  }
}

// Every CLI track-type flag: the JBrowse track type it opens and the adapter it
// builds. One entry per flag (rather than a type map plus a parallel adapter
// switch) so `--multiwig`'s absence from the adapter side — it builds its
// subadapter list separately in makeMultiWiggleTrackConfig — is stated once, and
// so adding a file type is a single edit.
interface FileType {
  trackType: string
  adapter?: (
    file: string,
    index: string | undefined,
    sequenceAdapter: unknown,
  ) => Record<string, unknown>
}

const fileTypes: Record<string, FileType> = {
  bam: {
    trackType: 'AlignmentsTrack',
    adapter: (file, index, sequenceAdapter) => {
      const chosen = index || siblingIndex(file, 'bai')
      return {
        type: 'BamAdapter',
        bamLocation: makeLocation(file),
        index: {
          location: makeLocation(chosen),
          indexType: isCsi(chosen) ? 'CSI' : 'BAI',
        },
        sequenceAdapter,
      }
    },
  },
  cram: {
    trackType: 'AlignmentsTrack',
    adapter: (file, index, sequenceAdapter) => ({
      type: 'CramAdapter',
      cramLocation: makeLocation(file),
      craiLocation: makeLocation(index || siblingIndex(file, 'crai')),
      sequenceAdapter,
    }),
  },
  bigwig: {
    trackType: 'QuantitativeTrack',
    adapter: file => ({
      type: 'BigWigAdapter',
      bigWigLocation: makeLocation(file),
    }),
  },
  multiwig: { trackType: 'MultiQuantitativeTrack' },
  vcfgz: {
    trackType: 'VariantTrack',
    adapter: (file, index) => ({
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }),
  },
  gffgz: {
    trackType: 'FeatureTrack',
    adapter: (file, index) => ({
      type: 'Gff3TabixAdapter',
      gffGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }),
  },
  hic: {
    trackType: 'HicTrack',
    adapter: file => ({ type: 'HicAdapter', hicLocation: makeLocation(file) }),
  },
  bigbed: {
    trackType: 'FeatureTrack',
    adapter: file => ({
      type: 'BigBedAdapter',
      bigBedLocation: makeLocation(file),
    }),
  },
  bedgz: {
    trackType: 'FeatureTrack',
    adapter: (file, index) => ({
      type: 'BedTabixAdapter',
      bedGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }),
  },
}

export const trackTypes = Object.keys(fileTypes)

// Comparison/synteny adapters. Each maps a CLI file type to its adapter type,
// the fileLocation slot that adapter reads from, and which of the two stacked
// assemblies the file's QUERY coordinates belong to.
//
// The distinction matters and is easy to get backwards: PAF/BLAST list the query
// first (minimap2/blast align a query against a target), so the upper assembly —
// written first — is the query. A chain/delta file instead describes a
// target→query liftover (a UCSC `targetToQuery.over.chain` maps FROM the target
// reference TO the query), so there the upper assembly is the TARGET. Picking the
// wrong one silently mis-maps coordinates and most alignments drop out.
const syntenyAdapterMap: Record<
  string,
  { adapterType: string; locSlot: string; upperAssemblyIsQuery: boolean }
> = {
  paf: {
    adapterType: 'PAFAdapter',
    locSlot: 'pafLocation',
    upperAssemblyIsQuery: true,
  },
  blasttab: {
    adapterType: 'BlastTabularAdapter',
    locSlot: 'blastTableLocation',
    upperAssemblyIsQuery: true,
  },
  chain: {
    adapterType: 'ChainAdapter',
    locSlot: 'chainLocation',
    upperAssemblyIsQuery: false,
  },
  delta: {
    adapterType: 'DeltaAdapter',
    locSlot: 'deltaLocation',
    upperAssemblyIsQuery: false,
  },
}

export const syntenyTrackTypes = Object.keys(syntenyAdapterMap)

// Build a SyntenyTrack for one level of a comparative view, given the two
// assemblies it sits between in stacked (top-to-bottom) order. The file format
// decides which is the query and which the target (see syntenyAdapterMap); the
// adapter's explicit queryAssembly/targetAssembly slots make that wiring legible
// rather than hiding it in a positional [query, target] array.
export function makeSyntenyTrackConfig(
  type: string,
  file: string,
  upperAssembly: string,
  lowerAssembly: string,
): Track {
  const { adapterType, locSlot, upperAssemblyIsQuery } =
    syntenyAdapterMap[type]!
  const queryAssembly = upperAssemblyIsQuery ? upperAssembly : lowerAssembly
  const targetAssembly = upperAssemblyIsQuery ? lowerAssembly : upperAssembly
  return {
    type: 'SyntenyTrack',
    trackId: path.basename(file),
    name: path.basename(file),
    // assemblyNames is [query, target] (see comparative-adapters/util.ts).
    assemblyNames: [queryAssembly, targetAssembly],
    adapter: {
      type: adapterType,
      [locSlot]: makeLocation(file),
      queryAssembly,
      targetAssembly,
    },
  }
}

// Attach the optional refNameAliases/cytobands adapters shared by every assembly
// builder, then return the assembly so callers can build-and-decorate in one go.
function withAliasesCytobands(
  assembly: Assembly,
  aliases: string | undefined,
  cytobands: string | undefined,
): Assembly {
  if (aliases) {
    assembly.refNameAliases = {
      adapter: { type: 'RefNameAliasAdapter', location: makeLocation(aliases) },
    }
  }
  if (cytobands) {
    assembly.cytobands = {
      adapter: {
        type: 'CytobandAdapter',
        cytobandLocation: makeLocation(cytobands),
      },
    }
  }
  return assembly
}

export function makeFastaAssembly(
  fasta: string,
  aliases: string | undefined,
  cytobands: string | undefined,
  trackId: string,
): Assembly {
  const bgzip = fasta.endsWith('gz')
  return withAliasesCytobands(
    {
      name: path.basename(fasta),
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId,
        adapter: {
          type: bgzip ? 'BgzipFastaAdapter' : 'IndexedFastaAdapter',
          fastaLocation: makeLocation(fasta),
          faiLocation: makeLocation(`${fasta}.fai`),
          gziLocation: bgzip ? makeLocation(`${fasta}.gzi`) : undefined,
        },
      },
    },
    aliases,
    cytobands,
  )
}

// A chrom.sizes assembly's display name is its basename without the
// `.chrom.sizes`/`.sizes` extension, so `hs1.chrom.sizes` shows as `hs1` in the
// synteny scalebar's assembly-name label — the extension is file-format noise,
// not part of the assembly name.
function chromSizesAssemblyName(chromSizes: string) {
  return path.basename(chromSizes).replace(/\.(chrom\.)?sizes$/, '')
}

// Whole-genome comparative views (e.g. a synteny dotplot) need only chromosome
// sizes, not the sequence itself, so a `.chrom.sizes` assembly skips the
// multi-GB FASTA/2bit entirely.
export function makeChromSizesAssembly(
  chromSizes: string,
  aliases: string | undefined,
  cytobands: string | undefined,
  trackId: string,
): Assembly {
  return withAliasesCytobands(
    {
      name: chromSizesAssemblyName(chromSizes),
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId,
        adapter: {
          type: 'ChromSizesAdapter',
          chromSizesLocation: makeLocation(chromSizes),
        },
      },
    },
    aliases,
    cytobands,
  )
}

// Build a MultiQuantitativeTrack from a `--multiwig` sources list. A plain array
// of BigWig path/URL strings becomes one BigWigAdapter subadapter each, with the
// location run through makeLocation so a LOCAL path works as well as a URL — the
// adapter's own `bigWigs` shorthand can only express URIs, so a bare local path
// would 404 there. The subtrack name still derives from the filename (the
// adapter falls back to the bigWigLocation basename when a subadapter carries no
// explicit name), matching the shorthand. An array of subadapter objects (each a
// BigWigAdapter config carrying its own name/color/group) passes through as
// `subadapters`, so a curated multi-sample track keeps its per-row metadata.
export function makeMultiWiggleTrackConfig(
  sources: unknown[],
  file: string,
  assembly: Assembly,
  name?: string,
): Track {
  const allStrings = sources.every(s => typeof s === 'string')
  const subadapters = allStrings
    ? sources.map(s => ({
        type: 'BigWigAdapter',
        bigWigLocation: makeLocation(s),
      }))
    : sources
  return {
    type: 'MultiQuantitativeTrack',
    trackId: path.basename(file),
    name: name ?? path.basename(file),
    assemblyNames: [assembly.name],
    adapter: {
      type: 'MultiWiggleAdapter',
      subadapters,
    },
  }
}

export function makeTrackConfig(
  type: string,
  file: string,
  index: string | undefined,
  assembly: Assembly,
  name?: string,
): Track | undefined {
  const fileType = fileTypes[type]
  const adapter = fileType?.adapter?.(file, index, assembly.sequence.adapter)
  return fileType && adapter
    ? {
        type: fileType.trackType,
        trackId: path.basename(file),
        name: name ?? path.basename(file),
        assemblyNames: [assembly.name],
        adapter,
      }
    : undefined
}
