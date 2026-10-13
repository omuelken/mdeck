// A dataview's options are the <data> tag's other attributes, typed by the
// dataview's manifest ([options], like a layout's properties). Attributes are
// text; here they become what the option takes: a number, a whole number,
// true or false, or text. The slides and `mdeck check` use the same reading.
import { SHARED_ATTRIBUTES } from './dataset.js'
import { propertyErrors } from '../layouts/layoutProps.js'

const TRUE = ['', 'true', 'yes', 'on', '1']
const FALSE = ['false', 'no', 'off', '0']

function coerce(text, schema) {
  const value = String(text).trim()
  if (schema.type === 'boolean') return TRUE.includes(value.toLowerCase()) ? true : FALSE.includes(value.toLowerCase()) ? false : value
  if (schema.type === 'number' || schema.type === 'integer') return value !== '' && Number.isFinite(Number(value)) ? Number(value) : value
  return String(text)
}

/** The options for `manifest` from the tag's attributes: { options, problems: [{ severity, message }] }. */
export function dataviewOptions(manifest, attrs = {}) {
  const options = {}, problems = []
  const schemas = manifest?.options ?? {}
  for (const [name, schema] of Object.entries(schemas)) {
    if (attrs[name] == null) { if (schema.default !== undefined) options[name] = schema.default; continue }
    const value = coerce(attrs[name], schema)
    const errors = propertyErrors(value, schema, name)
    if (errors.length) {
      problems.push({ severity: 'error', message: `${errors.join('; ')} (got "${attrs[name]}")` })
      if (schema.default !== undefined) options[name] = schema.default
    } else options[name] = value
  }
  for (const name of Object.keys(attrs)) {
    if (SHARED_ATTRIBUTES.includes(name) || name.startsWith('data-') || name.startsWith('aria-') || Object.hasOwn(schemas, name)) continue
    const known = Object.keys(schemas)
    problems.push({ severity: 'warning', message: `${manifest?.id ?? 'This dataview'} has no option "${name}"${known.length ? `; it takes: ${known.join(', ')}` : ''}` })
  }
  return { options, problems }
}
