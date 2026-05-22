type AnyErrorConstructor = new (...args: any[]) => Error

const list: [string, AnyErrorConstructor][] = [
  ['Error', Error],
  ['EvalError', EvalError],
  ['RangeError', RangeError],
  ['ReferenceError', ReferenceError],
  ['SyntaxError', SyntaxError],
  ['TypeError', TypeError],
  ['URIError', URIError],
  ['AggregateError', AggregateError],
]

export const errorConstructors = new Map(list)
export const errorFactories = new Map<string, () => Error>()
