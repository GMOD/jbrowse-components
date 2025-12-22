import DotplotGrid from './DotplotGrid'

import type { DotplotViewModel } from '../model'

export default function DotplotGridWrapper({
  model,
  children,
}: {
  model: DotplotViewModel
  children?: React.ReactNode
}) {
  const { viewWidth, viewHeight } = model
  return (
    <svg
      width={viewWidth}
      height={viewHeight}
      style={{ background: 'rgba(0,0,0,0.12)' }}
    >
      <DotplotGrid model={model}>{children}</DotplotGrid>
    </svg>
  )
}
