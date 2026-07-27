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

function makeModel(args?: { rowHeight?: number; isDensityMode?: boolean }) {
  const rowHeight = args?.rowHeight ?? 100
  return {
    sources: [{ name: 'a_very_long_sample_name' }, { name: 'sample2' }],
    isOverlay: false,
    rowHeight,
    isDensityMode: args?.isDensityMode ?? false,
    domain: [0, 100] as [number, number],
    scaleType: 'linear',
    ticks,
    rowHeightTooSmallForScalebar: rowHeight < 70,
    numSources: 2,
    numRows: 2,
    scoreRamp: undefined,
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

test('no axis drawn (score legend only) leaves the labels at the offset', () => {
  const svg = render({
    model: makeModel({ isDensityMode: true }),
    scalebarLeft: 50,
    labelOffset: 0,
  })
  expect(rowLabelX(svg)).toBe(0)
})
