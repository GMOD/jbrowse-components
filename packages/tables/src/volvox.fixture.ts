import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  AlignmentTablesArgs,
  FeatureTablesArgs,
  WiggleTablesArgs,
} from './index.ts'

const VOLVOX = path.resolve('test_data/volvox')
const METHYLATION = path.resolve('test_data/methylation_test')
const uri = (file: string, dir = VOLVOX) => ({
  uri: pathToFileURL(path.join(dir, file)).href,
  locationType: 'UriLocation',
})

const sequenceAdapter = {
  type: 'IndexedFastaAdapter',
  fastaLocation: uri('volvox.fa'),
  faiLocation: uri('volvox.fa.fai'),
}
const region = { refName: 'ctgA', start: 1000, end: 6000 }

export const BAM: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('volvox-sorted.bam'),
    index: { location: uri('volvox-sorted.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region,
}

export const SPLICED: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('spliced.bam'),
    index: { location: uri('spliced.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 400, end: 1300 },
}

export const PAIRED_INVERSION: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('volvox-simple-inv-paired.bam'),
    index: {
      location: uri('volvox-simple-inv-paired.bam.bai'),
      indexType: 'BAI',
    },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 18000, end: 32000 },
}

export const LONG_READS: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('volvox-long-reads-sv.bam'),
    index: { location: uri('volvox-long-reads-sv.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 1000, end: 20000 },
}

/** Seven ONT reads over a clip of hg38 chr20, with 5mC calls. */
export const METHYLATED: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('methylation_clip.bam', METHYLATION),
    index: {
      location: uri('methylation_clip.bam.bai', METHYLATION),
      indexType: 'BAI',
    },
  },
  sequenceAdapter: {
    type: 'IndexedFastaAdapter',
    fastaLocation: uri('hg38_clip.fa', METHYLATION),
    faiLocation: uri('hg38_clip.fa.fai', METHYLATION),
  },
  region: { refName: '20', start: 10000, end: 20000 },
}

export const CRAM: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'CramAdapter',
    cramLocation: uri('volvox-sorted.cram'),
    craiLocation: uri('volvox-sorted.cram.crai'),
  },
  sequenceAdapter,
  region,
}

/** volvox's genes, mRNAs, exons and CDS over the whole contig, at 50 bp/px. */
export const GFF3: FeatureTablesArgs = {
  adapterConfig: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: uri('volvox.sort.gff3.gz'),
    index: { location: uri('volvox.sort.gff3.gz.tbi'), indexType: 'TBI' },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
}

export const BIGBED: FeatureTablesArgs = {
  adapterConfig: { type: 'BigBedAdapter', bigBedLocation: uri('volvox.bb') },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
}

/** A signed microarray track over the whole contig, at 50 bp/px. */
export const SIGNED_BIGWIG: WiggleTablesArgs = {
  adapterConfig: {
    type: 'BigWigAdapter',
    bigWigLocation: uri('volvox_microarray_posneg.bw'),
  },
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
}

/** The coverage of `BAM`'s reads as a BigWig. */
export const COVERAGE_BIGWIG: WiggleTablesArgs = {
  adapterConfig: {
    type: 'BigWigAdapter',
    bigWigLocation: uri('volvox-sorted.bam.coverage.bw'),
  },
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
}
