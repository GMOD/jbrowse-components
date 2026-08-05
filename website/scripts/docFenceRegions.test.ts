/**
 * The doc-fence slicer, whose failure mode is a page that quietly loses half a
 * section.
 *
 * `sync-doc-snippets` compares what it produced against what the page already
 * held, so a slice that stops early rewrites the page and then agrees with
 * itself forever: the write run reports "updated", the `--check` run reports
 * "up to date", and nothing anywhere says the guide now ends mid-example. That
 * is not hypothetical — matching the first `#endregion` instead of the paired
 * one did exactly this to the no-build plugin guide's complete example.
 */
import { extractRegion, stripRegionMarkers } from './docFenceRegions.ts'

const NESTED = [
  '// a note that should not reach the guide',
  '// #region plugin',
  'export default class MyPlugin {',
  '  install(pm) {',
  '    // #region jexl',
  "    pm.jexl.addFunction('customColor', f => 'red')",
  '    // #endregion',
  '  }',
  '}',
  '// #endregion',
].join('\n')

test('a region containing a region runs to its own end', () => {
  expect(extractRegion(NESTED, 'f.js', 'plugin')).toBe(
    [
      'export default class MyPlugin {',
      '  install(pm) {',
      "    pm.jexl.addFunction('customColor', f => 'red')",
      '  }',
      '}',
    ].join('\n'),
  )
})

test('the inner region is still sliceable on its own', () => {
  expect(extractRegion(NESTED, 'f.js', 'jexl')).toBe(
    "pm.jexl.addFunction('customColor', f => 'red')",
  )
})

// Two regions at the same depth, one after the other: the first must not run on
// into the second's body.
test('a region ends at its own endregion, not the next region', () => {
  const source = [
    '// #region a',
    'const a = 1',
    '// #endregion',
    '// #region b',
    'const b = 2',
    '// #endregion',
  ].join('\n')
  expect(extractRegion(source, 'f.ts', 'a')).toBe('const a = 1')
  expect(extractRegion(source, 'f.ts', 'b')).toBe('const b = 2')
})

// The body is dedented to its own shallowest line, since a region sliced out of
// a class body would otherwise publish as a fence indented four spaces.
test('the body is dedented but keeps its internal shape', () => {
  const source = [
    '    // #region body',
    '    if (x) {',
    '      return 1',
    '    }',
    '    // #endregion',
  ].join('\n')
  expect(extractRegion(source, 'f.ts', 'body')).toBe(
    ['if (x) {', '  return 1', '}'].join('\n'),
  )
})

// Blank lines have no indentation to measure and must not drag the dedent to 0.
test('a blank line inside the body does not defeat the dedent', () => {
  const source = [
    '  // #region body',
    '  const a = 1',
    '',
    '  const b = 2',
    '  // #endregion',
  ].join('\n')
  expect(extractRegion(source, 'f.ts', 'body')).toBe(
    'const a = 1\n\nconst b = 2',
  )
})

// `#region` in a shell or python source is a `#` comment, and the shell scripts
// behind the tutorials are included the same way.
test('a # comment marker works as well as //', () => {
  const source = [
    '# #region cmd',
    'samtools index in.bam',
    '# #endregion',
  ].join('\n')
  expect(extractRegion(source, 'f.sh', 'cmd')).toBe('samtools index in.bam')
})

// Region names are matched on a word boundary, so `#region jexl` must not
// answer for `#region jexlAdvanced`.
test('a longer region name is not matched by a shorter one', () => {
  const source = [
    '// #region jexlAdvanced',
    'const advanced = 1',
    '// #endregion',
  ].join('\n')
  expect(() => extractRegion(source, 'f.ts', 'jexl')).toThrow(
    /no "#region jexl"/,
  )
})

// Both of these are how a rename or a botched edit shows up. They have to throw
// rather than return something plausible: the script turns a throw into a
// listed problem and a non-zero exit, but silently accepts any string.
test('a missing region throws, naming the file and the region', () => {
  expect(() => extractRegion('const a = 1', 'src/thing.ts', 'gone')).toThrow(
    'src/thing.ts: no "#region gone"',
  )
})

test('an unterminated region throws rather than running to EOF', () => {
  const source = ['// #region open', 'const a = 1'].join('\n')
  expect(() => extractRegion(source, 'src/thing.ts', 'open')).toThrow(
    'src/thing.ts: "#region open" has no "#endregion"',
  )
})

// A region whose endregion was deleted must not silently borrow the enclosing
// one's — that reads as a fence that grew a tail rather than as an error.
test('a nested region missing its endregion throws', () => {
  const source = [
    '// #region outer',
    'const a = 1',
    '// #region inner',
    'const b = 2',
    '// #endregion',
  ].join('\n')
  expect(() => extractRegion(source, 'f.ts', 'outer')).toThrow(
    /"#region outer" has no "#endregion"/,
  )
})

// The whole-file path: markers exist so *other* pages can slice, and would read
// as noise in a fence showing the file entire.
test('a whole-file include drops every marker and the trailing blank', () => {
  expect(stripRegionMarkers(NESTED + '\n\n')).toBe(
    [
      '// a note that should not reach the guide',
      'export default class MyPlugin {',
      '  install(pm) {',
      "    pm.jexl.addFunction('customColor', f => 'red')",
      '  }',
      '}',
    ].join('\n'),
  )
})
