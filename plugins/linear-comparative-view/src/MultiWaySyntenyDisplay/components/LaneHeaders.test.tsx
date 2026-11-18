import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { isClaimedPress } from '@jbrowse/core/util/pressOwner'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { createDisplay } from '../testEnv.ts'
import LaneHeaders from './LaneHeaders.tsx'

const decision = {
  refName: 'ctgB',
  flipped: false,
  rung: 1,
  pivotAnchor: { refName: 'ctgA', coord: 200 },
  pivotLaneBp: 200,
  pivotInHoleBp: 0,
  fitMin: 100,
  fitMax: 300,
  alsoOn: [],
  alsoOnMore: 0,
  alsoAt: [],
  pinned: false,
  orientationPinned: false,
}

function twoLaneDisplay(lanes: [string, string]) {
  const display = createDisplay()
  display.setFeatures(
    lanes.map(
      (mateAssembly, i) =>
        new SimpleFeature({
          uniqueId: `f${i}`,
          refName: 'ctgA',
          start: 100,
          end: 300,
          strand: 1,
          mate: {
            assemblyName: mateAssembly,
            refName: 'ctgB',
            start: 100,
            end: 300,
          },
        }),
    ),
  )
  display.setLaneFrames(0, new Map(lanes.map(lane => [lane, decision])))
  return display
}

function renderHeaders(display: ReturnType<typeof createDisplay>) {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneHeaders model={display} />
    </ThemeProvider>,
  )
}

test('a gutter next to an undescribed genome names the assembly to add', () => {
  const undeclared = 'sample#1#undeclared'
  const display = twoLaneDisplay(['volvox_random', undeclared])
  display.beginDescribingLanes([undeclared])
  display.endDescribingLanes([undeclared], {})
  renderHeaders(display)
  expect(screen.getByTestId('multiway-gutter-unheld')).toHaveTextContent(
    `Add ${undeclared} as an assembly to draw these ribbons`,
  )
})

test('a lane whose fetch failed says so, and Retry asks for it again', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  const [spec] = display.laneGenesFetchSpecs
  const fail = (key: string) => {
    display.setLaneGenes(
      new Map([[spec!.lane, { key, genes: [], error: new Error('503') }]]),
      display.laneGenesFetchSpecs,
      display.anchorAssemblyName,
    )
  }
  fail('an-earlier-window')
  renderHeaders(display)
  const testId = `multiway-lane-failed-${spec!.assemblyName}`
  expect(screen.queryByTestId(testId)).not.toBeInTheDocument()

  act(() => {
    fail(spec!.key)
  })
  const failure = screen.getByTestId(testId)
  expect(failure).toHaveTextContent('Failed to load Retry')
  expect(failure).toHaveAttribute('title', 'Error: 503')

  fireEvent.click(screen.getByTestId(`${testId}-retry`))
  expect(display.laneFetchErrors.size).toBe(0)
  expect(display.laneGenes.held.has(spec!.lane)).toBe(false)
  expect(screen.queryByTestId(testId)).not.toBeInTheDocument()
})

test('a lane pair whose fetch failed says so in its gutter', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  const [spec] = display.laneLinksFetchSpecs
  display.setLaneLinks(
    new Map([
      [
        spec!.lane,
        { key: spec!.key, links: [], ops: new Map(), error: new Error('503') },
      ],
    ]),
    display.laneLinksFetchSpecs,
    display.anchorAssemblyName,
  )
  renderHeaders(display)
  expect(screen.getByTestId('multiway-gutter-failed')).toHaveTextContent(
    'Failed to load alignments Retry',
  )
  expect(
    screen.queryByTestId('multiway-gutter-loading'),
  ).not.toBeInTheDocument()
})

test('a lane color draws as a swatch beside the label and tints it, the anchor included, above the lane and on the gene row', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  display.setLaneColor('volvox', 'black')
  display.setLaneColor('volvox_random', 'rgb(255, 0, 0)')
  const bars = () =>
    ['volvox', 'volvox_random', 'volvox_ins'].map(name =>
      screen.queryByTestId(`multiway-lane-color-${name}`),
    )
  for (const overlay of [false, true]) {
    display.setInlineLaneNames(overlay)
    const { unmount } = render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <LaneHeaders model={display} />
      </ThemeProvider>,
    )
    const [anchor, mate, bare] = bars()
    expect(anchor!.style.backgroundColor).toBe('black')
    expect(anchor!.style.width).toBe('10px')
    expect(
      screen.getByTestId('multiway-lane-label-volvox_random').style.background,
    ).toMatch(/^color-mix\(in srgb, rgb\(255,? 0,? 0\) 30%/)
    expect(mate!.style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect(bare).toBeNull()
    expect(mate!.nextElementSibling).toBe(
      screen.getByTestId('multiway-lane-label-volvox_random'),
    )
    unmount()
  }
})

function focusOutlineOf(element: Element) {
  return [...document.styleSheets]
    .flatMap(sheet => [...sheet.cssRules])
    .filter((rule): rule is CSSStyleRule => 'selectorText' in rule)
    .find(
      rule =>
        rule.selectorText.endsWith(':focus-visible') &&
        element.matches(rule.selectorText.replace(':focus-visible', '')),
    )?.style.outline
}

test('the lane menu button and Retry show where keyboard focus is', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  const [spec] = display.laneGenesFetchSpecs
  display.setLaneGenes(
    new Map([
      [spec!.lane, { key: spec!.key, genes: [], error: new Error('503') }],
    ]),
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  renderHeaders(display)
  for (const testId of [
    `multiway-lane-menu-${spec!.assemblyName}`,
    `multiway-lane-failed-${spec!.assemblyName}-retry`,
  ]) {
    expect(focusOutlineOf(screen.getByTestId(testId))).toMatch(/^2px solid/)
  }
})

test('a press on a mate label is claimed from the view pan, and its drag reorders the lanes', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  const claims: boolean[] = []
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <div
        onPointerDown={event => {
          claims.push(isClaimedPress(event))
        }}
      >
        <LaneHeaders model={display} />
      </div>
    </ThemeProvider>,
  )
  const [first, second] = display.rowAssemblies
  const label = screen.getByTestId(`multiway-lane-label-${first}`)
  const [, firstLane, secondLane] = display.laneStack.lanes
  const startY = firstLane!.bandStart + 2
  const dropY = secondLane!.bandStart + 2

  fireEvent.pointerDown(label, { button: 0, pointerId: 1, clientY: startY })
  fireEvent.pointerMove(label, { pointerId: 1, clientX: 40, clientY: dropY })
  fireEvent.pointerUp(label, { pointerId: 1, clientX: 40, clientY: dropY })

  expect(claims).toEqual([true])
  expect(display.rowAssemblies).toEqual([second, first])
})
