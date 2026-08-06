The view inherits CSS from its host — there is no shadow-DOM isolation in the
default rendering path, so wrapping it in a styled container just composes.

For the opposite, guaranteed isolation from a host page's global styles, render
it inside a [Shadow DOM](../theming/#shadow-dom) instead.
