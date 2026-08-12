import { syntenyCenterTargets } from './centerOnFeature.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const row = (assemblyName: string) =>
  ({ assemblyNames: [assemblyName] }) as unknown as LinearGenomeViewModel

const grape = row('grape')
const peach = row('peach')

const feat = {
  uniqueId: 'f1',
  refName: 'chr1',
  start: 1000,
  end: 2000,
  assemblyName: 'grape',
  mate: {
    refName: 'Pp01',
    start: 5000,
    end: 6000,
    assemblyName: 'peach',
  },
} as unknown as SimpleFeatureSerialized

test('a ribbon click centers the two rows its band was drawn between', () => {
  const { targets, missing } = syntenyCenterTargets({
    views: [grape, peach],
    level: 0,
    feat,
  })
  expect(targets.map(t => t.view)).toEqual([grape, peach])
  expect(targets.map(t => t.loc.refName)).toEqual(['chr1', 'Pp01'])
  expect(missing).toEqual([])
})

test('a level names rows by position, not by assembly', () => {
  // A three-row stack whose bottom row repeats an assembly. Matching on the
  // assemblies would center rows 0 and 1; the band was drawn between 1 and 2,
  // and only the level says so.
  const grapeAgain = row('grape')
  const { targets } = syntenyCenterTargets({
    views: [grape, peach, grapeAgain],
    level: 1,
    feat,
  })
  expect(targets.map(t => t.view)).toEqual([peach, grapeAgain])
})

// `level` is optional on the widget model, so a widget that names a synteny
// view without one — a restored session from before that property — falls back
// to matching rows by assembly.
test('with no level the rows are matched by assembly', () => {
  const { targets, missing } = syntenyCenterTargets({
    views: [peach, grape],
    level: undefined,
    feat,
  })
  expect(targets.map(t => t.view)).toEqual([grape, peach])
  expect(missing).toEqual([])
})

test('a side with no row is reported rather than skipped', () => {
  const { targets, missing } = syntenyCenterTargets({
    views: [grape],
    level: undefined,
    feat,
  })
  expect(targets.map(t => t.view)).toEqual([grape])
  // the assembly is named too, which is the half that says why no row matched
  expect(missing).toEqual([
    'Unable to find {peach}Pp01:5,001..6,000 in synteny view',
  ])
})

// A row removed since the widget was opened used to be skipped in silence,
// because the `level` path indexed it with `?.` and said nothing.
test('a level pointing past the rows is reported', () => {
  const { targets, missing } = syntenyCenterTargets({
    views: [grape, peach],
    level: 5,
    feat,
  })
  expect(targets).toEqual([])
  expect(missing).toHaveLength(2)
})

// A non-synteny adapter under a synteny display produces a feature with no
// mate. Centering the one side it has beats `navTo(undefined)`.
test('a feature with no mate contributes one side', () => {
  const { targets, missing } = syntenyCenterTargets({
    views: [grape, peach],
    level: 0,
    feat: { ...feat, mate: undefined },
  })
  expect(targets.map(t => t.view)).toEqual([grape])
  expect(missing).toEqual([])
})
