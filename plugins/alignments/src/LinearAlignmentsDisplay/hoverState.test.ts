import { autorun } from 'mobx'

import { createRpcTestEnvironment } from './testUtils.ts'

import type { HoveredJunction } from '../features/sashimi/supportingReads.ts'
import type { TextTooltipPayload } from './components/tooltipUtils.ts'
import type { AlignmentsHover } from './hoverState.ts'

type Display = ReturnType<
  ReturnType<typeof createRpcTestEnvironment>['createDisplay']
>['display']

const junction = (start: number): HoveredJunction => ({
  groupKey: '',
  refName: 'ctgA',
  start,
  end: 500,
  split: 'splitBack',
})

const arcHighlight = (x: number) => ({
  d: `M ${x} 0 L ${x + 10} 0`,
  clip: { x: 0, y: 0, width: 800, height: 40 },
  lineWidth: 2,
})

const tooltip = (line: string): TextTooltipPayload => ({
  type: 'text',
  lines: [line],
})

const everyField: AlignmentsHover = {
  overCigarItem: true,
  featureIdUnderMouse: 'read-1',
  mouseoverExtraInformation: tooltip('read-1'),
  hoverCoverageBand: { topOffset: 0, coverageHeight: 40 },
  hoveredArcHighlight: arcHighlight(10),
  hoveredJunction: junction(100),
  hoveredConnectorReadIds: ['read-1', 'read-2'],
}

const hoverFields = (display: Display) => ({
  featureIdUnderMouse: display.featureIdUnderMouse,
  mouseoverExtraInformation: display.mouseoverExtraInformation,
  overCigarItem: display.overCigarItem,
  hoverCoverageBand: display.hoverCoverageBand,
  hoveredArcHighlight: display.hoveredArcHighlight,
  hoveredJunction: display.hoveredJunction,
  hoveredConnectorReadIds: display.hoveredConnectorReadIds,
})

const noHover = {
  featureIdUnderMouse: undefined,
  mouseoverExtraInformation: undefined,
  overCigarItem: false,
  hoverCoverageBand: undefined,
  hoveredArcHighlight: undefined,
  hoveredJunction: undefined,
  hoveredConnectorReadIds: [],
}

describe('the hover clear', () => {
  test('clearMouseoverState leaves every hover field empty', () => {
    const { display } = createRpcTestEnvironment().createDisplay()
    display.setHoverState(everyField)
    expect(hoverFields(display)).toEqual(everyField)

    display.clearMouseoverState()
    expect(hoverFields(display)).toEqual(noHover)
  })

  test('a zoom under a still cursor leaves every hover field empty', () => {
    const { display, view } = createRpcTestEnvironment().createDisplay()
    view.zoomTo(10)
    display.setHoverState(everyField)
    expect(hoverFields(display)).toEqual(everyField)

    view.zoomTo(20)
    expect(hoverFields(display)).toEqual(noHover)
  })
})

describe('a mousemove that keeps what the hover lights', () => {
  function countHoverInkBuilds(display: Display) {
    let builds = 0
    const dispose = autorun(() => {
      void display.hoverInk
      builds += 1
    })
    return {
      builds: () => builds,
      dispose,
    }
  }

  test('along one connector rebuilds no hover ink', () => {
    const { display } = createRpcTestEnvironment().createDisplay()
    const ink = countHoverInkBuilds(display)
    const hoverConnector = (x: number, ends: string[]) => {
      display.setHoverState({
        overCigarItem: true,
        featureIdUnderMouse: undefined,
        mouseoverExtraInformation: tooltip(`at ${x}`),
        hoveredArcHighlight: arcHighlight(x),
        hoveredConnectorReadIds: ends,
      })
    }
    hoverConnector(10, ['read-1', 'read-2'])
    const ends = display.hoveredConnectorReadIds
    const builds = ink.builds()

    hoverConnector(11, ['read-1', 'read-2'])
    expect(display.hoveredConnectorReadIds).toBe(ends)
    expect(ink.builds()).toBe(builds)

    hoverConnector(12, ['read-3', 'read-4'])
    expect(ink.builds()).toBe(builds + 1)
    ink.dispose()
  })

  test('along one junction rebuilds no hover ink', () => {
    const { display } = createRpcTestEnvironment().createDisplay()
    const ink = countHoverInkBuilds(display)
    const hoverJunction = (x: number, start: number) => {
      display.setHoverState({
        overCigarItem: false,
        featureIdUnderMouse: undefined,
        mouseoverExtraInformation: tooltip(`at ${x}`),
        hoveredArcHighlight: arcHighlight(x),
        hoveredJunction: junction(start),
      })
    }
    hoverJunction(10, 100)
    const hovered = display.hoveredJunction
    const builds = ink.builds()

    hoverJunction(11, 100)
    expect(display.hoveredJunction).toBe(hovered)
    expect(ink.builds()).toBe(builds)

    hoverJunction(12, 200)
    expect(ink.builds()).toBe(builds + 1)
    ink.dispose()
  })

  test('off a connector and back keeps the empty connector ends', () => {
    const { display } = createRpcTestEnvironment().createDisplay()
    const empty = display.hoveredConnectorReadIds
    display.setHoverState({
      overCigarItem: false,
      featureIdUnderMouse: 'read-1',
      mouseoverExtraInformation: undefined,
    })
    expect(display.hoveredConnectorReadIds).toBe(empty)
    display.clearMouseoverState()
    expect(display.hoveredConnectorReadIds).toBe(empty)
  })
})
