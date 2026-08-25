`fetchResults` is the searching half on its own — query in, `BaseResult[]` out.
No navigation, no dialog, no decision about which hit you meant. That decision
is the whole reason the section above ends on a search that appears to do
nothing, and doing it yourself is what makes the ambiguous case ordinary.

It takes two sources and asks both: `textSearchManager` fans out to every
aggregate adapter scoped to the assembly, and `assembly` is scanned for refName
matches with aliases resolved, so `chr17` comes back as the canonical `17`. Pass
one and you get one kind of hit. RefName hits are returned first and capped well
below any sensible list length, so a genome with ten thousand scaffolds cannot
push the gene hits off the end.

## What a result carries

Only `getDisplayString()` is guaranteed. `getLocation()` can be an empty string
on a result that reports having one, and forwarding that into `navToLocString`
blanks the view rather than erroring. `getTrackId()` is absent on refName hits
and present on trix hits, where it is the id recorded when the index was built —
which is why this page's genes track is `genes` and not the `hg38_genes` every
other page here uses. An index and a config that disagree resolve locations
perfectly and then quietly fail to turn a track on.

## Two orderings that are not stylistic

`waitForAssembly` has to resolve before the refName scan: `allRefNames` is a
plain getter, so reading it early returns nothing rather than erroring. And
responses can land out of order — a slow `TP53` overwriting a fast `TP53BP1`
typed after it — so the effect tracks whether it is still the current one. A
debounce makes that rarer and does not fix it.
