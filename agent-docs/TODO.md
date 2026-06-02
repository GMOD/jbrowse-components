- regenerate embedded examples
- circular view filter sv types/sv-inpector filterings
- hic testing
- reversed region testing
- hide sashimi arcs if not relevant?
- show coverage hides arcs even when 'below'...
- make samplot mode have better coloring (same as arcs essentially)
- show outlines autohide
- when vertical scrolling, weird behavior that kind of scrolls the page too fast when you just want to scroll element
- more 'group operations'
- fullpage_arcs-collapse-introns-sashimi.png need to scroll down to see the collapsed arcs
- does yeast demo really need remote
- no max height react-app
- show sashimi arcs
- fix types
- fix tsc
- fix the undefined in volatile issue upstream in mobx-state-tree?
- fix the snap types?
- or just revert
- submenu for read connections
- jbrowse-img: expose CLI multi-level synteny (--fasta3/--loc3 or repeatable); render layer already supports N levels, CLI only has --fasta2/--loc2


## assembly

Typecheck clean. Here's my deeper assessment — questioning the design, not just tidying.

Applied (3)

1. Case-insensitive refName resolution was broken — getCanonicalRefName looked up the lowercase map with the raw key, so only already-lowercase inputs resolved. Fixed with refName.toLowerCase(). (real bug — affects locstring navigation like CHR1 when the assembly contig is chr1)
2. "undefined" map-key footgun — unmatched adapter refNames produced a literal "undefined" key via Object.fromEntries. Changed to ?? name identity fallback. (hygiene; benign today but a trap)
3. catch (e) → catch — unused binding.

Flagged for your call (not applied)

Assembly-load failure makes getRefNameMapForAdapter hang forever. This is the one I'd most want to fix next. The chain:

- load() swallows rejections — its .catch returns a resolved promise and stashes the error in self.error. So await assembly.load() never rejects.
- loadRefNameMap then does await when(() => !!(assembly.regions && assembly.refNameAliases)) with no timeout and no error branch. On a load failure those volatiles never get set, so when waits indefinitely.
- The hung promise is memoized in adapterLoads, so it stays hung for the session.

Net symptom: a bad assembly URL leaves tracks spinning forever instead of showing an error. The targeted fix is to make the when predicate observe the error (mobx when rejects if the predicate throws), which also needs 'error' added to the RefNameMapAssembly Pick:
await when(() => {
  if (assembly.error) throw assembly.error
  return !!(assembly.regions && assembly.refNameAliases)
}, { name: 'when assembly ready' })

Considered and deliberately left

- getRefNameAliases/getCytobands/getAssemblyRegions are duplicative, but each is a one-line, self-documenting wrapper used once; a generic instantiateAdapter<T> forces an awkward double-await inline. Net wash — left them.
- Double onBecomeObserved (volatileRegions + refNameAliases both call load()) is redundant but intentional and harmless (load is idempotent).
- loadPre passing conf?.sequence.adapter when configuration is an unresolved safeReference degrades to a confusing Cannot read 'type' of undefined rather than a clear error — minor.

Want me to apply the load-error-propagation fix? It's the only remaining item with real user-visible impact, and it touches error semantics so I held off.
