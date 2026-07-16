// Primary internal site pages shown in the nav bar (BaseLayout). The home page,
// search, and the non-nav pages (`cancer`, `features`, `contact`, `plugin_store`)
// are handled separately by their consumers — `plugin_store` lives in the docs
// sidebar (see `buildShowcaseGroups`); see the sitemap's `staticRoutes` for
// sitemap coverage of all of them.
export const navLinks = [
  { path: 'docs', label: 'Docs' },
  { path: 'blog', label: 'Blog' },
  { path: 'download', label: 'Download' },
  { path: 'gallery', label: 'Gallery' },
  { path: 'demos', label: 'Demos' },
]
