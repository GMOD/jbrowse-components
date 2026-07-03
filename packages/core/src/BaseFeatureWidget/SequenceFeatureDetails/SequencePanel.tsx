import { observer } from 'mobx-react'

import SequenceContents from './SequenceContents.tsx'
import SequenceName from './SequenceName.tsx'

import type { SequencePanelProps } from './types.ts'

// raw inline styles (not classes) so an html copy carries styling into external
// documents like Word; the explicit black-on-white also keeps the readout
// legible under a dark theme (coordinate labels and introns are uncolored)
const baseSeqStyle = {
  fontFamily: 'monospace',
  color: 'black',
  background: 'white',
  fontSize: 11,
} as const

function WordWrap({ children }: { children: React.ReactNode }) {
  return <pre style={baseSeqStyle}>{children}</pre>
}

function NoWordWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...baseSeqStyle,
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
