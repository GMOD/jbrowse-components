import { useEffect, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

interface TrackModel {
  setMixinData: (data: Record<string, unknown>) => void
}

const ComparativeAddTrackComponent = observer(
  function ComparativeAddTrackComponent({ model }: { model: TrackModel }) {
    const session = getSession(model)
    const defaultAsm = session.assemblies[0]?.name ?? ''
    const [queryAssembly, setQueryAssembly] = useState(defaultAsm)
    const [targetAssembly, setTargetAssembly] = useState(defaultAsm)
    // Initialize mixinData on mount so the default assemblies are set even
    // if the user never touches the selectors before confirming.
    useEffect(() => {
      model.setMixinData({
        adapter: { queryAssembly: defaultAsm, targetAssembly: defaultAsm },
      })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <>
        <AssemblySelector
          session={session}
          label="Query assembly"
          helperText=""
          selected={queryAssembly}
          onChange={asm => {
            setQueryAssembly(asm)
            model.setMixinData({
              adapter: { queryAssembly: asm, targetAssembly },
            })
          }}
          fullWidth
        />
        <AssemblySelector
          session={session}
          label="Target assembly"
          helperText=""
          selected={targetAssembly}
          onChange={asm => {
            setTargetAssembly(asm)
            model.setMixinData({
              adapter: { queryAssembly, targetAssembly: asm },
            })
          }}
          fullWidth
        />
      </>
    )
  },
)

export default ComparativeAddTrackComponent
