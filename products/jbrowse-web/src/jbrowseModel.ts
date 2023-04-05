import {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import PluginManager from '@jbrowse/core/PluginManager'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import {
  getParent,
  getRoot,
  getSnapshot,
  resolveIdentifier,
  types,
  cast,
} from 'mobx-state-tree'
import { toJS } from 'mobx'
import clone from 'clone'

// locals
import { SessionStateModel } from './sessionModelFactory'

// poke some things for testing (this stuff will eventually be removed)
// @ts-expect-error
window.getSnapshot = getSnapshot
// @ts-expect-error
window.resolveIdentifier = resolveIdentifier

function removeAttr(obj: Record<string, unknown>, attr: string) {
  for (const prop in obj) {
    if (prop === attr) {
      delete obj[prop]
    } else if (typeof obj[prop] === 'object') {
      removeAttr(obj[prop] as Record<string, unknown>, attr)
    }
  }
  return obj
}

/**
 * #config JBrowseWebConfiguration
 * configuration here appears as a "configuration" object on the root of config.json
 */
export default function JBrowseWeb(
  pluginManager: PluginManager,
  Session: SessionStateModel,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
) {
  const JBrowseModel = types
    .model('JBrowseWeb', {
      configuration: ConfigurationSchema('Root', {
        /**
         * #slot
         */
        rpc: RpcManager.configSchema,
        /**
         * #slot
         */
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
        /**
         * #slot
         */
        shareURL: {
          type: 'string',
          defaultValue: 'https://share.jbrowse.org/api/v1/',
        },

        featureDetails: ConfigurationSchema('FeatureDetails', {
          /**
           * #slot featureDetails.sequenceTypes
           */
          sequenceTypes: {
            type: 'stringArray',
            defaultValue: ['mRNA', 'transcript', 'gene', 'CDS'],
          },
        }),
        formatDetails: ConfigurationSchema('FormatDetails', {
          /**
           * #slot formatDetails.feature
           */
          feature: {
            type: 'frozen',
            description: 'adds extra fields to the feature details',
            defaultValue: {},
            contextVariable: ['feature'],
          },
          /**
           * #slot formatDetails.subfeatures
           */
          subfeatures: {
            type: 'frozen',
            description: 'adds extra fields to the subfeatures of a feature',
            defaultValue: {},
            contextVariable: ['feature'],
          },
          /**
           * #slot formatDetails.depth
           */
          depth: {
            type: 'number',
            defaultValue: 2,
            description: 'depth to iterate on subfeatures',
          },
        }),
        formatAbout: ConfigurationSchema('FormatAbout', {
          /**
           * #slot formatAbout.conf
           */
          config: {
            type: 'frozen',
            description: 'formats configuration object in about dialog',
            defaultValue: {},
            contextVariable: ['config'],
          },
          /**
           * #slot formatAbout.hideUris
           */
          hideUris: {
            type: 'boolean',
            defaultValue: false,
          },
        }),
        /**
         * #slot
         */
        disableAnalytics: {
          type: 'boolean',
          defaultValue: false,
        },
        /**
         * #slot
         */
        theme: { type: 'frozen', defaultValue: {} },
        /**
         * #slot
         */
        extraThemes: { type: 'frozen', defaultValue: {} },
        /**
         * #slot
         */
        logoPath: {
          type: 'fileLocation',
          defaultValue: { uri: '', locationType: 'UriLocation' },
        },
        ...pluginManager.pluginConfigurationSchemas(),
      }),
      plugins: types.array(types.frozen<PluginDefinition>()),
      assemblies: types.array(assemblyConfigSchemasType),
      // track configuration is an array of track config schemas. multiple
      // instances of a track can exist that use the same configuration
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
      internetAccounts: types.array(
        pluginManager.pluggableConfigSchemaType('internet account'),
      ),
      aggregateTextSearchAdapters: types.array(
        pluginManager.pluggableConfigSchemaType('text search adapter'),
      ),
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      defaultSession: types.optional(types.frozen(Session), {
        name: `New session`,
      }),
    })

    .views(self => ({
      get assemblyNames() {
        return self.assemblies.map(assembly => readConfObject(assembly, 'name'))
      },
      get rpcManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
    }))
    .actions(self => ({
      afterCreate() {
        const seen = [] as string[]
        self.assemblyNames.forEach(assemblyName => {
          if (!assemblyName) {
            throw new Error('Encountered an assembly with no "name" defined')
          }
          if (seen.includes(assemblyName)) {
            throw new Error(
              `Found two assemblies with the same name: ${assemblyName}`,
            )
          } else {
            seen.push(assemblyName)
          }
        })
      },
      addAssemblyConf(assemblyConf: AnyConfigurationModel) {
        const { name } = assemblyConf
        if (!name) {
          throw new Error('Can\'t add assembly with no "name"')
        }
        const assembly = self.assemblies.find(asm => asm.name === name)
        if (assembly) {
          return assembly
        }
        const length = self.assemblies.push({
          ...assemblyConf,
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: `${name}-${Date.now()}`,
            ...assemblyConf.sequence,
          },
        })
        return self.assemblies[length - 1]
      },
      removeAssemblyConf(assemblyName: string) {
        const toRemove = self.assemblies.find(
          assembly => assembly.name === assemblyName,
        )
        if (toRemove) {
          self.assemblies.remove(toRemove)
        }
      },
      addTrackConf(trackConf: AnyConfigurationModel) {
        const { type } = trackConf
        if (!type) {
          throw new Error(`unknown track type ${type}`)
        }
        const track = self.tracks.find(t => t.trackId === trackConf.trackId)
        if (track) {
          return track
        }
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addDisplayConf(trackId: string, displayConf: AnyConfigurationModel) {
        const { type } = displayConf
        if (!type) {
          throw new Error(`unknown display type ${type}`)
        }
        const track = self.tracks.find(t => t.trackId === trackId)
        if (!track) {
          throw new Error(`could not find track with id ${trackId}`)
        }
        return track.addDisplayConf(displayConf)
      },
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        const { type } = connectionConf
        if (!type) {
          throw new Error(`unknown connection type ${type}`)
        }
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },

      deleteConnectionConf(configuration: AnyConfigurationModel) {
        const idx = self.connections.findIndex(
          conn => conn.id === configuration.id,
        )
        if (idx === -1) {
          return undefined
        }
        return self.connections.splice(idx, 1)
      },

      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const { trackId } = trackConf
        const idx = self.tracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }

        return self.tracks.splice(idx, 1)
      },
      setDefaultSessionConf(sessionConf: AnyConfigurationModel) {
        const newDefault =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getParent<any>(self).session.name === sessionConf.name
            ? getSnapshot(sessionConf)
            : toJS(sessionConf)

        if (!newDefault.name) {
          throw new Error(`unable to set default session to ${newDefault.name}`)
        }

        // @ts-expect-error complains about name missing, but above line checks this
        self.defaultSession = cast(newDefault)
      },
      addPlugin(pluginDefinition: PluginDefinition) {
        self.plugins.push(pluginDefinition)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getRoot<any>(self).setPluginsUpdated(true)
      },

      removePlugin(pluginDefinition: PluginDefinition) {
        self.plugins = cast(
          self.plugins.filter(
            plugin =>
              plugin.url !== pluginDefinition.url ||
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self).setPluginsUpdated(true)
      },

      addInternetAccountConf(config: AnyConfigurationModel) {
        const { type } = config
        if (!type) {
          throw new Error(`unknown internetAccount type ${type}`)
        }
        const length = self.internetAccounts.push(config)
        return self.internetAccounts[length - 1]
      },
      deleteInternetAccountConf(config: AnyConfigurationModel) {
        const idx = self.internetAccounts.findIndex(a => a.id === config.id)
        if (idx === -1) {
          return undefined
        }
        return self.internetAccounts.splice(idx, 1)
      },
    }))

  return types.snapshotProcessor(JBrowseModel, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postProcessor(snapshot: { [key: string]: any }) {
      return removeAttr(clone(snapshot), 'baseUri')
    },
  })
}
