import { UCSC_HG38_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// Figures for the alignment half of the genomes_proteins tutorial, and the
// session its protein tour is filmed in (proteinTourFixtures, below).
//
// Loads genomes.jbrowse.org's OWN hg38 config rather than a repo test_data one,
// the same way the genomes_synteny figures do, so the track names, the
// right-click menu and the dialog are the ones a reader gets on the real site.
// That config already lists the MsaView plugin at the version-agnostic `latest/`
// path, so nothing here pins a plugin version and a plugin release reaches
// these figures with no config change.
//
// The Orthologs tab shipped in the release after jbrowse-plugin-msaview 2.7.3,
// and the plugin store `latest/` bundle this config loads now serves it: every
// label the stages gate on ("Orthologs (fast)", "Query species", "Species to
// include") is a literal in that bundle. Before that release the store served a
// BLAST-only dialog, stage 2 found no such tab, and stage 3 waited out its
// timeout with no alignment to gate on. A stage that fails that way is the
// store lagging a release, not a broken spec.
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

// The gene track carries an explicit height and longestCoding glyph mode: the
// right-click is resolved against the track's band, and an auto height is a
// function of how many isoforms RefSeq draws at this locus, so the click
// coordinate would move whenever that changed.
const NLRP1_LGV = {
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
}

const NLRP1_SESSION = sessionSpec(UCSC_HG38_CONFIG, { views: [NLRP1_LGV] })

const RIGHT_CLICK_NLRP1: ScreenshotAction = {
  type: 'rightclick',
  anchor: {
    track: 'hg38-ncbiRefSeqCurated',
    locus: 'chr17:5,543,000',
    // near the top of the band, not its middle. `longestCoding` draws this
    // locus as a single gene row, so the lower two thirds of a 60px track are
    // empty canvas: a centered right-click opens the view's own menu with no
    // feature items in it, and the stage then fails on the launcher it was
    // waiting for rather than on the click that missed.
    fracY: 0.2,
  },
}

// Open the launch dialog and wait for it to be usable. The tab label paints
// before the dialog has resolved the transcript's protein sequence, and the
// isoform selector is still filling in at that point. Submit is disabled until
// that sequence arrives, so an enabled Submit is the declarative "dialog is
// ready" rather than a guess at how long the fetch takes.
const OPEN_LAUNCH_DIALOG: ScreenshotAction[] = [
  { type: 'click', text: 'Launch MSA view' },
  { type: 'waitForText', text: 'Orthologs (fast)' },
  {
    type: 'waitForSelector',
    selector: 'button:not([disabled])::-p-text(Submit)',
    // Longer than the 30s default, because what gates it is a range read out of
    // hgdownload's hg38.2bit for the transcript's CDS. hgdownload is the
    // slowest host any of these figures touch, and at 30s this failed on a
    // pending 2bit request often enough to read as a broken selector.
    timeout: 120000,
  },
]

// Submit, then wait out a live NCBI lookup plus an EBI Clustal Omega job.
// Seconds rather than minutes, which is the tutorial's whole point, but
// network-bound: the domain overlay is a second round trip after the alignment
// itself lands.
//
// Gate on the RESULT, not on a timer, and specifically on the entry these
// figures are OF. The legend lists one row per domain type present anywhere in
// the alignment, and the human row is the only one with a pyrin, so
// `Pyrin_NALPs` appears only once NCBI has returned the human protein record. A
// looser gate on NACHT passes without it: eutils answers a burst of these runs
// with HTTP 429, the human row silently loses its domain calls, and the frame
// is an overlay missing the one block the page is about. Which is what it
// shipped as, once.
const SUBMIT_AND_WAIT: ScreenshotAction[] = [
  { type: 'click', selector: 'button::-p-text(Submit)' },
  { type: 'waitForText', text: 'Pyrin_NALPs', timeout: 180000 },
]

// What the protein tour films, on the same hosted config the figures above load.
//
// TP53 rather than NLRP1, and the reason is the second half of the clip: the
// launch is only worth watching if the two views are then seen to be one view,
// and that needs a locus whose variants a reader already expects to be there.
// The window is the gene plus a margin, so the hover walk below has exons and
// introns in the same frame.
//
// ClinVar SNVs ride along because the residue a variant lands on is the question
// the connected view answers. The hover does NOT need a variant under the
// cursor: the highlight follows the mouse's genomic position through the
// transcript's CDS, so what the track contributes is the reason to look, not the
// target to hit.
const TP53_WINDOW = 'chr17:7,668,000-7,688,000'
const TP53_GENE_TRACK = 'hg38-ncbiRefSeqCurated'
const TP53_CLINVAR_TRACK = 'hg38-clinvarMain'

export const proteinTourFixtures = {
  geneTrack: TP53_GENE_TRACK,
  // The window the tour zooms to before it hovers, and the three positions it
  // hovers in it. Measured on this transcript rather than worked out from the
  // exon list: 7,676,250 is residue 34, 7,675,200 is residue 134, and 7,674,600
  // is in the intron between them and maps to nothing.
  //
  // Two constraints pick these, and they pull opposite ways at gene-wide zoom.
  // The ALIGNMENT panel scrolls horizontally and a hover does not scroll it, so
  // only the protein's first ~160 residues are on screen and a hover past them
  // moves a column nobody can see. TP53 is on the minus strand, so those
  // residues are the gene's right-hand 1.6 kb — which across a 20 kb view is
  // eighty pixels, and three hovers inside it read as one twitching cursor.
  // Hence the zoom: at this window the same three positions are spread across
  // the frame, and the exon they leave is visible under the cursor.
  hoverWindow: 'chr17:7,674,400-7,676,600',
  codingLocus: 'chr17:7,676,250',
  secondCodingLocus: 'chr17:7,675,200',
  // The negative. g2p_mapper skips introns and UTRs, so the readout empties
  // rather than moving, which is the one thing about the connection that a
  // still of it cannot say.
  intronicLocus: 'chr17:7,674,600',
  session: sessionSpec(UCSC_HG38_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: TP53_WINDOW,
        tracks: [
          {
            trackId: TP53_GENE_TRACK,
            // the same two settings the NLRP1 figures pin, and for the same
            // reason: the right-click is resolved against the track's band
            geneGlyphMode: 'longestCoding',
            height: 60,
          },
          { trackId: TP53_CLINVAR_TRACK, height: 90 },
        ],
      },
    ],
  }),
}

// The OTHER route the proteins page documents, and the only tour here whose
// subject is a site this repo does not build: the JBrowseMSA Gene Explorer takes
// a gene symbol and hands back a JBrowse session with all three views already
// connected.
//
// Nothing here spells that session out, and that is the point of filming this
// one rather than reproducing it: the explorer's generator owns the collapsed
// intron list, the indexed multiz alignment and the AlphaFold url, and a fixture
// restating them would document a session only this file believes in. The tour
// clicks the page's own example and follows the tab it opens.
export const geneExplorerTourFixtures = {
  url: 'https://gmod.org/JBrowseMSA/gene-explorer/',
  // The page's own examples row, which is also the gene the rest of the page
  // uses.
  exampleGene: 'TP53',
  geneInput: 'input[placeholder="e.g. TP53"]',
  // As the DOM spells it. The page renders it in caps through a text-transform,
  // so the label a reader sees is not the string a selector matches.
  launchLink: 'Open in JBrowse',
  // The gene track the explorer's session turns on, and three coding positions
  // to hover along it. Refnames are the explorer's (`17`, not `chr17`).
  //
  // All three are in the protein's first sixty residues, and that is the whole
  // of what constrains them. The alignment opens at residue zoom, which on a
  // protein this long is about sixty readable columns, and it does not scroll
  // itself to a hovered residue — so a hover past them moves a column nobody can
  // see, which is a film of two views answering instead of three. **Fit
  // horizontally** is the other way to get the column on screen and it is worse
  // here: fitted, twelve hundred columns are a purple texture and the one the
  // hover lights is a hairline in it.
  //
  // TP53 is on the minus strand, so those residues are the gene's right-hand
  // end. What buys the separation the other protein tour needed a zoom for is
  // the explorer's own collapsed-intron view: the introns are gone, so the CDS
  // is drawn at about a pixel per base and sixty residues are a couple of
  // hundred pixels of screen, spread across three exon blocks.
  geneTrack: 'hg38-ncbiRefSeqSelect',
  hoverLoci: ['17:7,676,560', '17:7,676,390', '17:7,676,200'],
}

export const msaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'genomes_msa/launch_sequence',
    url: NLRP1_SESSION,
    // A menu, the dialog it opens, and the view that dialog builds: each stage
    // is reachable only by driving the one before it, so they are stages of one
    // spec rather than three specs.
    stages: [
      {
        actions: [
          RIGHT_CLICK_NLRP1,
          { type: 'waitForText', text: 'Launch MSA view' },
        ],
        // Both boxes are assertions, not decoration: an anchor that resolves to
        // nothing throws. genomes.jbrowse.org loads protein3d beside msaview,
        // so one right-click on a gene offers both, and the tutorial says so.
        // If `Launch protein view` ever stops resolving here, that sentence is
        // what has gone stale.
        annotations: [
          { type: 'box', anchor: { text: 'Launch MSA view' } },
          { type: 'box', anchor: { text: 'Launch protein view' } },
        ],
        // the one-track view plus the menu it opens, and nothing under them.
        // At the spec's own 900 this frame was more empty page than figure, and
        // it is the top third of a three-frame stack, so the whitespace pushed
        // the alignment below the fold on the page that embeds it.
        viewportHeight: 540,
      },
      {
        actions: OPEN_LAUNCH_DIALOG,
        annotations: [
          { type: 'box', anchor: { text: 'Orthologs (fast)' } },
          { type: 'box', anchor: { text: 'Species to include' } },
        ],
        // Declared, not inherited. A stage without its own height keeps
        // whatever the previous one resized to, so leaving this off gave the
        // dialog the 540 the menu frame above wanted and cut it off below the
        // species checkboxes: no isoform selector, no Submit, in the frame
        // whose whole subject is that dialog.
        //
        // 700, down from 880, and the dialog carries ten more species than it
        // did: msaview 2.8.0 put the species grid on auto-fitted 130px columns
        // (five rows for twenty-three where three 160px columns were five rows
        // for thirteen), cut a seven-line intro to one line, and moved the
        // query-row note to helper text under the isoform selector. Measured off
        // the two captures at the same frame width: 735 css px of dialog before,
        // 616 after.
        viewportHeight: 700,
      },
      {
        actions: [
          ...SUBMIT_AND_WAIT,
          // The view opens at colWidth 12, which is residue zoom: about a
          // hundred columns of a ~1500-column alignment, and none of the domain
          // blocks this frame is of. Fit horizontally is the one action that
          // puts the whole protein on screen, and it computes the width instead
          // of stepping 0.75x per click toward a floor that would still leave
          // the C terminus off the right edge.
          //
          // The selector is the toolbar button's `tooltip` prop, which msaview
          // passes straight through to the MUI IconButton and React therefore
          // renders as a DOM attribute. That is the only thing distinguishing
          // this button from the five icon buttons beside it, which carry no
          // aria-label; if the plugin ever wraps it in a real MUI Tooltip the
          // attribute goes away and this stage fails on the selector.
          {
            type: 'click',
            selector: 'button[tooltip="Fit / zoom options"]',
          },
          { type: 'click', text: 'Fit horizontally' },
          { type: 'delay', ms: 1000 },
        ],
        // the MSA view opens at a fixed height, so this is the LGV above it
        // plus that view plus nothing: the run's own
        // `blank below the last content` said 122 css px at 1000.
        //
        // Left at 878 after trying 1010 for the domain KEY, whose last entry
        // reads as cut off. Raising the frame only added page background (128
        // css px of blank below, key looking the same), and the reason is that
        // the key is not clipped at all: it is a scrollable list sized off the
        // VIEW (60% of the MSA panel), and a scrollable list with a half-visible
        // last row is indistinguishable from truncation in a still image.
        // Measured on this alignment: 18 entries, Paper 330px ending at y=813,
        // nearest clipping ancestor ending at 855, no row past that edge,
        // clientHeight 296 against scrollHeight 313. So there is nothing here
        // for a frame height or a plugin fix to do, and the caption names the
        // two blocks the figure is about instead.
        viewportHeight: 878,
      },
    ],
    hideTooltip: true,
    viewportHeight: 900,
    // the UCSC hub config is ~570 tracks and pulls four remote plugins, the
    // same reason genomes_synteny raises this
    readyTimeout: 120000,
  },
  {
    // The same alignment left at the zoom it OPENS at, which is the one thing
    // the fitted whole-protein frame above cannot show: individual residues.
    // The tutorial's control check is that the rows without a pyrin block are
    // not empty under it, and "no domain annotated" and "no sequence" are the
    // same picture at whole-protein zoom.
    //
    // Single frame rather than a fourth stage on the spec above: a stack is
    // unusable as a gallery card (gen-gallery-thumbs fits inside 1200x600, so a
    // 3000x4600 stack paints as a 170px-wide sliver), and this is the figure
    // the gallery card is cut from.
    //
    // Declarative, and the whole point of it being so is that the columns are
    // aimed rather than accepted. The dialog-driven version of this spec drove
    // the same click-path as the figure above and then shot whatever columns
    // the view happened to open on, which stopped being the pyrin ones the
    // moment the species list widened: at twelve rows the alignment's first
    // columns are the gorilla's private N-terminal extension, then the
    // gorilla's and the horse's, and the human query's first residue is 82
    // columns in. `orthologParams` is msaview's own launch path reached from a
    // session spec (jbrowse-plugin-msaview >= 2.8.2), so there is no
    // right-click, no dialog and no submit here.
    mode: 'url',
    name: 'genomes_msa/pyrin_residues',
    url: sessionSpec(UCSC_HG38_CONFIG, {
      views: [
        NLRP1_LGV,
        {
          type: 'MsaView',
          // `taxa` omitted is every species the dialog offers, and
          // `proteinSequence` omitted is NCBI's representative protein for the
          // gene -- which is also what makes the query row byte-identical to
          // the RefSeq record its accession names, so the CDD overlay the
          // readiness gate below waits on is there by construction.
          orthologParams: {
            taxId: 9606,
            geneCandidates: ['NLRP1'],
            msaAlgorithm: 'clustalo',
          },
          // Hide any column gappier than this, which is the aiming. Measured
          // on this alignment: the gorilla alone holds columns 0-31 (1 of 12
          // rows, 91.7% gaps) and the gorilla with the horse holds 32-81 (2 of
          // 12, 83.3%), while the human M and eight other rows start together
          // at column 82. 80 drops both runs and keeps everything a third row
          // reaches (3 of 12 is 75%), so the view opens on the human N
          // terminus with the pyrin call nine residues into it. The margin is
          // what makes it robust rather than the exact number: at eleven or
          // thirteen rows those two quantities are 81.8/72.7 and 84.6/76.9,
          // still either side of 80.
          //
          // `hideGaps` defaults true, so this one number is the whole setting.
          allowedGappyness: 80,
        },
      ],
    }),
    // The same gate the click-path above uses, and for the same reason: it is
    // the only thing that proves NCBI answered the human record rather than
    // 429ing, and a frame without it is an overlay missing the one block the
    // page is about.
    actions: [{ type: 'waitForText', text: 'Pyrin_NALPs', timeout: 180000 }],
    hideTooltip: true,
    viewportHeight: 878,
    readyTimeout: 120000,
  },
]
