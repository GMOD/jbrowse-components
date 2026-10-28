// Four tutorial figures the 2026 renewal prints at 3.35 to 3.77 in wide, each
// without callouts and with callouts sized to a printed point size at that
// width. NIH accepts figure text under 11 pt only if it reads at 100%. The
// renewal's captions name panels by position, so the panel letters go.
import { deflateSync, inflateSync } from 'node:zlib'

import { junctionScaffold, scaffoldOverview } from './cgiab-junction.ts'
import { paperSvReadsSpecs } from './paper-sv-reads.ts'
import { proteinTp53Y220cSpecs } from './protein_figure_tp53_y220c.ts'
import { proteinVariantSpecs } from './protein_variants.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'
import type { SessionJson, ViewJson } from './protein_variants.ts'

const SIZES = [6, 8, 11]

type Edit = Partial<Pick<Annotation, 'text' | 'dx' | 'dy' | 'maxWidth'>>
// keyed by the callout's text, or by its type for every callout of that type
type Edits = Record<string, Edit | 'drop'>
type Annotated = ScreenshotSpec & { annotations?: Annotation[] }

interface Sizing {
  cssWidth: number
  printPt: number
  edits?: (pt: number, font: number) => Edits
}

interface Figure extends Sizing {
  key: string
  spec: Annotated
}

const DEFAULT_FONT: Record<string, number> = {
  text: 22,
  circle: 18,
  legend: 20,
}

function sized(a: Annotation, font: number, edit: Edit = {}): Annotation {
  const k = font / (a.fontSize ?? DEFAULT_FONT[a.type] ?? 22)
  return {
    ...a,
    fontSize: font,
    maxWidth: a.maxWidth ? Math.round(a.maxWidth * k) : font * 20,
    ...(a.leader
      ? { strokeWidth: Math.max(4, Math.round(4 * Math.sqrt(k))) }
      : {}),
    ...edit,
  }
}

function resize(annotations: Annotation[] = [], font: number, edits: Edits) {
  return annotations.flatMap(a => {
    const edit = (a.text && edits[a.text]) ?? edits[a.type]
    return edit === 'drop' ? [] : [sized(a, font, edit)]
  })
}

function byName(specs: ScreenshotSpec[], name: string): Annotated {
  const spec = specs.find(s => s.name === name)
  if (!spec) {
    throw new Error(`no spec ${name}`)
  }
  return spec
}

const fontAt = (f: Sizing, pt: number) =>
  Math.round((pt * f.cssWidth) / f.printPt)

const sizedAnnotations = (f: Sizing, spec: Annotated, pt: number) => {
  const font = fontAt(f, pt)
  return resize(spec.annotations, font, f.edits?.(pt, font) ?? {})
}

function variants(f: Figure): ScreenshotSpec[] {
  return [
    { ...f.spec, name: `grant/${f.key}_none`, annotations: [] },
    ...SIZES.map(pt => ({
      ...f.spec,
      name: `grant/${f.key}_${pt}pt`,
      annotations: sizedAnnotations(f, f.spec, pt),
    })),
  ]
}

function editSession(url: string, edit: (session: SessionJson) => void) {
  const [head, encoded] = url.split('&session=encoded-') as [string, string]
  const session = JSON.parse(
    inflateSync(Buffer.from(encoded, 'base64url')).toString(),
  ) as SessionJson
  edit(session)
  return `${head}&session=encoded-${deflateSync(JSON.stringify(session)).toString('base64url')}`
}

const KG = 'kgp3202_chr11_snv'
const GWAS_SUBSET = 'gwasCatalog_sickle_cell_traits'
const RS334 = 'chr11:5,227,002'
const SUPERPOPULATIONS = ['AFR', 'AMR', 'EUR', 'SAS', 'EAS']

// The renewal's figure: the tutorial's 1000 Genomes figure with the rows in
// one band per superpopulation and the alignment colored by domain. The
// sample table comes from the 1000 Genomes 3,202-sample pedigree file, and
// only the generator's own server, on its default port, serves it.
const KG_SAMPLES = 'http://localhost:3334/test_data/1000g_3202/samples.tsv'
const hbb1000g = byName(
  proteinVariantSpecs,
  'protein/hbb_1000_genomes',
) as Annotated & { url: string }
const sickleSpec = {
  ...hbb1000g,
  url: editSession(hbb1000g.url, session => {
    const kg = session.sessionTracks?.find(
      t => (t as { trackId: string }).trackId === KG,
    ) as { adapter: object }
    kg.adapter = {
      ...kg.adapter,
      samplesTsvLocation: { uri: KG_SAMPLES },
    }
    const [lgv, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
    const init = lgv.init as { tracks: { trackId: string }[] }
    init.tracks = init.tracks.map(t =>
      t.trackId === KG
        ? {
            ...t,
            rowColor: 'superpopulation',
            facet: { field: 'superpopulation', sort: SUPERPOPULATIONS },
          }
        : t,
    )
    msa.showDomains = true
    msa.height = 400
    protein.height = 1000
  }),
  viewportHeight: 1310,
  annotations: [
    {
      type: 'text',
      text: 'Malaria',
      leader: true,
      anchor: { trackId: GWAS_SUBSET, loc: RS334, fracY: 0.62 },
      dx: 220,
      dy: 0,
    },
    {
      type: 'text',
      text: 'African\nancestry\ncarriers',
      leader: true,
      anchor: { trackId: KG, loc: RS334, fracY: 0.03 },
      dx: 100,
      dy: 90,
    },
    {
      type: 'text',
      text: 'Val6',
      leader: true,
      anchor: { residue: 'B:6' },
      dx: 60,
      dy: 300,
    },
  ],
} as Annotated

const sickle: Figure = {
  key: 'sickle_cell',
  spec: sickleSpec,
  cssWidth: 2000,
  printPt: 259.2,
  // the pill's top stays on the 1000 Genomes track at every size
  edits: (_pt, font) => ({
    'African\nancestry\ncarriers': { dy: font * 2 },
  }),
}

const y220c: Figure = {
  key: 'tp53_y220c',
  spec: byName(proteinTp53Y220cSpecs, 'protein/tp53_y220c'),
  cssWidth: 1800,
  printPt: 247,
  // the two pills' colors stand in for the legend
  edits: (pt, font) => ({
    circle: 'drop',
    legend: 'drop',
    'Y220C + REZATAPOPT': { maxWidth: font * (pt >= 8 ? 7 : 13) },
    'Y220C: broken': { dx: -1.5 * font, dy: -0.9 * font },
    'Y220F keeps the ring: works': {
      text: 'Y220F: works',
      dx: -1.5 * font,
      dy: 0.9 * font,
    },
    'Empty pocket':
      pt >= 11
        ? { dx: -5, dy: 210, maxWidth: font * 4 }
        : { dx: -40, maxWidth: font * 4 },
  }),
}

const svReads: Figure = {
  key: 'sv_read_evidence',
  spec: byName(paperSvReadsSpecs, 'paper/sv_read_evidence'),
  cssWidth: 1500,
  printPt: 271.4,
  edits: pt =>
    pt >= 8
      ? {
          'SV call arcs': 'drop',
          'PacBio: split-read arcs': 'drop',
          'Illumina: coverage': 'drop',
        }
      : {},
}

// Two 1800 CSS px parts stacked with no side margin
const translocation: Sizing = {
  cssWidth: 1800,
  printPt: 241.2,
  edits: (pt, font) => ({
    'chr13 breakend': { text: 'chr13', dx: 100 },
    'chr3 breakend': { text: 'chr3' },
    junction: { dy: -font },
    ...(pt >= 8
      ? { 'aggregate read links': 'drop', 'unsplit reads': 'drop' }
      : {}),
  }),
}

function translocationVariant(suffix: string, pt?: number): ScreenshotSpec[] {
  const hide = { hideAppBar: true }
  const parts = [
    junctionScaffold(`grant/sv_junction_${suffix}`, hide),
    scaffoldOverview(`grant/sv_overview_${suffix}`, hide),
  ] as Annotated[]
  return [
    ...parts.map(p => ({
      ...p,
      annotations: pt ? sizedAnnotations(translocation, p, pt) : [],
    })),
    {
      mode: 'compose',
      name: `grant/sv_translocation_${suffix}`,
      parts: parts.map(p => p.name),
      gutter: 40,
    },
  ]
}

export const grantCalloutSizeSpecs: ScreenshotSpec[] = [
  ...variants(sickle),
  ...variants(y220c),
  ...variants(svReads),
  ...translocationVariant('none'),
  ...SIZES.flatMap(pt => translocationVariant(`${pt}pt`, pt)),
]
