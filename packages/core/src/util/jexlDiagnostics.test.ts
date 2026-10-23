import createJexlInstance from './jexl.ts'
import {
  expressionKind,
  jexlProblemText,
  jexlProblems,
  registeredFunctions,
} from './jexlDiagnostics.ts'
import { filterFieldSchema } from './jexlFilterFields.ts'

const jexl = createJexlInstance()

test('every registered function takes any arguments', () => {
  const functions = registeredFunctions(jexl)
  expect(functions.get).toEqual({
    params: ['any'],
    variadic: true,
    optional: 1,
  })
  expect(functions.startsWith).toBeDefined()
  expect(functions.map).toBeDefined()
})

test('a well-formed expression has no problems', () => {
  expect(
    jexlProblems(
      "jexl:startsWith(get(feature,'name'),'BR') && feature.score > 4",
      jexl,
    ),
  ).toEqual([])
})

test('a syntax error says the column in the text as given', () => {
  const [problem] = jexlProblems('  jexl:feature.score >', jexl)
  expect(problem).toEqual({
    severity: 'error',
    message: expect.stringContaining('Unexpected end of expression'),
    column: 23,
  })
  expect(jexlProblemText('Line 2', problem!)).toMatch(
    /^Line 2: Unexpected end of expression: feature.score > \(column 23\)$/,
  )
})

test('a misspelt function is an error that names the registered one', () => {
  expect(jexlProblems("startWith(get(feature,'name'), 'BR')", jexl)).toEqual([
    {
      severity: 'error',
      message: expect.stringMatching(
        /^no function startWith; did you mean .*startsWith/,
      ),
    },
  ])
})

test('a schema finds an undeclared category, a call any argument count', () => {
  const schema = filterFieldSchema([
    { label: 'type', path: ['type'], type: 'text', values: ['gene', 'mRNA'] },
  ])
  expect(
    jexlProblems(
      "get(feature,'type') == 'gen' && max(1, 2, 3) > 0",
      jexl,
      schema,
    ),
  ).toEqual([
    {
      severity: 'warning',
      message: expect.stringContaining("did you mean 'gene'?"),
    },
  ])
})

// & is jexl's own, so every parser reads it, and it binds tighter than ==
test('a flag test reads as it is written, in every reader', () => {
  const flags = (value: number) =>
    jexl.eval('feature.flags & 16 == 0', { feature: { flags: value } })
  expect(flags(16)).toBe(false)
  expect(flags(2)).toBe(true)
  expect(jexlProblems('jexl:feature.flags & 2', jexl)).toEqual([])
  expect(expressionKind('jexl:feature.flags & 2')).toBe('numeric')
})
