import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// onChange fires on every MST patch. Use it to persist the session (e.g. to
// localStorage or a backend), drive an undo/redo stack, or sync external UI.
export default function WithOnChange() {
  const [log, setLog] = useState<string[]>([])
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'onChange example',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
              },
            },
          ],
        },
      },
      onChange: patch => {
        setLog(prev => [`${patch.op} ${patch.path}`, ...prev].slice(0, 8))
      },
    }),
  )

  return (
    <div>
      <div
        style={{
          padding: 8,
          fontFamily: 'monospace',
          fontSize: 12,
          background: '#8881',
        }}
      >
        <div>Recent session patches (pan/zoom, or show/hide a track):</div>
        <pre style={{ margin: 0 }}>
          {log.join('\n') || '(interact with the view to see patches)'}
        </pre>
      </div>
      <JBrowseApp viewState={state} />
    </div>
  )
}
