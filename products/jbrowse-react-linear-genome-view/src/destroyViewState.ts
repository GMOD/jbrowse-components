// the shared implementation, re-exported so hosts get it from this package;
// the subtle part (materializing the session before the tree dies) is stated
// once in product-core rather than in each embedded product
export { destroyViewState } from '@jbrowse/product-core'
