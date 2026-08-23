import { canReplaceView } from '../util/types/index.ts'
import ReplaceCurrentViewButton from './ReplaceCurrentViewButton.tsx'

import type {
  AbstractViewContainer,
  AbstractViewModel,
} from '../util/types/index.ts'
import type { SubmitFormProps } from './SubmitForm.tsx'

/**
 * The two destinations a launch dialog offers, as `SubmitDialog` props: Submit
 * opens the launched view in a new one, and a second button puts it in the slot
 * the launching view occupies.
 *
 * Every launcher anchored on what a view is already showing — the synteny
 * launches, "read vs ref", the derivative reconstruction — wants exactly this
 * pair, and each had written the same four lines around
 * {@link ReplaceCurrentViewButton}: the guard, the button, its disabled state,
 * and the renaming of Submit that only makes sense once there are two buttons.
 * The guard is the part worth having in one place; see {@link canReplaceView}
 * for the case each copy got wrong.
 *
 * Spread it into the dialog *before* any explicit props, so a caller that words
 * its own Submit differently still can:
 *
 * ```tsx
 * <SubmitDialog
 *   {...replaceViewAction({ session, sourceView, disabled, onReplace: launch })}
 *   submitText="Open in new view"
 * />
 * ```
 */
export function replaceViewAction({
  session,
  sourceView,
  disabled,
  onReplace,
}: {
  session: AbstractViewContainer
  // the view the launch came out of, or undefined for a launcher with no single
  // view to name
  sourceView: AbstractViewModel | undefined
  disabled?: boolean
  // handed the source view back, narrowed to the case where replacing it is
  // real, so the caller doesn't repeat the `sourceView &&` it just asked for
  onReplace: (replacing: AbstractViewModel) => void
}): Pick<SubmitFormProps, 'submitText' | 'actions'> {
  return canReplaceView(session, sourceView)
    ? {
        // named only when there is a second way out to tell it apart from —
        // otherwise Submit is the only button and "Submit" is what it has
        // always said
        submitText: 'Open in new view',
        actions: (
          <ReplaceCurrentViewButton
            disabled={disabled}
            onClick={() => {
              onReplace(sourceView)
            }}
          />
        ),
      }
    : {}
}
