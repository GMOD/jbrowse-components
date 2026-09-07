---
name: gate-the-two-per-base-colour-modes-against-the-other
description: Gate the two per-base colour modes against the other backend
area: rendering-and-displays
---

# Gate the two per-base colour modes against the other backend

built,
measured, removed the same day (2026-08-27). The modes really were covered by
nothing, and two scenes in `Alignments Color Schemes` closed that; both failed
immediately, at **16.39%** on `perBaseLetter` and 1.76% on `perBaseQuality`
against a 1.5% threshold. The disagreement is real, does not move between
rasterizers, and predates the sub-pixel bin that prompted the look: the GPU
snaps a cell to a pixel column and drops 10,553 one-pixel columns, Canvas2D
leaves the edge fractional and averages neighbouring bases into colours no base
has.

**Declined on the cost of carrying it, not on the finding.** Neither mode is a
common setting, nobody intends to make the backends agree, and holding the
scenes needed an 18% override — a ceiling that would never come down, which is
exactly what the 2026-08-05 override audit deleted seven entries for. The 1.6pp
of headroom it bought over a 16.39% pair would have caught only a catastrophe.

What a re-proposal has to beat: nothing about the picture, which is measured
and written down. Bring a reason the modes now matter, or take the visual call
first. Numbers, mechanism and the recipe to re-take it in one gate run:
[CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) §"The per-base wall".
