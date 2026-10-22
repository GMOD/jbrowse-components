import { unwrapBold } from './unwrap-bold.ts'

test('a bold span split across lines is joined onto its first line', () => {
  expect(unwrapBold('Pick **Color by... →\nStrand** now.\nNext line.')).toEqual(
    [
      { line: 0, text: 'Pick **Color by... → Strand** now.' },
      { line: 2, text: 'Next line.' },
    ],
  )
})

test('a blank line or a fence stops the join', () => {
  expect(unwrapBold('a **b\n\nc** d').map(l => l.line)).toEqual([0, 1, 2])
  expect(unwrapBold('a **b\n```\nc** d\n```').map(l => l.line)).toEqual([
    0, 1, 2, 3,
  ])
})

test('fenced lines are never joined', () => {
  expect(unwrapBold('```python\nf(**kw)\ng()\n```')).toHaveLength(4)
})
