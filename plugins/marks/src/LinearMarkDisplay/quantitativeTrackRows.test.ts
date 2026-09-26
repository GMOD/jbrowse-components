import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
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
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

interface DisplaySnapshot {
  type: string
  marks?: MarkSnapshot[]
  facet?: FacetSnapshot
  rows?: RowsSnapshot
}

const BARS = [{ mark: 'bar', encoding: { y: 'score' } }]

function loadedTrack(snap: Record<string, unknown>) {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new WigglePlugin(),
    new MarksPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager.pluggableConfigSchemaType('track').create(
    {
      trackId: 't',
      assemblyNames: ['volvox'],
      adapter: { type: 'BigWigAdapter', uri: 'a.bw' },
      ...snap,
    },
    { pluginManager },
  )
}

function loadedDisplays(snap: Record<string, unknown>) {
  return (getSnapshot(loadedTrack(snap)) as { displays: DisplaySnapshot[] })
    .displays
}

function rowsFields(snap: Record<string, unknown>) {
  return loadedTrack(snap).displays.map((d: AnyConfigurationModel) => [
    readConfObject(d, 'type'),
    readConfObject(d, ['rows', 'field']),
  ])
}

test("a MultiQuantitativeTrack's row per source reaches its quantitative display alone", () => {
  expect(rowsFields({ type: 'MultiQuantitativeTrack' })).toEqual([
    ['LinearWiggleDisplay', 'source'],
    ['LinearMarkDisplay', ''],
  ])
  expect(
    loadedDisplays({ type: 'MultiQuantitativeTrack' }).map(d => d.rows),
  ).toEqual([undefined, undefined])
})

test('a mark display faceted by strand on a MultiQuantitativeTrack carries no rows to report', () => {
  const snap = {
    type: 'MultiQuantitativeTrack',
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: 'm',
        facet: 'strand',
        marks: BARS,
      },
    ],
  }
  const [mark] = loadedDisplays(snap)
  expect(mark!.rows).toBeUndefined()
  expect(rowsFields(snap)).toEqual([
    ['LinearMarkDisplay', ''],
    ['LinearWiggleDisplay', 'source'],
  ])
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
