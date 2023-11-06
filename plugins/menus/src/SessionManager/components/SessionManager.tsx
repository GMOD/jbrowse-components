import React from 'react'
import { observer } from 'mobx-react'

// icons
import { SessionModel } from './util'
import AutosaveSessionsList from './AutosavedSessionsList'
import RegularSavedSessionsList from './RegularSavedSessionsList'

const SessionManager = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  return (
    <>
      <AutosaveSessionsList session={session} />
      <RegularSavedSessionsList session={session} />
    </>
  )
})

export default SessionManager
