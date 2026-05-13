import tokensCSS from './tokens.css?inline'
import templatesCSS from './templates.css?inline'
import themeMeta from './meta.json'
import defaultPalette from './palettes/default.json'
import darkPalette from './palettes/dark.json'
import blackCherryPalette from './palettes/black-cherry.json'
import noirPalette from './palettes/noir.json'

export const palettes = {
  default:        defaultPalette,
  dark:           darkPalette,
  'black-cherry': blackCherryPalette,
  noir:           noirPalette,
}

export { tokensCSS, templatesCSS, themeMeta }
