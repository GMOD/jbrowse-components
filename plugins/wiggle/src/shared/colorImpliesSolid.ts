// `color` is only read when useBicolor is off, so a config naming a single
// color and nothing else used to render in posColor/negColor and silently
// ignore it. Treat that as the solid-color shorthand. A snapshot that also
// names useBicolor, posColor, or negColor is asking for bicolor, so leave it.
export function colorImpliesSolid(snap: Record<string, unknown>) {
  return snap.color !== undefined &&
    snap.useBicolor === undefined &&
    snap.posColor === undefined &&
    snap.negColor === undefined
    ? { ...snap, useBicolor: false }
    : snap
}
