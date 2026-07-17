import { createApp } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// Every other example on this site uses the <JBrowse> React component. This one
// uses `createApp` instead — the framework-agnostic imperative mount that
// non-React hosts (anywidget, R htmlwidgets, vanilla JS) wrap. It takes the same
// declarative `views` list, so a synteny view is one `{ type, init }` entry. A
// cleanup-returning ref bridges the imperative mount into React: it builds the
// app when the div attaches and disposes it when the div unmounts.
export default function CreateAppSynteny() {
  return (
    <div
      ref={el => {
        if (el) {
          const controller = createApp(el, {
            assemblies: volvoxConfig.assemblies,
            tracks: volvoxConfig.tracks,
            views: [
              {
                type: 'LinearSyntenyView',
                init: {
                  views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
                  tracks: ['volvox_del.paf'],
                },
              },
            ],
          })
          return () => {
            controller.destroy()
          }
        }
      }}
    />
  )
}
