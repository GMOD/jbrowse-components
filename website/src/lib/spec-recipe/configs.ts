import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Most figures load a `test_data/…` config that lives in this repo, so a spec's
// bare `"tracks": ["ncbi_gff_hg19"]` can be resolved at build time into the
// track's real name and file type — the two things a reader needs in order to
// do the same thing with a file of their own. Figures pointing at a hosted
// config (jbrowse.org/demos/…) stay unresolved and fall back to generic wording
// rather than triggering a network fetch during the site build.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

interface RawAdapter {
  type?: string
  [field: string]: unknown
}

interface RawTrack {
  trackId: string
  name?: string
  type?: string
  adapter?: RawAdapter
}

interface RawAssembly {
  name: string
  sequence?: { adapter?: RawAdapter }
}

interface RawConfig {
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
}

export interface AssemblyInfo {
  name: string
  adapterType: string
}

const cache = new Map<string, RawConfig | undefined>()

function readConfig(config: string): RawConfig | undefined {
  if (!cache.has(config)) {
    let parsed: RawConfig | undefined
    if (config.startsWith('test_data/')) {
      try {
        parsed = JSON.parse(
          readFileSync(join(repoRoot, config), 'utf8'),
        ) as RawConfig
      } catch {
        parsed = undefined
      }
    }
    cache.set(config, parsed)
  }
  return cache.get(config)
}

export function lookupTrack(
  config: string,
  trackId: string,
): TrackInfo | undefined {
  const track = readConfig(config)?.tracks?.find(t => t.trackId === trackId)
  return track
    ? {
        trackId,
        name: track.name ?? trackId,
        type: track.type ?? '',
        adapterType: track.adapter?.type ?? '',
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
