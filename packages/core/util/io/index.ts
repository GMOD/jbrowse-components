import { BlobFile, GenericFilehandle, RemoteFile } from 'generic-filehandle'
import LocalFile from './LocalFile'
import {
  FileLocation,
  LocalPathLocation,
  UriLocation,
  BlobLocation,
} from '../types'
import { getBlob } from '../tracks'
import { isElectron } from '../../util'
import PluginManager from '../../PluginManager'
import AuthenticationPlugin from '@jbrowse/plugin-authentication'

function isUriLocation(location: FileLocation): location is UriLocation {
  return 'uri' in location
}

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blobId' in location
}

// needs to take the rootmodel in as an optional parameter, use if there is no preauth information
// calls that arent in data-adapters would need the rootmodel param added, main thread stuff
// this does not exist right now

// need plugin manger for openLocation now
export function openLocation(
  location: FileLocation,
  pluginManager?: PluginManager,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rootModel?: any,
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
  } else {
    if (isUriLocation(location)) {
      if (!location.uri) {
        throw new Error('No URI provided')
      }
      if (location.internetAccountId) {
        if (!location.internetAccountPreAuthorization) {
          if (rootModel) {
            const modifiedLocation = JSON.parse(JSON.stringify(location))
            const internetAccount = rootModel.findAppropriateInternetAccount(
              location,
            )
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
        } else {
          if (pluginManager) {
            const internetAccountType = pluginManager.getInternetAccountType(
              location.internetAccountPreAuthorization.internetAccountType,
            )
            const internetAccount = internetAccountType.stateModel.create({
              type:
                location.internetAccountPreAuthorization.internetAccountType,
              configuration:
                location.internetAccountPreAuthorization.authInfo.configuration,
            })
            if (!location.internetAccountPreAuthorization?.authInfo.token) {
              throw new Error('Issue with authorization')
            }
            return internetAccount.openLocation(location)
          }
        }
      }

      const url = location.baseUri
        ? new URL(location.uri, location.baseUri).href
        : location.uri
      return new RemoteFile(String(url))
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
  throw new Error('invalid fileLocation')
}
