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
// label the stages gate on ("Orthologs", "Query species", "Rows to align") is a
// literal in that bundle. Before that release the store served a BLAST-only
// dialog, stage 2 found no such tab, and stage 3 waited out its timeout with no
// alignment to gate on. A stage that fails that way is the store lagging a
// release, not a broken spec. The tab was labelled "Orthologs (fast)" until the
// store bundle dropped the parenthetical, which failed the stage the same way.
//
// "Rows to align" replaced a grid of 23 species checkboxes in 2.10.0, which is
// also what made these figures dense: the checkbox list was intersected with
// NCBI's ortholog report and kept 12 of the 165 orthologs NCBI publishes for
// this gene. A stage still gating on "Species to include" is the store serving
// something older than 2.10.0.
//
// NLRP1 (hg38 chr17:5,501,396-5,584,509, minus strand, per NCBI Datasets), not a
// housekeeping gene: the overlay only says something when the rows differ.
// NLRP1's N-terminal pyrin domain is present in human and absent in mouse while
// the NACHT / winged-helix / HD2 / FIIND / CARD core is shared by every row.
// Read out of the proteins NCBI's own product_report picks, so the figure and
// the pipeline agree: human NP_127497.1 carries Pyrin_NALPs at residue 9, and
// mouse NP_001004142.2 starts at NACHT residue 133 with no pyrin call anywhere.
//
// It is also honest about how far the gene reaches. Every one of the 165
// orthologs NCBI publishes for NLRP1 is a mammal: placentals plus the common
// wombat and the common brushtail, and no monotreme, bird, reptile, amphibian
// or fish. So the tree these figures draw stops where the gene does, while CFTR
// reaches sea lamprey on the same click-path. That is the tutorial's last
// section.
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
    trackId: 'hg38-ncbiRefSeqCurated',
    loc: 'chr17:5,543,000',
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
  { type: 'waitForText', text: 'Orthologs' },
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

// Submit, then wait out a live NCBI lookup plus an EBI Clustal Omega job. The
// lookup is instant; the aligner is the wait, and the domain overlay is a second
// round trip after the alignment itself lands.
//
// Gate on the RESULT, not on a timer, and specifically on the entry these
// figures are OF. The legend lists one row per domain type present anywhere in
// the alignment, so `Pyrin_NALPs` appears only once NCBI has returned the
// records that carry a pyrin call. A looser gate on NACHT passes without it:
// eutils answers a burst of these runs with HTTP 429, those rows silently lose
// their domain calls, and the frame is an overlay missing the one block the page
// is about. Which is what it shipped as, once.
//
// Measured at the dialog's default row count: about a minute at EBI (half a
// second a row) and a few seconds more for a hundred GenPept records. The gate
// is set well past that rather than near it, because it is a queue and the cost
// of waiting is a slower sweep while the cost of missing is a wrong figure.
const ALIGNMENT_TIMEOUT = 420000

const SUBMIT_AND_WAIT: ScreenshotAction[] = [
  { type: 'click', selector: 'button::-p-text(Submit)' },
  { type: 'waitForText', text: 'Pyrin_NALPs', timeout: ALIGNMENT_TIMEOUT },
]

// The domain key floats over the top-right of the alignment at 95% opacity and
// is sized off the view, so on a panel this tall it covers a real block of
// residues -- at the residue zoom below, some of the columns the frame is OF.
//
// Collapsed by CLICKING it rather than by `showDomainLegend: false` in the
// session, and the ordering is the whole reason: the gate above waits on
// `Pyrin_NALPs`, which is a legend entry, so a session that opens with the
// legend already collapsed removes the only text proving the pyrin call
// arrived and the spec times out on a frame that is otherwise correct.
// Gate on the legend, then put it away.
const COLLAPSE_DOMAIN_KEY: ScreenshotAction[] = [
  { type: 'click', selector: 'button[title="Collapse key"]' },
  { type: 'delay', ms: 500 },
]

// What the protein tour films, on the same hosted config the figures above load.
//
// TP53 rather than NLRP1, and the reason is the second half of the clip: the
// launch is only worth watching if the two views are then seen to be one view,
// and that needs a locus whose variants a reader already expects to be there.
//
// ClinVar SNVs ride along because the residue a variant lands on is the question
// the connected view answers. The hover does NOT need a variant under the
// cursor: the highlight follows the mouse's genomic position through the
// transcript's CDS, so what the track contributes is the reason to look, not the
// target to hit.
//
// The window is 2.2 kb of the gene rather than all of it, for two reasons. The
// ALIGNMENT panel scrolls horizontally and a hover does not scroll it, so only
// the protein's first ~160 residues are on screen; TP53 is on the minus strand,
// so those are the gene's right-hand 1.6 kb, eighty pixels of a 20 kb view. And
// at 20 kb ClinVar paints "Too many features" instead of its variants.
const TP53_WINDOW = 'chr17:7,674,400-7,676,600'
const TP53_GENE_TRACK = 'hg38-ncbiRefSeqCurated'
const TP53_CLINVAR_TRACK = 'hg38-clinvarMain'

export const proteinTourFixtures = {
  geneTrack: TP53_GENE_TRACK,
  // The positions the tour hovers, measured on this transcript rather than
  // worked out from the exon list: 7,676,250 is residue 34, 7,675,200 is
  // residue 134, and 7,674,600 is in the intron between them.
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

// The session https://genomes.jbrowse.org/protein-browser/?gene=TP53&residue=248&align=hundredWay
// hands to Open in JBrowse, decoded from that link's `encoded-` session and
// carried here as the same snapshot. Regenerate it from the page when the
// protein browser changes what it builds.
const TP53_CDS: [number, number, number][] = [
  [7669608, 7669690, 1],
  [7670608, 7670715, 0],
  [7673534, 7673608, 2],
  [7673700, 7673837, 1],
  [7674180, 7674290, 0],
  [7674858, 7674971, 2],
  [7675052, 7675236, 0],
  [7675993, 7676272, 0],
  [7676381, 7676403, 1],
  [7676520, 7676594, 0],
]

const TP53_TRANSCRIPT = {
  uniqueId: 'ENST00000269305.9',
  type: 'mRNA',
  refName: 'chr17',
  start: 7669608,
  end: 7676594,
  strand: -1,
  name: 'ENST00000269305.9',
  subfeatures: TP53_CDS.map(([start, end, phase]) => ({
    type: 'CDS',
    start,
    end,
    strand: -1,
    phase,
  })),
}

const TP53_PROTEIN =
  'MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSDZ'

const PROTEIN_BROWSER_TP53 = {
  name: 'Gene explorer: TP53',
  views: [
    {
      id: 'lgv-TP53',
      type: 'LinearGenomeView',
      colorByCDS: true,
      hideHeaderOverview: true,
      showGridlines: false,
      init: {
        assembly: 'hg38',
        loc: 'chr17:7676481-7676634[rev] chr17:7676342-7676443[rev] chr17:7675954-7676312[rev] chr17:7675013-7675276[rev] chr17:7674819-7675011[rev] chr17:7674141-7674330[rev] chr17:7673661-7673877[rev] chr17:7673495-7673648[rev] chr17:7670569-7670755[rev] chr17:7669569-7669730[rev]',
        tracks: [
          'hg38-ncbiRefSeqSelect',
          'hg38-clinvarMain',
          'hg38-alphaMissense',
        ],
      },
    },
    {
      id: 'msa-TP53',
      type: 'MsaView',
      connectedViewId: 'lgv-TP53',
      connectedFeature: TP53_TRANSCRIPT,
      uniprotId: 'P04637',
      colorSchemeName: 'percent_identity_dynamic',
      labelsAlignRight: true,
      treeAreaWidth: 200,
      treeFilehandle: {
        uri: 'https://jbrowse.org/demos/msaview/100way/hg38.multiz100way.nh',
        locationType: 'UriLocation',
      },
      init: {
        msaIndexedLocation: {
          uri: 'https://jbrowse.org/demos/msaview/100way/hg38.knownCanonical.multiz100way.aa.fa.gz',
        },
        msaName: 'TP53',
        querySeqName: 'hg38',
      },
    },
    {
      id: 'protein-TP53',
      type: 'ProteinView',
      height: 500,
      zoomToBaseLevel: false,
      structures: [
        {
          url: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif',
          feature: TP53_TRANSCRIPT,
          userProvidedTranscriptSequence: TP53_PROTEIN,
          connectedViewId: 'lgv-TP53',
          initialTranscriptResidues: [{ start: 248, end: 248 }],
        },
      ],
    },
  ],
  useWorkspaces: true,
  activePanelId: 'panel-left',
  layout: {
    id: 'branch-root',
    direction: 'row',
    size: 1,
    children: [
      {
        id: 'panel-left',
        size: 58,
        tabs: [{ id: 'tab-left', viewIds: ['lgv-TP53', 'msa-TP53'] }],
        activeTabId: 'tab-left',
      },
      {
        id: 'panel-right',
        size: 42,
        tabs: [{ id: 'tab-right', viewIds: ['protein-TP53'] }],
        activeTabId: 'tab-right',
      },
    ],
  },
}

export const msaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/protein_browser_tp53',
    url: `?config=${UCSC_HG38_CONFIG}&session=json-${encodeURIComponent(JSON.stringify({ session: PROTEIN_BROWSER_TP53 }))}`,
    readySelector: '[data-testid="protein-view-ready"]',
    readyTimeout: 180000,
    hideSelectors: ['.msp-background-tasks'],
    hideTooltip: true,
    viewportWidth: 2000,
    viewportHeight: 1300,
  },
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
          { type: 'box', anchor: { text: 'Orthologs' } },
          {
            type: 'box',
            anchor: {
              selector:
                '[role="dialog"] .MuiTextField-root:has(input[type="number"])',
            },
          },
        ],
        // Declared, not inherited. A stage without its own height keeps
        // whatever the previous one resized to, so leaving this off gave the
        // dialog the 540 the menu frame above wanted and cut it off below the
        // species list: no isoform selector, no Submit, in the frame whose
        // whole subject is that dialog.
        //
        // Down again, to 580: msaview 2.10.0 replaced the grid of 23 species
        // checkboxes with one "Rows to align" field, which is the change these
        // figures are of. The dialog has been 880, then 700 as the grid tightened
        // (735 css px of dialog, then 616), and is now four fields tall.
        viewportHeight: 580,
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
          // The selector is the toolbar button's `tooltip` prop, which
          // CascadingMenuButton now puts on the MUI IconButton as its
          // `aria-label` while a real MUI Tooltip carries the title. It is the
          // only thing distinguishing this button from the icon buttons beside
          // it. An earlier bundle passed the prop through as a raw `tooltip`
          // DOM attribute, and that spelling is what this stage used to match.
          {
            type: 'click',
            selector: 'button[aria-label="Fit / zoom options"]',
          },
          { type: 'click', text: 'Fit horizontally' },
          { type: 'delay', ms: 1000 },
          ...COLLAPSE_DOMAIN_KEY,
        ],
        // the split views and the MSA panel's fixed height, and nothing under
        // them. The domain key's last row can look cut off; it is a scrollable
        // list sized off the view, not a clip.
        viewportHeight: 700,
      },
    ],
    hideTooltip: true,
    viewportHeight: 900,
    // the UCSC hub config is ~570 tracks and pulls four remote plugins, the
    // same reason genomes_synteny raises this
    readyTimeout: 120000,
  },
  {
    // The tutorial's control on the overlay above: the same domain architecture
    // read out of UniProt and projected onto the genome by UCSC, rather than out
    // of NCBI's conserved-domain database and drawn in alignment columns. Two
    // annotation sources over one gene, and the pyrin call is what a reader
    // compares between them.
    //
    // NLRP1 is on the minus strand, so its N terminus is the RIGHT-hand end of
    // this window and the pyrin block is the rightmost one on the domain track.
    // The NACHT / winged-helix / FIIND / CARD core the alignment shows every row
    // sharing runs leftward from it, which is what makes the frame readable: a
    // track carrying one domain would say nothing about which of them the two
    // sources agreed on.
    //
    // Declarative, and free of both plugins: these are the hosted config's own
    // tracks, so a protein3d or msaview release cannot reach this figure.
    mode: 'url',
    name: 'genomes_msa/genomic_domains',
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
            // Filtered to NLRP1's own reviewed UniProt entry. UCSC's unipDomain
            // BigBed carries one feature per record per isoform, so unfiltered
            // this window is a dozen rows in which FIIND is written eleven
            // times and the architecture the section is about is the top row
            // only. `uniProtId` is the BigBed's own column, the one the track's
            // mouseover reads.
            {
              trackId: 'hg38-unipDomain',
              // the track's own display type, already its default. Named so
              // `check-spec-recipes` can resolve which menu the filter below
              // lives in rather than reporting the field as unreachable.
              type: 'LinearBasicDisplay',
              filter: ["jexl:get(feature,'uniProtId')=='Q9C000'"],
              height: 90,
            },
          ],
        },
      ],
    }),
    readyText: 'UniProt - Domains',
    // the UCSC hub config is ~570 tracks and pulls four remote plugins, the
    // same reason the two specs above raise this
    readyTimeout: 120000,
    hideTooltip: true,
    viewportHeight: 390,
  },
]
