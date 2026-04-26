import { destroy, types } from '@jbrowse/mobx-state-tree'

import {
  adapterTypes,
  detectAdapterType,
  getAdapterConfig,
  getAssemblyNameFromFilename,
  getFilename,
  isBlank,
} from './util.ts'

import type { AdapterType } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

const blank = { uri: '' } as FileLocation

function maybeAutoFillAssemblyName(
  self: { assemblyName: string },
  filename: string,
) {
  if (filename && !self.assemblyName) {
    self.assemblyName = getAssemblyNameFromFilename(filename)
  }
}

function OpenSequenceDialogModelF() {
  return types
    .model('OpenSequenceDialogModel')
    .volatile(() => ({
      adapterSelection: adapterTypes[0] as AdapterType,
      assemblyName: '',
      assemblyDisplayName: '',
      fastaLocation: blank as FileLocation,
      faiLocation: blank as FileLocation,
      gziLocation: blank as FileLocation,
      twoBitLocation: blank as FileLocation,
      chromSizesLocation: blank as FileLocation,
      refNameAliasesLocation: blank as FileLocation,
      cytobandsLocation: blank as FileLocation,
    }))
    .actions(self => ({
      setAdapterSelection(type: AdapterType) {
        self.adapterSelection = type
      },
      setAssemblyName(name: string) {
        self.assemblyName = name
      },
      setAssemblyDisplayName(name: string) {
        self.assemblyDisplayName = name
      },
      setFaiLocation(loc: FileLocation) {
        self.faiLocation = loc
      },
      setGziLocation(loc: FileLocation) {
        self.gziLocation = loc
      },
      setChromSizesLocation(loc: FileLocation) {
        self.chromSizesLocation = loc
      },
      setRefNameAliasesLocation(loc: FileLocation) {
        self.refNameAliasesLocation = loc
      },
      setCytobandsLocation(loc: FileLocation) {
        self.cytobandsLocation = loc
      },
      setPrimaryFile(location: FileLocation) {
        const filename = getFilename(location)
        const detected = filename ? detectAdapterType(filename) : undefined
        if (detected === 'TwoBitAdapter') {
          self.twoBitLocation = location
          self.adapterSelection = 'TwoBitAdapter'
        } else {
          self.fastaLocation = location
          if (detected) {
            self.adapterSelection = detected
          }
        }
        maybeAutoFillAssemblyName(self, filename)
      },
      setTwoBitFile(location: FileLocation) {
        self.twoBitLocation = location
        maybeAutoFillAssemblyName(self, getFilename(location))
      },
      clearFormState() {
        self.fastaLocation = blank
        self.faiLocation = blank
        self.gziLocation = blank
        self.twoBitLocation = blank
        self.chromSizesLocation = blank
        self.refNameAliasesLocation = blank
        self.cytobandsLocation = blank
        self.assemblyName = ''
        self.assemblyDisplayName = ''
      },
    }))
    .views(self => ({
      get adapterConfig() {
        return getAdapterConfig({
          adapterSelection: self.adapterSelection,
          fastaLocation: self.fastaLocation,
          faiLocation: self.faiLocation,
          gziLocation: self.gziLocation,
          twoBitLocation: self.twoBitLocation,
          chromSizesLocation: self.chromSizesLocation,
        })
      },
      get baseAssemblyConfig() {
        return {
          name: self.assemblyName,
          ...(self.assemblyDisplayName
            ? { displayName: self.assemblyDisplayName }
            : {}),
          ...(!isBlank(self.refNameAliasesLocation)
            ? {
                refNameAliases: {
                  adapter: {
                    type: 'RefNameAliasAdapter',
                    location: self.refNameAliasesLocation,
                  },
                },
              }
            : {}),
          ...(!isBlank(self.cytobandsLocation)
            ? {
                cytobands: {
                  adapter: {
                    type: 'CytobandAdapter',
                    cytobandsLocation: self.cytobandsLocation,
                  },
                },
              }
            : {}),
        }
      },
    }))
}

export type OpenSequenceDialogModel = Instance<
  ReturnType<typeof OpenSequenceDialogModelF>
>

export function createOpenSequenceDialogModel() {
  return OpenSequenceDialogModelF().create()
}

export function destroyOpenSequenceDialogModel(model: OpenSequenceDialogModel) {
  destroy(model)
}
