import { ConfigurationReference } from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import { DropboxOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'

const stateModelFactory = (
  configSchema: DropboxOAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'DropboxOAuthInternetAccount',
      baseModel(OAuthConfigSchema),
      types.model({
        id: 'DropboxOAuth',
        type: types.literal('DropboxOAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(() => ({
      get internetAccountType() {
        return 'DropboxOAuthInternetAccount'
      },
    }))
    .actions(() => ({
      async fetchFile(locationUri: string, accessToken: string) {
        if (!locationUri || !accessToken) {
          return
        }
        const response = await fetch(
          'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`, // the access token is getting cached or something here
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: locationUri,
            }),
          },
        )
        if (!response.ok) {
          throw new Error(
            `Network response failure: ${
              response.status
            } (${await response.text()})`,
          )
        }
        const metadata = await response.json()
        if (metadata) {
          const fileResponse = await fetch(
            'https://api.dropboxapi.com/2/files/get_temporary_link',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ path: metadata.id }),
            },
          )
          if (!fileResponse.ok) {
            throw new Error(
              `Network response failure: ${
                fileResponse.status
              } (${await fileResponse.text()})`,
            )
          }
          const file = await fileResponse.json()
          return file.link
        }
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
