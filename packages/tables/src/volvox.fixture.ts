import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  AlignmentTablesArgs,
  FeatureTablesArgs,
  VariantTablesArgs,
  WiggleTablesArgs,
} from './index.ts'

const VOLVOX = path.resolve('test_data/volvox')
const METHYLATION = path.resolve('test_data/methylation_test')
const DOG10K = path.resolve('test_data/dog10k')
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

/** Reads in two read groups, `RG:Z:4` and `RG:Z:5`. */
export const READ_GROUPS: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('volvox-rg.bam'),
    index: { location: uri('volvox-rg.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 0, end: 50000 },
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
export const SIGNED_BIGWIG = {
  adapterConfig: {
    type: 'BigWigAdapter',
    bigWigLocation: uri('volvox_microarray_posneg.bw'),
  },
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
} satisfies WiggleTablesArgs

/** The coverage of `BAM`'s reads as a BigWig. */
export const COVERAGE_BIGWIG: WiggleTablesArgs = {
  adapterConfig: {
    type: 'BigWigAdapter',
    bigWigLocation: uri('volvox-sorted.bam.coverage.bw'),
  },
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
}

/** 39 dogs genotyped at 490 SNVs across CYP1A2, a few of them phased. */
export const DOG_VCF: VariantTablesArgs = {
  adapterConfig: {
    type: 'VcfTabixAdapter',
    vcfGzLocation: uri('dog10k_cyp1a2_snvs.vcf.gz', DOG10K),
    index: { location: uri('dog10k_cyp1a2_snvs.vcf.gz.tbi', DOG10K) },
  },
  region: { refName: 'chr30', start: 38258000, end: 38265000 },
}

/** Dog10K structural variants at AMY2B, each sample's group and breed in a samples file. */
export const DOG_SV: VariantTablesArgs = {
  adapterConfig: {
    type: 'VcfTabixAdapter',
    vcfGzLocation: uri('dog10k_amy2b_svs.vcf.gz', DOG10K),
    index: { location: uri('dog10k_amy2b_svs.vcf.gz.tbi', DOG10K) },
    samplesTsvLocation: uri('dog10k_amy2b_samples.tsv', DOG10K),
  },
  region: { refName: 'chr6', start: 47340000, end: 47420000 },
}

/** Three signed BigWigs as one multi-wiggle track, `posneg_rw1` to `3`. */
export const MULTI_BIGWIG: WiggleTablesArgs = {
  adapterConfig: {
    type: 'MultiWiggleAdapter',
    subadapters: [1, 2, 3].map(n => ({
      type: 'BigWigAdapter',
      name: `posneg_rw${n}`,
      bigWigLocation: uri(`posneg_rw${n}.bw`),
    })),
  },
  region: { refName: 'ctgA', start: 0, end: 50000 },
  bpPerPx: 50,
}
