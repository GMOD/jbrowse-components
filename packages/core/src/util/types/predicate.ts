/**
 * get the type that a predicate asserts.
 *
 * Alone in a file rather than beside its four relatives in `./util.ts`, which
 * names `PluginManager`: the parent-walk primitives are the one part of the MST
 * helpers that has no application in its type graph, and this is the only thing
 * they need from here.
 */
export type TypeTestedByPredicate<PREDICATE extends (thing: any) => boolean> =
  PREDICATE extends ((thing: any) => thing is infer TYPE) ? TYPE : never
