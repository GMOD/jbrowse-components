// The hg38 RefSeq annotation projected onto the COLO829 derivative allele, in
// the allele's own coordinates. What it shows is the point of the figures that
// carry it: the allele holds RARB's first coding exon and its start codon, then
// 183 bp of TRHDE spliced in backwards, then RARB again inverted.
//
// Transcribed from the tool's output, not measured off a picture:
//
//   sv_multihop.py derive ... --genes ncbiRefSeq.gff.gz
//
// writes <out>.derivative_genes.gff3 by running project_gff over the same PAF
// rows the hosted der3_vs_hg38 track draws (see scripts/sv_multihop.py, and
// scripts/check-build-scripts.py for what the projection guarantees). The
// features below are that GFF3 nested by ID/Parent, which is what a Gff3Adapter
// would hand the gene glyph, with one difference: sibling transcripts a segment
// clips to the same shape are collapsed to one, since geneGlyphMode
// 'longestCoding' draws one of them anyway and BICC1 alone contributes twelve.
//
// They ride in the session spec rather than a hosted file so the figure and its
// live link need nothing added to demos/cancer_sv; when that GFF is hosted, this
// becomes a normal track id.
const DER3 = 'der3_RARB_BICC1_TRHDE'

const DER3_GENE_FEATURES = [
  {
    uniqueId: 'RARB.seg0',
    refName: DER3,
    start: 0,
    end: 32732,
    strand: 1,
    type: 'gene',
    name: 'RARB',
    subfeatures: [
      {
        uniqueId: 'NM_001290216.3.seg0',
        refName: DER3,
        start: 0,
        end: 32732,
        strand: 1,
        type: 'transcript',
        name: 'NM_001290216.3',
      },
      {
        uniqueId: 'NM_001290300.2.seg0',
        refName: DER3,
        start: 13980,
        end: 32732,
        strand: 1,
        type: 'transcript',
        name: 'NM_001290300.2',
        subfeatures: [
          {
            uniqueId: 'exon:NM_001290300.2.1.seg0',
            refName: DER3,
            start: 13980,
            end: 14070,
            strand: 1,
            type: 'exon',
          },
          {
            uniqueId: 'CDS:NM_001290300.2.1.seg0',
            refName: DER3,
            start: 14042,
            end: 14070,
            strand: 1,
            type: 'CDS',
          },
          {
            uniqueId: 'start_codon:NM_001290300.2.1.seg0',
            refName: DER3,
            start: 14042,
            end: 14045,
            strand: 1,
            type: 'start_codon',
          },
        ],
      },
    ],
  },
  {
    uniqueId: 'LOC124906342.seg0',
    refName: DER3,
    start: 9171,
    end: 9237,
    strand: 1,
    type: 'gene',
    name: 'LOC124906342',
    subfeatures: [
      {
        uniqueId: 'XR_007096298.1.seg0',
        refName: DER3,
        start: 9171,
        end: 9237,
        strand: 1,
        type: 'transcript',
        name: 'XR_007096298.1',
        subfeatures: [
          {
            uniqueId: 'exon:XR_007096298.1.1.seg0',
            refName: DER3,
            start: 9171,
            end: 9237,
            strand: 1,
            type: 'exon',
          },
        ],
      },
    ],
  },
  {
    uniqueId: 'BICC1.seg1',
    refName: DER3,
    start: 32732,
    end: 32931,
    strand: 1,
    type: 'gene',
    name: 'BICC1',
    subfeatures: [
      {
        uniqueId: 'XM_047425780.1.seg1',
        refName: DER3,
        start: 32732,
        end: 32931,
        strand: 1,
        type: 'transcript',
        name: 'XM_047425780.1',
      },
    ],
  },
  {
    uniqueId: 'FAM133CP.seg1',
    refName: DER3,
    start: 32732,
    end: 32803,
    strand: 1,
    type: 'gene',
    name: 'FAM133CP',
    subfeatures: [
      {
        uniqueId: 'NR_027508.1.seg1',
        refName: DER3,
        start: 32732,
        end: 32803,
        strand: 1,
        type: 'transcript',
        name: 'NR_027508.1',
        subfeatures: [
          {
            uniqueId: 'exon:NR_027508.1.1.seg1',
            refName: DER3,
            start: 32732,
            end: 32803,
            strand: 1,
            type: 'exon',
          },
        ],
      },
    ],
  },
  {
    uniqueId: 'TRHDE.seg2',
    refName: DER3,
    start: 32932,
    end: 33115,
    strand: -1,
    type: 'gene',
    name: 'TRHDE',
    subfeatures: [
      {
        uniqueId: 'XM_017019244.2.seg2',
        refName: DER3,
        start: 32932,
        end: 33115,
        strand: -1,
        type: 'transcript',
        name: 'XM_017019244.2',
      },
      {
        uniqueId: 'XM_005268819.6.seg2',
        refName: DER3,
        start: 32932,
        end: 33115,
        strand: -1,
        type: 'transcript',
        name: 'XM_005268819.6',
        subfeatures: [
          {
            uniqueId: 'exon:XM_005268819.6.1.seg2',
            refName: DER3,
            start: 32932,
            end: 33115,
            strand: -1,
            type: 'exon',
          },
          {
            uniqueId: 'CDS:XM_005268819.6.1.seg2',
            refName: DER3,
            start: 32932,
            end: 33115,
            strand: -1,
            type: 'CDS',
          },
        ],
      },
    ],
  },
  {
    uniqueId: 'TRHDE-AS1.seg2',
    refName: DER3,
    start: 32932,
    end: 33115,
    strand: 1,
    type: 'gene',
    name: 'TRHDE-AS1',
    subfeatures: [
      {
        uniqueId: 'NR_026837.1.seg2',
        refName: DER3,
        start: 32932,
        end: 33115,
        strand: 1,
        type: 'transcript',
        name: 'NR_026837.1',
        subfeatures: [
          {
            uniqueId: 'exon:NR_026837.1.1.seg2',
            refName: DER3,
            start: 32932,
            end: 33115,
            strand: 1,
            type: 'exon',
          },
        ],
      },
    ],
  },
  {
    uniqueId: 'RARB.seg3',
    refName: DER3,
    start: 33126,
    end: 39549,
    strand: -1,
    type: 'gene',
    name: 'RARB',
    subfeatures: [
      {
        uniqueId: 'NM_001290216.3.seg3',
        refName: DER3,
        start: 33126,
        end: 39549,
        strand: -1,
        type: 'transcript',
        name: 'NM_001290216.3',
      },
    ],
  },
]

// A session track needs its own adapter: session tracks do not inherit the
// config's tracks, and this one exists only in the spec.
export const DER3_GENES_TRACK = {
  type: 'FeatureTrack',
  trackId: 'der3_genes',
  name: 'Reference genes projected onto the derivative',
  assemblyNames: [DER3],
  adapter: {
    type: 'FromConfigAdapter',
    features: DER3_GENE_FEATURES,
  },
}
