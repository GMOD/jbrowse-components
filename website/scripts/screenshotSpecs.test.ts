/// <reference types="jest" />

/**
 * `validateSpecs` is the only thing standing between a mistyped spec and an
 * hour of rendering that produces a wrong-but-plausible figure, so each of its
 * rules is worth proving fires. A rule that silently matches nothing is the
 * failure mode it exists to prevent, one level up.
 *
 * The real spec list is checked separately — by check-specs.ts in `pnpm
 * check-docs`, and by generate-screenshots before it renders anything. This is
 * about the rules themselves, which is why every case here is synthetic: the
 * committed corpus is (and should stay) clean, so it can't exercise them.
 */
import {
  countDetachableLabels,
  validateSpecs,
} from './screenshot-spec-rules.ts'

import type { ScreenshotSpec } from './screenshot-spec-types.ts'

const problem = (list: ScreenshotSpec[]) => validateSpecs(list).join('\n')

test('two specs sharing a name', () => {
  expect(
    problem([
      { mode: 'url', name: 'a', url: '?x' },
      { mode: 'url', name: 'a', url: '?y' },
    ]),
  ).toMatch('two specs share this name')
})

test('a compose part that names no spec', () => {
  expect(problem([{ mode: 'compose', name: 'a', parts: ['nope'] }])).toMatch(
    'part "nope" is not a spec',
  )
})

test('a compose that lists itself', () => {
  expect(problem([{ mode: 'compose', name: 'a', parts: ['a'] }])).toMatch(
    'lists itself as a part',
  )
})

// The compose pass walks the list in order after the render pool, so a compose
// part built later is stacked from whatever its previous run left on disk.
test('a compose part that is a compose declared after it', () => {
  expect(
    problem([
      { mode: 'url', name: 'p', url: '?x' },
      { mode: 'compose', name: 'a', parts: ['b'] },
      { mode: 'compose', name: 'b', parts: ['p'] },
    ]),
  ).toMatch('declared after it')
  // the same pair the other way round is fine
  expect(
    problem([
      { mode: 'url', name: 'p', url: '?x' },
      { mode: 'compose', name: 'b', parts: ['p'] },
      { mode: 'compose', name: 'a', parts: ['b'] },
    ]),
  ).toBe('')
})

test('fields an embedded capture ignores', () => {
  const found = problem([
    {
      mode: 'embedded',
      name: 'a',
      viewState: {},
      hideTooltip: true,
      expectTooltip: true,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
  ])
  expect(found).toMatch('embedded specs ignore')
  expect(found).toMatch('hideTooltip')
  expect(found).toMatch('expectTooltip')
  expect(found).toMatch('crop')
})

test('a staged figure never draws its top-level annotations', () => {
  expect(
    problem([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        annotations: [{ type: 'box', anchor: { text: 'z' } }],
        stages: [{ actions: [] }],
      },
    ]),
  ).toMatch('top-level annotation(s) alongside stages')
  // the same annotations on the stage are the correct spelling
  expect(
    problem([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        stages: [{ annotations: [{ type: 'box', anchor: { text: 'z' } }] }],
      },
    ]),
  ).toBe('')
})

test('a stage ready gate that only a navigating stage would use', () => {
  expect(
    problem([
      { mode: 'url', name: 'a', url: '?x', stages: [{ readySelector: '#z' }] },
    ]),
  ).toMatch('readySelector without url')
  expect(
    problem([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        stages: [{ url: '?y', readySelector: '#z' }],
      },
    ]),
  ).toBe('')
})

test('contradictory tooltip flags, and stageColumns with no stages', () => {
  expect(
    problem([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        expectTooltip: true,
        hideTooltip: true,
      },
    ]),
  ).toMatch('contradict each other')
  expect(
    problem([{ mode: 'url', name: 'a', url: '?x', stageColumns: 2 }]),
  ).toMatch('stageColumns without stages')
})

test('the ordinary spec shapes are quiet', () => {
  expect(
    problem([
      { mode: 'url', name: 'a', url: '?x' },
      { mode: 'embedded', name: 'b', viewState: {} },
      { mode: 'cli', name: 'jbrowse-img/c', args: ['--width', '1'] },
      { mode: 'compose', name: 'd', parts: ['a', 'b'] },
    ]),
  ).toBe('')
})

// ── the detached-label ratchet ──
//
// The pairing is by ANCHOR, so what has to be proved is that it fires on the
// authored pair and stays quiet on an arrow that merely shares a figure with a
// pill. A ratchet that matches everything is as useless as one that matches
// nothing, and both look like a passing check.
const site = { track: 't', locus: 'ctgA:100' }
const labels = (list: ScreenshotSpec[]) => countDetachableLabels(list).found

test('a pill and the arrow leaving it', () => {
  expect(
    labels([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        annotations: [
          { type: 'text', text: 'LCT', anchor: { ...site, dx: 150 } },
          {
            type: 'arrow',
            anchor: { ...site, dx: 14 },
            fromAnchor: { ...site, dx: 88 },
          },
        ],
      },
    ]),
  ).toEqual(['a: "LCT"'])
})

test('a pill that draws its own arrow is the fix, not a pair', () => {
  expect(
    labels([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        annotations: [
          {
            type: 'text',
            text: 'LCT',
            leader: true,
            anchor: site,
            dx: 150,
          },
        ],
      },
    ]),
  ).toEqual([])
})

test('an arrow that starts somewhere else is not this pattern', () => {
  expect(
    labels([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        annotations: [
          { type: 'text', text: 'LCT', anchor: { ...site, dx: 150 } },
          {
            type: 'arrow',
            anchor: { ...site, dx: 14 },
            fromAnchor: { track: 't', locus: 'ctgA:900' },
          },
        ],
      },
    ]),
  ).toEqual([])
})

test('it reaches a stage, where a figure keeps half its callouts', () => {
  expect(
    labels([
      {
        mode: 'url',
        name: 'a',
        url: '?x',
        stages: [
          {
            annotations: [
              { type: 'text', text: 'sorted', anchor: { ...site, dx: 150 } },
              { type: 'arrow', fromAnchor: { ...site, dx: 88 } },
            ],
          },
        ],
      },
    ]),
  ).toEqual(['a stage 0: "sorted"'])
})
