import { assertValidAnnotations } from './annotationSpec.ts'

import type { Annotation } from './annotationOverlay.ts'

const anchor = { selector: '#a' }

test('callouts that draw pass', () => {
  expect(() => {
    assertValidAnnotations([
      { type: 'arrow', fromAnchor: anchor, to: { x: 1, y: 2 } },
      { type: 'arrow', from: { x: 0, y: 0 }, anchor },
      { type: 'box', anchor },
      { type: 'box', x: 1, y: 1, width: 5, height: 5 },
      { type: 'circle', x: 1, y: 1 },
      { type: 'text', text: 'hi', anchor },
      { type: 'legend', entries: [{ label: 'a', color: 'red' }], x: 1, y: 1 },
      { type: 'trapezoid', anchor, fromAnchor: anchor },
    ])
  }).not.toThrow()
})

test.each<[string, Annotation, string]>([
  ['an arrow with no tail', { type: 'arrow', anchor }, 'a head and a tail'],
  [
    'an arrow with no head',
    { type: 'arrow', fromAnchor: anchor },
    'a head and a tail',
  ],
  ['a box placed nowhere', { type: 'box' }, 'a box needs'],
  ['a box with no size', { type: 'box', x: 1, y: 1 }, 'a box needs'],
  [
    'a box with no position',
    { type: 'box', width: 5, height: 5 },
    'a box needs',
  ],
  [
    'an unknown type',
    { type: 'squiggle' } as unknown as Annotation,
    'type "squiggle" is not one of arrow, box',
  ],
  ['a text with no words', { type: 'text', anchor }, 'a text needs'],
  ['a legend with no entries', { type: 'legend', anchor }, 'a legend needs'],
  ['a trapezoid with one end', { type: 'trapezoid', anchor }, 'both anchor'],
])('%s is refused', (_name, annotation, why) => {
  expect(() => {
    assertValidAnnotations([annotation])
  }).toThrow(why)
})

test('each bad callout is named by position', () => {
  expect(() => {
    assertValidAnnotations([
      { type: 'box', anchor },
      { type: 'box' },
      { type: 'text' },
    ])
  }).toThrow(/annotation 1: .*annotation 2: /)
})

test('an anchor key the overlay does not read is refused, not ignored', () => {
  expect(() => {
    assertValidAnnotations([
      { type: 'box', anchor: { track: 't', locus: 'chr1:1-2' } } as Annotation,
    ])
  }).toThrow('anchor key(s) track, locus not recognized')
})
