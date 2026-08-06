import { UCSC_HG38_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// Figures for the genomes_msa tutorial.
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
const NLRP1_SESSION = sessionSpec(UCSC_HG38_CONFIG, {
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
})

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
        viewportHeight: 880,
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
        // `blank below the last content` said 122 css px at 1000
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
    // same picture at whole-protein zoom. scrollX starts at 0 and the pyrin
    // call is at query residue 9, so the columns the view opens on are the
    // columns the check is about, with no scrolling to write down.
    //
    // Single frame rather than a fourth stage on the spec above: a stack is
    // unusable as a gallery card (gen-gallery-thumbs fits inside 1200x600, so a
    // 3000x4600 stack paints as a 170px-wide sliver), and this is the figure
    // the gallery card is cut from.
    mode: 'url',
    name: 'genomes_msa/pyrin_residues',
    url: NLRP1_SESSION,
    actions: [RIGHT_CLICK_NLRP1, ...OPEN_LAUNCH_DIALOG, ...SUBMIT_AND_WAIT],
    hideTooltip: true,
    viewportHeight: 878,
    readyTimeout: 120000,
  },
]
