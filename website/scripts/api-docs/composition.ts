import * as ts from 'typescript'

import {
  MODEL_CHAIN_METHODS,
  headIdentifier,
  isTypesCall,
  returnedExpression,
} from './astShapes.ts'
import { followAlias, symbolDeclId } from './symbols.ts'
import { writtenFunction } from './typeSignatures.ts'

import type { ComposedRef } from './docProgram.ts'

// For a `baseConfiguration: <expr>` or sub-schema slot property, the declId of
// the schema the expr's head identifier references (`createBaseTrackConfig(pm)`
// -> `createBaseTrackConfig`); undefined for non-identifier heads like
// `pluginManager.getDisplayType(...)` and for a slot's object literal.
export function referencedDeclId(checker: ts.TypeChecker, node: ts.Node) {
  const head = ts.isPropertyAssignment(node)
    ? headIdentifier(node.initializer)
    : undefined
  return head && symbolDeclId(checker, checker.getSymbolAtLocation(head))
}

// Whether a `#stateModel` tag landed on something that can plausibly BUILD a
// model, as opposed to a plain piece of data.
//
// This checks tag ATTACHMENT, not content. TypeScript binds a JSDoc block to
// whatever declaration follows it, so a `const` that lands between a
// `#stateModel` block and its factory quietly takes the tag. The page still
// renders — name and prose come from the comment — but the composition walk now
// searches that `const` instead of the factory and finds no compose call, so
// every inherited member row vanishes with no warning. That is what happened to
// the multi-wiggle display (17 rows, silently, for who knows how long).
//
// Three shapes all count as correctly attached, and the middle one is why this
// can't just look for a `types.*` call: a factory may build its model by chaining
// `.views()/.actions()` onto ANOTHER factory's result and never mention `types`
// itself (LinearBasicDisplay, the OAuth accounts).
//   - a function returning a call: `function F() { return Base().views(…) }`
//   - a variable initialized from a call: `const M = someFactory(…)`
//   - anything containing a literal `types.compose(…)` / `types.model(…)`, or
//     a `.props()`/`.views()`/`.actions()` chain on a model held in a local
//
// A function is not enough by itself: a helper declared between the JSDoc and
// the factory takes the tag just as a `const` does.
//
// Deliberately not `composedOf.length === 0`: a bare `types.model` composes
// nothing legitimately, so an empty composedOf can't tell the two cases apart.
export function definesStateModel(node: ts.Node) {
  const fn = writtenFunction(node)
  const returned = fn && returnedExpression(fn)
  if (returned && ts.isCallExpression(returned)) {
    return true
  }
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isCallExpression(node.initializer)
  ) {
    return true
  }
  let found = false
  const walk = (n: ts.Node) => {
    if (found) {
      return
    }
    if (
      isTypesCall(n, 'compose') ||
      isTypesCall(n, 'model') ||
      (ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        MODEL_CHAIN_METHODS.has(n.expression.name.text))
    ) {
      found = true
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return found
}

// The models a `#stateModel` declaration composes. Two patterns are covered:
//
//   A. `types.compose('Name', Base, Mixin(), types.model({...}))` — each
//      argument is resolved (alias-followed); `Mixin` resolves directly,
//      `Mixin(args)` reduces to its head identifier, and the string-literal name
//      and inline `types.model(...)` (any `types.*` literal) yield no identifier
//      and are skipped.
//   B. `return BaseFactory(args).views(...).actions(...)` — a model built by
//      extending another factory's result rather than composing. The base is the
//      head identifier of the factory's own returned chain.
//
// Deduped by declId/name, in source order. Requires the #stateModel JSDoc to sit
// on the model's factory (or its `types.compose`), not an unrelated preceding
// declaration — which is what `definesStateModel` above checks.
export function resolveComposedModels(checker: ts.TypeChecker, node: ts.Node) {
  const out: ComposedRef[] = []
  const seen = new Set<string>()
  const add = (ref: ComposedRef | undefined) => {
    const key = ref && (ref.declId ?? ref.name)
    if (ref && key && !seen.has(key)) {
      seen.add(key)
      out.push(ref)
    }
  }
  const walk = (n: ts.Node) => {
    if (isTypesCall(n, 'compose')) {
      for (const arg of n.arguments) {
        const head = headIdentifier(arg)
        const ref = head && identifierRef(checker, head)
        if (ref) {
          add(ref)
        } else {
          walk(arg)
        }
      }
    } else {
      ts.forEachChild(n, walk)
    }
  }
  walk(node)
  add(returnedBaseRef(checker, node))
  return out
}

// Pattern B: the base factory a model extends by chaining `.views()/.actions()/
// ...` onto another factory's result. Peels the factory's own returned method
// chain to the root call and returns its callee when it is a bare identifier.
// `types.compose(...)` / `types.model(...)` roots return undefined (compose is
// handled by the walk above; a plain model has no base).
function returnedBaseRef(checker: ts.TypeChecker, node: ts.Node) {
  const fn = writtenFunction(node)
  const ret = fn && returnedExpression(fn)
  if (!ret) {
    return undefined
  }
  let expr: ts.Expression = ret
  while (
    ts.isCallExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    ts.isCallExpression(expr.expression.expression)
  ) {
    expr = expr.expression.expression
  }
  return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)
    ? identifierRef(checker, expr.expression)
    : undefined
}

// Resolve an identifier naming a composed/base model to a ComposedRef, returning
// both declId and alias-followed name so the generator can match on either. When
// it resolves to a `const X = Factory(...)` — the common "export the factory's
// result" shape, and the `const base = factory(schema)` local that's then
// composed — follow the initializer to the factory identifier, which carries the
// #stateModel tag so its declId matches the model's page.
function identifierRef(
  checker: ts.TypeChecker,
  id: ts.Identifier,
  depth = 0,
): ComposedRef | undefined {
  const symbol = checker.getSymbolAtLocation(id)
  if (!symbol) {
    return undefined
  }
  const aliased = followAlias(checker, symbol)
  const decl = aliased.declarations?.[0]
  const head =
    depth < 3 && decl && ts.isVariableDeclaration(decl) && decl.initializer
      ? headIdentifier(decl.initializer)
      : undefined
  return (
    (head && identifierRef(checker, head, depth + 1)) ?? {
      declId: symbolDeclId(checker, aliased),
      name: aliased.getName(),
    }
  )
}

// First string literal anywhere in an expression (depth-first). Used to recover
// a config name from a dynamic `getDisplayType('Name')` base reference.
export function findStringLiteral(node: ts.Node): string | undefined {
  let found: string | undefined
  const walk = (n: ts.Node) => {
    if (found === undefined) {
      if (ts.isStringLiteral(n)) {
        found = n.text
      } else {
        ts.forEachChild(n, walk)
      }
    }
  }
  walk(node)
  return found
}
