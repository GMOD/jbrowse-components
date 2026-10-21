import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// Loads genomes.jbrowse.org's own hg38 config, whose MsaView plugin tracks the
// store's `latest/` bundle. A stage that times out on "Orthologs" or "Rows to
// align" means the store serves an older plugin, not a broken spec.
//
// NLRP1 because its pyrin domain is present in human and absent in mouse.
const NLRP1_WINDOW = 'chr17:5,495,000-5,591,000'

// The fixed height and longestCoding mode keep the right-click coordinate
// stable when RefSeq's isoform count changes.
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
    // The lower part of the 60px track is empty canvas, where a right-click
    // opens a menu with no feature items.
    fracY: 0.2,
  },
}

// Submit stays disabled until the transcript's protein sequence arrives.
const OPEN_LAUNCH_DIALOG: ScreenshotAction[] = [
  { type: 'click', text: 'Launch MSA view' },
  { type: 'waitForText', text: 'Orthologs' },
  {
    type: 'waitForSelector',
    selector: 'button:not([disabled])::-p-text(Submit)',
    // The hgdownload 2bit read often outlasts the 30s default.
    timeout: 120000,
  },
]

// Gate on `Pyrin_NALPs`, not NACHT: eutils rate-limits with 429s, rows then
// silently lose their domain calls, and a NACHT gate passes without the pyrin
// block. The timeout covers EBI's Clustal Omega queue.
const ALIGNMENT_TIMEOUT = 420000

const SUBMIT_AND_WAIT: ScreenshotAction[] = [
  { type: 'click', selector: 'button::-p-text(Submit)' },
  { type: 'waitForText', text: 'Pyrin_NALPs', timeout: ALIGNMENT_TIMEOUT },
]

// The domain key covers residues the frame is of. Collapse it by click after
// the gate: `showDomainLegend: false` would hide `Pyrin_NALPs`, the text the
// gate waits on.
const COLLAPSE_DOMAIN_KEY: ScreenshotAction[] = [
  { type: 'click', selector: 'button[title="Collapse key"]' },
  { type: 'delay', ms: 500 },
]

// The protein tour's session. A hover does not scroll the alignment panel, so
// the window covers only the gene's right-hand end (TP53 is minus strand), and
// at 20 kb ClinVar paints "Too many features".
const TP53_WINDOW = 'chr17:7,674,400-7,676,600'
const TP53_GENE_TRACK = 'hg38-ncbiRefSeqCurated'
const TP53_CLINVAR_TRACK = 'hg38-clinvarMain'

export const proteinTourFixtures = {
  geneTrack: TP53_GENE_TRACK,
  // Measured on this transcript: residue 34, residue 134, and the intron
  // between them.
  codingLocus: 'chr17:7,676,250',
  secondCodingLocus: 'chr17:7,675,200',
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
            // The right-click resolves against the band, as in NLRP1_LGV.
            geneGlyphMode: 'longestCoding',
            height: 60,
          },
          { trackId: TP53_CLINVAR_TRACK, height: 90 },
        ],
      },
    ],
  }),
}

// The protein browser's Open in JBrowse session for TP53 with Colour set to
// AlphaMissense.
const PROTEIN_BROWSER_TP53 = deflateSync(
  readFileSync(
    fileURLToPath(
      new URL('protein_browser_tp53.session.json', import.meta.url),
    ),
  ),
).toString('base64url')

const PROTEIN_BROWSER_PAGE =
  'https://genomes.jbrowse.org/protein-browser/?gene=TP53&ref=9606&residue=248&label=Cancer+hotspot+R248&structure=3kmd'

export const msaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/protein_browser_page',
    noSession: true,
    url: PROTEIN_BROWSER_PAGE,
    readyText: 'More about residue 248',
    readyTimeout: 90000,
    viewportWidth: 1100,
    viewportHeight: 640,
    liveLabel: 'Open TP53 in the protein browser',
    diffThreshold: 0.02,
    actions: [
      { type: 'click', selector: '.msv-advanced-switch input' },
      {
        type: 'type',
        selector: '.msv-advanced > label:nth-child(2) select',
        value: 'Al',
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 500 },
    ],
  },
  {
    mode: 'url',
    name: 'protein/protein_browser_tp53',
    url: `?config=${UCSC_HG38_CONFIG}&session=encoded-${PROTEIN_BROWSER_TP53}`,
    readySelector:
      'body:has([data-testid="protein-view-ready"]):has([data-testid="msa_canvas"])',
    readyTimeout: 300000,
    hideSelectors: ['.msp-background-tasks'],
    tooltip: 'hide',
    viewportWidth: 2000,
    viewportHeight: 1300,
  },
  {
    mode: 'url',
    name: 'genomes_msa/launch_sequence',
    url: NLRP1_SESSION,
    stages: [
      {
        actions: [
          RIGHT_CLICK_NLRP1,
          { type: 'waitForText', text: 'Launch MSA view' },
        ],
        // An unresolved anchor throws, so these boxes also assert that
        // genomes.jbrowse.org still offers both launchers, as the tutorial says.
        annotations: [
          { type: 'box', anchor: { text: 'Launch MSA view' } },
          { type: 'box', anchor: { text: 'Launch protein view' } },
        ],
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
        // A stage without its own height inherits the previous stage's 540,
        // which cuts off Submit.
        viewportHeight: 580,
      },
      {
        actions: [
          ...SUBMIT_AND_WAIT,
          // A bare `Zoom` text would match the genome view's "Zoom on scroll".
          { type: 'click', selector: '[data-testid="view_menu"]' },
          { type: 'click', selector: '[role="menuitem"]::-p-text(Zoom)' },
          { type: 'click', text: 'Fit width' },
          { type: 'delay', ms: 1000 },
          ...COLLAPSE_DOMAIN_KEY,
        ],
        // The domain key's last row is a scrollable list, not a clip.
        viewportHeight: 700,
      },
    ],
    tooltip: 'hide',
    viewportHeight: 900,
    readyTimeout: 120000,
  },
  {
    // Uses only hosted-config tracks, so no protein3d or msaview release can
    // change this figure.
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
            // unipDomain has one feature per record per isoform; unfiltered,
            // FIIND appears eleven times.
            {
              trackId: 'hg38-unipDomain',
              filter: ["jexl:get(feature,'uniProtId')=='Q9C000'"],
              height: 90,
            },
          ],
        },
      ],
    }),
    readyText: 'UniProt - Domains',
    readyTimeout: 120000,
    tooltip: 'hide',
    viewportHeight: 390,
  },
]
