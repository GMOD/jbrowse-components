---
name: chain-mode-flags-an-unmapped-mate-but-not-an-interchromosomal-one
description: decide whether the asymmetry is deliberate; `colorUtils.test.ts` pins neither half
---

# Chain mode flags an unmapped mate but not an interchromosomal one

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. One line, and it is not established that the asymmetry is
even wrong.

`readColorCategory` gives `unmappedMate` its own bucket under the plain `normal`
scheme when chain mode is on (`isOrientationScheme || (colorScheme ===
ColorScheme.normal && isChain)`), and the `interchrom` test one line below is
gated on `isOrientationScheme` alone. Both produce the same thing on screen — a
chain drawn with a partner that never arrives — so the asymmetry is either a
deliberate call nobody wrote down or an omission. `colorUtils.test.ts` covers
only the orientation-scheme half of each, so nothing pins it either way.
