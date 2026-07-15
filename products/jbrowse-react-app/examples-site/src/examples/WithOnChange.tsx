import { useState } from 'react'

import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// onChange fires on every MST patch. Use it to persist the session (e.g. to
// localStorage or a backend), drive an undo/redo stack, or sync external UI.
export default function WithOnChange() {
  const [log, setLog] = useState<string[]>([])

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
      <JBrowse
        assemblies={volvoxConfig.assemblies}
        tracks={volvoxConfig.tracks}
        views={[
          {
            type: 'LinearGenomeView',
            init: {
              assembly: 'volvox',
              loc: 'ctgA:1..50000',
              tracks: ['volvox_cram'],
            },
          },
        ]}
        onChange={patch => {
          setLog(prev => [`${patch.op} ${patch.path}`, ...prev].slice(0, 8))
        }}
      />
    </div>
  )
}
