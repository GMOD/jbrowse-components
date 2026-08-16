import { panelAssemblyName } from './panelAssemblyName.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'

function feat(extra: Record<string, unknown> = {}): SimpleFeatureSerialized {
  return { uniqueId: 'f1', refName: 'chr1', start: 100, end: 200, ...extra }
}

// hg38 answers to the alias GRCh38; mm10 is configured but has no aliases
const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    ({ hg38: 'hg38', GRCh38: 'hg38', mm10: 'mm10' })[name],
  has: (name: string) => ['hg38', 'mm10'].includes(name),
}

test('a feature with no assembly of its own takes the view first', () => {
  expect(
    panelAssemblyName({
      feature: feat(),
      viewAssemblyNames: ['hg38', 'mm10'],
      assemblyManager,
    }),
  ).toBe('hg38')
})

// the synteny case: the view lists both rows and the clicked ribbon is on the
// second, where the view's first would silently fetch hg38 chr1:100-200
test('a feature on the second row fetches from its own assembly', () => {
  expect(
    panelAssemblyName({
      feature: feat({ assemblyName: 'mm10' }),
      viewAssemblyNames: ['hg38', 'mm10'],
      assemblyManager,
    }),
  ).toBe('mm10')
})

test('an aliased assembly resolves to its canonical name', () => {
  expect(
    panelAssemblyName({
      feature: feat({ assemblyName: 'GRCh38' }),
      viewAssemblyNames: ['mm10'],
      assemblyManager,
    }),
  ).toBe('hg38')
})

test('an assembly the session cannot open loses to the view', () => {
  expect(
    panelAssemblyName({
      feature: feat({ assemblyName: 'nonexistent' }),
      viewAssemblyNames: ['hg38'],
      assemblyManager,
    }),
  ).toBe('hg38')
})

// the track config default is the literal string 'assemblyName', and a
// half-built view pads its list with empty strings
test.each([['assemblyName'], [''], [undefined], [42]])(
  'a degenerate assemblyName %p takes the view first',
  value => {
    expect(
      panelAssemblyName({
        feature: feat({ assemblyName: value }),
        viewAssemblyNames: ['hg38'],
        assemblyManager,
      }),
    ).toBe('hg38')
  },
)

test('no view and no feature assembly is undefined, not a crash', () => {
  expect(
    panelAssemblyName({
      feature: feat(),
      viewAssemblyNames: undefined,
      assemblyManager,
    }),
  ).toBeUndefined()
})
