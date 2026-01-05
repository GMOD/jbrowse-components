import { forwardRef } from 'react'

import { observer } from 'mobx-react'

import SequenceContents from './SequenceContents'
import SequenceName from './SequenceName'

import type { SequencePanelProps } from './types'

function WordWrap({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        /* raw styles instead of className so that html copy works */
        fontFamily: 'monospace',
        color: 'black',
        fontSize: 11,
      }}
    >
      {children}
    </pre>
  )
}

function NoWordWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        /* raw styles instead of className so that html copy works */
        fontFamily: 'monospace',
        color: 'black',
        fontSize: 11,
        maxWidth: 600,
        whiteSpace: 'wrap',
        wordBreak: 'break-all',
      }}
    >
      {children}
    </div>
  )
}

const SequencePanel = observer(
  forwardRef<HTMLDivElement, SequencePanelProps>(function S(props, ref) {
    const { sequence, model, feature } = props
    const { showCoordinates, mode } = model

    const Container = showCoordinates ? WordWrap : NoWordWrap
    return (
      <div
        data-testid="sequence_panel"
        ref={ref}
        style={{ maxHeight: 300, overflow: 'auto' }}
      >
        <Container>
          <SequenceName model={model} mode={mode} feature={feature} />
          <SequenceContents
            model={model}
            mode={mode}
            feature={feature}
            sequence={sequence}
          />
        </Container>
      </div>
    )
  }),
)

export default SequencePanel
