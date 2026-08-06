import { UCSC_HG38_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the genomes_msa tutorial.
//
// Loads genomes.jbrowse.org's OWN hg38 config rather than a repo test_data one,
// the same way the genomes_synteny figures do, so the track names, the
// right-click menu and the dialog are the ones a reader gets on the real site.
// That config already lists the MsaView plugin at the version-agnostic `latest/`
// path, so nothing here pins a plugin version and a plugin release reaches
// these figures with no config change.
//
// NOT YET REGENERATED: the Orthologs tab ships in the release AFTER
// jbrowse-plugin-msaview 2.7.3, and until that is published to the plugin store
// `latest/` still serves the BLAST-only dialog. Stage 2 would find no such tab
// and stage 3 would wait out its timeout with no alignment to gate on. Run this
// spec after the release, not before it.
//
// The genomes_msa tutorial card has no gen-tutorial-thumbs entry yet for the
// same reason: that script renders its crop from a committed PNG, so the entry
// goes in together with the figure this spec produces, not ahead of it.
//
// NLRP1 (hg38 chr17:5,501,396-5,584,509, minus strand, per NCBI Datasets), not a
// housekeeping gene: the overlay only says something when the rows differ.
// NLRP1's N-terminal pyrin domain is present in human and absent in mouse while
// the NACHT / winged-helix / HD2 / FIIND / CARD core is shared by every row.
// Read out of the proteins NCBI's own product_report picks, so the figure and
// the pipeline agree: human NP_127497.1 carries Pyrin_NALPs at residue 9, and
// mouse NP_001004142.2 starts at NACHT residue 133 with no pyrin call anywhere.
//
// It is also honest about the panel. NLRP1 is fast-evolving, so NCBI has
// orthologs for only part of the species list (human, mouse, dog, cattle, pig
// on a run of the shipped panel). A conserved gene fills it, which is what the
// tutorial's last section says.
const NLRP1_WINDOW = 'chr17:5,495,000-5,591,000'

export const msaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'genomes_msa/launch_sequence',
    // The gene track carries an explicit height and longestCoding glyph mode:
    // the right-click is resolved against the track's band, and an auto height
    // is a function of how many isoforms RefSeq draws at this locus, so the
    // click coordinate would move whenever that changed.
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: NLRP1_WINDOW,
          tracks: [
            {
              trackId: 'hg38-ncbiRefSeqCurated',
              geneGlyphMode: 'longestCoding',
              height: 60,
            },
          ],
        },
      ],
    }),
    // A menu, the dialog it opens, and the view that dialog builds: each stage
    // is reachable only by driving the one before it, so they are stages of one
    // spec rather than three specs.
    stages: [
      {
        actions: [
          {
            type: 'rightclick',
            anchor: {
              track: 'hg38-ncbiRefSeqCurated',
              locus: 'chr17:5,543,000',
              fracY: 0.5,
            },
          },
          { type: 'waitForText', text: 'Launch MSA view' },
        ],
        annotations: [{ type: 'box', anchor: { text: 'Launch MSA view' } }],
      },
      {
        actions: [
          { type: 'click', text: 'Launch MSA view' },
          { type: 'waitForText', text: 'Orthologs (fast)' },
          // The tab label paints before the dialog has resolved the
          // transcript's protein sequence, and the isoform selector is still
          // filling in at that point. Submit is disabled until that sequence
          // arrives, so an enabled Submit is the declarative "dialog is ready"
          // rather than a guess at how long the fetch takes.
          {
            type: 'waitForSelector',
            selector: 'button:not([disabled])::-p-text(Submit)',
          },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Orthologs (fast)' } },
          { type: 'box', anchor: { text: 'Species to include' } },
        ],
      },
      {
        // Submit, then wait out a live NCBI lookup plus an EBI Clustal Omega
        // job. Seconds rather than minutes, which is the tutorial's whole
        // point, but network-bound: the domain overlay is a second round trip
        // after the alignment itself lands.
        actions: [
          { type: 'click', selector: 'button::-p-text(Submit)' },
          // Gate on the RESULT, not on a timer. The domain legend renders only
          // once the alignment has loaded AND its CDD annotations have come
          // back, so its first entry appearing is the end state this frame is
          // of. NACHT is in every NLRP1 ortholog, which is what makes it a safe
          // thing to wait for; the pyrin entry is not, since only some rows
          // have one.
          { type: 'waitForText', text: 'NACHT', timeout: 180000 },
        ],
        viewportHeight: 1000,
      },
    ],
    hideTooltip: true,
    viewportHeight: 900,
  },
]
