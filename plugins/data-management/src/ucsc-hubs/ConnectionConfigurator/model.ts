import { getConf } from '@jbrowse/core/configuration'
import { addDisposer, types } from 'mobx-state-tree'

// locals
import { UnifiedHubData, fetchAll } from '../fetching-utils'
import { autorun } from 'mobx'
import { FileLocation } from '@jbrowse/core/util'
import configSchema from '../configSchema'

const ConfiguratorState = types
  .model({
    state: types.optional(
      types.enumeration('validationState', [
        'unvalidated',
        'pending',
        'valid',
        'invalid',
      ]),
      'unvalidated',
    ),
    configuration: configSchema,
    message: '',
    hubData: types.frozen<UnifiedHubData | undefined>(),
  })
  .actions(self => ({
    reset() {
      self.state = 'unvalidated'
      self.message = ''
      self.hubData = undefined
    },
    setError(error: Error) {
      console.error(error)
      self.state = 'invalid'
      self.message = error.message
    },
    setHubData(hubData: UnifiedHubData) {
      self.hubData = hubData
      self.state = 'valid'
      self.message = ''
    },
  }))
  .actions(self => {
    let runningFetch: AbortController | undefined = undefined
    return {
      fetchAndValidate() {
        self.state = 'pending'
        if (runningFetch) {
          runningFetch.abort()
        }
        runningFetch = new AbortController()
        ;(async () => {
          const hubFileLocation = getConf(self, 'hubTxtLocation')
          const hubDefinitions = await fetchAll(
            hubFileLocation,
            runningFetch.signal,
          )
          self.setHubData(hubDefinitions)
        })().catch(self.setError)
      },
    }
  })
  .actions(self => ({
    afterCreate() {
      // watch the hubTxtLocation and validate it when it changes
      addDisposer(
        self,
        autorun(
          () => {
            const hubFileLocation = getConf(
              self,
              'hubTxtLocation',
            ) as FileLocation
            if (hubFileLocation) {
              self.fetchAndValidate()
            }
          },
          { delay: 650 },
        ),
      )
    },
  }))

export default ConfiguratorState
