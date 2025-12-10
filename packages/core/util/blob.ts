import { PreFileLocation } from './types/index.ts'

let blobMap: Record<string, File> = {}

// get a specific blob
export function getBlob(id: string) {
  return blobMap[id]
}

// used to export entire context to webworker
export function getBlobMap() {
  return blobMap
}

// TODO:IS THIS BAD?
// used in new contexts like webworkers
export function setBlobMap(map: Record<string, File>) {
  blobMap = map
}

let counter = 0

// blob files are stored in a global map. the blobId is based on a combination
// of timestamp plus counter to be unique across sessions and fast repeated
// calls
export function storeBlobLocation(location: PreFileLocation) {
  if ('blob' in location) {
    const blobId = `b${Date.now()}-${counter++}`
    blobMap[blobId] = location.blob
    return { name: location.blob.name, blobId, locationType: 'BlobLocation' }
  }
  return location
}
