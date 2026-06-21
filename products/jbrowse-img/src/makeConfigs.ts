import path from 'path'

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

// Comparison/synteny adapters: each maps a CLI file type to its adapter type
// and the fileLocation slot that adapter reads from.
const syntenyAdapterMap: Record<
  string,
  [adapterType: string, locSlot: string]
> = {
  paf: ['PAFAdapter', 'pafLocation'],
  delta: ['DeltaAdapter', 'deltaLocation'],
  chain: ['ChainAdapter', 'chainLocation'],
  blasttab: ['BlastTabularAdapter', 'blastTableLocation'],
}

export const syntenyTrackTypes = Object.keys(syntenyAdapterMap)

// assemblyNames order is [query, target], matching the two views in order: the
// first --fasta/--assembly is the query (top in synteny, x-axis in dotplot),
// the second is the target.
export function makeSyntenyTrackConfig(
  type: string,
  file: string,
  queryName: string,
  targetName: string,
): Track {
  const [adapterType, locSlot] = syntenyAdapterMap[type]!
  const assemblyNames = [queryName, targetName]
  return {
    type: 'SyntenyTrack',
    trackId: path.basename(file),
    name: path.basename(file),
    assemblyNames,
    adapter: {
      type: adapterType,
      [locSlot]: makeLocation(file),
      assemblyNames,
    },
  }
}

export function makeFastaAssembly(
  fasta: string,
  aliases: string | undefined,
  cytobands: string | undefined,
  trackId: string,
): Assembly {
  const bgzip = fasta.endsWith('gz')
  const assembly: Assembly = {
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
  }
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
