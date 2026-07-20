import { tokenEntryModelFactory } from '../tokenEntryModelFactory.ts'
import { HTTPBasicLoginForm } from './HTTPBasicLoginForm.tsx'

import type { HTTPBasicInternetAccountConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel HTTPBasicInternetAccount
 * Internet account that authenticates requests with an HTTP Basic
 * username/password the user enters through a dialog, optionally validated with
 * a HEAD request. See [TokenEntryInternetAccount](../tokenentryinternetaccount)
 * for the shared behavior.
 */
const stateModelFactory = (configSchema: HTTPBasicInternetAccountConfigModel) =>
  tokenEntryModelFactory(
    'HTTPBasicInternetAccount',
    'HTTPBasicInternetAccount',
    configSchema,
    HTTPBasicLoginForm,
  )

export default stateModelFactory
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
