import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { pageTrack } from './pageTrack.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// Measured 2026-10-16 against the files the tracks read, so captions name the
// direction without a number:
//   HBB rs334 chr11:5,227,002 T>A, codon 7 GAG>GTG; 179 GWAS Catalog rows
//   (2026-10-19), 7 in the page filter's four traits.
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
  domains?: boolean
}

function linkedSession(
  base: SessionJson,
  config: string,
  msaName: string,
  region: object,
  {
    loc,
    tracks,
    sessionTracks = [],
    msaHeight = 560,
    domains = false,
  }: SessionOptions,
) {
  const session = structuredClone(base)
  const [lgv, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
  lgv.init = { ...lgv.init, loc, tracks }
  lgv.showGridlines = true
  msa.height = msaHeight
  msa.displayName = msaName
  msa.showDomains = domains
  msa.region = region
  protein.height = 780
  if (domains) {
    lgv.colorByCDS = false
    msa.domainsOnGenome = true
    delete protein.colorScheme
    protein.color = { field: 'domain' }
  }
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
const SICKLE_CELL_PAGE = 'tutorials/protein_variants_sickle_cell.md'
const KG_TRACK = pageTrack(SICKLE_CELL_PAGE, KG)
const GWAS_SUBSET = 'gwasCatalog_sickle_cell_traits'
const GWAS_SUBSET_TRACK = pageTrack(SICKLE_CELL_PAGE, GWAS_SUBSET)
const RS334 = 'chr11:5,227,002'
const RS713040 = 'chr11:5,227,013'
const HBB_GENE_TRACK = { trackId: HBB_GENES, height: 60 }
const HBB_DOMAINS = 'msaview-domains-msa-HBB'
const HBB_CODON_7 = 'chr11:5226956-5227046[rev]'
const HBB_EXON_2_START = 'chr11:5226750-5226799[rev]'

function hbbSession(
  options: Partial<SessionOptions> & Pick<SessionOptions, 'tracks'>,
) {
  const session = structuredClone(HBB_SESSION)
  session.views[2]!.colorScheme = 'mapped-chain'
  return linkedSession(
    session,
    decodeURIComponent(UCSC_HG38_CONFIG),
    'HBB orthologs',
    { row: 'human_query', start: 1, end: 31 },
    { loc: HBB_CODON_7, ...options },
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
      tracks: [
        HBB_GENE_TRACK,
        { trackId: GWAS, height: 160 },
        { trackId: GWAS_SUBSET, height: 300 },
      ],
      sessionTracks: [GWAS_SUBSET_TRACK],
    }),
    ...READY,
    viewportHeight: 1430,
    actions: hoverAlignment({ dx: 193, dy: 8 }),
    annotations: [
      {
        type: 'text',
        text: 'One feature per study and trait',
        fontSize: 18,
        leader: true,
        anchor: { trackId: GWAS, loc: RS334, fracY: 0.5 },
        dx: -260,
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
    name: 'protein/hbb_domains_three_views',
    url: hbbSession({
      tracks: [
        HBB_GENE_TRACK,
        { trackId: GWAS_SUBSET, height: 300 },
        { trackId: KG, type: 'LinearMultiSampleVariantDisplay', height: 330 },
      ],
      sessionTracks: [GWAS_SUBSET_TRACK, KG_TRACK],
      loc: `${HBB_CODON_7} ${HBB_EXON_2_START}`,
      msaHeight: 300,
      domains: true,
    }),
    ...READY,
    readySelector: `${READY.readySelector}:has([data-testid="trackRenderingContainer-lgv-HBB-${HBB_DOMAINS}"])`,
    // Wide enough for the exon 2 records' labels to end inside the view. The
    // alignment's columns widen with it, so column 7 sits further right.
    viewportWidth: 2300,
    viewportHeight: 1490,
    actions: [
      { type: 'waitForAppSettled' },
      ...hoverAlignment({ dx: 224, dy: 8 }),
    ],
    annotations: [
      codonCallout('1  rs334, codon 7: GAG to GTG', HBB_GENES, RS334),
      {
        type: 'text',
        text: '2  GWAS Catalog records at rs334, filtered to these traits',
        fontSize: 18,
        maxWidth: 260,
        leader: true,
        anchor: { trackId: GWAS_SUBSET, loc: RS334, fracY: 0.5 },
        dx: -60,
        dy: 0,
      },
      {
        type: 'text',
        text: '3  Sickle allele, African-ancestry rows only',
        fontSize: 18,
        leader: true,
        anchor: { trackId: KG, loc: RS334, fracY: 0.12 },
        dx: 170,
        dy: 150,
      },
      {
        type: 'text',
        text: '4  rs713040, synonymous His3, in every group',
        fontSize: 18,
        leader: true,
        anchor: { trackId: KG, loc: RS713040, fracY: 0.75 },
        dx: 90,
        dy: 40,
      },
      {
        type: 'text',
        text: '5  The same column in every ortholog',
        fontSize: 18,
        leader: true,
        anchor: {
          selector: '[data-testid="msa_canvas"]',
          alignX: 'left',
          dx: 224,
          alignY: 'top',
          dy: 8,
        },
        dx: 150,
        dy: -70,
      },
      {
        ...structureCallout(
          '6  Val6 in magenta: Structure V, Genome E in the header',
        ),
        maxWidth: 600,
      },
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
