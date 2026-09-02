import { tagColorPalette } from '@jbrowse/core/ui/palette'

import { pathStripBlocks } from './pathStripBlocks.ts'

import type { DerivativeSegment } from '@jbrowse/plugin-alignments'

// Drawn at a fixed width and scaled down uniformly if the dialog is narrower
// (`maxWidth: 100%` with the default preserveAspectRatio), rather than stretched
// to fit: the strip's whole content is a set of proportions, and a horizontal
// stretch is the one transform that would misreport them.
const STRIP_WIDTH = 460
const STRIP_HEIGHT = 20

// Pale qualitative fills, the same ones a read colored by an arbitrary tag gets,
// so "one color per category" reads the same here as in the pileup. Pale
// throughout means one dark stroke and one dark ink are legible on every slot,
// in either theme, without asking the theme anything.
const STROKE = 'rgba(0,0,0,0.45)'
const INK = 'rgba(0,0,0,0.82)'

// Below these a chevron is a smudge and a name is a clipped letter. Both fall
// back to the block's hover title and to the sizes printed under the strip.
const MIN_CHEVRON_WIDTH = 13
const MIN_LABEL_WIDTH = 30
// Room for the letters and the chromosome name side by side.
const MIN_FULL_LABEL_WIDTH = 80
const CHAR_WIDTH = 6.5

function blockFill(colorIndex: number) {
  return tagColorPalette[colorIndex % tagColorPalette.length]
}

// A block carrying forty letters is a long segment cut by forty junctions
// elsewhere on its chromosome; the strip shows what fits and the figure the rest.
function fitText(text: string, width: number) {
  const maxChars = Math.floor((width - 16) / CHAR_WIDTH)
  return text.length > maxChars
    ? `${text.slice(0, Math.max(1, maxChars - 1))}…`
    : text
}

// Reversed segments point back the way they came, which is what makes a
// foldback visible in the strip rather than only in the wording.
function Chevron({ cx, strand }: { cx: number; strand: number }) {
  const midY = STRIP_HEIGHT / 2
  const dir = strand === -1 ? -1 : 1
  const half = 3
  return (
    <polyline
      points={`${cx - half * dir},${midY - half} ${cx + half * dir},${midY} ${
        cx - half * dir
      },${midY + half}`}
      fill="none"
      stroke={INK}
      strokeWidth={1.4}
    />
  )
}

/**
 * A candidate derivative path drawn as a proportional strip: one block per
 * segment in the order the reads cross them, width proportional to the
 * reference each carries, one color per chromosome, a chevron for the direction
 * it is traversed in, and the letters of the reference pieces it carries.
 *
 * The picture answers what the row's total-bp figure could not — whether one arm
 * dominates (a rearrangement) or the segments are all the same read-sized piece
 * (an aligner splitting a read). See `pathStripBlocks.ts`.
 */
export default function DerivativePathStrip({
  segments,
  letters,
}: {
  segments: DerivativeSegment[]
  /** One string per segment, `ABC` or `E′`, from `letterSegments`. */
  letters?: string[]
}) {
  const blocks = pathStripBlocks(segments, { width: STRIP_WIDTH })
  return (
    <svg
      width={STRIP_WIDTH}
      height={STRIP_HEIGHT}
      viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`}
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      // The strip restates what the path label and the sizes beneath it already
      // say, so it is decoration to a screen reader rather than a third
      // description of the same row.
      aria-hidden="true"
    >
      {/* Keyed by position in the path, which is what a block IS — a segment's
          `x` is a float that only happens to be unique, and a refName repeats
          whenever a path returns to a chromosome. */}
      {blocks.map((block, i) => {
        const run = letters?.[i]
        const label =
          run === undefined
            ? block.refName
            : block.width >= MIN_FULL_LABEL_WIDTH
              ? `${run} · ${block.refName}`
              : run
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- position in the path IS the block's identity; it is rebuilt whole per candidate and never reordered
          <g key={i}>
            <title>{run ? `${run} · ${block.title}` : block.title}</title>
            <rect
              x={block.x}
              y={0}
              width={block.width}
              height={STRIP_HEIGHT}
              rx={2}
              fill={blockFill(block.colorIndex)}
              stroke={STROKE}
              strokeWidth={1}
            />
            {block.width >= MIN_LABEL_WIDTH ? (
              <>
                <text
                  x={block.x + block.width / 2}
                  y={STRIP_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={run ? 'bold' : 'normal'}
                  fill={INK}
                >
                  {fitText(label, block.width)}
                </text>
                {/* On a labelled block the chevron sits at the leading edge
                    rather than the middle, where the label is. */}
                <Chevron
                  cx={
                    block.strand === -1
                      ? block.x + 7
                      : block.x + block.width - 7
                  }
                  strand={block.strand}
                />
              </>
            ) : block.width >= MIN_CHEVRON_WIDTH ? (
              <Chevron cx={block.x + block.width / 2} strand={block.strand} />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
