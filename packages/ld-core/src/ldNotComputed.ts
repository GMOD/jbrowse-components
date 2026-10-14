/**
 * The value a banded `ldValues` cell carries when the file lists no value for
 * that pair: plink's `--ld-window-r2` leaves most pairs out, and a D' for one
 * of them is no more 0 than it is 1. Every metric lands in [0, 1], so -2 is
 * no measurement, and `ldValueComputed`, the generated twin the shaders test
 * with, is what both renderers ask before painting.
 */
export const LD_NOT_COMPUTED = -2
