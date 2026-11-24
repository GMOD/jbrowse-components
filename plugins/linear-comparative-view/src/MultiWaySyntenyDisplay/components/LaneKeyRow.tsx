import { bandInk, bandPalette } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import {
  KEY_FONT_PX,
  KEY_ITEM_GAP_PX,
  KEY_LINE_PX,
  KEY_SWATCH_GAP_PX,
  KEY_SWATCH_PX,
} from '../legend.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

/**
 * The marks every lane draws alike, swatch and label after swatch and label
 * in the band above the anchor lane; a label wider than a line wraps. It
 * scrolls away with the lanes
 */
const LaneKeyRow = observer(function LaneKeyRow({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { keyBandPx, canvasWidthPx, scrollTop, keyRowScales } = model
  const entries = keyRowScales.flatMap(scale =>
    scale.kind === 'categorical' ? scale.entries : [],
  )
  return keyBandPx > 0 && entries.length > 0 ? (
    <div
      data-testid="multiway-key-row"
      style={{
        position: 'absolute',
        top: -scrollTop,
        left: 0,
        width: canvasWidthPx,
        height: keyBandPx,
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        alignItems: 'flex-start',
        fontSize: KEY_FONT_PX,
        lineHeight: `${KEY_LINE_PX}px`,
        color: bandInk().text,
      }}
    >
      {entries.map(entry => (
        <span
          key={entry.value}
          data-testid="multiway-key-entry"
          style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            maxWidth: '100%',
            marginRight: KEY_ITEM_GAP_PX,
            boxSizing: 'border-box',
          }}
        >
          {entry.color === undefined ? null : (
            <span
              style={{
                flex: 'none',
                width: KEY_SWATCH_PX,
                height: KEY_SWATCH_PX,
                marginTop: (KEY_LINE_PX - KEY_SWATCH_PX) / 2,
                marginRight: KEY_SWATCH_GAP_PX,
                background: entry.color,
              }}
            />
          )}
          <span style={{ overflowWrap: 'anywhere' }}>{entry.label}</span>
        </span>
      ))}
      <button
        type="button"
        aria-label="Hide legend"
        title="Hide legend"
        onClick={() => {
          model.setShowLegend(false)
        }}
        style={{
          marginLeft: 'auto',
          height: KEY_LINE_PX,
          padding: '0 3px',
          border: 0,
          background: 'none',
          font: 'inherit',
          color: bandPalette.text.secondary,
          cursor: 'pointer',
          pointerEvents: 'all',
        }}
      >
        ×
      </button>
    </div>
  ) : null
})

export default LaneKeyRow
