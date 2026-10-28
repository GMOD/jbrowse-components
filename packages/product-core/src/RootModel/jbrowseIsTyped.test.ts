import type { BaseSession } from '../Session/BaseSession.ts'
import type { BaseRootModel } from './BaseRootModel.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IsAny } from '@jbrowse/core/util/types'

// Typecheck-only: `jbrowse` read as `any` until the config models got an
// interface, which left every `.tracks`, `.assemblies` and edit off it unchecked.
test('session.jbrowse and root.jbrowse are typed', () => {
  const pins: [
    IsAny<BaseSession['jbrowse']>,
    IsAny<BaseSession['jbrowse']['tracks']>,
    IsAny<AbstractSessionModel['jbrowse']>,
    IsAny<BaseRootModel['jbrowse']>,
    IsAny<BaseRootModel['jbrowse']['plugins']>,
    IsAny<BaseRootModel['session']>,
  ] = [false, false, false, false, false, false]
  expect(pins).toEqual([false, false, false, false, false, false])
})
