import { extend } from './colordVendor'
import mix from './colordVendor/plugins/mix'
import names from './colordVendor/plugins/names'
extend([mix, names])
export { Colord, colord } from './colordVendor'
