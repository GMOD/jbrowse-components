import { SimpleFeature } from '@jbrowse/core/util'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { render, screen } from '@testing-library/react'
import { when } from 'mobx'

import LinearArcReactComponent from '../LinearArcDisplay/components/ReactComponent.tsx'
import {
  createPairedTestEnvironment,
  createTestEnvironment,
} from './testEnv.ts'

function feat(
  uniqueId: string,
  end: number,
  data: Record<string, unknown> = {},
) {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgA',
    start: 100,
    end,
    ...data,
  })
}

// The legend spells every colour as the packed form's rgba, the way the
// worker-painted keys do.
const css = (color: string) => abgrToCssRgba(cssColorToABGR(color))

test('a string colour paints every arc alike, and a jexl callback paints per feature', () => {
  const { display } = createTestEnvironment({
    color: 'green',
    thickness: 2,
  }).createDisplay()
  display.setFeatures([feat('a', 2000, { strand: 1 })])
  expect(display.arcStyles!.map(s => s.paint)).toEqual([{ color: 'green' }])
  expect(display.colorScales).toEqual([])
  expect(display.hasLegendKey).toBe(false)

  const { display: perFeature } = createTestEnvironment({
    color: "jexl:feature.strand==-1?'red':'blue'",
    thickness: 2,
  }).createDisplay()
  perFeature.setFeatures([
    feat('a', 2000, { strand: 1 }),
    feat('b', 3000, { strand: -1 }),
  ])
  expect(perFeature.arcStyles!.map(s => s.paint.color)).toEqual(['blue', 'red'])
})

test('a field paints each arc by its value, and the key lists the values painted', () => {
  const { display } = createTestEnvironment({
    color: { field: 'strand' },
    thickness: 2,
  }).createDisplay()
  display.setFeatures([
    feat('a', 2000, { strand: 1 }),
    feat('b', 3000, { strand: -1 }),
    feat('c', 4000, { strand: 1 }),
  ])
  expect(display.arcStyles!.map(s => s.paint)).toEqual([
    { key: '1', color: 'tomato' },
    { key: '-1', color: 'cornflowerblue' },
    { key: '1', color: 'tomato' },
  ])
  expect(display.laidOutArcs.map(a => a.color)).toEqual([
    'tomato',
    'cornflowerblue',
    'tomato',
  ])
  const [key] = display.colorScales
  expect(key).toMatchObject({ kind: 'categorical', title: 'strand' })
  expect(
    key!.kind === 'categorical' && key!.entries.map(e => [e.label, e.color]),
  ).toEqual([
    ['Forward strand', css('tomato')],
    ['Reverse strand', css('cornflowerblue')],
  ])
  expect(display.hasLegendKey).toBe(true)
  expect(
    display
      .trackMenuItems()
      .some(item => 'label' in item && /legend/i.test(String(item.label))),
  ).toBe(true)
})

test('a threshold over a number paints each interval, and the key lists every interval, painted or not', () => {
  const { display } = createTestEnvironment({
    color: {
      field: 'score',
      scale: 'threshold',
      domain: ['10'],
      range: ['#aaaaaa', '#bbbbbb'],
    },
    thickness: 2,
  }).createDisplay()
  display.setFeatures([feat('b', 3000, { score: 50 })])
  expect(display.arcStyles!.map(s => s.paint.color)).toEqual(['#bbbbbb'])
  const [key] = display.colorScales
  expect(key!.kind === 'categorical' && key!.entries.map(e => e.label)).toEqual(
    ['< 10', '≥ 10'],
  )
})

test('scale none beside a field paints value and offers no key', () => {
  const { display } = createTestEnvironment({
    color: { value: 'green', field: 'strand', scale: 'none' },
    thickness: 2,
  }).createDisplay()
  display.setFeatures([
    feat('a', 2000, { strand: 1 }),
    feat('b', 3000, { strand: -1 }),
  ])
  expect(display.arcStyles!.map(s => s.paint)).toEqual([
    { color: 'green' },
    { color: 'green' },
  ])
  expect(display.colorScales).toEqual([])
  expect(display.hasLegendKey).toBe(false)
})

test('a legacy renderer colour hoists into the object and paints', () => {
  const { display } = createTestEnvironment({
    renderer: { type: 'ArcRenderer', color: 'green' },
    thickness: 2,
  }).createDisplay()
  expect(display.conf.color.value).toBe('green')
  display.setFeatures([feat('a', 2000)])
  expect(display.arcStyles![0]!.paint).toEqual({ color: 'green' })
})

// Two ends apart, since two records over one pair of ends are one arc.
const sv = (id: string, svtype: string, end: number) =>
  new SimpleFeature({
    uniqueId: id,
    refName: 'ctgA',
    start: 1000,
    end,
    ALT: [`<${svtype}>`],
    INFO: { SVTYPE: svtype },
  })

test('the paired display colours by SV type unless a field is bound, which reads the record', () => {
  const { display } = createPairedTestEnvironment().createDisplay()
  display.setFeatures([sv('a', 'DEL', 5000), sv('b', 'DUP', 7000)])
  const [del, dup] = display.arcStyles!.map(s => s.paint)
  expect(del!.key).toBeUndefined()
  expect(del!.color).not.toBe(dup!.color)
  expect(display.colorScales).toEqual([])

  const { display: byField } = createPairedTestEnvironment({
    color: { field: 'INFO.SVTYPE' },
  }).createDisplay()
  byField.setFeatures([sv('a', 'DEL', 5000), sv('b', 'DUP', 7000)])
  expect(byField.arcStyles!.map(s => s.paint.key)).toEqual(['DEL', 'DUP'])
  const [key] = byField.colorScales
  expect(key!.kind === 'categorical' && key!.entries.map(e => e.label)).toEqual(
    ['DEL', 'DUP'],
  )
})

test('the paired display takes the jexl string shorthand, whose callback sees alt', () => {
  const { display } = createPairedTestEnvironment({
    color: "jexl:alt=='<DEL>'?'red':'blue'",
  }).createDisplay()
  display.setFeatures([sv('a', 'DEL', 5000), sv('b', 'DUP', 7000)])
  expect(display.arcStyles!.map(s => s.paint)).toEqual([
    { color: 'red' },
    { color: 'blue' },
  ])
  expect(display.colorScales).toEqual([])
})

test('the status chrome places the key, and Show legend takes it away', () => {
  const { display } = createTestEnvironment({
    color: { field: 'strand' },
    thickness: 2,
  }).createDisplay()
  display.setFeatures([
    feat('a', 2000, { strand: 1 }),
    feat('b', 3000, { strand: -1 }),
  ])
  const { rerender } = render(<LinearArcReactComponent model={display} />)
  expect(screen.getByTestId('floating-legend')).toBeTruthy()
  display.setShowLegend(false)
  rerender(<LinearArcReactComponent model={display} />)
  expect(screen.queryByTestId('floating-legend')).toBeNull()
})

test('showLegend false in config holds the key back until Show legend', () => {
  const { display } = createTestEnvironment({
    color: { field: 'strand' },
    showLegend: false,
    thickness: 2,
  }).createDisplay()
  display.setFeatures([
    feat('a', 2000, { strand: 1 }),
    feat('b', 3000, { strand: -1 }),
  ])
  expect(display.hasLegendKey).toBe(true)
  const { rerender } = render(<LinearArcReactComponent model={display} />)
  expect(screen.queryByTestId('floating-legend')).toBeNull()
  display.setShowLegend(true)
  rerender(<LinearArcReactComponent model={display} />)
  expect(screen.getByTestId('floating-legend')).toBeTruthy()
})

test('the export carries the key beside the arcs', async () => {
  const { display } = createTestEnvironment({
    color: { field: 'strand' },
    thickness: 2,
  }).createDisplay()
  // the harness's fetch answers no features; let it land before the test's
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    feat('a', 2000, { strand: 1 }),
    feat('b', 3000, { strand: -1 }),
  ])
  const { container } = render(<svg>{await display.renderSvg()}</svg>)
  expect(container.querySelectorAll('path').length).toBeGreaterThan(0)
  expect(container.querySelector('[data-testid="color-legend"]')).toBeTruthy()
})
