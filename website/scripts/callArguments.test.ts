/// <reference types="jest" />
// Same tsconfig situation as shellCommands.test.ts: without the reference
// above, every `test`/`expect` here reads as an undefined name under
// `astro check`.

/**
 * The Python/R snippet parser behind `check-script-commands`, whose failure
 * mode is a guard that passes because it found nothing.
 *
 * `shellCommands.test.ts` makes the argument at length for the bash side, and
 * it applies here unchanged: an empty result reports "every marked call still
 * runs" on a page whose calls no longer do. The two languages meet in one
 * parser, so both spellings of every case are pinned.
 */
import { callsAndArgs } from './callArguments.ts'

test('a python call yields its callee and keyword names', () => {
  expect(
    callsAndArgs(
      'snap.ex.export_coverage(adata, groupby="cell_type", bin_size=25)',
    ),
  ).toEqual([
    { callee: 'snap.ex.export_coverage', args: ['groupby', 'bin_size'] },
  ])
})

test('an R call yields the same, spaces and namespace included', () => {
  expect(
    callsAndArgs('se <- satuRn::fitDTU(object = se, formula = ~ 0 + tissue)'),
  ).toEqual([{ callee: 'satuRn::fitDTU', args: ['object', 'formula'] }])
})

test('a nested call keeps its own arguments', () => {
  // Regression shape: `formula`'s value holds a call, and reading the inner
  // call's names as the outer one's would fail the outer against the script.
  expect(
    callsAndArgs('testDTU(object = se, contrasts = makeContrasts(levels = d))'),
  ).toEqual([
    { callee: 'testDTU', args: ['object', 'contrasts'] },
    { callee: 'makeContrasts', args: ['levels'] },
  ])
})

test('a comparison is not a named argument', () => {
  // `==`, `>=` and R's `<-` all end in or begin with `=`, and reading one as an
  // argument name invents a flag the script can never have.
  expect(
    callsAndArgs('subset(x, fdr <= 0.05, keep == 1, drop = TRUE)')[0]!.args,
  ).toEqual(['drop'])
  expect(callsAndArgs('f(a != 1, b >= 2, out = "x")')[0]!.args).toEqual(['out'])
})

test('an = inside a string or a bracket is not an argument name', () => {
  expect(
    callsAndArgs('fetch(url="https://x.org/api?db=BXD&method=gemma")'),
  ).toEqual([{ callee: 'fetch', args: ['url'] }])
  expect(callsAndArgs('f(cols[key=1], out = 2)')[0]!.args).toEqual(['out'])
})

test('a definition is not a call', () => {
  expect(callsAndArgs('def label(row, sep="_"):\n    return row')).toEqual([])
  expect(callsAndArgs('label <- function(row, sep = "_") row')).toEqual([])
})

test('comments are dropped outside quotes and kept inside them', () => {
  expect(callsAndArgs('# fitDTU(object = se)')).toEqual([])
  expect(callsAndArgs('fitDTU(object = se)  # the fit')).toEqual([
    { callee: 'fitDTU', args: ['object'] },
  ])
  expect(callsAndArgs('load(path="K12#1#chr", strict=True)')[0]!.args).toEqual([
    'path',
    'strict',
  ])
})

test('library loads and printing contribute no call', () => {
  expect(
    callsAndArgs('library(satuRn)\nprint(len(x))\ncat("n:", nrow(x))'),
  ).toEqual([{ callee: 'nrow', args: [] }])
})

test('callsAndArgs never silently swallows a snippet', () => {
  // The guard on the guard: whatever the parsing details, a snippet holding
  // calls must not come back empty.
  const snippet = [
    'keep <- edgeR::filterByExpr(cnt, group = coldata$tissue)',
    'se <- satuRn::fitDTU(object = se, formula = ~ 0 + tissue, parallel = FALSE)',
    'L <- limma::makeContrasts(muscle_vs_liver = muscle - liver, levels = design)',
    'se <- satuRn::testDTU(object = se, contrasts = L, sort = FALSE)',
  ].join('\n')
  expect(callsAndArgs(snippet).map(c => c.callee)).toEqual([
    'edgeR::filterByExpr',
    'satuRn::fitDTU',
    'limma::makeContrasts',
    'satuRn::testDTU',
  ])
  expect(callsAndArgs(snippet)[1]!.args).toEqual([
    'object',
    'formula',
    'parallel',
  ])
})
