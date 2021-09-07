import { ConfigurationReference } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, types } from 'mobx-state-tree'
import { GoogleDriveOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchemaFactory as OAuthConfigSchemaFactory } from '../OAuthModel'

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: GoogleDriveOAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'GoogleDriveOAuthInternetAccount',
      baseModel(pluginManager, OAuthConfigSchemaFactory(pluginManager)),
      types.model({
        id: 'GoogleDriveOAuth',
        type: types.literal('GoogleDriveOAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(() => ({
      get internetAccountType() {
        return 'GoogleDriveOAuthInternetAccount'
      },
    }))
    .actions(() => ({
      async fetchFile(locationUri: string, accessToken: string) {
        if (!locationUri || !accessToken) {
          return
        }
        const urlId = locationUri.match(/[-\w]{25,}/)

        const response = await fetch(
          `https://www.googleapis.com/drive/v2/files/${urlId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Network response failure: ${
              response.status
            } (${await response.text()})`,
          )
        }
        const fileMetadata = await response.json()
        return fileMetadata.downloadUrl
      },
    }))
}

export default stateModelFactory
export type GoogleDriveOAuthStateModel = ReturnType<typeof stateModelFactory>
export type GoogleDriveOAuthModel = Instance<GoogleDriveOAuthStateModel>
