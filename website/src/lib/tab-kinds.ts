// The tabs the fence widget (remark-config-cli-tabs.ts) and the figure recipe
// (spec-recipe/html.ts) both draw. TabMemory.astro carries a reader's pick
// between the two by kind, so each shared tab has its kind, and its label where
// the two say the same thing, here.
export const APP_TAB = { kind: 'desktop', label: 'In the app' } as const

export const JSON_TAB_KIND = 'config'
