import type { Mark, MarkFrame, PlannedPass } from './types.ts'

/**
 * A mark list resolved against one frame's state: the marks whose `enabled`
 * said yes, in list order, and the passes they draw.
 *
 * `drawMarks` asks every mark's gate, lens and staged compare per block, which
 * is the right shape for a display that stages its uniforms through the marks
 * — and at 120 section blocks a frame it is the whole cost the pileup measured
 * and declined (`agent-docs/ideas/one-mark-declaration-per-feature.md`). A
 * display that writes the uniforms itself, once per section, has nothing left
 * for the per-block walk to decide: `planMarks` answers the frame question
 * once, `drawPlannedPasses` issues a `drawPass` per planned mark against
 * whatever the caller staged, and `marks` is the painter's list.
 */
export interface MarkPlan<TRegion, TState extends MarkFrame> {
  readonly marks: readonly Mark<TRegion, TState>[]
  readonly passes: readonly PlannedPass[]
}

/**
 * Resolve which marks draw this frame. Throws for an enabled mark the plan
 * form cannot carry — one with a `band` or a `paintsBlock` — since a plan
 * neither scissors nor asks the block anything, and dropping the gate silently
 * would draw on the GPU what Canvas2D declines.
 */
export function planMarks<TRegion, TState extends MarkFrame>(
  marks: readonly Mark<TRegion, TState>[],
  state: TState,
): MarkPlan<TRegion, TState> {
  const enabled: Mark<TRegion, TState>[] = []
  const passes: PlannedPass[] = []
  for (const mark of marks) {
    if (!mark.enabled || mark.enabled(state)) {
      if (!mark.planned) {
        throw new Error(
          `mark ${mark.pass.id} declares a band or a block gate, which a frame plan does not carry; draw it through drawMarks`,
        )
      }
      enabled.push(mark)
      passes.push(mark.planned)
    }
  }
  return { marks: enabled, passes }
}
