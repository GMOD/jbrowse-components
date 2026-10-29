// The grant's figures, each a row of JBrowse frames lettered in the margin
// above them. No frame shows the app bar, which repeated reads as several apps.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { DEFAULT_VIEWPORT } from '../screenshot-spec-types.ts'
import { junctionScaffold, scaffoldOverview } from './cgiab-junction.ts'
import {
  drosophilaBlocksUrl,
  paperDrosophilaSpecs,
} from './paper-drosophila.ts'
import { paperSvReadsSpecs } from './paper-sv-reads.ts'
import { proteinHbbE6vPocketSpecs } from './protein_figure_hbb_e6v_pocket.ts'
import { proteinTp53Y220cSpecs } from './protein_figure_tp53_y220c.ts'

import type {
  Annotation,
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

const CHROME = ['header.MuiAppBar-root']
const APP_BAR_HEIGHT = 48
const SIZE = { viewportWidth: 1100, viewportHeight: 832 }
const LEGEND = '[data-testid="floating-legend"]'

// A part's letter and title, bare, in the row's labelMargin
const partLabel = (part: number, text: string): Annotation => ({
  type: 'text',
  text,
  fontSize: 96,
  maxWidth: 3000,
  color: 'none',
  background: 'none',
  anchor: {
    selector: `[data-part="${part}"]`,
    alignX: 'left',
    alignY: 'top',
    dx: 0,
    dy: -26,
  },
})

// A figure as a grant part: the row's letter replaces its own lettered circles
function asPart(spec: ScreenshotSpec, name: string) {
  if (spec.mode !== 'url') {
    throw new Error(`${spec.name} is not a url spec`)
  }
  const viewportHeight =
    (spec.viewportHeight ?? DEFAULT_VIEWPORT.height) - APP_BAR_HEIGHT
  return {
    ...spec,
    name,
    viewportHeight,
    hideSelectors: [...(spec.hideSelectors ?? []), ...CHROME],
    annotations: spec.annotations?.filter(a => a.type !== 'circle'),
  } satisfies SessionUrlSpec
}

// Every callout and pill at one font size, with per-callout edits keyed by text
function withFont(
  part: SessionUrlSpec,
  font: number,
  edits: Record<string, Partial<Annotation> | 'drop'>,
): SessionUrlSpec {
  return {
    ...part,
    annotations: part.annotations?.flatMap(a => {
      const edit = edits[a.text ?? a.type]
      if (edit === 'drop') {
        return []
      }
      return a.type === 'text'
        ? [
            {
              ...a,
              fontSize: font,
              ...(a.maxWidth
                ? {
                    maxWidth: Math.round(
                      (a.maxWidth * font) / (a.fontSize ?? 22),
                    ),
                  }
                : {}),
              ...edit,
            },
          ]
        : [a]
    }),
  }
}

const sickle = asPart(proteinHbbE6vPocketSpecs[0]!, 'grant/hbb_e6v_pocket')
const tp53 = asPart(proteinTp53Y220cSpecs[0]!, 'grant/tp53_y220c')
// The sickle figure is the shorter, so it renders at a higher scale to stand
// as tall as TP53's, and TP53's callouts take the size the sickle's print at
const sickleScale = tp53.viewportHeight / sickle.viewportHeight
// The sickle figure's callouts are sized to print at 8 pt across a whole page;
// half a page wide they need this much more
const CALLOUT_GROWTH = 1.3
const sickleFont = Math.round(
  (sickle.annotations?.find(a => a.type === 'text')?.fontSize ?? 22) *
    CALLOUT_GROWTH,
)
const font = Math.round(sickleFont * sickleScale)
const proteinParts = [
  { ...withFont(sickle, sickleFont, {}), scale: sickleScale },
  // At this size the legend and the two pills cover the scan's dots, so the
  // pills' colors stand in for the legend and each sits clear of the dots, as
  // grant_callout_sizes.ts has them
  withFont(tp53, font, {
    legend: 'drop',
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
    'Y220C + REZATAPOPT': { maxWidth: font * 7 },
    'Empty pocket': { dx: -40, maxWidth: font * 4 },
  }),
]

function urlSpec(spec: ScreenshotSpec) {
  if (spec.mode !== 'url') {
    throw new Error(`${spec.name} is not a url spec`)
  }
  return spec
}

// The translocation stacks the junction over the scaffold overview, both at the
// app's 2x, so the inversion renders at the scale that draws it as tall as the
// stack, and the translocation's callouts take the size the inversion's print at
const HIDE_APP_BAR = { hideAppBar: true }
const STACK_GUTTER_2X = 40
const junction = urlSpec(
  junctionScaffold('grant/sv_row_junction', HIDE_APP_BAR),
)
const overview = urlSpec(
  scaffoldOverview('grant/sv_row_overview', HIDE_APP_BAR),
)
const inversion = urlSpec(paperSvReadsSpecs[1]!)
const stackHeight =
  junction.viewportHeight! + overview.viewportHeight! + STACK_GUTTER_2X / 2
const inversionScale = stackHeight / inversion.viewportHeight!
const inversionFont =
  inversion.annotations?.find(a => a.type === 'text')?.fontSize ?? 16
const svFont = Math.round(inversionFont * inversionScale)
const anchorOf = (spec: SessionUrlSpec, text: string) => {
  const anchor = spec.annotations?.find(a => a.text === text)?.anchor
  if (!anchor) {
    throw new Error(`${spec.name} has no callout ${text}`)
  }
  return anchor
}

// The band labels move off the reads and coverage they would cover: into the
// white beside them on a leader, or beside the track's own label
const svParts: ScreenshotSpec[] = [
  withFont(junction, svFont, {
    'SV calls': {
      anchor: { ...anchorOf(junction, 'SV calls'), alignX: 'right', dx: 28 },
    },
    'split reads': {
      anchor: { ...anchorOf(junction, 'split reads'), dx: 195 },
      leader: true,
      dx: -20,
      dy: 205,
    },
    'unsplit reads': {
      anchor: { ...anchorOf(junction, 'unsplit reads'), dx: 465 },
      leader: true,
      dx: 100,
      dy: 0,
    },
  }),
  withFont(overview, svFont, {}),
  {
    ...withFont(inversion, inversionFont, {
      'PacBio: coverage': {
        anchor: {
          text: 'PacBio HiFi: coverage',
          alignX: 'right',
          alignY: 'center',
          dx: 30,
          dy: 6,
        },
      },
      'PacBio: unsplit reads': 'drop',
      'Illumina: coverage': {
        anchor: {
          text: 'Illumina: coverage and read arcs',
          alignX: 'right',
          alignY: 'center',
          dx: 30,
          dy: 6,
        },
      },
      'Illumina: read-pair arcs': {
        anchor: { ...anchorOf(inversion, 'Illumina: read-pair arcs'), dx: 120 },
        leader: true,
        dx: 50,
        dy: 58,
      },
    }),
    name: 'grant/sv_row_inversion',
    scale: inversionScale,
  },
  {
    mode: 'compose',
    name: 'grant/sv_row_translocation',
    parts: ['grant/sv_row_junction', 'grant/sv_row_overview'],
    gutter: STACK_GUTTER_2X,
  },
]

// The synteny row shares one frame height, so the three draw text at one size.
// MG1655 is the reference row. One strain per lab lineage (BL21 for B), since
// the K-12 and B derivatives repeat their parent's cluster.
const ECOLI_LANES = [
  'BL21_DE3',
  'HS',
  'IAI1',
  'SE11',
  '55989',
  'E24377A',
  'Sakai',
  'EDL933',
  'CFT073',
  'UTI89',
  'S88',
  'APEC_O1',
  'UMN026',
  'IAI39',
  'ED1a',
  'SMS-3-5',
  'Sflexneri_301',
  'Sdysenteriae_Sd197',
  'Sboydii_Sb227',
  'Ssonnei_53G',
]

export const grantSpecs: ScreenshotSpec[] = [
  {
    ...paperDrosophilaSpecs[0]!,
    name: 'grant/drosophila_blocks',
    url: drosophilaBlocksUrl(150),
    ...SIZE,
    hideSelectors: [LEGEND, '[data-testid="lgv-mini-controls"]', ...CHROME],
  },
  {
    mode: 'url',
    name: 'grant/tp53_cactus',
    url: sessionSpec('https://jbrowse.org/demos/t2t_apes_cactus/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:7,400,000-7,700,000',
          tracks: [
            {
              trackId: 't2t_apes_cactus',
              height: 640,
              ribbons: { encoding: { color: 'strand' } },
              labels: { lanes: { placement: 'overlay' } },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    ...SIZE,
    hideSelectors: [LEGEND, ...CHROME],
  },
  {
    mode: 'url',
    name: 'grant/ecoli_oantigen',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_orthologs/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'MG1655',
          loc: 'NC_000913.3:2,095,000-2,115,000',
          tracks: [
            {
              trackId: 'ecoli_orthologs',
              height: 640,
              rows: { kept: ECOLI_LANES },
              ribbons: {
                encoding: { color: { value: 'rgb(130,130,130)' } },
              },
              labels: { lanes: { placement: 'overlay' } },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    ...SIZE,
    // the paper figure's width, which the cluster's gene labels need
    viewportWidth: 1500,
    hideSelectors: CHROME,
  },
  {
    mode: 'compose',
    name: 'grant/synteny_row',
    parts: [
      'grant/drosophila_blocks',
      'grant/tp53_cactus',
      'grant/ecoli_oantigen',
    ],
    columns: 3,
    gutter: 60,
    labelMargin: 150,
    trim: 12,
    annotations: [
      partLabel(0, 'A) Five Drosophila species'),
      partLabel(1, 'B) TP53 region across seven apes'),
      partLabel(2, 'C) E. coli O-antigen cluster'),
    ],
  },
  ...proteinParts,
  {
    mode: 'compose',
    name: 'grant/protein_row',
    parts: ['grant/hbb_e6v_pocket', 'grant/tp53_y220c'],
    columns: 2,
    gutter: 60,
    labelMargin: 150,
    trim: 12,
    annotations: [
      partLabel(0, 'A) Sickle cell mutation'),
      partLabel(1, 'B) TP53 mutation with drug rescue'),
    ],
  },
  ...svParts,
  {
    mode: 'compose',
    name: 'grant/sv_row',
    parts: ['grant/sv_row_translocation', 'grant/sv_row_inversion'],
    columns: 2,
    gutter: 60,
    labelMargin: 150,
    trim: 12,
    annotations: [
      partLabel(0, 'A) Translocation between chr3 and chr13'),
      partLabel(1, 'B) Inversion: read evidence'),
    ],
  },
]
