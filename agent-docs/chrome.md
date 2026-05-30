Now that I can see alignments fully, I understand why my binary question was the wrong frame. Let me lay out what's actually blocking universal adoption and the rethink it points to.

Why the current DisplayChrome can't go universal

DisplayChrome bakes in one assumption: the render backend lives at the same component level as the chrome. It takes renderError as a prop, so whoever renders <DisplayChrome> must also be where useDisplayRendering was called.

That holds for the five single-canvas displays (wiggle, multi-wiggle, manhattan, canvas, maf) — one component, one canvas, backend and chrome co-located.

Alignments breaks it by necessity, not stubbornness:
- The backend lives deep — useAlignmentsBase (→ useRenderingBackend) is inside PileupInner, because it's fused with hit-testing, the wheel/scroll handler, and the canvas ref.
- So its terminal states are scattered across three levels: !view.initialized → "Initializing" in AlignmentsDisplayComponent (top); error/regionTooLarge → a div in PileupComponent (middle); renderError → if (renderError) return renderError in PileupInner (deep).

You can't hoist useDisplayRendering to the top for alignments without tearing the canvas away from its hit-test/scroll machinery. So "make alignments root in <DisplayChrome>" genuinely doesn't work — you were right to call it.

The rethink

The fix is to move the abstraction boundary off "a React wrapper that owns the backend" and omodel as the single source of truthate — including renderError.
                                                                                             Concretely:
- useRenderingBackend stops returning error and instead writes it to the model               (model.setRenderError(e) / model.re The backend hook can then liveanywhere — top or deep — because it no longer has to hand its error to the chrome.           - DisplayChrome becomes purely moderen + status overlays). It readsrenderError, error, regionTooLarge, loadingOverlayVisible, initialized all off the model. No renderError prop, no co-location re
- Now DisplayChrome model={model} can wrap any content subtree — one canvas or alignments' whole     pileup tree. Alignments' three scate wrapper at the top; PileupInnerjust renders the canvas and reports its backend error into the model.
This makes adoption structural: every GPU display's registered component wraps its content in        DisplayChrome, the canvas/backend ss, and there is no shape a displaycan take that lets it skip the chrome. It also lines up with the repo's own grain — model state over React-local error/refs, "avoid the

The one thing to validate before coently React-local useState inuseRenderingBackend; it needs to become model volatile that clears on retry/reload. That's the
load-bearing change — everything el

Want me to work this into a concretmodel change, the DisplayChromerewrite to model-only, and the alignments collapse) so you can review the approach before I touch the six displays?

Let me record the principle so it s
