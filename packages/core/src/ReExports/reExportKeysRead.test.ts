import { reExportKeysRead } from './reExportKeysRead.ts'

test('reads the keys every bundler shape spells as a literal', () => {
  const esbuild =
    'var y=JBrowseExports["@jbrowse/core/Plugin"];var P=JBrowseExports[\'@jbrowse/core/util\']'
  const minified =
    't(e.JBrowsePluginApollo={},e.JBrowseExports[`@mui/material`],e.JBrowseExports.mobx,e.JBrowseExports.react)'
  expect([...reExportKeysRead(`${esbuild};${minified}`)!].sort()).toEqual([
    '@jbrowse/core/Plugin',
    '@jbrowse/core/util',
    '@mui/material',
    'mobx',
    'react',
  ])
})

test('a bundle that reads nothing reads no keys', () => {
  expect(reExportKeysRead('self.JBrowsePluginUrl={default:class{}}')).toEqual(
    new Set(),
  )
})

test.each([
  ['a computed key', 'var k="react";JBrowseExports[k]'],
  ['a template with a substitution', 'JBrowseExports[`@jbrowse/${x}`]'],
  ['the global passed whole', 'register(JBrowseExports)'],
  ['a mention outside a read', 'throw new Error("JBrowseExports missing")'],
  ['jbrequire', 'JBrowseExports.react;pluginManager.jbrequire(lib)'],
])('cannot say for %s', (_, text) => {
  expect(reExportKeysRead(text)).toBeUndefined()
})
