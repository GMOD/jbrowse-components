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
import { validateSpecs } from './screenshot-spec-rules.ts'

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
