// The grant's figures, each a row of JBrowse frames lettered in the margin
// above them. No frame shows the app bar, which repeated reads as several apps.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { DEFAULT_VIEWPORT } from '../screenshot-spec-types.ts'
import {
  drosophilaBlocksUrl,
  paperDrosophilaSpecs,
} from './paper-drosophila.ts'
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
const font = Math.round(
  (sickle.annotations?.find(a => a.type === 'text')?.fontSize ?? 22) *
    sickleScale,
)
const proteinParts = [
  { ...sickle, scale: sickleScale },
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
]
