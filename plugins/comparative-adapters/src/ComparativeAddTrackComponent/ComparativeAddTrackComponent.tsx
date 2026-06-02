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

    // Seed the adapter's query/target assemblies while this picker is shown
    // (covering the untouched-defaults case), and clear them on unmount so a
    // subsequently chosen non-synteny adapter isn't left with stale assembly
    // fields. These used to be injected for every track in getTrackConfig.
    useEffect(() => {
      model.setMixinData({ adapter: { queryAssembly, targetAssembly } })
      return () => {
        try {
          model.setMixinData({})
        } catch {
          // widget may already be detached during teardown (submit); ignore
        }
      }
    }, [model, queryAssembly, targetAssembly])

    return (
      <>
        <AssemblySelector
          session={session}
          label="Query assembly"
          helperText=""
          selected={queryAssembly}
          onChange={asm => {
            setQueryAssembly(asm)
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
          }}
          fullWidth
        />
      </>
    )
  },
)

export default ComparativeAddTrackComponent
