import type { LinearSyntenyViewModel } from './model.ts'

/**
 * #api
 * Whether a session's view is a synteny view, for a host that finds it in
 * `session.views` to draw it with `SyntenyStack`.
 */
export function isLinearSyntenyView(
  view: unknown,
): view is LinearSyntenyViewModel {
  return (view as { type?: unknown } | undefined)?.type === 'LinearSyntenyView'
}
