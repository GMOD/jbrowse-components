import { createContext, use } from 'react'

import { useNotifyError } from '../NotifyContext.ts'
import { mergeConfigInputs } from './configInputs.ts'
import { MAX_GENOMES_PER_LAUNCH, TOO_MANY_GENOMES } from './launchLimit.ts'
import { fetchConfig, launchSnapshot } from './util.tsx'

import type { JBrowseConfigInput } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export type StartScreenDialog = 'openGenome' | 'hostedGenomes' | 'openLink'

export interface StartScreenLaunch {
  launch: (load: () => Promise<PluginManager>) => Promise<void>
  openDialog: (dialog: StartScreenDialog) => void
}

export const StartScreenLaunchContext = createContext<
  StartScreenLaunch | undefined
>(undefined)

export function useStartScreenLaunch() {
  const value = use(StartScreenLaunchContext)
  if (!value) {
    throw new Error('useStartScreenLaunch must be used within the StartScreen')
  }
  return value
}

export function useLaunchConfigs() {
  const { launch } = useStartScreenLaunch()
  const notifyError = useNotifyError()

  async function launchConfigs(
    getEntries: () => Promise<JBrowseConfigInput[]>,
  ) {
    try {
      await launch(async () =>
        launchSnapshot(mergeConfigInputs(await getEntries())),
      )
    } catch (e) {
      console.error(e)
      notifyError(e)
    }
  }

  async function launchConfigUrls(configUrls: string[]) {
    if (configUrls.length > MAX_GENOMES_PER_LAUNCH) {
      notifyError(new Error(TOO_MANY_GENOMES))
    } else {
      await launchConfigs(() =>
        Promise.all(configUrls.map(url => fetchConfig(url))),
      )
    }
  }

  return {
    launchConfigs,
    launchConfigUrls,
  }
}
