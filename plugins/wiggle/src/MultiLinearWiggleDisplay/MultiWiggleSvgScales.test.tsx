import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import MultiWiggleSvgScales from './MultiWiggleSvgScales.tsx'

const ticks = {
  values: [0, 100],
  yTop: 0,
  yBottom: 100,
  items: [
    { value: 0, y: 100, label: '0' },
    { value: 100, y: 0, label: '100' },
  ],
}

function makeModel(args?: {
  rowHeight?: number
  isDensityMode?: boolean
  showRowLabels?: boolean
}) {
  const rowHeight = args?.rowHeight ?? 100
  return {
    sources: [{ name: 'a_very_long_sample_name' }, { name: 'sample2' }],
    isOverlay: false,
    effectiveRowHeight: rowHeight,
    isDensityMode: args?.isDensityMode ?? false,
    domain: [0, 100] as [number, number],
    scaleType: 'linear',
    ticks,
    rowHeightTooSmallForScalebar: rowHeight < 70,
    numSources: 2,
    numRows: 2,
    scoreRamp: undefined,
    symlogConstant: 0,
    showRowLabels: args?.showRowLabels ?? true,
  }
}

// x of the <g> the row labels are drawn in. The scalebar group translates with
// one argument, so the two-argument form is unambiguously SvgRowLabels.
function rowLabelX(svg: string) {
  return Number(/<g transform="translate\((\d+) 0\)">/.exec(svg)?.[1])
}

function render(props: {
  scalebarLeft: number
  labelOffset: number
  model: ReturnType<typeof makeModel>
}) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <MultiWiggleSvgScales legendRight={800} {...props} />
      </svg>
    </ThemeProvider>,
  )
}

test('row labels start past the y-scalebar rather than under it', () => {
  const svg = render({
    model: makeModel(),
    scalebarLeft: 50,
    labelOffset: 0,
  })
  expect(rowLabelX(svg)).toBeGreaterThan(50)
})

test('a tree offset wider than the axis strip still wins', () => {
  const svg = render({
    model: makeModel(),
    scalebarLeft: 50,
    labelOffset: 200,
  })
  expect(rowLabelX(svg)).toBe(200)
})

// The rows stack edge to edge (`ticks` is built with offset 0), so a label
// centered on its own tick lands half in the neighbouring row: clipped away
// entirely on the first and last rows, overdrawn by the neighbour's
// opposite-end label everywhere in between. YScaleBar's `insetLabels` is what
// keeps them inside, and this is the only thing asking for it.
test('the per-row axes inset their end labels', () => {
  const svg = render({
    model: makeModel(),
    scalebarLeft: 50,
    labelOffset: 0,
  })
  // domain-min at yBottom=100 (stroke at 99.5) pulled up to 95, domain-max at
  // yTop=0 (stroke at 0.5) pushed down to 5, for each of the two rows
  const axisLabels = [...svg.matchAll(/<text [^>]*paint-order="stroke"[^>]*>/g)]
  expect(axisLabels.map(m => /\by="(-?[\d.]+)"/.exec(m[0])?.[1])).toEqual([
    '-4.5',
    '4.5',
    '-4.5',
    '4.5',
  ])
})

test('no axis drawn (score legend only) leaves the labels at the offset', () => {
  const svg = render({
    model: makeModel({ isDensityMode: true }),
    scalebarLeft: 50,
    labelOffset: 0,
  })
  expect(rowLabelX(svg)).toBe(0)
})

// The one thing "Show row labels" off has to do: at a row height too short for
// text the labels are a bare column of swatches, and a track whose colors are
// per-row identity rather than a grouping is better off without it.
test('row labels can be turned off entirely', () => {
  const svg = render({
    model: makeModel({ rowHeight: 2, showRowLabels: false }),
    scalebarLeft: 50,
    labelOffset: 0,
  })
  expect(rowLabelX(svg)).toBeNaN()
})
