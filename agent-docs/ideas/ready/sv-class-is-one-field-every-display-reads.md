---
name: sv-class-is-one-field-every-display-reads
description: Core's svClassOf now names one structural-variant class for every display, with one fixed colour per class. Left, in order - svType as a VcfFeature field, the class vocabulary in core so every display paints it one way, copy number as a number on a diverging ramp, the 1000G CNV demo flipped to loss red / gain blue with a legend, then ChordVariantDisplay's colour object. `impact` stays a lazy worker-side read.
---

# The SV class is one field every display reads

## Where it stands

`svClassOfAlt` and `svClassOf` (`packages/core/src/util/svAlt.ts`) are the one
classifier: DEL, DUP, INS, INV, CNV, TR, BND, CPX, OTHER. The variant displays,
the SV inspector's chords, the spreadsheet tally and the mark display's `mate`
step (which writes `svType` per allele) all read them. Each class has one fixed
colour (`plugins/variants/src/shared/variantSvType.ts`); the colours were
chosen against the reference, no-call and alt colours, het shades and 45%
alpha chords under deutan and protan vision. Two reviews of 2026-09-27 back the
rules: VCF 4.4 deprecated SVTYPE, subtypes fold on the first colon, 1000
Genomes' `<CNn>` counts one haplotype's copies, and unknown tokens are rare in
SV callsets but universal in tandem-repeat ones.

Colin's calls (2026-09-27): a token no class names takes one "Other / mixed"
swatch, not a hashed hue; `impact` does not reach the chords for now; the 1000G
CNV demo can flip to whatever reads best, with a good legend.

## The work left, in order

1. **`svType` and `svSubtype` are `VcfFeature` fields.** A lazy `get` arm, and
   `svType` in `toJSON` (about 1 µs a record; the chords and the spreadsheet
   read features serialized on the main thread, so a getter alone reaches
   neither). `svSubtype` keeps the full id (`INS:ME:ALU`), which the mobile
   element tracks exist to show. The SV inspector fills `svType` in on rows
   restored from v4.3.0 links, which carry `toJSON` output without it. Retire
   the jexl preset (`LinearVariantDisplay/presetColor.ts`) for `svType`.
   `impact` gets at most a lazy arm; it costs 10-58 µs a record and never
   goes in `toJSON`.
2. **The class vocabulary moves into core's `VOCABULARIES`**
   (`packages/core/src/util/categoricalField.ts`), closed and with no `missing`
   key, so each display keeps its own no-value colour. The multi-sample cells
   then paint through the generic field path, and `assignSvTypeColors` with
   its `svTypeColors` RPC plumbing goes. The "Other / mixed" key row can list
   the raw tokens it holds.
3. **Copy number is a number, not a class.** Read `<CNn>`, `INFO/CN[allele]`
   or `FORMAT/CN`; paint it on a diverging ramp centred at 1 for allele copy
   number and at the sample's ploidy for `FORMAT/CN`, loss in the DEL red
   family and gain in the DUP blue family, log-scaled for `CNV:TR` ratios. The
   key says whether it shows allele or sample copy number.
4. **The 1000G CNV demo** (`test_data/1000g_cnv/config.json`): the heatmap's
   `range` flips to loss red, gain blue, matching the class colours, with
   labels naming each side.
5. **`ChordVariantDisplay.color` becomes the shared colour object**, with the
   link mark's scale set (ADR-177). Its per-chord read is
   `stateModelFactory.ts:172`, its key `legendColor` (~line 416) and the
   circle's legend (`CircularView/circularLegend.ts`).

Still to check after these land: the `multisv_svtype` and
`paper/cohort_sv_multisample` figures and jbrowse-web's
`VariantColorBy.test.tsx`, which name the old labels and colours.
