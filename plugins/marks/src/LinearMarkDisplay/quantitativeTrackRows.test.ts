import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import MarksPlugin from '../index.ts'
import { markProblems } from './markProblems.ts'

import type {
  FacetSnapshot,
  MarkSnapshot,
  RowsSnapshot,
} from './markProblems.ts'

interface DisplaySnapshot {
  type: string
  marks?: MarkSnapshot[]
  facet?: FacetSnapshot
  rows?: RowsSnapshot
}

const BARS = [{ mark: 'bar', encoding: { y: 'score' } }]

function loadedDisplays(snap: Record<string, unknown>) {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new WigglePlugin(),
    new MarksPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const conf = pluginManager.pluggableConfigSchemaType('track').create(
    {
      trackId: 't',
      assemblyNames: ['volvox'],
      adapter: { type: 'BigWigAdapter', uri: 'a.bw' },
      ...snap,
    },
    { pluginManager },
  )
  return (getSnapshot(conf) as { displays: DisplaySnapshot[] }).displays
}

test("a MultiQuantitativeTrack's seeded rows reach its quantitative display alone", () => {
  expect(
    loadedDisplays({ type: 'MultiQuantitativeTrack' }).map(d => [
      d.type,
      d.rows,
    ]),
  ).toEqual([
    ['LinearWiggleDisplay', { field: 'source' }],
    ['LinearMarkDisplay', undefined],
  ])
})

test('a mark display faceted by strand on a MultiQuantitativeTrack carries no rows to report', () => {
  const [mark, wiggle] = loadedDisplays({
    type: 'MultiQuantitativeTrack',
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: 'm',
        facet: 'strand',
        marks: BARS,
      },
    ],
  })
  expect(mark!.rows).toBeUndefined()
  expect(wiggle).toMatchObject({
    type: 'LinearWiggleDisplay',
    rows: { field: 'source' },
  })
  expect(markProblems(mark!.marks ?? [], mark!.facet, [], mark!.rows)).toEqual(
    [],
  )
})

test('displayDefaults.rows on another field fails the load for the quantitative display', () => {
  expect(() =>
    loadedDisplays({
      type: 'QuantitativeTrack',
      displayDefaults: { rows: 'group' },
    }),
  ).toThrow(/a quantitative display puts "source" alone on rows/)
})
