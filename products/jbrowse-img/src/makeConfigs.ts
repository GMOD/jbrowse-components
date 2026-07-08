import path from 'node:path'

import type { Assembly, Track } from './types.ts'

// Turn a CLI file argument into a JBrowse location: a URL scheme (http/s3/ftp/…)
// becomes a `uri`, anything else a local path.
export function makeLocation(file: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(file)
    ? { uri: file }
    : { localPath: file }
}

const trackTypeMap: Record<string, string> = {
  bam: 'AlignmentsTrack',
  cram: 'AlignmentsTrack',
  bigwig: 'QuantitativeTrack',
  vcfgz: 'VariantTrack',
  gffgz: 'FeatureTrack',
  hic: 'HicTrack',
  bigbed: 'FeatureTrack',
  bedgz: 'FeatureTrack',
}

export const trackTypes = Object.keys(trackTypeMap)

function makeTabixIndex(file: string, index: string | undefined) {
  return {
    location: makeLocation(index || `${file}.tbi`),
    indexType: index?.endsWith('.csi') ? 'CSI' : 'TBI',
  }
}

function makeAdapter(
  type: string,
  file: string,
  index: string | undefined,
  sequenceAdapter: unknown,
) {
  if (type === 'bam') {
    return {
      type: 'BamAdapter',
      bamLocation: makeLocation(file),
      index: {
        location: makeLocation(index || `${file}.bai`),
        indexType: index?.endsWith('.csi') ? 'CSI' : 'BAI',
      },
      sequenceAdapter,
    }
  }
  if (type === 'cram') {
    return {
      type: 'CramAdapter',
      cramLocation: makeLocation(file),
      craiLocation: makeLocation(index || `${file}.crai`),
      sequenceAdapter,
    }
  }
  if (type === 'bigwig') {
    return { type: 'BigWigAdapter', bigWigLocation: makeLocation(file) }
  }
  if (type === 'vcfgz') {
    return {
      type: 'VcfTabixAdapter',
      vcfGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }
  }
  if (type === 'gffgz') {
    return {
      type: 'Gff3TabixAdapter',
      gffGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }
  }
  if (type === 'hic') {
    return { type: 'HicAdapter', hicLocation: makeLocation(file) }
  }
  if (type === 'bigbed') {
    return { type: 'BigBedAdapter', bigBedLocation: makeLocation(file) }
  }
  if (type === 'bedgz') {
    return {
      type: 'BedTabixAdapter',
      bedGzLocation: makeLocation(file),
      index: makeTabixIndex(file, index),
    }
  }
  return undefined
}

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
      adapter: { type: 'CytobandAdapter', location: makeLocation(cytobands) },
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
export function chromSizesAssemblyName(chromSizes: string) {
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

export function makeTrackConfig(
  type: string,
  file: string,
  index: string | undefined,
  assembly: Assembly,
): Track | undefined {
  const trackType = trackTypeMap[type]
  const adapter = makeAdapter(type, file, index, assembly.sequence.adapter)
  if (!trackType || !adapter) {
    return undefined
  }
  return {
    type: trackType,
    trackId: path.basename(file),
    name: path.basename(file),
    assemblyNames: [assembly.name],
    adapter,
  }
}
