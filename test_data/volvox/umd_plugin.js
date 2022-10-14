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
        return React.createElement('div', null, 'This is a custom about dialog')
      }
      function ExtraAboutPanel() {
        return React.createElement('div', null, 'This is a custom about dialog')
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
            ? { name: 'More info', component: ExtraAboutPanel }
            : DefaultAboutExtra
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
