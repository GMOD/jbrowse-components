import { JexlSyntaxError, check } from '@jbrowse/jexl'

import { stripJexlPrefix } from './jexlFilterFields.ts'

import type { FieldSchema, Jexl, Severity, Signature } from '@jbrowse/jexl'

export interface JexlProblem {
  severity: Severity
  message: string
  /** 1-based, in the text as given, for a syntax error */
  column?: number
}

export type JexlChecker = Pick<Jexl, 'parse' | '_grammar'>

const ANY_ARGUMENTS: Signature = {
  params: ['any'],
  variadic: true,
  optional: 1,
}

/**
 * Every function `jexl` registers, each taking any arguments, so `check`
 * reports a misspelt name without judging a registered one's arity.
 */
export function registeredFunctions(jexl: Pick<Jexl, '_grammar'>) {
  return Object.fromEntries(
    Object.keys(jexl._grammar.functions).map(name => [name, ANY_ARGUMENTS]),
  )
}

/**
 * What is wrong with a jexl expression over `feature`, written with or
 * without its `jexl:` prefix: the syntax error that stops it parsing, else
 * what `check` finds against `schema` and the functions `jexl` registers.
 */
export function jexlProblems(
  text: string,
  jexl: JexlChecker,
  schema?: readonly FieldSchema[],
): JexlProblem[] {
  const trimmed = text.trim()
  const code = stripJexlPrefix(trimmed)
  let ast
  try {
    ast = jexl.parse(code)
  } catch (e) {
    const start =
      text.length - text.trimStart().length + trimmed.length - code.length
    return [
      {
        severity: 'error',
        message: e instanceof Error ? e.message : String(e),
        ...(e instanceof JexlSyntaxError
          ? { column: start + e.offset + 1 }
          : {}),
      },
    ]
  }
  return check(ast, {
    schema,
    functions: registeredFunctions(jexl),
    accessors: { get: [] },
    row: 'feature',
  }).diagnostics.map(({ severity, message }) => ({ severity, message }))
}

/** A problem as one line, `where` naming the line or setting it is in. */
export function jexlProblemText(
  where: string,
  { message, column }: JexlProblem,
) {
  return `${where}: ${message}${column ? ` (column ${column})` : ''}`
}
