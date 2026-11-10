import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import OpenLinkDialog from '../OpenLinkDialog.tsx'
import { newSessionName } from './sessionName.ts'
import { useLaunchConfigs, useStartScreenLaunch } from './startScreenLaunch.ts'
import { useFavoriteGenomes } from './useFavoriteGenomes.ts'
import { openSpecLink } from './util.tsx'

import type { StartScreenDialog } from './startScreenLaunch.ts'
import type { AssemblyConf } from '@jbrowse/core/util/assemblyConfigUtils'

// Between them most of what the start screen could pull in: the
// available-genomes table is ~2400 lines of grid, search index and category
// state, and the sequence dialog brings AddGenomePane and the assembly-config
// builders. Neither is on the way to anything the start screen shows by itself.
const OpenSequenceDialog = lazy(() => import('../OpenSequenceDialog.tsx'))
const AvailableGenomesDialog = lazy(
  () => import('./availableGenomes/AvailableGenomesDialog.tsx'),
)

const StartScreenDialogs = observer(function StartScreenDialogs({
  dialog,
  onClose,
}: {
  dialog: StartScreenDialog | undefined
  onClose: () => void
}) {
  const { launch } = useStartScreenLaunch()
  const { launchConfigs, launchConfigUrls } = useLaunchConfigs()
  const [favorites, setFavorites] = useFavoriteGenomes()

  return (
    // no fallback: the chunk is on local disk, and a spinner sitting where the
    // dialog is about to be reads as a broken button
    <Suspense fallback={null}>
      {dialog === 'openGenome' ? (
        <OpenSequenceDialog
          onClose={async (conf?: AssemblyConf[]) => {
            if (conf) {
              void launchConfigs(async () => [
                {
                  assemblies: conf,
                  tracks: [],
                  internetAccounts: [],
                  defaultSession: {
                    name: newSessionName(),
                  },
                },
              ])
            }
            onClose()
          }}
        />
      ) : dialog === 'hostedGenomes' ? (
        <AvailableGenomesDialog
          favorites={favorites}
          setFavorites={setFavorites}
          launch={launchConfigUrls}
          onClose={onClose}
        />
      ) : dialog === 'openLink' ? (
        <OpenLinkDialog
          onSubmit={link => launch(() => openSpecLink(link))}
          onClose={onClose}
        />
      ) : null}
    </Suspense>
  )
})

export default StartScreenDialogs
