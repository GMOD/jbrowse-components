import { useCallback, useRef, useState } from 'react'

import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshair from '../../shared/components/MultiVariantCrosshairs'
import LegendBar from '../../shared/components/MultiVariantLegendBar'
import TreeSidebar from '../../shared/components/TreeSidebar'

import type { MultiLinearVariantDisplayModel } from '../model'

interface MouseState {
  x: number
  y: number
  offsetX: number
  offsetY: number
}

const MultiLinearVariantDisplayComponent = observer(function (props: {
  model: MultiLinearVariantDisplayModel
}) {
  const { model } = props
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()
  const [mouseState, setMouseState] = useState<MouseState>()

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    const clientX = event.clientX
    const clientY = event.clientY
    rafRef.current = requestAnimationFrame(() => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) {
        setMouseState({
          x: clientX - rect.left,
          y: clientY - rect.top,
          offsetX: rect.left,
          offsetY: rect.top,
        })
      }
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    setMouseState(undefined)
  }, [])

  return (
    <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <TreeSidebar model={model} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
        }}
      >
        <BaseLinearDisplayComponent {...props} />
      </div>
      <LegendBar model={model} />

      {mouseState ? (
        <Crosshair
          mouseX={mouseState.x}
          mouseY={mouseState.y}
          offsetX={mouseState.offsetX}
          offsetY={mouseState.offsetY}
          model={model}
        />
      ) : null}
    </div>
  )
})

export default MultiLinearVariantDisplayComponent
