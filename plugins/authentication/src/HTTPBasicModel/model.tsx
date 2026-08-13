import { HTTPBasicLoginForm } from '../lazyLoginForms.ts'
import { tokenEntryModelFactory } from '../tokenEntryModelFactory.ts'

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
  ).views(() => ({
    /**
     * #getter
     * There is nothing to pick: an HTTP Basic account matches by domain and
     * prompts on its own. RpcManager also mints one of these per origin on a
     * 401, so offering them would fill the picker with a toggle per server the
     * session happened to touch.
     */
    get showInFileSelector() {
      return false
    },
  }))

export default stateModelFactory
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
