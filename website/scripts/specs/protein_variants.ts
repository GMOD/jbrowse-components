import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { pageTrack } from './pageTrack.ts'

import type {
  Annotation,
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

// Captions name a direction; these numbers, read off the tracks' files, back it:
//   HBB rs334 (codon 7 GAG>GTG): AF_AFR 0.100, AF_AMR 0.005, other
//   superpopulations 0; rs713040 (His3, synonymous) 0.50-0.88 in all. The GWAS
//   filter keeps one row per trait at the codon.
//   SOD1 E40K (canFam4): no wolf or coyote carries it; 198 of 1,987 dogs do.
//   AGL11 codon 197: Arg in Pinot Noir, Leu in A0A217EJJ0 (cv. Sultanina);
//   AlphaFold pLDDT 57.6 there.

export interface ViewJson {
  init?: object
  [key: string]: unknown
}

interface LayoutPanel {
  id: string
  size: number
  activeTabId: string
  tabs: { id: string; viewIds: string[] }[]
}

export interface SessionJson {
  layout?: { children: LayoutPanel[] }
  views: ViewJson[]
  sessionTracks?: object[]
  highlights?: object[]
}

export function readSession(file: string): SessionJson {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8'),
  )
}

export interface SessionOptions {
  loc: string
  tracks: object[]
  sessionTracks?: object[]
  msaHeight?: number
  domains?: boolean
  legend?: boolean
  turnedOff?: string[]
  proteinColor?: object
  hideTracks?: string[]
  pairStructure?: object
  pairColor?: object
  highlights?: object[]
}

export function linkedSession(
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
    turnedOff = [],
    proteinColor,
    hideTracks = [],
    pairStructure,
    pairColor,
    highlights,
  }: SessionOptions,
) {
  const session = structuredClone(base)
  const [lgv, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
  lgv.init = { ...lgv.init, loc, tracks }
  lgv.axis = { grid: true }
  msa.height = msaHeight
  msa.displayName = msaName
  msa.showDomains = domains
  msa.region = region
  if (turnedOff.length > 0) {
    msa.turnedOffFeatures = Object.fromEntries(turnedOff.map(a => [a, true]))
  }
  protein.height = 780
  if (proteinColor) {
    delete protein.colorScheme
    protein.color = proteinColor
  }
  if (domains) {
    lgv.colorByFrame = false
    msa.domainsOnGenome = true
    delete protein.colorScheme
    protein.color = { field: 'domain' }
  }
  if (hideTracks.length > 0) {
    msa.turnedOffTracks = Object.fromEntries(hideTracks.map(t => [t, true]))
  }
  if (pairStructure) {
    const pair = structuredClone(protein)
    pair.id = `${protein.id as string}-pair`
    pair.structures = (protein.structures as object[]).map(st => ({
      ...st,
      ...pairStructure,
    }))
    if (pairColor) {
      delete pair.colorScheme
      pair.color = pairColor
    }
    session.views.push(pair)
    const [left, right] = session.layout!.children as [LayoutPanel, LayoutPanel]
    left.size = 34
    right.size = 33
    session.layout!.children.push({
      id: 'panel-right-pair',
      size: 33,
      activeTabId: 'tab-right-pair',
      tabs: [{ id: 'tab-right-pair', viewIds: [pair.id as string] }],
    })
  }
  session.sessionTracks = sessionTracks
  if (highlights) {
    session.highlights = highlights
  }
  return `?config=${encodeURIComponent(config)}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

export const READY = {
  readySelector:
    'body:has([data-testid="protein-view-ready"]):has([data-testid="msa_canvas"])',
  readyTimeout: 300000,
  hideSelectors: ['.msp-background-tasks', '.msp-highlight-info'],
  tooltip: 'hide',
  viewportWidth: 2000,
  viewportHeight: 1050,
} satisfies Partial<SessionUrlSpec>

export const RESET_ZOOM = [
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

// codon 7 on the genome; the structure labels Val6
const E6V = {
  assemblyName: 'hg38',
  refName: 'chr11',
  start: 5227000,
  end: 5227003,
  label: 'E6V',
}

function hbbSession({
  msaEnd = 31,
  assembly,
  pdbId,
  ...options
}: Partial<SessionOptions> &
  Pick<SessionOptions, 'tracks'> & {
    msaEnd?: number
    assembly?: string
    pdbId?: string
  }) {
  const session = structuredClone(HBB_SESSION)
  session.highlights = [E6V]
  session.views[1]!.relativeTo = 'human_query'
  const protein = session.views[2]!
  protein.colorScheme = 'mapped-chain'
  if (assembly || pdbId) {
    protein.structures = (protein.structures as object[]).map(s => ({
      ...s,
      ...(assembly ? { assembly } : {}),
      ...(pdbId ? { pdbId } : {}),
    }))
  }
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

// The codon column's px width follows the figure's zoom, so each figure passes
// its own `controlDx`.
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
export const HG38_GENE_TRACK = { trackId: HG38_GENES, height: 60 }
export const CLINVAR_TRACK = { trackId: 'hg38-clinvarMain', height: 300 }
const HOTSPOT_FONT_SIZE = 23

export interface Hotspot {
  label: string
  refName: string
  start: number
  end: number
}

export interface HotspotGene {
  session: SessionJson
  gene: string
  hotspots: Hotspot[]
}

export function hotspotSession(
  { session: base, gene, hotspots }: HotspotGene,
  region: { start: number; end: number },
  options: Omit<SessionOptions, 'highlights'>,
  extraHotspots: Hotspot[] = [],
) {
  const session = structuredClone(base)
  const [, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
  msa.relativeTo = 'human_query'
  if (options.domains && !options.legend) {
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

export function hoverCodon(loc: string) {
  return [
    ...RESET_ZOOM,
    { type: 'hover' as const, anchor: { trackId: HG38_GENES, loc } },
    { type: 'delay' as const, ms: 1500 },
  ]
}

// `grow` adds px to the domain track so every site's row shows.
export function domainFigure(
  gene: string,
  codon: string,
  grow = 0,
  keepLegend = false,
) {
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
    ...(keepLegend
      ? {}
      : {
          clicksChange:
            grow > 0
              ? "close the domain track's legend and grow the track"
              : "close the domain track's legend",
        }),
    actions: [
      ...(keepLegend
        ? []
        : [
            {
              type: 'click' as const,
              selector: `[data-track-overlay-slot]:has([data-testid="${testid}"]) [aria-label="Hide legend"]`,
            },
          ]),
      ...(grow > 0 ? [resize] : []),
      { type: 'waitForAppSettled' as const },
      ...hoverCodon(codon),
    ],
  }
}

export function residueCallout(
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

// From the GenPept CDD features and the launched ortholog alignments:
//   KRAS G12 and G13 sit in the G1 box, Q61 in Switch II.
//   TP53 R248 and R273 are DNA-binding sites; R175 is in none.
//   BRAF V600 lies in the activation loop.
//   HBB residue 7 lies outside every CDD domain.
//   Every aligned row keeps the hotspot residue.
// BRAF uses 4MNF: 3OG7 leaves residues 597-605 unmodelled.

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
const KRAS_G12C: HotspotGene = {
  ...KRAS,
  hotspots: [{ ...KRAS.hotspots[0]!, label: 'G12C' }],
}
const KRAS_G12_WINDOW = 'chr12:25245320-25245380[rev]'
const KRAS_DOMAIN_WINDOWS =
  'chr12:25245328-25245372[rev] chr12:25227320-25227364[rev]'
const KRAS_G12 = 'chr12:25,245,350'
const KRAS_CDD = '133338'
const KRAS_UNSHOWN_SITES = [
  'G1 box',
  'G2 box',
  'G3 box',
  'G4 box',
  'G5 box',
  'putative GDI interaction site',
  'GEF interaction site',
  'effector interaction site',
  'Switch I region',
  'GTP/Mg2+ binding site',
].map(name => `${KRAS_CDD}:${name}`)

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
const BRAF_V600E: HotspotGene = {
  ...BRAF,
  hotspots: [{ ...BRAF.hotspots[0]!, label: 'V600E' }],
}
const BRAF_V600_WINDOW = 'chr7:140753306-140753366[rev]'
const BRAF_V600 = 'chr7:140,753,336'
const BRAF_UNSHOWN = [
  '340654',
  '410421',
  '340654:putative RBD_Raf-Ras interaction site',
  '340654:putative RBD_Raf-KRas interaction site',
  '340654:homodimer interface',
  '340654:putative Ca binding site',
  '270964:active',
  '270964:polypeptide substrate binding site',
  '270964:dimer interface',
]

const CFTR: HotspotGene = {
  session: readSession('protein_browser_cftr.session.json'),
  gene: 'CFTR',
  hotspots: [
    { label: 'F508del', refName: 'chr7', start: 117559592, end: 117559595 },
  ],
}
const CFTR_F508_WINDOW = 'chr7:117559577-117559607'
const CFTR_F508 = 'chr7:117,559,593'

const APOE: HotspotGene = {
  session: readSession('protein_browser_apoe.session.json'),
  gene: 'APOE',
  hotspots: [
    { label: 'C112R', refName: 'chr19', start: 44908683, end: 44908686 },
    { label: 'R158C', refName: 'chr19', start: 44908821, end: 44908824 },
  ],
}
const APOE_WIDE = 'chr19:44400000-45400000'
const FINNGEN_AD = 'finngen_r12_ad_apoe'
const FINNGEN_AD_TRACK = {
  type: 'GWASTrack',
  trackId: FINNGEN_AD,
  name: "FinnGen R12 Alzheimer's disease",
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://jbrowse.org/demos/apoe/finngen_r12_ad_apoe.bed.gz',
  },
  displayDefaults: { height: 200 },
}

const HBB_GWAS_STORY = 'gwasCatalog_hbb_story'
const HBB_GWAS_STORY_TRACK = {
  type: 'FeatureTrack',
  trackId: HBB_GWAS_STORY,
  name: 'GWAS Catalog at rs334, one record per trait',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    bedGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/gwasCatalog.bed.gz' },
    index: {
      indexType: 'CSI',
      location: { uri: 'https://jbrowse.org/ucsc/hg38/gwasCatalog.bed.gz.csi' },
    },
  },
  displayDefaults: {
    filter: [
      "jexl:feature.name == 'rs334'",
      "jexl:feature.trait in ['Malaria', 'Hereditary hemolytic anemias (PheCode 282)']",
      "jexl:feature.pValue in ['4E-69', '1E-323']",
    ],
    labels: { name: 'trait' },
    showLabels: 'name',
  },
}

const F5: HotspotGene = {
  session: readSession('protein_browser_f5.session.json'),
  gene: 'F5',
  hotspots: [
    { label: 'R506Q', refName: 'chr1', start: 169549809, end: 169549812 },
  ],
}
function withPdb(base: SessionJson, pdbId: string): SessionJson {
  const session = structuredClone(base)
  const protein = session.views[2]!
  protein.structures = (protein.structures as object[]).map(st => ({
    ...st,
    pdbId,
  }))
  return session
}

const F5_WIDE = 'chr1:169049811-170049811'
const FINNGEN_VTE = 'finngen_r12_vte_f5'
const FINNGEN_VTE_TRACK = {
  type: 'GWASTrack',
  trackId: FINNGEN_VTE,
  name: 'FinnGen R12 venous thromboembolism',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://jbrowse.org/demos/factor_v/finngen_r12_vte_f5.bed.gz',
  },
  displayDefaults: { height: 200 },
}

// SGE from Findlay 2018 (MaveDB urn:mavedb:00000097-0-2). The hotspots are
// ClinVar VUS; 1T15's author numbering matches MANE NM_007294.4.
const BRCA1: HotspotGene = {
  session: readSession('protein_browser_brca1.session.json'),
  gene: 'BRCA1',
  hotspots: [
    { label: 'T1700P', refName: 'chr17', start: 43063925, end: 43063928 },
    { label: 'G1738A', refName: 'chr17', start: 43057114, end: 43057117 },
    { label: 'A1752T', refName: 'chr17', start: 43057072, end: 43057075 },
  ],
}
const BRCA1_BRCT = 'chr17:43045600-43071500[rev]'
const BRCA1_SGE = 'brca1_sge_position_mean'
const BRCA1_SGE_TRACK = {
  type: 'QuantitativeTrack',
  trackId: BRCA1_SGE,
  name: 'BRCA1 saturation genome editing, mean score per base',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/brca1/BRCA1.sge.position_mean.bw',
  },
  displayDefaults: { height: 170 },
}

// 5MG7 (wild type) and 7B49 (R273H) share a crystal form, both DNA-bound. The
// SGE track is Funk 2025 (MaveDB urn:mavedb:00001277-a-1), where a HIGHER
// score means loss of function.
const TP53_R273H: HotspotGene = {
  session: readSession('protein_browser_tp53_r273h.session.json'),
  gene: 'TP53',
  hotspots: [
    { label: 'R273H', refName: 'chr17', start: 7673800, end: 7673803 },
  ],
}
const TP53_EXONS_5_8 = 'chr17:7673400-7676400[rev]'
const TP53_SGE = 'tp53_sge_position_mean'
const TP53_SGE_TRACK = {
  type: 'QuantitativeTrack',
  trackId: TP53_SGE,
  name: 'TP53 saturation genome editing, mean score per base',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/demos/tp53_sge/TP53.sge.position_mean.bw',
  },
  displayDefaults: { height: 170 },
}
const TP53_CDD_UNSHOWN = [
  '462520',
  '375947',
  '462238',
  '176262:zinc binding site',
  '176262:dimerization site',
]

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
      assembly: 'deposited',
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
    annotations: [
      {
        type: 'text',
        text: '1  One copy protects against malaria; two copies cause sickle cell disease',
        fontSize: HBB_FONT_SIZE,
        maxWidth: 300,
        leader: true,
        anchor: { trackId: GWAS_SUBSET, loc: RS334, fracY: 0.5 },
        dx: 400,
        dy: 0,
      },
      {
        type: 'text',
        text: '2  Carriers are African-ancestry genomes, nearly all with one copy',
        fontSize: HBB_FONT_SIZE,
        maxWidth: 300,
        leader: true,
        anchor: { trackId: KG, loc: RS334, fracY: 0.12 },
        dx: 200,
        dy: 90,
      },
      {
        type: 'text',
        text: '3  No heme or interface site here: glutamate 6 sits on the surface',
        fontSize: HBB_FONT_SIZE,
        maxWidth: 340,
        leader: true,
        anchor: {
          selector: '[data-testid="msa_canvas"]',
          alignX: 'left',
          dx: 93,
          alignY: 'top',
          dy: 8,
        },
        dx: 150,
        dy: -70,
      },
      {
        type: 'text',
        text: '4  Valine 6 of one tetramer docks into a pocket on the other, the contact that strings haemoglobin S into fibres',
        fontSize: HBB_FONT_SIZE,
        maxWidth: 420,
        leader: true,
        anchor: { residue: 'H:6' },
        dx: 20,
        dy: 470,
      },
    ],
  },
  {
    mode: 'url',
    name: 'protein/hbb_e6v',
    url: hbbSession({
      tracks: [HBB_GENE_TRACK, { trackId: HBB_GWAS_STORY, height: 170 }],
      sessionTracks: [HBB_GWAS_STORY_TRACK],
      msaHeight: 420,
      pdbId: '2hhb',
      pairStructure: { pdbId: '2hbs' },
      proteinColor: { field: 'hydrophobicity' },
    }),
    ...READY,
    viewportWidth: 2600,
    viewportHeight: 1150,
    actions: [
      { type: 'waitForAppSettled' },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-HBB-2hbs"] button[title="Reset Zoom"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-HBB-2hbs-pair"] button[title="Reset Zoom"]',
      },
      PARK_CURSOR,
      { type: 'delay', ms: 1500 },
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
    annotations: [residueCallout('Cys12 beside sotorasib', 'A:12', 160, 260)],
  },
  {
    mode: 'url',
    name: 'protein/kras_g12c',
    url: hotspotSession(
      KRAS_G12C,
      { start: 1, end: 75 },
      {
        loc: KRAS_DOMAIN_WINDOWS,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 490,
        domains: true,
        turnedOff: KRAS_UNSHOWN_SITES,
      },
    ),
    ...domainFigure('KRAS', KRAS_G12, 0, true),
    viewportHeight: 1100,
    annotations: [residueCallout('Sotorasib', 'A:303', 160, 260)],
  },
  {
    mode: 'url',
    name: 'protein/kras_two_drugs',
    url: hotspotSession(
      { ...KRAS, hotspots: [{ ...KRAS.hotspots[0]!, label: 'G12' }] },
      { start: 1, end: 75 },
      {
        loc: KRAS_DOMAIN_WINDOWS,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 490,
        domains: true,
        turnedOff: KRAS_UNSHOWN_SITES,
        hideTracks: ['conservation', 'property-conservation'],
        pairStructure: { pdbId: '7rpz' },
      },
    ),
    ...domainFigure('KRAS', KRAS_G12, 0, true),
    viewportWidth: 2600,
    viewportHeight: 1100,
    actions: [
      { type: 'waitForAppSettled' },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-KRAS-6oim"] button[title="Reset Zoom"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-KRAS-6oim-pair"] button[title="Reset Zoom"]',
      },
      PARK_CURSOR,
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      {
        ...residueCallout('G12C: sotorasib', 'A:303', 80, -170),
        anchor: { residue: 'A:303', view: 2 },
      },
      {
        ...residueCallout('G12D: MRTX1133', 'A:202', 80, -170),
        anchor: { residue: 'A:202', view: 3 },
      },
    ],
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
    name: 'protein/braf_v600e',
    url: hotspotSession(
      BRAF_V600E,
      { start: 570, end: 630 },
      {
        loc: BRAF_V600_WINDOW,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 490,
        domains: true,
        turnedOff: BRAF_UNSHOWN,
      },
    ),
    ...domainFigure('BRAF', BRAF_V600, 0, true),
    viewportHeight: 1100,
  },
  {
    mode: 'url',
    name: 'protein/cftr_f508',
    url: hotspotSession(
      CFTR,
      { start: 488, end: 528 },
      {
        loc: CFTR_F508_WINDOW,
        tracks: [HG38_GENE_TRACK],
        msaHeight: 420,
        proteinColor: { field: 'clinvarPathogenicCount' },
      },
    ),
    ...READY,
    viewportWidth: 2300,
    viewportHeight: 1150,
    actions: hoverCodon(CFTR_F508),
  },
  {
    mode: 'url',
    name: 'protein/apoe_e4',
    url: hotspotSession(
      APOE,
      { start: 120, end: 185 },
      {
        loc: APOE_WIDE,
        tracks: [{ trackId: FINNGEN_AD, height: 220 }, HG38_GENE_TRACK],
        sessionTracks: [FINNGEN_AD_TRACK],
        msaHeight: 420,
        hideTracks: ['property-conservation'],
        pairStructure: { pdbId: undefined, uniprotId: 'P02649' },
        pairColor: { field: 'plddt' },
      },
    ),
    ...READY,
    viewportWidth: 2600,
    viewportHeight: 1150,
    actions: [
      { type: 'waitForAppSettled' },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-APOE-1b68"] button[title="Reset Zoom"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-APOE-1b68-pair"] button[title="Reset Zoom"]',
      },
      PARK_CURSOR,
      { type: 'delay', ms: 1500 },
    ],
  },
  {
    mode: 'url',
    name: 'protein/f5_leiden',
    url: hotspotSession(
      { ...F5, session: withPdb(F5.session, '7kxy') },
      { start: 515, end: 555 },
      {
        loc: F5_WIDE,
        tracks: [{ trackId: FINNGEN_VTE, height: 220 }, HG38_GENE_TRACK],
        sessionTracks: [FINNGEN_VTE_TRACK],
        msaHeight: 420,
        hideTracks: ['property-conservation'],
        pairStructure: { pdbId: '9mov' },
      },
    ),
    ...READY,
    viewportWidth: 2600,
    viewportHeight: 1150,
    actions: [
      { type: 'waitForAppSettled' },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-F5-9mot"] button[title="Reset Zoom"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-F5-9mot-pair"] button[title="Reset Zoom"]',
      },
      PARK_CURSOR,
      { type: 'delay', ms: 1500 },
    ],
    annotations: [
      {
        ...residueCallout('APC cuts here', 'A:506', 120, 200),
        anchor: { residue: 'A:506', view: 3 },
      },
    ],
  },
  {
    mode: 'url',
    name: 'protein/brca1_sge',
    url: hotspotSession(
      BRCA1,
      { start: 1690, end: 1760 },
      {
        loc: BRCA1_BRCT,
        tracks: [{ trackId: BRCA1_SGE, height: 170 }, HG38_GENE_TRACK],
        sessionTracks: [BRCA1_SGE_TRACK],
        msaHeight: 420,
        hideTracks: ['property-conservation'],
      },
    ),
    ...READY,
    viewportWidth: 2300,
    viewportHeight: 1150,
    actions: RESET_ZOOM,
  },
  {
    mode: 'url',
    name: 'protein/tp53_r273h',
    url: hotspotSession(
      TP53_R273H,
      { start: 240, end: 300 },
      {
        loc: TP53_EXONS_5_8,
        tracks: [{ trackId: TP53_SGE, height: 170 }, HG38_GENE_TRACK],
        sessionTracks: [TP53_SGE_TRACK],
        msaHeight: 420,
        domains: true,
        turnedOff: TP53_CDD_UNSHOWN,
        hideTracks: ['property-conservation'],
        pairStructure: { pdbId: '7b49' },
      },
    ),
    ...domainFigure('TP53', TP53_R248, 0, true),
    viewportWidth: 2600,
    viewportHeight: 1150,
    actions: [
      { type: 'waitForAppSettled' },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-TP53-5mg7"] button[title="Reset Zoom"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="view-container-protein-TP53-5mg7-pair"] button[title="Reset Zoom"]',
      },
      PARK_CURSOR,
      { type: 'delay', ms: 1500 },
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
