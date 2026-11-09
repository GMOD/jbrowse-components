Prefer `name`. A span is interbase (0-based, half-open), so coordinates copied
from the location box match nothing. `featureHighlights` is display state, not a
config slot, so it goes on the `view.tracks` entry; in `displayDefaults` it is
dropped without a word.
