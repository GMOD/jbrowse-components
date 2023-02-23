/* eslint-disable no-restricted-globals */
// we put the code in a function to avoid variable name collisions with the
// global scope
;(function () {
  class Plugin {
    name = 'UMDLocPlugin'
    version = '1.0'

    install(pluginManager) {
      const React = pluginManager.jbrequire('react')

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
          return model.trackId === 'volvox.inv.vcf'
            ? ReplaceFeatureWidget
            : DefaultWidget
        },
      )
    }

    configure(/* pluginManager */) {}
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginUMDLocPlugin = {
    default: Plugin,
  }
})()
