import { JexlSyntaxError, check } from '@jbrowse/jexl'

import { stripJexlPrefix } from './jexlFilterFields.ts'
import { FEATURE_ROW, parseJexl } from './jexlSyntax.ts'

import type {
  FieldSchema,
  Jexl,
  Severity,
  Signature,
  Type,
} from '@jbrowse/jexl'

export interface JexlProblem {
  severity: Severity
  message: string
  /** 1-based, in the text as given, for a syntax error */
  column?: number
}

export type JexlChecker = Pick<Jexl, 'parse' | 'functionNames'>

const ANY_ARGUMENTS: Signature = {
  params: ['any'],
  variadic: true,
  optional: 1,
}

/**
 * Every function `jexl` registers, each taking any arguments, so `check`
 * reports a misspelt name without judging a registered one's arity.
 */
export function registeredFunctions(jexl: Pick<Jexl, 'functionNames'>) {
  return Object.fromEntries(
    jexl.functionNames().map(name => [name, ANY_ARGUMENTS]),
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
    ...FEATURE_ROW,
  }).diagnostics.map(({ severity, message }) => ({ severity, message }))
}

function kindOf(type: Type): 'numeric' | 'categorical' | 'unknown' {
  switch (type.kind) {
    case 'number': {
      return 'numeric'
    }
    case 'string':
    case 'boolean': {
      return 'categorical'
    }
    case 'union': {
      const kinds = new Set(type.of.map(kindOf))
      return kinds.size === 1 ? [...kinds][0]! : 'unknown'
    }
    default: {
      return 'unknown'
    }
  }
}

/**
 * Whether a jexl expression over `feature` answers a number, text or a truth
 * value, as `check` infers it from the expression alone: `feature.score * 2`
 * is numeric, `` `${feature.type}!` `` categorical, `feature.score` unknown.
 */
export function expressionKind(text: string) {
  const ast = parseJexl(text)
  return ast ? kindOf(check(ast, FEATURE_ROW).type) : 'unknown'
}

/** A problem as one line, `where` naming the line or setting it is in. */
export function jexlProblemText(
  where: string,
  { message, column }: JexlProblem,
) {
  return `${where}: ${message}${column ? ` (column ${column})` : ''}`
}
