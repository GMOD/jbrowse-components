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

export function openLocation(
  location: FileLocation,
  _pluginManager: PluginManager,
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
  if (isUriLocation(location)) {
    if (!location.uri) {
      throw new Error('No URI provided')
    }
    return new RemoteFile(
      location.baseUri
        ? new URL(location.uri, location.baseUri).href
        : location.uri,
    )
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
