import { builtUrl, staleEsmImport, transitionGroup } from './resolve.ts'

test('rewrites the react-transition-group subpath dirs', () => {
  expect(transitionGroup('react-transition-group/TransitionGroupContext')).toBe(
    'react-transition-group/esm/TransitionGroupContext.js',
  )
  expect(transitionGroup('react-transition-group')).toBe(
    'react-transition-group',
  )
})

test('leaves jbrowse-img own source alone', () => {
  expect(
    builtUrl('file:///repo/products/jbrowse-img/src/renderRegion.ts'),
  ).toBeUndefined()
})

test('names a stale esm/ when one of its modules has gone', () => {
  expect(
    staleEsmImport(
      './models/installPrerequisiteFetch.js',
      'file:///repo/plugins/linear-genome-view/esm/BaseLinearDisplay/index.js',
    )?.message,
  ).toContain('pnpm build:esm --force')
})

test('leaves an unrelated resolve failure to node', () => {
  expect(
    staleEsmImport(
      'some-missing-package',
      'file:///repo/products/jbrowse-img/src/bin.ts',
    ),
  ).toBeUndefined()
  expect(
    staleEsmImport(
      './gone.js',
      'file:///repo/node_modules/a-dep/packages/core/esm/index.js',
    ),
  ).toBeUndefined()
  expect(staleEsmImport('./gone.js', undefined)).toBeUndefined()
})
