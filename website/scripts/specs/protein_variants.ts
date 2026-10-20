import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { pageTrack } from './pageTrack.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// Measured 2026-10-16 against the files the tracks read, so captions name the
// direction without a number:
//   HBB rs334 chr11:5,227,002 T>A, codon 7 GAG>GTG; 179 GWAS Catalog rows at
//   the codon (2026-10-19), 134 of them rs334; the page filter keeps 4, one per
//   trait. Alignment column 7: Glu in most rows, Asp in Bolivian squirrel
//   monkey, Ala in Norway rat.
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
  highlights?: object[]
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
  highlights?: object[]
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
    highlights,
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
  if (highlights) {
    session.highlights = highlights
  }
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

function structureCallout(text: string, fontSize = 18): Annotation {
  return {
    type: 'text',
    text,
    maxWidth: 420,
    fontSize,
    anchor: {
      selector: '[data-testid="protein-view-molstar"]',
      alignX: 'left',
      alignY: 'top',
    },
    dx: 90,
    dy: 30,
  }
}

function codonCallout(
  text: string,
  trackId: string,
  loc: string,
  fontSize = 18,
): Annotation {
  return {
    type: 'text',
    text,
    fontSize,
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

// codon 7 on the genome; every linked view writes the label, the alignment on
// column 7 and the structure beside Val6
const E6V = {
  assemblyName: 'hg38',
  refName: 'chr11',
  start: 5227000,
  end: 5227003,
  label: 'E6V',
}

function hbbSession({
  msaEnd = 31,
  ...options
}: Partial<SessionOptions> &
  Pick<SessionOptions, 'tracks'> & { msaEnd?: number }) {
  const session = structuredClone(HBB_SESSION)
  session.highlights = [E6V]
  session.views[1]!.relativeTo = 'human_query'
  session.views[2]!.colorScheme = 'mapped-chain'
  return linkedSession(
    session,
    decodeURIComponent(UCSC_HG38_CONFIG),
    'HBB orthologs',
    { row: 'human_query', start: 1, end: msaEnd },
    { loc: HBB_CODON_7, ...options },
  )
}

const HBB_FONT_SIZE = 23
const SICKLE_CODON = 'The sickle-cell change: GAG to GTG'
const SICKLE_CARRIERS =
  'Sickle allele, carried mostly by African-ancestry genomes'
const RS713040_CONTROL = 'A harmless nearby variant, common in every population'

// Both pills sit in the gap right of the codon column, clear of the legend.
// `controlDx` carries rs713040's leader across the column, whose distance in px
// follows the figure's zoom.
function kgCallouts(controlDx: number): Annotation[] {
  return [
    {
      type: 'text',
      text: SICKLE_CARRIERS,
      fontSize: HBB_FONT_SIZE,
      maxWidth: 340,
      leader: true,
      anchor: { trackId: KG, loc: RS334, fracY: 0.12 },
      dx: 50,
      dy: 90,
    },
    {
      type: 'text',
      text: RS713040_CONTROL,
      fontSize: HBB_FONT_SIZE,
      maxWidth: 340,
      leader: true,
      anchor: { trackId: KG, loc: RS713040, fracY: 0.75 },
      dx: controlDx,
      dy: 0,
    },
  ]
}

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

const HG38_GENES = 'hg38-ncbiRefSeqSelect'
const HG38_GENE_TRACK = { trackId: HG38_GENES, height: 60 }
const CLINVAR_TRACK = { trackId: 'hg38-clinvarMain', height: 300 }
const HOTSPOT_FONT_SIZE = 23

interface Hotspot {
  label: string
  refName: string
  start: number
  end: number
}

interface HotspotGene {
  session: SessionJson
  gene: string
  hotspots: Hotspot[]
}

// The protein browser's launch with human as the alignment's reference row,
// and each hotspot codon as a labelled session highlight.
function hotspotSession(
  { session: base, gene, hotspots }: HotspotGene,
  region: { start: number; end: number },
  options: Omit<SessionOptions, 'highlights'>,
  extraHotspots: Hotspot[] = [],
) {
  const session = structuredClone(base)
  const [, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
  msa.relativeTo = 'human_query'
  if (options.domains) {
    msa.showDomainLegend = false
  }
  protein.colorScheme = 'mapped-chain'
  return linkedSession(
    session,
    decodeURIComponent(UCSC_HG38_CONFIG),
    `${gene} orthologs`,
    { row: 'human_query', ...region },
    {
      ...options,
      highlights: [...hotspots, ...extraHotspots].map(h => ({
        ...h,
        assemblyName: 'hg38',
      })),
    },
  )
}

function hoverCodon(loc: string) {
  return [
    ...RESET_ZOOM,
    { type: 'hover' as const, anchor: { trackId: HG38_GENES, loc } },
    { type: 'delay' as const, ms: 1500 },
  ]
}

// The domain track the alignment adds to the genome view, its legend closed
// and its height grown by `grow` px to show every site's row, then the codon
// hovered.
function domainFigure(gene: string, codon: string, grow = 0) {
  const testid = `trackRenderingContainer-lgv-${gene}-msaview-domains-msa-${gene}`
  const handle = {
    selector: `[data-testid="${testid}"]`,
    alignY: 'bottom' as const,
    dy: 2,
  }
  const resize = {
    type: 'drag' as const,
    fromAnchor: handle,
    toAnchor: { ...handle, dy: handle.dy + grow },
  }
  return {
    ...READY,
    readySelector: `${READY.readySelector}:has([data-testid="${testid}"])`,
    viewportWidth: 2300,
    clicksChange:
      grow > 0
        ? "close the domain track's legend and grow the track"
        : "close the domain track's legend",
    actions: [
      {
        type: 'click' as const,
        selector: `[data-track-overlay-slot]:has([data-testid="${testid}"]) [aria-label="Hide legend"]`,
      },
      ...(grow > 0 ? [resize] : []),
      { type: 'waitForAppSettled' as const },
      ...hoverCodon(codon),
    ],
  }
}

function residueCallout(
  text: string,
  residue: string,
  dx: number,
  dy: number,
): Annotation {
  return {
    type: 'text',
    text,
    fontSize: HOTSPOT_FONT_SIZE,
    leader: true,
    anchor: { residue },
    dx,
    dy,
  }
}

// Measured 2026-10-20 from the GenPept records' CDD features and from the
// alignments the protein browser launches (NCBI orthologs, 100 rows plus the
// human query):
//   KRAS NP_004976.2, CDD:133338 H_N_K_Ras_like 3-164. G12 is in the G1 box
//   (10-17), the GTP/Mg2+ binding site (12-18, 28-30, ...) and the putative
//   GDI interaction site (11-12, 59-60); G13 in the G1 box and GTP/Mg2+ site;
//   Q61 in the Switch II region (59-77) and the GEF interaction site. Every
//   aligned row has G at 12 and 13 and Q at 61 (Gekko japonicus gapped);
//   columns 1-75 differ from human only at 67 (common cuckoo Q).
//   TP53 NP_000537.3, CDD:176262 P53 109-288. The DNA binding site is 239, 241,
//   248, 273, 275-277, 280; R175 is in no site (zinc 176, 179, 238, 242).
//   Every aligned row has R at 175, 248 and 273 (bald eagle gapped at 273);
//   columns 259-264, 268-269 and 283 vary in 25-52 rows. 1TUP chain B: R248
//   CG 3.4 A and R273 NH2 2.5 A from DNA atoms, R175 13.2 A.
//   BRAF NP_004324.2, CDD:270964 STKc_Raf 463-715. The activation loop site is
//   593-606, 612-618 and holds V600; the ATP binding site ends at D594. Every
//   aligned row has V at 600 (sunbittern gapped); 594-607 match human in every
//   row, 608 and 610 differ in 3-4 rows.
//   HBB NP_000509.1: the Hb-beta-like domain starts at 8, so residue 7 is
//   outside every CDD domain and site.
//   6OIM (KRAS G12C, sotorasib) assembly 1 is chain A, Cys12 modelled. 3OG7's
//   assembly 1 is chain A, which leaves 597-605 unmodelled, so BRAF uses 4MNF
//   (V600E, GDC-0879), whose chains A and B both model Glu600.

// KRAS NM_004985.5, minus strand: G12 and G13 open exon 2's coding run, Q61
// sits in exon 3.
const KRAS: HotspotGene = {
  session: readSession('protein_browser_kras.session.json'),
  gene: 'KRAS',
  hotspots: [
    { label: 'G12', refName: 'chr12', start: 25245348, end: 25245351 },
    { label: 'G13', refName: 'chr12', start: 25245345, end: 25245348 },
    { label: 'Q61', refName: 'chr12', start: 25227340, end: 25227343 },
  ],
}
const KRAS_G12_WINDOW = 'chr12:25245320-25245380[rev]'
const KRAS_DOMAIN_WINDOWS =
  'chr12:25245328-25245372[rev] chr12:25227320-25227364[rev]'
const KRAS_G12 = 'chr12:25,245,350'

const TP53: HotspotGene = {
  session: readSession('protein_browser_tp53_1tup.session.json'),
  gene: 'TP53',
  hotspots: [
    { label: 'R248', refName: 'chr17', start: 7674218, end: 7674221 },
    { label: 'R273', refName: 'chr17', start: 7673800, end: 7673803 },
  ],
}
const TP53_WINDOWS = 'chr17:7674201-7674239[rev] chr17:7673783-7673821[rev]'
const TP53_R175: Hotspot = {
  label: 'R175',
  refName: 'chr17',
  start: 7675086,
  end: 7675089,
}
const TP53_DOMAIN_WINDOWS = `chr17:7675069-7675107[rev] ${TP53_WINDOWS}`
const TP53_R248 = 'chr17:7,674,220'

const BRAF: HotspotGene = {
  session: readSession('protein_browser_braf.session.json'),
  gene: 'BRAF',
  hotspots: [
    { label: 'V600', refName: 'chr7', start: 140753334, end: 140753337 },
  ],
}
const BRAF_V600_WINDOW = 'chr7:140753306-140753366[rev]'
const BRAF_V600 = 'chr7:140,753,336'

export const proteinVariantSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/hbb_codon_hover',
    url: hbbSession({ tracks: [HBB_GENE_TRACK] }),
    ...READY,
    actions: hoverAlignment({ dx: 193, dy: 232 }),
    annotations: [codonCallout(SICKLE_CODON, HBB_GENES, RS334, HBB_FONT_SIZE)],
  },
  {
    mode: 'url',
    name: 'protein/hbb_gwas_catalog',
    url: hbbSession({
      tracks: [
        HBB_GENE_TRACK,
        { trackId: GWAS, height: 160 },
        { trackId: GWAS_SUBSET, height: 170 },
      ],
      sessionTracks: [GWAS_SUBSET_TRACK],
    }),
    ...READY,
    viewportHeight: 1300,
    actions: hoverAlignment({ dx: 193, dy: 8 }),
    annotations: [
      {
        type: 'text',
        text: 'Every GWAS hit at this codon',
        fontSize: HBB_FONT_SIZE,
        leader: true,
        anchor: { trackId: GWAS, loc: RS334, fracY: 0.5 },
        dx: -60,
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
        { trackId: GWAS_SUBSET, height: 170 },
        { trackId: KG, type: 'LinearMultiSampleVariantDisplay', height: 330 },
      ],
      sessionTracks: [GWAS_SUBSET_TRACK, KG_TRACK],
      msaHeight: 300,
    }),
    ...READY,
    viewportHeight: 1210,
    actions: hoverAlignment({ dx: 193, dy: 8 }),
    annotations: kgCallouts(190),
  },
  {
    mode: 'url',
    name: 'protein/hbb_domains_three_views',
    url: hbbSession({
      tracks: [
        HBB_GENE_TRACK,
        { trackId: GWAS_SUBSET, height: 170 },
        { trackId: KG, type: 'LinearMultiSampleVariantDisplay', height: 330 },
      ],
      sessionTracks: [GWAS_SUBSET_TRACK, KG_TRACK],
      loc: `${HBB_CODON_7} ${HBB_EXON_2_START}`,
      msaHeight: 490,
      domains: true,
      msaEnd: 75,
    }),
    ...READY,
    readySelector: `${READY.readySelector}:has([data-testid="trackRenderingContainer-lgv-HBB-${HBB_DOMAINS}"])`,
    // The alignment's columns widen with the viewport, so the hover's dx
    // follows it to column 7.
    viewportWidth: 2300,
    viewportHeight: 1550,
    clicksChange: "close the domain track's legend",
    actions: [
      {
        type: 'click',
        selector: `[data-track-overlay-slot]:has([data-testid="trackRenderingContainer-lgv-HBB-${HBB_DOMAINS}"]) [aria-label="Hide legend"]`,
      },
      { type: 'waitForAppSettled' },
      ...RESET_ZOOM,
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
  {
    mode: 'url',
    name: 'protein/kras_codon_hover',
    url: hotspotSession(
      KRAS,
      { start: 1, end: 31 },
      {
        loc: KRAS_G12_WINDOW,
        tracks: [HG38_GENE_TRACK, CLINVAR_TRACK],
        msaHeight: 420,
      },
    ),
    ...READY,
    viewportWidth: 2300,
    viewportHeight: 1150,
    actions: hoverCodon(KRAS_G12),
    annotations: [residueCallout('Cys12 beside sotorasib', 'A:12', -80, -300)],
  },
  {
    mode: 'url',
    name: 'protein/kras_domains_three_views',
    url: hotspotSession(
      KRAS,
      { start: 1, end: 75 },
      {
        loc: KRAS_DOMAIN_WINDOWS,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 490,
        domains: true,
      },
    ),
    ...domainFigure('KRAS', KRAS_G12, 110),
    viewportHeight: 1220,
  },
  {
    mode: 'url',
    name: 'protein/tp53_codon_hover',
    url: hotspotSession(
      TP53,
      { start: 241, end: 280 },
      { loc: TP53_WINDOWS, tracks: [HG38_GENE_TRACK], msaHeight: 560 },
    ),
    ...READY,
    viewportWidth: 2300,
    viewportHeight: 1070,
    actions: hoverCodon(TP53_R248),
  },
  {
    mode: 'url',
    name: 'protein/tp53_domains_three_views',
    url: hotspotSession(
      TP53,
      { start: 231, end: 290 },
      {
        loc: TP53_DOMAIN_WINDOWS,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 490,
        domains: true,
      },
      [TP53_R175],
    ),
    ...domainFigure('TP53', TP53_R248),
    viewportHeight: 1140,
  },
  {
    mode: 'url',
    name: 'protein/braf_codon_hover',
    url: hotspotSession(
      BRAF,
      { start: 585, end: 615 },
      {
        loc: BRAF_V600_WINDOW,
        tracks: [HG38_GENE_TRACK, CLINVAR_TRACK],
        msaHeight: 420,
      },
    ),
    ...READY,
    viewportWidth: 2300,
    viewportHeight: 1150,
    actions: hoverCodon(BRAF_V600),
    annotations: [
      residueCallout('Glu600: 4MNF is the V600E protein', 'A:600', -80, -300),
    ],
  },
  {
    mode: 'url',
    name: 'protein/braf_domains_three_views',
    url: hotspotSession(
      BRAF,
      { start: 570, end: 630 },
      {
        loc: BRAF_V600_WINDOW,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 490,
        domains: true,
      },
    ),
    ...domainFigure('BRAF', BRAF_V600, 80),
    viewportHeight: 1190,
  },
]
