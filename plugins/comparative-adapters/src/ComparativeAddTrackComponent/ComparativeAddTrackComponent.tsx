import { useEffect, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

const ComparativeAddTrackComponent = observer(function ({ model }: any) {
  const session = getSession(model)
  const [r0, setR0] = useState(session.assemblies[0]?.name)
  const [r1, setR1] = useState(session.assemblies[0]?.name)
  useEffect(() => {
    model.setMixinData({
      adapter: {
        queryAssembly: r0,
        targetAssembly: r1,
      },
    })
  }, [model, r0, r1])
  return (
    <>
      <AssemblySelector
        session={session}
        label="Query assembly"
        helperText=""
        selected={r0}
        onChange={asm => {
          setR0(asm)
        }}
        TextFieldProps={{
          fullWidth: true,
        }}
      />
      <AssemblySelector
        session={session}
        label="Target assembly"
        helperText=""
        selected={r1}
        onChange={asm => {
          setR1(asm)
        }}
        TextFieldProps={{
          fullWidth: true,
        }}
      />
    </>
  )
})

export default ComparativeAddTrackComponent
