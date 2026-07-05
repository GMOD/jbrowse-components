import { launchSyntenyView } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export interface LaunchDotplotViewArgs extends SyntenyViewSharedInit {
  session: AbstractSessionModel
  // optional: the extension point receives untrusted runtime spec data, so a
  // malformed spec can omit it — the handler guards and reports a clear error
  views?: { assembly: string; loc?: string }[]
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
    // views/tracks and the remaining init fields (colorBy, autoDiagonalize,
    // highlight, ...) forward verbatim; each is guarded on undefined by the
    // init autorun.
    const { session, views = [], tracks = [], ...rest } = args
    launchSyntenyView(session, 'DotplotView', { views, tracks, ...rest })
    return args
  })
}
