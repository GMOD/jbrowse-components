import type { WebSessionModel } from '../sessionModel/index.ts'
import type { WebRootModel } from './rootModel.ts'
import type { IsAny } from '@jbrowse/core/util/types'

type Session = NonNullable<WebRootModel['session']>

// Typecheck-only: the base root took its session model as `IAnyType`, so
// `rootModel.session` read as `any` and none of its members were checked.
test("the web root's session is the web session model", () => {
  const notAny: IsAny<Session> = false
  const isWebSession: Session extends WebSessionModel ? true : false = true
  expect([notAny, isWebSession]).toEqual([false, true])
})
