import { UCSC_HG38_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the genomes_basics tutorial: finding a track in the hosted UCSC
// catalog and turning it on, worked on hg38's phyloP conservation.
//
// Loads genomes.jbrowse.org's OWN hg38 config, the same way the genomes_synteny
// and genomes_msa figures do, so the track names in the selector, the category
// they sit under and the track the checkbox opens are the ones a reader gets on
// the real site. An earlier version of this figure built the same picture out of
// `sessionTracks` against a bare hg38 config, which rendered the same phyloP
// BigWig under a name nothing in the UI would ever show.
//
// The BigWig itself is served by hgdownload with byte-range + CORS, so only the
// viewed region downloads despite the file's size. hgdownload is also the
// slowest host any of these figures touch, hence the raised ready timeouts.

// The transcript body alone, for the figure that reads the signal against the
// exons. Collapsed to one transcript, TP53's drawn 5' end is whichever of the
// five transcripts tying at a 1182 bp CDS the collapse picks (this one stops at
// 7,677,451), so the full locus above leaves the right half of the frame with
// signal and no gene under it, nothing to line the peaks up against.
const TP53_TRANSCRIPT_WINDOW = 'chr17:7,668,400-7,677,600'

// A whole coding exon of TP53 (the DNA-binding domain), from
// api.genome.ucsc.edu's ncbiRefSeqCurated exon bounds rather than eyeballed off
// the figure above. 110 bp is inside the zoom where the sequence track draws
// letters and its translation rows, which is what the last figure checks the
// per-base scores against.
const TP53_EXON_WINDOW = 'chr17:7,674,180-7,674,290'

// The gene track the site itself opens with (its defaultSession shows
// `hg38-ncbiRefSeq`, RefSeq All), and nothing else: no height, no glyph mode, no
// display settings at all. A figure on a page called "basic usage" has to be the
// view a reader lands in, so RefSeq All draws its 28 TP53 transcripts here the
// way it draws them for everyone. The page collapses them where it needs to, as
// a step the reader takes, and shows the control that does it.
const GENE_TRACK = { trackId: 'hg38-ncbiRefSeq' }
const PHYLOP_TRACK = { trackId: 'hg38-phyloP100way' }

// Collapsed to the longest coding transcript, which the page reaches through the
// isoform control at the bottom right of the gene track. Used by the base-zoom
// figure alone, because at that zoom the default is one codon row printed 28
// times and the residue labels are what the check is read against.
const GENE_TRACK_COLLAPSED = {
  ...GENE_TRACK,
  geneGlyphMode: 'longestCoding',
}

// genomes_basics/turn_on_phylop was here and is DELETED (review: "this is just
// too boring and detailed i think. consider delete"). It was the click path
// drawn as two stacked frames -- the filter box with two red boxes on the
// filtered row and its category, then the same view with the track open. Every
// pixel of it was JBrowse chrome, and the one result frame was already the next
// figure on the page, better. Two clicks are a sentence.

export const conservationSpecs: ScreenshotSpec[] = [
  // The result on its own, declared as a session rather than clicked together:
  // the figure the tutorial reads, and the one the gallery card is cut from.
  {
    mode: 'url',
    name: 'genomes_basics/phylop_tp53',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_TRANSCRIPT_WINDOW,
          // gene track first, phyloP second: a track opened from the selector
          // is appended below what is already there, so this is the order the
          // click-path above ends in rather than a tidier one
          tracks: [GENE_TRACK, PHYLOP_TRACK],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportHeight: 460,
    diffThreshold: 0.02,
  },

  // The check against the raw data: one coding exon at base zoom, where the
  // scores are visibly one bar per base and the sequence track underneath says
  // which base each one is on. A whole-gene view cannot tell a per-base score
  // from a smoothed band.
  {
    mode: 'url',
    name: 'genomes_basics/phylop_bases',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: TP53_EXON_WINDOW,
          // same appended order: genes, then phyloP, then the reference
          // sequence, which is off by default and is a third turn of the same
          // checkbox
          tracks: [
            GENE_TRACK_COLLAPSED,
            PHYLOP_TRACK,
            { trackId: 'hg38-refseq' },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
    settleMs: 8000,
    viewportHeight: 620,
    diffThreshold: 0.02,
  },
]
