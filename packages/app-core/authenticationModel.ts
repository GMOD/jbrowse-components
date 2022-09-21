import PluginManager from '@jbrowse/core/PluginManager'
import {
  types,
  resolveIdentifier,
  IModelType,
  ModelProperties,
} from 'mobx-state-tree'

export default function extend<PROPS extends ModelProperties, OTHERS>(
  model: IModelType<PROPS, OTHERS>,
  pm: PluginManager,
): IModelType<PROPS, OTHERS> {
  const newModel = types
    .model({
      internetAccounts: types.array(
        pm.pluggableMstType('internet account', 'stateModel'),
      ),
    })
    .actions(self => ({
      initializeInternetAccount(accountId: string, initialSnapshot = {}) {
        console.log('t1')
        const CONFIG = pm.pluggableConfigSchemaType('internet account')
        const configuration = resolveIdentifier(CONFIG, self, accountId)

        const TYPE = pm.getInternetAccountType(configuration.type)
        if (!TYPE) {
          throw new Error(`unknown internet account type ${configuration.type}`)
        }

        const account = TYPE.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(account)
        return account
      },

      createEphemeralInternetAccount(
        accountId: string,
        initialSnapshot = {},
        url: string,
      ) {
        let hostUri

        try {
          hostUri = new URL(url).origin
        } catch (e) {
          // ignore
        }

        // id of format is `${type}-${name}`
        const internetAccountSplit = accountId.split('-')
        const configuration = {
          type: internetAccountSplit[0],
          internetAccountId: accountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        const TYPE = pm.getInternetAccountType(configuration.type)
        const account = TYPE.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(account)
        return account
      },
    }))

  return types.compose(newModel, model)
}
