- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?







## toggle off tooltips
for multivariantdisplay

## display mode -> rename to set feature height

## add option "hide this feature" to multisamplevariantdisplay, etc


## jb2hubs real ncbi gff for ucsc




## expressive SV search language for the SV inspector import form
Current import-form filtering matches query strings like `CHR2=17` against the
spreadsheet columns — narrow (won't catch variants *originating* from chr17, only
those naming it in a column). A richer SV query language (by breakend chrom/pos,
type, length range, INFO fields, AND/OR) would be more useful. Net-new feature,
not a screenshot defect. (Was: sv_inspector_importform_filtered review item.)

## screenshot review: 2 items left, both blocked on remote demo-data regen
- cnv_multi_bigwig — indexcov bigWigs aren't co-normalized for CNV. Recipe to
  regenerate a log2(tumor/normal) ratio + BAF track:
  website/scripts/cnv-data-recipe.md. Needs source CRAMs + re-upload to
  jbrowse.org/demos/cgiab.
- trio-hapibd-painting — gaps are intentional hap-ibd thresholds (documented in
  analyze_trio.md). Low priority; lower min-seed/min-output + tiling MIN_RUN_CM to
  fill gaps, at the cost of phasing-error noise; needs re-upload of the bed.

  ## reaudit displaychroime
