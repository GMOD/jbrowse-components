import {
  HG38_NCBI_GENE_TRACK,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// hg38_only.json supplies the hg38 assembly (remote fasta/aliases on
// jbrowse.org); the phyloP + gene tracks are added as session tracks.
const HG38_ONLY = 'test_data/hg38_only.json'

// UCSC hg38 phyloP 100-way conservation — signed data (positive = conserved,
// negative = accelerated), so it exercises the bicolor whiskers rendering. There
// is no jbrowse.org mirror, and hgdownload serves byte-range + CORS, so only the
// viewed region downloads despite the file's size.
const HG38_PHYLOP_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hg38_phylop100way',
  name: 'phyloP 100-way (UCSC)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/hg38.phyloP100way.bw',
      locationType: 'UriLocation',
    },
  },
}

export const conservationSpecs: ScreenshotSpec[] = [
  // phyloP (signed BigWig, default xyplot+whiskers) over TP53 alongside the NCBI
  // RefSeq GFF gene track: the conserved exons read blue (positive) above the
  // pivot and accelerated/neutral bases red (negative) below it, lined up with
  // the gene model.
  {
    mode: 'url',
    name: 'phylop_ncbi_refseq_tp53',
    url: sessionSpec(HG38_ONLY, {
      sessionTracks: [HG38_PHYLOP_TRACK, HG38_NCBI_GENE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:7,668,400-7,687,550', // TP53
          tracks: [
            {
              trackId: 'hg38_phylop100way',
              defaultRendering: 'xyplot',
              height: 130,
            },
            { trackId: 'ncbi_genes_hg38_ucsc', height: 160 },
          ],
        },
      ],
    }),
    readyText: 'phyloP',
    readyTimeout: 60000,
    settleMs: 8000,
    viewportHeight: 500,
    // Remote UCSC/NCBI range fetches introduce render-timing jitter; loosen the
    // content-stable gate so an unchanged capture isn't re-committed each regen.
    diffThreshold: 0.02,
  },
]
