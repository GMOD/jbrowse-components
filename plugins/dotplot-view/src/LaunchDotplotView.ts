import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export interface LaunchDotplotViewArgs extends SyntenyViewSharedInit {
  session: AbstractSessionModel
  views: { assembly: string; loc?: string }[]
  tracks?: string[]
  // loc-strings or URL-encoded HighlightType JSON, forwarded to the view's
  // declarative init (see DotplotView init autorun)
  highlight?: string[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-DotplotView': {
      args: LaunchDotplotViewArgs
      result: LaunchDotplotViewArgs
    }
  }
}

export default function LaunchDotplotView(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-DotplotView | async | Programmatically launch a dotplot view */
  pluginManager.addToExtensionPoint('LaunchView-DotplotView', args => {
    const { session, views, tracks = [], ...rest } = args
    if (views.length < 2) {
      throw new Error('DotplotView requires 2 views to be specified')
    }
    // remaining init fields (colorBy, autoDiagonalize, highlight, ...) forward
    // verbatim; the init autorun guards each on undefined
    session.addView('DotplotView', {
      init: { views, tracks, ...rest },
    })
    return args
  })
}
