import type { LinearComparativeViewModel } from '../LinearComparativeView/model.ts'
import type { LinearSyntenyViewModel } from './model.ts'

/**
 * The synteny-specific header controls (colorBy, alpha, etc.) read state that
 * only exists on a LinearSyntenyView. Gate on the MST type discriminator so a
 * plain LinearComparativeView never renders those controls against a model that
 * lacks the matching state/actions. Narrowing along the compose chain and not
 * from an arbitrary object, so the only thing unchecked is the discriminator
 * itself, which every subclass sets to its own literal.
 *
 * A leaf module (the model imports are type-only) so the components chunk can
 * use it without pulling the lazily loaded state model into its chunk.
 */
export function asSyntenyModel(model: LinearComparativeViewModel) {
  return model.type === 'LinearSyntenyView'
    ? (model as LinearSyntenyViewModel)
    : undefined
}
