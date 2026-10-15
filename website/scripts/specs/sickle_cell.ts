import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tutorials/sickle_cell_variant page: HBB's sickle allele (rs334) traced
// from the GWAS Catalog and 1000 Genomes to its residue in sickle haemoglobin.
//
// The session is the one the genomes.jbrowse.org protein browser's Open in
// JBrowse link writes for ?gene=HBB&ref=9606&residue=7&structure=2hbs, saved
// as JSON so the figure does not move when the protein browser changes what it
// launches. Each figure narrows the genome view to codon 7 and adds the tracks
// the page has told the reader to add by then.
//
// VERIFIED 2026-10-15 against the files the tracks read, so the captions can
// name the direction without restating a number:
//   rs334 chr11:5,227,002 T>A (hg38), codon 7 GAG -> GTG, Glu6Val. 134 GWAS
//   Catalog rows at rs334. The 1000 Genomes VCF's own INFO gives AF_AFR 0.100,
//   AF_AMR 0.005, AF_EUR/AF_EAS/AF_SAS 0. rs713040 (chr11:5,227,013 A>G, the
//   His3 codon four codons upstream, synonymous) is 0.50 to 0.88 in every superpopulation, which is
//   the control column. HbC (rs33930165, chr11:5,227,003 C>T) shares the
//   codon at AF_AFR 0.015.
const BASE_SESSION = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('protein_browser_hbb.session.json', import.meta.url)),
    'utf8',
  ),
)

const GENES = 'hg38-ncbiRefSeqSelect'
const GWAS = 'hg38-gwasCatalog'
const KG = 'kgp3202_chr11_snv'
const CODON_WINDOW = 'chr11:5226956-5227046[rev]'
const RS334 = 'chr11:5,227,002'
const RS713040 = 'chr11:5,227,013'

// The 3,202-genome high-coverage callset, read from the page's own fence so
// the figure is shot with the config the reader pastes. Its sample sheet is the
// release's ped file sorted by superpopulation
// (demos/1000g/1kgp_3202_superpopulations.tsv, made by the page's awk command),
// so each superpopulation is one block of rows.
const KG_TRACK = pageTrack('tutorials/sickle_cell_variant.md', KG)

function hbbSession(
  tracks: object[],
  sessionTracks: object[] = [],
  msaHeight = 560,
) {
  const session = structuredClone(BASE_SESSION)
  const [lgv, msa, protein] = session.views
  lgv.init = { ...lgv.init, loc: CODON_WINDOW, tracks }
  lgv.showGridlines = true
  msa.height = msaHeight
  msa.displayName = 'HBB orthologs'
  protein.height = 780
  protein.colorScheme = 'mapped-chain'
  session.sessionTracks = sessionTracks
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

const GENE_TRACK = { trackId: GENES, height: 60 }

// The protein view's ready marker covers the structure load and its
// alignment; the MSA canvas covers the ortholog alignment the session builds in
// the browser. Reset Zoom fits the whole 2HBS asymmetric unit: the selection
// otherwise frames the camera on residue 7 alone.
const READY = {
  readySelector:
    'body:has([data-testid="protein-view-ready"]):has([data-testid="msa_canvas"])',
  readyTimeout: 300000,
  hideSelectors: ['.msp-background-tasks', '.msp-highlight-info'],
  hideTooltip: true,
  viewportWidth: 2000,
  viewportHeight: 1050,
}

const HOVER_CODON = [
  { type: 'click' as const, selector: 'button[title="Reset Zoom"]' },
  { type: 'delay' as const, ms: 1500 },
  {
    type: 'hover' as const,
    anchor: { loc: RS334, trackId: GENES, fracY: 0.5 },
  },
  { type: 'delay' as const, ms: 1500 },
]

const STRUCTURE_CALLOUT = {
  type: 'text' as const,
  text: 'Val6 in magenta: 2HBS is the sickle protein itself',
  maxWidth: 420,
  fontSize: 18,
  anchor: {
    selector: '[data-testid="protein-view-molstar"]',
    alignX: 'left' as const,
    alignY: 'top' as const,
  },
  dx: 90,
  dy: 30,
}

export const sickleCellSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/hbb_codon_hover',
    url: hbbSession([GENE_TRACK]),
    ...READY,
    actions: HOVER_CODON,
    annotations: [
      {
        type: 'text',
        text: 'Codon 7, GAG on the transcript',
        fontSize: 18,
        leader: true,
        anchor: { trackId: GENES, loc: RS334, fracY: 0.4 },
        dx: 140,
        dy: 30,
      },
      STRUCTURE_CALLOUT,
    ],
  },
  {
    mode: 'url',
    name: 'protein/hbb_gwas_catalog',
    url: hbbSession([GENE_TRACK, { trackId: GWAS, height: 240 }]),
    ...READY,
    viewportHeight: 1220,
    actions: HOVER_CODON,
    annotations: [
      {
        type: 'text',
        text: 'One feature per study and trait',
        fontSize: 18,
        leader: true,
        anchor: { trackId: GWAS, loc: RS334, fracY: 0.5 },
        dx: 160,
        dy: 0,
      },
    ],
  },
  {
    mode: 'url',
    name: 'protein/hbb_1000_genomes',
    url: hbbSession(
      [
        GENE_TRACK,
        { trackId: GWAS, height: 110 },
        {
          trackId: KG,
          type: 'LinearMultiSampleVariantDisplay',
          height: 330,
        },
      ],
      [KG_TRACK],
      300,
    ),
    ...READY,
    viewportHeight: 1150,
    actions: HOVER_CODON,
    annotations: [
      {
        type: 'text',
        text: 'Sickle allele, African-ancestry rows only',
        fontSize: 18,
        leader: true,
        anchor: { trackId: KG, loc: RS334, fracY: 0.12 },
        dx: 170,
        dy: 150,
      },
      {
        type: 'text',
        text: 'rs713040, in every group',
        fontSize: 18,
        leader: true,
        anchor: { trackId: KG, loc: RS713040, fracY: 0.75 },
        dx: 90,
        dy: 40,
      },
      STRUCTURE_CALLOUT,
    ],
  },
]
