import { addOrReplaceView } from '@jbrowse/core/util'

import type {} from './model.ts'
import type { AbstractViewContainer } from '@jbrowse/core/util'

// typecheck-only: `addView`'s snapshot is checked against the view type's own
// snapshot type once the view has augmented `ViewTypeRegistry`, and stays open
// for a name nothing registered. An unused @ts-expect-error fails
// `pnpm typecheck`, so these are real assertions despite running nothing.
function launches(session: AbstractViewContainer) {
  session.addView('LinearGenomeView', {
    assembly: 'volvox',
    loc: 'ctgA:1-100',
    tracks: ['genes', { trackId: 'reads', type: 'LinearAlignmentsDisplay' }],
    hideHeader: true,
    bpPerPx: 10,
  })
  // @ts-expect-error a misspelled launch key
  session.addView('LinearGenomeView', { asembly: 'volvox' })
  // @ts-expect-error a misspelled declared property
  session.addView('LinearGenomeView', { hideHeaders: true })
  // @ts-expect-error the wrong type for a declared property
  session.addView('LinearGenomeView', { hideHeader: 'yes' })
  // @ts-expect-error `type` is the name addView writes
  session.addView('LinearGenomeView', { type: 'DotplotView' })
  const widened = { type: 'LinearGenomeView', assembly: 'volvox' }
  // @ts-expect-error a variable's `type: string` cannot widen the name and, with it, the check
  session.addView('LinearGenomeView', widened)
  session.addView('SomeOtherPluginView', { asembly: 'volvox' })
  const name: string = 'LinearGenomeView'
  session.addView(name, { asembly: 'volvox' })
  addOrReplaceView({
    session,
    typeName: 'LinearGenomeView',
    // @ts-expect-error the same check through the replace-or-append helper
    initialState: { asembly: 'volvox' },
  })
}

test('addView is typed by the registry', () => {
  expect(launches).toBeInstanceOf(Function)
})
