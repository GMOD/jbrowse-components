- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?













When we autodiagonalize we may want to have the choice to swap query and target as it can affect.

                                                                                                                                                                                                Searched for 5 patterns, read 1 file, ran 3 shell commands
                                                                                                                                                                                                Both ideas are feasible, and one's actually half-there already:
                                                                                                                                                                                              - Swap query/target: diagonalizeRegions (packages/core/src/util/diagonalizeRegions.ts)lds the reference (hview) fixed and reorders the query (vview) by best-matching alignedbases. Swapping which side is held fixed can absolutely change the result, especially when one genome is well-assembled (few chroms) and the other is scaffold-heavy — you generally want the well-assembled one as the fixed anchor. Cheapest implementation: add a swap flag that tRegions and the ref*/query* fields on each AlignmentData before calling the existingalgorithm, then thread it through DiagonalizeDotplotRpc/DiagonalizeSyntenyRpc args and a menu toggle.
not just a flag. DotplotView itself is hard-capped at 2 axes (h/v), so swap there is a

Want me to prototype the swap flag for the 2-genome case (dotplot + the level-0/1 pair the multi-level anchor-choice as a separate follow-up?

## For the maternal+paternal crossing over

Not a clear example for the maternal, please use another one

It should also highlight the specific range of mom h1 row, and the portion of the child haplotype that matches mom h1 using one color, and then also the specific range of the mom h2 row, and the portion of the child haplotype that matches mom h2 using different color. then use same idea for paternal screenshots

## better domain for protein3d/connected example

the current one is an 'overlapping' domain. try motif track instead, it is shorter and less likely overlapping



## trans except
feature_sequence

## toggle off tooltips
for multivariantdisplay

## display mode -> rename to set feature height

## add option "hide this feature" to multisamplevariantdisplay, etc

## mouseovers are not as good on multisamplevariantdisplay as they used to. check into
