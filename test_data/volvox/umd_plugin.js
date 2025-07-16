/* eslint-disable no-restricted-globals */
// we put the code in a function to avoid variable name collisions with the
// global scope
;(function () {
  class Plugin {
    name = 'UMDLocPlugin'
    version = '1.0'

    install(pluginManager) {
      const React = pluginManager.jbrequire('react')

      pluginManager.addToExtensionPoint(
        'Core-handleUnrecognizedAssembly',
        (_defaultResult, { assemblyName, session }) => {
          const jb2asm = `jb2hub-${assemblyName}`
          if (
            assemblyName &&
            !session.connections.find(f => f.connectionId === jb2asm)
          ) {
            console.log('getUnrecognizedAssembly', { assemblyName })
            const conf = {
              type: 'JB2TrackHubConnection',
              uri: 'http://localhost:3000/test_data/volvox/config2.json',
              name: 'my conn',
              assemblyNames: [assemblyName],
              connectionId: jb2asm,
            }
            session.addConnectionConf(conf)
            session.makeConnection(conf)
          }
        },
      )

      function NewAboutComponent() {
        return React.createElement(
          'div',
          null,
          'This is a replaced about dialog',
        )
      }
      function ExtraAboutPanel() {
        return React.createElement('div', null, 'This is a custom about dialog')
      }
      function ExtraFeaturePanel() {
        return React.createElement(
          'div',
          null,
          'This is a custom feature panel',
        )
      }
      function ReplaceFeatureWidget() {
        return React.createElement(
          'div',
          null,
          'This is a replaced feature panel',
        )
      }
      pluginManager.addToExtensionPoint(
        'Core-replaceAbout',
        (DefaultAboutComponent, { /*session,*/ config }) => {
          return config.trackId === 'volvox.inv.vcf'
            ? NewAboutComponent
            : DefaultAboutComponent
        },
      )

      pluginManager.addToExtensionPoint(
        'Core-extraAboutPanel',
        (DefaultAboutExtra, { /*session,*/ config }) => {
          return config.trackId === 'volvox_sv_test'
            ? { name: 'More info', Component: ExtraAboutPanel }
            : DefaultAboutExtra
        },
      )

      pluginManager.addToExtensionPoint(
        'Core-extraFeaturePanel',
        (DefaultFeatureExtra, { model }) => {
          return model.trackId === 'volvox_filtered_vcf'
            ? { name: 'Extra info', Component: ExtraFeaturePanel }
            : DefaultFeatureExtra
        },
      )

      pluginManager.addToExtensionPoint('Core-extendSession', session => {
        return session.extend(self => {
          const superThemes = self.allThemes
          return {
            views: {
              allThemes() {
                return {
                  ...superThemes(),
                  custom: {
                    name: 'Custom theme from plugin',
                    palette: {
                      primary: { main: '#0f0' },
                      secondary: { main: '#f00' },
                    },
                  },
                }
              },
            },
          }
        })
      })

      // extend session twice, just to ensure both work
      pluginManager.addToExtensionPoint('Core-extendSession', session => {
        return session.extend(self => {
          const superThemes = self.allThemes
          return {
            views: {
              allThemes() {
                const s = superThemes()
                return {
                  ...s,
                  // modify the default theme
                  default: {
                    ...s.default,
                    palette: {
                      ...s.default.palette,
                      quaternary: { main: '#090' },
                    },
                  },
                  custom2: {
                    name: 'Custom theme from plugin 2',
                    palette: {
                      primary: { main: '#00f' },
                      secondary: { main: '#0ff' },
                    },
                  },
                }
              },
            },
          }
        })
      })

      pluginManager.addToExtensionPoint(
        'Core-replaceWidget',
        (DefaultWidget, { model }) => {
          return model.trackId === 'volvox_sv_test_renamed'
            ? ReplaceFeatureWidget
            : DefaultWidget
        },
      )
      pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap => {
        snap.metadata = {
          ...snap.metadata,
          'metadata from plugin':
            'added by umd_plugin.js using Core-preProcessTrackConfig',
        }
        return snap
      })
    }

    configure(pluginManager) {
      pluginManager.jexl.addFunction('repeatColor', feature => {
        let type = feature.get('repeatClass')
        return {
          R: '#00A000',
          RC: '#FF7F00',
          F: '#8b0000',
          C: '#0000FF',
        }[type]
      })
    }
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginUMDLocPlugin = {
    default: Plugin,
  }
})()
