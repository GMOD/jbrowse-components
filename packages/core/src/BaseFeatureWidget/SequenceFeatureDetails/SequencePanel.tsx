import { observer } from 'mobx-react'

import SequenceContents from './SequenceContents.tsx'
import SequenceName from './SequenceName.tsx'

import type { SequencePanelProps } from './types.ts'

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
        whiteSpace: 'normal',
        wordBreak: 'break-all',
      }}
    >
      {children}
    </div>
  )
}

const SequencePanel = observer(function SequencePanel({
  sequence,
  model,
  feature,
  mode,
  assemblyGeneticCodeId,
  ref,
}: SequencePanelProps) {
  const { showCoordinates } = model
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
          assemblyGeneticCodeId={assemblyGeneticCodeId}
        />
      </Container>
    </div>
  )
})

export default SequencePanel
