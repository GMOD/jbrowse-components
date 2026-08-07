import {
  rExportCommandBlock,
  renderExtraArgs,
  shellSingleQuote,
} from './rexportCommandText.ts'

const invocation = {
  configUrl: 'https://example.com/config.json',
  sessionSpec: '{\n "views": [{ "type": "LinearGenomeView" }]\n}',
  extraArgs: [],
}

test('the block names the figure in its heading, its --out and its Rscript', () => {
  const block = rExportCommandBlock('alignments_sort', invocation)
  expect(block).toContain('### alignments_sort\n')
  expect(block).toContain('  --out alignments_sort.R')
  expect(block).toContain('Rscript alignments_sort.R')
})

// The spec is inline rather than a path, so the line pastes without saving a
// file first — which means it has to be compacted and single-quoted.
test('the session spec goes inline on one quoted line', () => {
  const block = rExportCommandBlock('genes', invocation)
  expect(block).toContain(
    `  --spec '{"views":[{"type":"LinearGenomeView"}]}' \\`,
  )
})

test('a single quote inside a value survives the quoting', () => {
  expect(shellSingleQuote(`a'b`)).toBe(`'a'\\''b'`)
})

// `['--track', 'id', '{json}']` is one line: the flag, its plain trackId
// unquoted, and the display-state JSON quoted.
test('extra argv regroups one flag per line, quoting only what needs it', () => {
  expect(
    renderExtraArgs(['--track', 'volvox_bam', '{"sortedBy":{"x":1}}']),
  ).toEqual([`  --track volvox_bam '{"sortedBy":{"x":1}}'`])
  expect(renderExtraArgs(['--track', 'a', '--track', 'b'])).toEqual([
    '  --track a',
    '  --track b',
  ])
})

test('extra argv lands between --spec and --out, each line continued', () => {
  const block = rExportCommandBlock('sorted', {
    ...invocation,
    extraArgs: ['--track', 'volvox_bam', '{"sortedBy":{"pos":1}}'],
  })
  expect(block).toContain(
    `  --track volvox_bam '{"sortedBy":{"pos":1}}' \\\n  --out sorted.R`,
  )
})
