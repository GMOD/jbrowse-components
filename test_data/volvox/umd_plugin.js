/* eslint-disable no-restricted-globals */
// we put the code in a function to avoid variable name collisions with the
// global scope
;(function () {
  class Plugin {
    name = 'UMDLocPlugin'
    version = '1.0'

    install(pluginManager) {
      const React = pluginManager.jbrequire('react')
      // const { GlyphType } = pluginManager.jbrequire(
      //   '@jbrowse/core/pluggableElementTypes',
      // )
      //
      // // Example pluggable glyph: draws SNV features as purple diamonds
      // pluginManager.addGlyphType(
      //   () =>
      //     new GlyphType({
      //       name: 'SNVGlyph',
      //       displayName: 'SNV Diamond',
      //       draw: ctx => {
      //         const { ctx: context, featureLayout } = ctx
      //         const { x, y, width, height } = featureLayout
      //
      //         const centerX = x + width / 2
      //         const centerY = y + height / 2
      //         const halfWidth = Math.max(width / 2, 4)
      //         const halfHeight = height / 2
      //
      //         // Purple diamond fill
      //         context.fillStyle = '#800080'
      //         context.beginPath()
      //         context.moveTo(centerX, centerY - halfHeight) // top
      //         context.lineTo(centerX + halfWidth, centerY) // right
      //         context.lineTo(centerX, centerY + halfHeight) // bottom
      //         context.lineTo(centerX - halfWidth, centerY) // left
      //         context.closePath()
      //         context.fill()
      //
      //         // Indigo stroke
      //         context.strokeStyle = '#4B0082'
      //         context.lineWidth = 1
      //         context.stroke()
      //       },
      //       match: feature => feature.get('type') === 'SNV',
      //     }),
      // )

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
      // Example: custom folder dialog for "Wiggle Rendering Styles" category.
      // This demonstrates how plugins can provide a custom UI for a specific
      // folder category using the 'TrackSelector-folderDialog' extension point.
      // Instead of the default faceted data grid, it shows styled toggle cards.
      pluginManager.addToExtensionPoint(
        'TrackSelector-folderDialog',
        (DefaultComponent, { categoryId }) => {
          if (
            categoryId !==
            'Tracks-Integration test,Wiggle,Wiggle Rendering Styles'
          ) {
            return DefaultComponent
          }

          const { readConfObject } = pluginManager.jbrequire(
            '@jbrowse/core/configuration',
          )
          const { observer } = pluginManager.jbrequire('mobx-react')
          const {
            Dialog,
            DialogTitle,
            DialogContent,
            DialogActions,
            Button,
            Typography,
          } = pluginManager.jbrequire('@mui/material')

          return observer(function WiggleRenderingStylesDialog({
            model,
            title,
            subtracks,
            handleClose,
          }) {
            const { shownTrackIds, view } = model
            const tracks = subtracks.filter(s => s.type === 'track')

            const renderingDescriptions = {
              xyplot: 'Bar chart showing signal intensity at each position',
              lineplot: 'Connected line graph for smooth signal visualization',
              density: 'Heatmap-style density rendering for compact display',
            }

            return React.createElement(
              Dialog,
              {
                open: true,
                onClose: handleClose,
                maxWidth: 'sm',
                fullWidth: true,
              },
              React.createElement(DialogTitle, null, title),
              React.createElement(
                DialogContent,
                null,
                React.createElement(
                  Typography,
                  {
                    variant: 'body2',
                    color: 'textSecondary',
                    style: { marginBottom: 8 },
                  },
                  'This is a custom folder dialog demo from umd_plugin.js. ',
                  'It uses the TrackSelector-folderDialog extension point to ',
                  'replace the default faceted selector with a custom UI.',
                ),
                React.createElement(
                  Typography,
                  {
                    variant: 'body2',
                    style: { marginBottom: 16 },
                  },
                  'Choose which rendering styles to display. Each shows the same data with a different visualization.',
                ),
                ...tracks.map(track => {
                  const { trackId, name, conf } = track
                  const checked = shownTrackIds.has(trackId)
                  const description = readConfObject(conf, 'description')
                  const renderingType = name.toLowerCase().includes('lineplot')
                    ? 'lineplot'
                    : name.toLowerCase().includes('density')
                      ? 'density'
                      : 'xyplot'

                  return React.createElement(
                    'div',
                    {
                      key: trackId,
                      onClick: () => view.toggleTrack(trackId),
                      style: {
                        padding: '12px 16px',
                        marginBottom: 8,
                        borderRadius: 6,
                        border: checked
                          ? '2px solid #1976d2'
                          : '2px solid #ddd',
                        background: checked ? '#e3f2fd' : '#fafafa',
                        cursor: 'pointer',
                      },
                    },
                    React.createElement(
                      Typography,
                      {
                        variant: 'subtitle2',
                        style: { marginBottom: 4 },
                      },
                      checked ? '✓ ' : '',
                      name,
                    ),
                    React.createElement(
                      Typography,
                      { variant: 'body2', color: 'textSecondary' },
                      description || renderingDescriptions[renderingType] || '',
                    ),
                  )
                }),
              ),
              React.createElement(
                DialogActions,
                null,
                React.createElement(
                  Button,
                  { onClick: handleClose, variant: 'contained' },
                  'Close',
                ),
              ),
            )
          })
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

      // Example: Add LinearReadCloudDisplay as the first display for AlignmentsTracks
      // that have "_sv" in their trackId (e.g. structural variant tracks)
      // This now works because showTrackGeneric calls Core-preProcessTrackConfig
      // and spreads display config properties into the display state
      pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap => {
        if (snap.type === 'AlignmentsTrack' && snap.trackId?.includes('_sv')) {
          const displays = snap.displays || []
          const hasReadCloud = displays.some(
            d => d.type === 'LinearReadCloudDisplay',
          )
          if (!hasReadCloud) {
            console.log(
              'Adding LinearReadCloudDisplay with drawCloud:true for',
              snap.trackId,
            )
            return {
              ...snap,
              displays: [
                {
                  type: 'LinearReadCloudDisplay',
                  displayId: `${snap.trackId}-LinearReadCloudDisplay`,
                  drawCloud: true,
                },
                ...displays,
              ],
            }
          }
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
