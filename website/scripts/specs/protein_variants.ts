import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { pageTrack } from './pageTrack.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// Measured 2026-10-16 against the files the tracks read, so captions name the
// direction without a number:
//   HBB rs334 chr11:5,227,002 T>A, codon 7 GAG>GTG; 134 GWAS Catalog rows.
//   1000 Genomes AF_AFR 0.100, AF_AMR 0.005, EUR/EAS/SAS 0. rs713040
//   (chr11:5,227,013, His3, synonymous) 0.50-0.88 in every superpopulation.
//   SOD1 E40K chr31:27,123,057 G>A (canFam4), codon 40 GAA>AAA. Dog10K: 198
//   carriers of 1,987; wolves 0/126 and coyotes 0/8 chromosomes, breed dogs
//   184/3186, village dogs 34/618. chr31:27,122,819 C>T is alternate in 0.96 of
//   wolf, 0.79 of breed and 0.92 of village dog chromosomes. NCBI orthologs at
//   residue 40: Glu in mammals, Asp in birds, Pro in fish, Lys in axolotl.
//   AGL11 codon 197 chr18:32,255,717-32,255,719 (minus strand), CGC Arg in
//   Pinot Noir; A0A217EJJ0 (cv. Sultanina) has Leu. AlphaFold v6 pLDDT 57.6 at
//   197, mean 94.8 over residues 1-60. UniRef alignment: Arg in 16 of 20 rows.

interface ViewJson {
  init?: object
  [key: string]: unknown
}

interface SessionJson {
  views: ViewJson[]
  sessionTracks?: object[]
}

function readSession(file: string): SessionJson {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8'),
  )
}

interface SessionOptions {
  loc: string
  tracks: object[]
  sessionTracks?: object[]
  msaHeight?: number
}

function linkedSession(
  base: SessionJson,
  config: string,
  msaName: string,
  region: object,
  { loc, tracks, sessionTracks = [], msaHeight = 560 }: SessionOptions,
) {
  const session = structuredClone(base)
  const [lgv, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
  lgv.init = { ...lgv.init, loc, tracks }
  lgv.showGridlines = true
  msa.height = msaHeight
  msa.displayName = msaName
  msa.showDomains = false
  msa.region = region
  protein.height = 780
  session.sessionTracks = sessionTracks
  return `?config=${encodeURIComponent(config)}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

const READY = {
  readySelector:
    'body:has([data-testid="protein-view-ready"]):has([data-testid="msa_canvas"])',
  readyTimeout: 300000,
  hideSelectors: ['.msp-background-tasks', '.msp-highlight-info'],
  hideTooltip: true,
  viewportWidth: 2000,
  viewportHeight: 1050,
}

const RESET_ZOOM = [
  { type: 'click' as const, selector: 'button[title="Reset Zoom"]' },
  PARK_CURSOR,
  { type: 'delay' as const, ms: 1500 },
]

function hoverAlignment({ dx, dy }: { dx?: number; dy: number }) {
  return [
    ...RESET_ZOOM,
    {
      type: 'hover' as const,
      anchor: {
        selector: '[data-testid="msa_canvas"]',
        ...(dx === undefined ? {} : { alignX: 'left' as const, dx }),
        alignY: 'top' as const,
        dy,
      },
    },
    { type: 'delay' as const, ms: 1500 },
  ]
}

function structureCallout(text: string): Annotation {
  return {
    type: 'text',
    text,
    maxWidth: 420,
    fontSize: 18,
    anchor: {
      selector: '[data-testid="protein-view-molstar"]',
      alignX: 'left',
      alignY: 'top',
    },
    dx: 90,
    dy: 30,
  }
}

function codonCallout(text: string, trackId: string, loc: string): Annotation {
  return {
    type: 'text',
    text,
    fontSize: 18,
    leader: true,
    anchor: { trackId, loc, fracY: 0.4 },
    dx: 150,
    dy: 30,
  }
}

const HBB_SESSION = readSession('protein_browser_hbb.session.json')
const HBB_GENES = 'hg38-ncbiRefSeqSelect'
const GWAS = 'hg38-gwasCatalog'
const KG = 'kgp3202_chr11_snv'
const KG_TRACK = pageTrack('tutorials/protein_variants_sickle_cell.md', KG)
const RS334 = 'chr11:5,227,002'
const RS713040 = 'chr11:5,227,013'
const HBB_GENE_TRACK = { trackId: HBB_GENES, height: 60 }

function hbbSession(options: Omit<SessionOptions, 'loc'>) {
  const session = structuredClone(HBB_SESSION)
  session.views[2]!.colorScheme = 'mapped-chain'
  return linkedSession(
    session,
    decodeURIComponent(UCSC_HG38_CONFIG),
    'HBB orthologs',
    { row: 'human_query', start: 1, end: 31 },
    { loc: 'chr11:5226956-5227046[rev]', ...options },
  )
}

const HBB_STRUCTURE = structureCallout(
  'Val6 in magenta: 2HBS is the sickle protein itself',
)

const SOD1_SESSION = readSession('sod1_canfam4.session.json')
const SOD1_GENES = 'canFam4-ncbiRefSeqCurated'
const DOG10K = 'dog10k_sod1'
const DOG10K_TRACK = pageTrack(
  'tutorials/protein_variants_dog_myelopathy.md',
  DOG10K,
)
const SOD1_CODON = 'chr31:27123013-27123103'
const SOD1_E40K = 'chr31:27,123,058'
const SOD1_CONTROL = 'chr31:27,122,819'
const SOD1_GENE_TRACK = { trackId: SOD1_GENES, height: 60 }

function sod1Session(options: SessionOptions) {
  const session = structuredClone(SOD1_SESSION)
  const [, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
  msa.orthologParams = { ...(msa.orthologParams as object), maxSpecies: 30 }
  protein.colorScheme = 'mapped-chain'
  return linkedSession(
    session,
    'https://jbrowse.org/ucsc/canFam4/config.json',
    'SOD1 orthologs',
    { row: 'dog_query', start: 25, end: 55 },
    options,
  )
}

const AGL11_SESSION = readSession('protein_browser_agl11.session.json')
const GRAPE_GENES = 'GCF_030704535.1-ncbiRefSeqCurated'
const AGL11_R197 = 'chr18:32,255,718'

export const proteinVariantSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/hbb_codon_hover',
    url: hbbSession({ tracks: [HBB_GENE_TRACK] }),
    ...READY,
    actions: hoverAlignment({ dx: 193, dy: 232 }),
    annotations: [
      codonCallout('Codon 7, GAG on the transcript', HBB_GENES, RS334),
      HBB_STRUCTURE,
    ],
  },
  {
    mode: 'url',
    name: 'protein/hbb_gwas_catalog',
    url: hbbSession({
      tracks: [HBB_GENE_TRACK, { trackId: GWAS, height: 240 }],
    }),
    ...READY,
    viewportHeight: 1220,
    actions: hoverAlignment({ dx: 193, dy: 8 }),
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
    url: hbbSession({
      tracks: [
        HBB_GENE_TRACK,
        { trackId: GWAS, height: 110 },
        { trackId: KG, type: 'LinearMultiSampleVariantDisplay', height: 330 },
      ],
      sessionTracks: [KG_TRACK],
      msaHeight: 300,
    }),
    ...READY,
    viewportHeight: 1150,
    actions: hoverAlignment({ dx: 193, dy: 8 }),
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
      HBB_STRUCTURE,
    ],
  },
  {
    mode: 'url',
    name: 'protein/sod1_codon_hover',
    url: sod1Session({ loc: SOD1_CODON, tracks: [SOD1_GENE_TRACK] }),
    ...READY,
    actions: hoverAlignment({ dy: 88 }),
    annotations: [
      codonCallout('Codon 40, GAA on the transcript', SOD1_GENES, SOD1_E40K),
      structureCallout(
        'Lys40 outlined in pink: 7WX0 is the E40K protein itself',
      ),
    ],
  },
  {
    mode: 'url',
    name: 'protein/sod1_dog10k',
    url: sod1Session({
      loc: `chr31:27122805-27122834 ${SOD1_CODON}`,
      tracks: [
        SOD1_GENE_TRACK,
        {
          trackId: DOG10K,
          type: 'LinearMultiSampleVariantDisplay',
          height: 640,
        },
      ],
      sessionTracks: [DOG10K_TRACK],
      msaHeight: 300,
    }),
    ...READY,
    viewportHeight: 1300,
    actions: RESET_ZOOM,
    annotations: [
      {
        type: 'text',
        text: 'E40K: no wolf or coyote carries it',
        fontSize: 18,
        leader: true,
        anchor: { trackId: DOG10K, loc: SOD1_E40K, fracY: 0.02 },
        dx: -80,
        dy: 170,
      },
      {
        type: 'text',
        text: 'Intronic SNV, in every category',
        fontSize: 18,
        leader: true,
        anchor: { trackId: DOG10K, loc: SOD1_CONTROL, fracY: 0.5 },
        dx: 120,
        dy: 0,
      },
    ],
  },
  {
    mode: 'url',
    name: 'protein/agl11_codon_hover',
    url: linkedSession(
      AGL11_SESSION,
      'https://jbrowse.org/hubs/genark/GCF/030/704/535/GCF_030704535.1/config.json',
      'AGL11 orthologs',
      { row: 'wine_grape_query', start: 182, end: 212 },
      {
        loc: 'chr18:32255673-32255763[rev]',
        tracks: [{ trackId: GRAPE_GENES, height: 60 }],
      },
    ),
    ...READY,
    actions: hoverAlignment({ dy: 24 }),
    annotations: [
      codonCallout('Codon 197, CGC in Pinot Noir', GRAPE_GENES, AGL11_R197),
      structureCallout(
        'Leu197 outlined in pink, where the model turns from blue to yellow and orange',
      ),
    ],
  },
]
