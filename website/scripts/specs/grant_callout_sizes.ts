// Four tutorial figures the 2026 renewal prints at 3.35 to 3.77 in wide, each
// without callouts and with callouts sized to a printed point size at that
// width. NIH accepts figure text under 11 pt only if it reads at 100%. The
// renewal's captions name panels by position, so the panel letters go.
import { deflateSync, inflateSync } from 'node:zlib'

import { junctionReads, scaffoldOverview } from './cgiab-junction.ts'
import { paperSvReadsSpecs } from './paper-sv-reads.ts'
import { proteinTp53Y220cSpecs } from './protein_figure_tp53_y220c.ts'
import { proteinVariantSpecs } from './protein_variants.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'
import type { SessionJson, ViewJson } from './protein_variants.ts'

const SIZES = [6, 8]

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
    const edit = (a.text ? edits[a.text] : undefined) ?? edits[a.type]
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

// The renewal's figure: the tutorial's 1000 Genomes figure without the 1000
// Genomes track, its alignment colored by domain and given the freed height.
const hbb1000g = byName(
  proteinVariantSpecs,
  'protein/hbb_1000_genomes',
) as Annotated & { url: string }
const sickleSpec = {
  ...hbb1000g,
  url: editSession(hbb1000g.url, session => {
    session.sessionTracks = session.sessionTracks?.filter(
      t => (t as { trackId: string }).trackId !== KG,
    )
    const [lgv, msa, protein] = session.views as [ViewJson, ViewJson, ViewJson]
    const init = lgv.init as { tracks: { trackId: string }[] }
    init.tracks = init.tracks
      .filter(t => t.trackId !== KG)
      .map(t => (t.trackId === GWAS_SUBSET ? { ...t, height: 240 } : t))
    msa.showDomains = true
    msa.height = 420
    protein.height = 800
  }),
  viewportHeight: 1120,
  annotations: [
    {
      type: 'text',
      text: 'Malaria\nGWAS hit',
      leader: true,
      anchor: { trackId: GWAS_SUBSET, loc: RS334, fracY: 0.44 },
      dx: 180,
      dy: 0,
    },
    {
      type: 'text',
      text: 'Sickle\nmutation',
      leader: true,
      anchor: { residue: 'B:6' },
      dx: -40,
      dy: 220,
    },
  ],
} as Annotated

const sickle: Figure = {
  key: 'sickle_cell',
  spec: sickleSpec,
  cssWidth: 2000,
  printPt: 259.2,
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
    'Y220C: broken': {
      text: 'Y220C breaks p53',
      dx: -1.5 * font,
      dy: -0.9 * font,
    },
    'Y220F keeps the ring: works': {
      text: 'Y220F keeps p53 working',
      dx: -1.5 * font,
      dy: 0.9 * font,
    },
    'Empty pocket': { dx: -40, maxWidth: font * 4 },
  }),
}

function editSpecSession(url: string, edit: (session: SessionJson) => void) {
  const [head, rest] = url.split('&session=spec-') as [string, string]
  const [json, tail] = rest.split('&sessionName=') as [string, string]
  const session = JSON.parse(decodeURIComponent(json)) as SessionJson
  edit(session)
  return `${head}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=${tail}`
}

const SV_READS_VIEWPORT_HEIGHT = 1240

const svReadsBase = byName(
  paperSvReadsSpecs,
  'paper/sv_read_evidence',
) as Annotated & { url: string }
const svReadsFrame = {
  ...svReadsBase,
  name: 'grant/sv_read_frame',
  annotations: [],
  url: editSpecSession(svReadsBase.url, session => {
    const [lgv] = session.views as [ViewJson]
    const tracks = lgv.tracks as { trackId: string; pileup?: object }[]
    // split reads alone, grouped by split; the read arcs draw each junction, not sashimi too
    lgv.tracks = tracks
      .filter(t => t.trackId !== 'hg38_ncbiRefSeq_ucsc')
      .map(t => ({
        ...t,
        ...(t.trackId.startsWith('hg008_t_')
          ? { sashimi: { show: false } }
          : {}),
        ...(t.trackId === 'hg008_t_hifi_chains'
          ? {
              facet: { field: 'split', hidden: ['unsplit'] },
              heightMode: 'grow',
              pileup: { ...t.pileup, mark: { height: 4 } },
            }
          : {}),
      }))
  }),
  viewportHeight: SV_READS_VIEWPORT_HEIGHT,
} as Annotated

// The frame is 1500 CSS px wide at 2x. Callouts sit in white side margins,
// centered on a leader to the band they name, so none covers reads.
const FRAME_WIDTH = 3000
const FRAME_HEIGHT = 2 * SV_READS_VIEWPORT_HEIGHT
const SV_READS_PRINT_PT = 271.4
const LABEL_EM = 6.2

interface Callout {
  text: string
  side: 'left' | 'right'
  // where the leader ends, in the first part's own px
  x: number
  y: number
  maxPt?: number
}

const svReadsCallouts: Callout[] = [
  { text: 'SV\ncalls', side: 'left', x: 887, y: 307 },
  { text: 'SV call\narcs', side: 'right', x: 2206, y: 674, maxPt: 6 },
  { text: 'PacBio\ncoverage', side: 'left', x: 775, y: 837, maxPt: 6 },
  {
    text: 'PacBio\nsplit read\narcs',
    side: 'right',
    x: 2164,
    y: 1008,
    maxPt: 6,
  },
  { text: 'PacBio\nsplit reads', side: 'left', x: 670, y: 1145 },
  { text: 'Illumina\ncoverage', side: 'right', x: 2850, y: 1690, maxPt: 6 },
  { text: 'Illumina\npair arcs', side: 'left', x: 891, y: 1814 },
  { text: 'Illumina\nread cloud', side: 'right', x: 2186, y: 2299 },
]

// Margins of `em` font sizes each side shrink the frame on the page, so the
// font f solves f = pt * (frameWidth + 2 * em * f) / printPt.
const marginFont = (
  pt: number,
  frameWidth: number,
  printPt: number,
  em: number,
) => Math.round((pt * frameWidth) / (printPt - pt * 2 * em))

function marginCallout(
  c: Callout,
  font: number,
  frameWidth: number,
  em: number,
  dy = 0,
): Annotation {
  const gap = Math.round(font / 4)
  return {
    type: 'text',
    text: c.text,
    leader: true,
    fontSize: font,
    maxWidth: font * em,
    strokeWidth: Math.max(6, Math.round(font / 12)),
    anchor: {
      selector: '[data-part="0"]',
      alignX: 'left',
      alignY: 'top',
      dx: c.x,
      dy: c.y,
    },
    dx: c.side === 'left' ? -(c.x + gap) : frameWidth + gap - c.x,
    dy,
  }
}

// keeps a two-line label inside the frame by moving it off its leader's level
const clampDy = (y: number, font: number) => {
  const half = Math.round(1.4 * font)
  return Math.min(Math.max(y, half), FRAME_HEIGHT - half) - y
}

function svReadsVariant(pt?: number): ScreenshotSpec {
  if (!pt) {
    return {
      mode: 'compose',
      name: 'grant/sv_read_evidence_none',
      parts: [svReadsFrame.name],
    }
  }
  const font = marginFont(pt, FRAME_WIDTH, SV_READS_PRINT_PT, LABEL_EM)
  return {
    mode: 'compose',
    name: `grant/sv_read_evidence_${pt}pt`,
    parts: [svReadsFrame.name],
    sideMargin: Math.round(LABEL_EM * font),
    annotations: svReadsCallouts
      .filter(c => pt <= (c.maxPt ?? pt))
      .map(c =>
        marginCallout(c, font, FRAME_WIDTH, LABEL_EM, clampDy(c.y, font)),
      ),
  }
}

const HIDE_APP_BAR = { hideAppBar: true }
const TRANSLOCATION_PRINT_PT = 241.2
const TRANSLOCATION_WIDTH = 3600
const ROW_LABEL_EM = 4.5

// the top panel is the read view alone: the synteny ribbons under it are in the
// bottom panel
const readsPart = (suffix: string) => {
  const base = junctionReads(
    `grant/sv_reads_${suffix}`,
    HIDE_APP_BAR,
  ) as Annotated & { url: string }
  return {
    ...base,
    // one view row, chr13 then chr3 as the overview's GRCh38 row runs
    url: editSpecSession(base.url, session => {
      const [split] = session.views as [ViewJson]
      type Panel = { loc: string; assembly: string; tracks: [object, object] }
      const [chr3, chr13] = split.views as [Panel, Panel]
      session.views = [
        {
          type: 'LinearGenomeView',
          assembly: chr3.assembly,
          loc: `${chr13.loc} ${chr3.loc}`,
          tracks: [
            chr3.tracks[0],
            {
              ...chr3.tracks[1],
              unit: 'chain',
              facet: { field: 'split', hidden: ['unsplit'] },
              encoding: { color: 'pairOrientation' },
              readConnections: { show: true, height: 70 },
              sashimi: { show: false },
              legend: { show: true },
              pileup: { mark: { height: 2 } },
              height: 530,
            },
          ],
        },
      ]
    }),
    viewportHeight: 770,
    annotations: [],
  } as Annotated
}

const overviewPart = (suffix: string, font: number | undefined) => {
  const spec = scaffoldOverview(
    `grant/sv_overview_${suffix}`,
    HIDE_APP_BAR,
  ) as Annotated
  const css = (font ?? 0) / 2
  const edits: Edits = {
    hap2: 'drop',
    GRCh38: 'drop',
    hap1: 'drop',
    'chr13 breakend': {
      text: 'chr13',
      dx: 100,
      dy: 40 + 0.6 * css,
      maxWidth: css * 6,
    },
    'chr3 breakend': {
      text: 'chr3',
      dx: -140,
      dy: 40 - 2.2 * css,
      maxWidth: css * 6,
    },
    junction: { dy: -css },
  }
  return {
    ...spec,
    annotations: font ? resize(spec.annotations, css, edits) : [],
  } as Annotated
}

const READ_CALLOUTS: Callout[] = [
  { text: 'chr13', side: 'left', x: 907, y: 306 },
  { text: 'chr3', side: 'right', x: 2695, y: 306 },
  { text: 'split\nreads', side: 'right', x: 2600, y: 845 },
]

// y: the row's center in the overview part's own px
const ROWS = [
  { text: 'hap2', y: 270 },
  { text: 'GRCh38', y: 810 },
  { text: 'hap1', y: 1368 },
]

function translocationCallouts(font: number): Annotation[] {
  return [
    ...READ_CALLOUTS.map(c =>
      marginCallout(c, font, TRANSLOCATION_WIDTH, ROW_LABEL_EM),
    ),
    // a label's baseline sits on its anchor, so this centers capitals on the row
    ...ROWS.map((r): Annotation => ({
      type: 'text',
      text: r.text,
      fontSize: font,
      textAlign: 'end',
      anchor: {
        selector: '[data-part="1"]',
        alignX: 'left',
        alignY: 'top',
        dx: -Math.round(font / 4),
        dy: r.y + Math.round(font * 0.35),
      },
    })),
  ]
}

function translocationVariant(pt?: number): ScreenshotSpec[] {
  const suffix = pt ? `${pt}pt` : 'none'
  const font = pt
    ? marginFont(pt, TRANSLOCATION_WIDTH, TRANSLOCATION_PRINT_PT, ROW_LABEL_EM)
    : undefined
  const reads = readsPart(suffix)
  const overview = overviewPart(suffix, font)
  return [
    reads,
    overview,
    {
      mode: 'compose',
      name: `grant/sv_translocation_${suffix}`,
      parts: [reads.name, overview.name],
      gutter: 40,
      ...(font ? { sideMargin: Math.round(ROW_LABEL_EM * font) } : {}),
      annotations: font ? translocationCallouts(font) : [],
    },
  ]
}

export const grantCalloutSizeSpecs: ScreenshotSpec[] = [
  ...variants(sickle),
  ...variants(y220c),
  svReadsFrame,
  svReadsVariant(),
  ...SIZES.map(pt => svReadsVariant(pt)),
  ...translocationVariant(),
  ...SIZES.flatMap(pt => translocationVariant(pt)),
]
