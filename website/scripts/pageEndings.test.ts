import { pageEndingProblems } from './page-endings.ts'

const page = (...sections: string[]) =>
  ['# Title', '', 'Body.', '', ...sections].join('\n')

test('the three closing sections in order pass', () => {
  expect(
    pageEndingProblems(
      page(
        '## See also\n\n- [](/docs/tutorials/rnaseq)\n- [LGV storybook](https://jbrowse.org/storybook/lgv/)\n',
        '## External links\n\n- [pggb](https://github.com/pangenome/pggb)\n',
        '## Citations\n\n- Li H. (2018) https://doi.org/10.1093/bioinformatics/bty191\n',
        '[^note]: A footnote.',
      ),
    ),
  ).toEqual([])
})

test('a References section is retired', () => {
  expect(pageEndingProblems(page('## References\n\n- Li H. (2018)\n'))).toEqual(
    [expect.stringContaining('## References')],
  )
})

test('the sections keep their order and nothing follows them', () => {
  expect(
    pageEndingProblems(
      page('## Citations\n\n- x\n', '## See also\n\n- [](/docs/a)\n'),
    ),
  ).toEqual([expect.stringContaining('out of order')])
  expect(
    pageEndingProblems(page('## See also\n\n- [](/docs/a)\n', '## Build it\n')),
  ).toEqual([expect.stringContaining('## Build it after the closing sections')])
})

test('See also links only pages on jbrowse.org', () => {
  expect(
    pageEndingProblems(
      page('## See also\n\n- [HiGlass](https://higlass.io/)\n'),
    ),
  ).toEqual([expect.stringContaining('move it to External links')])
})

test('a See also bullet does not type the kind the build adds', () => {
  expect(
    pageEndingProblems(
      page('## See also\n\n- **Tutorial:** [](/docs/tutorials/rnaseq)\n'),
    ),
  ).toEqual([expect.stringContaining('types its own kind prefix')])
})
