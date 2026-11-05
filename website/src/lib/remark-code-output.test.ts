import remarkCodeOutput, { OUTPUT_CLASS } from './remark-code-output.ts'

import type { Code, Root, RootContent } from 'mdast'

function fence(lang: string, meta: string | null = null): Code {
  return { type: 'code', lang, meta, value: 'x' }
}

function tagged(children: RootContent[]) {
  const tree: Root = { type: 'root', children }
  const transform = remarkCodeOutput.call(undefined as never) as (
    tree: Root,
  ) => void
  transform(tree)
  return children.map(c =>
    c.type === 'code' && c.data?.hProperties?.className
      ? String(c.data.hProperties.className)
      : '',
  )
}

const prose: RootContent = {
  type: 'paragraph',
  children: [{ type: 'text', value: 'then' }],
}

test('an output fence under a command is tagged', () => {
  expect(tagged([fence('bash'), fence('text', 'output')])).toEqual([
    '',
    OUTPUT_CLASS,
  ])
})

test('an output fence with prose above it stays a plain block', () => {
  expect(tagged([fence('bash'), prose, fence('text', 'output')])).toEqual([
    '',
    '',
    '',
  ])
})

test('a second output fence in a row stays a plain block', () => {
  expect(
    tagged([fence('bash'), fence('text', 'output'), fence('text', 'output')]),
  ).toEqual(['', OUTPUT_CLASS, ''])
})

test('a plain text fence under a command is not tagged', () => {
  expect(tagged([fence('bash'), fence('text')])).toEqual(['', ''])
})
