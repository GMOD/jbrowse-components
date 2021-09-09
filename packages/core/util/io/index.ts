import { BlobFile, GenericFilehandle, RemoteFile } from 'generic-filehandle'
import LocalFile from './LocalFile'
import {
  FileLocation,
  LocalPathLocation,
  BlobLocation,
  isAppRootModel,
  isUriLocation,
} from '../types'
import { BaseInternetAccountModel } from '../../pluggableElementTypes/models'
import { getBlob } from '../tracks'
import { isElectron } from '../../util'
import PluginManager from '../../PluginManager'

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blobId' in location
}

export function openLocation(
  location: FileLocation,
  pluginManager?: PluginManager,
): GenericFilehandle {
  if (!location) {
    throw new Error('must provide a location to openLocation')
  }
  if (isLocalPathLocation(location)) {
    if (!location.localPath) {
      throw new Error('No local path provided')
    }
    if (isElectron || typeof jest !== 'undefined') {
      return new LocalFile(location.localPath)
    } else {
      throw new Error("can't use local files in the browser")
    }
  }
  if (isBlobLocation(location)) {
    // special case where blob is not directly stored on the model, use a getter
    const blob = getBlob(location.blobId)
    if (!blob) {
      throw new Error(
        `file ("${location.name}") was opened locally from a previous session. To restore it, go to track settings and reopen the file`,
      )
    }
    return new BlobFile(blob)
  }
  if (isUriLocation(location)) {
    if (!location.uri) {
      throw new Error('No URI provided')
    }
    if (location.internetAccountId) {
      // TODOAUTH: check internetaccountId is in arrya, if not need to make new config for HTTPBasic,
      // which means you dont have to configure httpbasic
      if (!pluginManager) {
        throw new Error(
          'need plugin manager to open locations with an internet account',
        )
      }
      const { rootModel } = pluginManager
      if (rootModel && !isAppRootModel(rootModel)) {
        throw new Error('This context does not support internet accounts')
      }
      if (location.internetAccountPreAuthorization) {
        let internetAccount
        if (rootModel) {
          internetAccount = rootModel.findAppropriateInternetAccount(
            location,
          ) as BaseInternetAccountModel | undefined
        } else {
          const internetAccountType = pluginManager.getInternetAccountType(
            location.internetAccountPreAuthorization.internetAccountType,
          )

          internetAccount = internetAccountType.stateModel.create({
            type: location.internetAccountPreAuthorization.internetAccountType,
            configuration:
              location.internetAccountPreAuthorization.authInfo.configuration,
          })
          if (!location.internetAccountPreAuthorization.authInfo.token) {
            throw new Error('Failed to obtain token from internet account')
          }
        }
        if (!internetAccount) {
          throw new Error('Could not find associated internet account')
        }
        return internetAccount.openLocation(location)
      } else {
        if (rootModel) {
          const modifiedLocation = JSON.parse(JSON.stringify(location))
          const internetAccount = rootModel.findAppropriateInternetAccount(
            location,
          ) as BaseInternetAccountModel | undefined
          if (!internetAccount) {
            throw new Error('Could not find associated internet account')
          }
          internetAccount.getPreAuthorizationInformation(location).then(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (preAuthInfo: any) =>
              (modifiedLocation.internetAccountPreAuthorization = preAuthInfo),
          )
          return internetAccount.openLocation(modifiedLocation)
        }
        throw new Error('Could not pre-authorize location')
      }
    }

    const url = location.baseUri
      ? new URL(location.uri, location.baseUri).href
      : location.uri
    return new RemoteFile(url)
  }
  throw new Error('invalid fileLocation')
}
