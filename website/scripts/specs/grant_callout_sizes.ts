// Four tutorial figures the 2026 renewal prints at 3.35 to 3.77 in wide, each
// without callouts and with callouts sized to a printed point size at that
// width. NIH accepts figure text under 11 pt only if it reads at 100%. The
// renewal's captions name panels by position, so the panel letters go.
import { junctionScaffold, scaffoldOverview } from './cgiab-junction.ts'
import { paperSvReadsSpecs } from './paper-sv-reads.ts'
import { proteinTp53Y220cSpecs } from './protein_figure_tp53_y220c.ts'
import { proteinVariantSpecs } from './protein_variants.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

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

const hbbThreeViews = byName(
  proteinVariantSpecs,
  'protein/hbb_domains_three_views',
) as Annotated & { actions: { type: string; selector?: string }[] }

// main's domain track draws no legend, so the tutorial's click to hide it misses
const sickle: Figure = {
  key: 'sickle_cell',
  spec: {
    ...hbbThreeViews,
    actions: hbbThreeViews.actions.filter(
      a => !a.selector?.includes('Hide legend'),
    ),
  } as Annotated,
  cssWidth: 2300,
  printPt: 259.2,
  edits: (_pt, font) => ({
    'One copy protects against malaria; two cause sickle cell disease': {
      text: 'Malaria',
    },
    'Sickle allele carriers, nearly all with one copy': {
      text: 'Sickle carriers',
      maxWidth: font * 5.5,
    },
    'No heme or interface site at glutamate 6': 'drop',
    'Valine 6 docks into a pocket on the next tetramer, stringing haemoglobin S into fibres':
      { text: 'Val6' },
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
