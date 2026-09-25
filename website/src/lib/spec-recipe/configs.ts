import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from '../../../scripts/paths.ts'
import { hostedConfigs } from './hostedConfigs.generated.ts'

// A spec's bare `"tracks": ["ncbi_gff_hg19"]` resolves at build time into the
// track's real name and file type — the two things a reader needs to do the
// same with a file of their own — from the config's copy in this repo:
// `test_data/…`, or `demos/…` for a jbrowse.org/demos config, which
// scripts/deploy-demo.sh deploys only from that copy. Any other hosted config
// reads the tracks figures name off `hostedConfigs.generated.ts`, which
// `pnpm gen:hosted-configs` fetches, so the site build fetches nothing.

interface RawAdapter {
  type?: string
  [field: string]: unknown
}

export interface RawTrack {
  trackId: string
  name?: string
  type?: string
  assemblyNames?: string[]
  adapter?: RawAdapter
  displays?: { type?: string }[]
}

export interface RawAssembly {
  name: string
  sequence?: { trackId?: string; adapter?: RawAdapter }
}

export interface RawConfig {
  assemblies?: RawAssembly[]
  tracks?: RawTrack[]
}

export interface TrackInfo {
  trackId: string
  name: string
  // e.g. AlignmentsTrack
  type: string
  // e.g. CramAdapter
  adapterType: string
  // The display types the track config declares, in order. `pickDisplayForView`
  // consults these before falling back to the ones the track type registers, so
  // a config naming exactly one settles which display a spec entry means without
  // the plugin registry a static script cannot reach.
  declaredDisplayTypes: string[]
}

export interface AssemblyInfo {
  name: string
  adapterType: string
}

const DEMOS_URL = 'https://jbrowse.org/demos/'

export function repoConfigPath(config: string) {
  const path = config.startsWith(DEMOS_URL)
    ? `demos/${config.slice(DEMOS_URL.length)}`
    : config
  return existsSync(join(repoRoot, path)) ? path : undefined
}

const cache = new Map<string, RawConfig | undefined>()

function readConfig(config: string): RawConfig | undefined {
  if (!cache.has(config)) {
    const path = repoConfigPath(config)
    let parsed: RawConfig | undefined
    try {
      parsed = path
        ? (JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as RawConfig)
        : hostedConfigs[config]
    } catch {
      parsed = undefined
    }
    cache.set(config, parsed)
  }
  return cache.get(config)
}

function sequenceTrack(
  assemblies: RawAssembly[] | undefined,
  trackId: string,
): RawTrack | undefined {
  const assembly = assemblies?.find(
    a => (a.sequence?.trackId ?? `${a.name}-ReferenceSequenceTrack`) === trackId,
  )
  return assembly
    ? {
        trackId,
        name: `Reference sequence (${assembly.name})`,
        type: 'ReferenceSequenceTrack',
        adapter: assembly.sequence?.adapter,
      }
    : undefined
}

export function lookupTrack(
  config: string,
  trackId: string,
  sessionTracks?: RawTrack[],
): TrackInfo | undefined {
  const raw = readConfig(config)
  const track =
    sessionTracks?.find(t => t.trackId === trackId) ??
    raw?.tracks?.find(t => t.trackId === trackId) ??
    sequenceTrack(raw?.assemblies, trackId)
  return track
    ? {
        trackId,
        name: track.name ?? trackId,
        type: track.type ?? '',
        adapterType: track.adapter?.type ?? '',
        declaredDisplayTypes: (track.displays ?? [])
          .map(d => d.type)
          .filter(t => typeof t === 'string'),
      }
    : undefined
}

export function lookupAssembly(
  config: string,
  name: string,
): AssemblyInfo | undefined {
  const assembly = readConfig(config)?.assemblies?.find(a => a.name === name)
  return assembly
    ? { name, adapterType: assembly.sequence?.adapter?.type ?? '' }
    : undefined
}

// What a reader would have to supply to build the same track from their own
// data. Keyed by adapter type so it stays accurate as adapters are added —
// an unknown adapter degrades to generic wording instead of a wrong file
// extension.
const FILE_KINDS: Record<string, string> = {
  BamAdapter: 'a BAM file (.bam + .bai)',
  CramAdapter: 'a CRAM file (.cram + .crai)',
  VcfTabixAdapter: 'a bgzip-compressed, tabix-indexed VCF (.vcf.gz + .tbi)',
  VcfAdapter: 'a VCF file (.vcf)',
  Gff3TabixAdapter: 'a bgzip-compressed, tabix-indexed GFF3 (.gff.gz + .tbi)',
  Gff3Adapter: 'a GFF3 file (.gff3)',
  GtfAdapter: 'a GTF file (.gtf)',
  BedTabixAdapter: 'a bgzip-compressed, tabix-indexed BED (.bed.gz + .tbi)',
  BedAdapter: 'a BED file (.bed)',
  BedpeAdapter: 'a BEDPE file (.bedpe)',
  BigWigAdapter: 'a BigWig file (.bw)',
  BigBedAdapter: 'a BigBed file (.bb)',
  HicAdapter: 'a Hi-C file (.hic)',
  PAFAdapter: 'a PAF file (.paf)',
  PairwiseIndexedPAFAdapter: 'a bgzip-indexed PAF (.pif.gz + .tbi)',
  MCScanAnchorsAdapter: 'an MCScan .anchors file',
  MCScanSimpleAnchorsAdapter: 'an MCScan .anchors.simple file',
  DeltaAdapter: 'a MUMmer .delta file',
  ChainAdapter: 'a UCSC .chain file',
  MashMapAdapter: 'a MashMap output file',
  BlastTabularAdapter: 'a BLAST tabular file',
  MafTabixAdapter: 'a bgzip-compressed, tabix-indexed MAF (.maf.gz + .tbi)',
  BigMafAdapter: 'a BigMaf file (.bb)',
  TwoBitAdapter: 'a .2bit genome',
  IndexedFastaAdapter: 'an indexed FASTA (.fa + .fai)',
  BgzipFastaAdapter: 'a bgzip-compressed FASTA (.fa.gz + .fai + .gzi)',
  FromConfigAdapter: 'features defined inline in the config',
}

export function fileKind(adapterType: string): string | undefined {
  return FILE_KINDS[adapterType]
}
