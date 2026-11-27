---
name: svgcanvas-accepts-calls-it-then-drops
description: SvgCanvas's loose `clip`, `drawImage`, `clearRect` and style-setter signatures let a draw call compile that the vector export then drops or serializes as `[object CanvasGradient]`; narrowing them turns each into a compile error.
---

# SvgCanvas accepts calls it then drops

`clip(..._args: unknown[])` and `drawImage(..._args: unknown[])`
([SvgCanvas.ts](../../../packages/core/src/util/SvgCanvas.ts)) let
`ctx.clip(path2d)`, `ctx.clip('evenodd')` and `drawImage` compile against
`Ctx2D`. In vector mode the first two clip to the current path and `drawImage`
draws nothing.

- `clearRect` is a silent no-op, which
  [gap/mark.ts](../../../plugins/alignments/src/features/gap/mark.ts) records
  having been bitten by.
- `fillStyle` and `strokeStyle` are typed to take a `CanvasGradient` or
  `CanvasPattern`, which would serialize as `[object CanvasGradient]`.

No vector caller hits these today:
[ringShape.ts](../../../plugins/circular-view/src/rings/ringShape.ts) guards its
`drawImage`.

## The change

- Narrow `clip()` to no arguments and the style setters to `string`.
- Remove `drawImage` and `clearRect` from the type the draw functions see, so a
  vector path that reaches either fails to compile.

It needs a typecheck loop over every draw function that takes `Ctx2D`.
