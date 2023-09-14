import { extend } from 'colord'
import mix from 'colord/plugins/mix'
import names from 'colord/plugins/names'
extend([mix, names])

export { Colord, colord } from 'colord'
