import {
  rExportCommandBlock,
  renderArgLines,
  shellSingleQuote,
} from './rexportCommandText.ts'

const configArgs = [
  '--config',
  'https://example.com/config.json',
  '--spec',
  '{"views":[{"type":"LinearGenomeView"}]}',
]

test('the block names the figure in its heading, its --out and its Rscript', () => {
  const block = rExportCommandBlock('alignments_sort', configArgs)
  expect(block).toContain('### alignments_sort\n')
  expect(block).toContain('  --out alignments_sort.R')
  expect(block).toContain('Rscript alignments_sort.R')
})

// The spec is inline rather than a path, so the line pastes without saving a
// file first — which means it has to be single-quoted.
test('the session spec goes inline on one quoted line', () => {
  const block = rExportCommandBlock('genes', configArgs)
  expect(block).toContain(
    `  --spec '{"views":[{"type":"LinearGenomeView"}]}' \\`,
  )
})

test('a single quote inside a value survives the quoting', () => {
  expect(shellSingleQuote(`a'b`)).toBe(`'a'\\''b'`)
})

// `['--bam', 'reads.bam', '{json}']` is one line: the flag, its plain url
// unquoted, and the display-state JSON quoted.
test('argv regroups one flag per line, quoting only what needs it', () => {
  expect(
    renderArgLines([
      '--bam',
      'https://example.com/reads.bam',
      '{"sortedBy":{"x":1}}',
    ]),
  ).toEqual([`  --bam https://example.com/reads.bam '{"sortedBy":{"x":1}}'`])
  expect(renderArgLines(['--bam', 'a.bam', '--bam', 'b.bam'])).toEqual([
    '  --bam a.bam',
    '  --bam b.bam',
  ])
})

// A locstring's thousands separators are the everyday value that needs quoting.
test('a loc with commas is quoted', () => {
  expect(renderArgLines(['--loc', 'ctgA:1-8,000'])).toEqual([
    `  --loc 'ctgA:1-8,000'`,
  ])
})

test('a file-flag command lands whole between jb2export and --out', () => {
  const block = rExportCommandBlock('genes', [
    '--fasta',
    'https://example.com/volvox.fa',
    '--loc',
    'ctgA:17200-23200',
    '--gffgz',
    'https://example.com/volvox.sort.gff3.gz',
    '{"height":300}',
  ])
  expect(block).toContain(
    [
      'jb2export \\',
      '  --fasta https://example.com/volvox.fa \\',
      '  --loc ctgA:17200-23200 \\',
      `  --gffgz https://example.com/volvox.sort.gff3.gz '{"height":300}' \\`,
      '  --out genes.R',
    ].join('\n'),
  )
})
