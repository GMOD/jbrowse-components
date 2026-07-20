import { tokenEntryModelFactory } from '../tokenEntryModelFactory.ts'
import { ExternalTokenEntryForm } from './ExternalTokenEntryForm.tsx'

import type { ExternalTokenInternetAccountConfigModel } from './configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel ExternalTokenInternetAccount
 * Internet account that authenticates requests with a user-supplied external
 * token, prompting for the token via a dialog and optionally validating it with
 * a HEAD request. See
 * [TokenEntryInternetAccount](../tokenentryinternetaccount) for the shared
 * behavior.
 */
const stateModelFactory = (
  configSchema: ExternalTokenInternetAccountConfigModel,
) =>
  tokenEntryModelFactory(
    'ExternalTokenInternetAccount',
    'ExternalTokenInternetAccount',
    configSchema,
    ExternalTokenEntryForm,
  )

export default stateModelFactory
export type ExternalTokenStateModel = ReturnType<typeof stateModelFactory>
export type ExternalTokenModel = Instance<ExternalTokenStateModel>
