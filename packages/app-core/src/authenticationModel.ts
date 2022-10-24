import PluginManager from '@jbrowse/core/PluginManager'
import { autorun } from 'mobx'
import {
  addDisposer,
  types,
  resolveIdentifier,
  IModelType,
  ModelProperties,
} from 'mobx-state-tree'
import { UriLocation } from '@jbrowse/core/util/types'

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
        const sp = accountId.split('-')
        const configuration = {
          type: sp[0],
          internetAccountId: accountId,
          name: sp.slice(1).join('-'),
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

      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selected = self.internetAccounts.find(
            a => a.internetAccountId === selectedId,
          )
          if (selected) {
            return selected
          }
        }

        // if no existing account or not found, try to find working account
        for (const a of self.internetAccounts) {
          const handleResult = a.handlesLocation(location)
          if (handleResult) {
            return a
          }
        }

        // if still no existing account, create ephemeral config to use
        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
    }))

  return types.compose(newModel, model)
}

export function initInternetAccounts(self: any) {
  addDisposer(
    self,
    autorun(() => {
      // @ts-ignore
      self.jbrowse.internetAccounts.forEach(account => {
        // @ts-ignore
        this.initializeInternetAccount(account.internetAccountId)
      })
    }),
  )
}
