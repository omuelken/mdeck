// Maps layout property schemas to form controls and back.
import yaml from 'js-yaml'

export function fieldKind(schema = {}) {
  if (Array.isArray(schema.enum) && schema.enum.length) return 'select'
  if (schema.type === 'boolean') return 'checkbox'
  if (schema.type === 'number' || schema.type === 'integer') return 'number'
  if (schema.type === 'array' || schema.type === 'object') return 'yaml'
  return 'text'
}

// Returns { value } or { error } for a control's raw input.
export function parseFieldValue(kind, raw, schema = {}) {
  if (kind === 'checkbox') return { value: Boolean(raw) }
  if (kind === 'number') {
    if (String(raw).trim() === '') return { value: undefined }
    const value = Number(raw)
    if (!Number.isFinite(value)) return { error: 'Enter a number' }
    if (schema.type === 'integer' && !Number.isInteger(value)) return { error: 'Enter a whole number' }
    return { value }
  }
  if (kind === 'yaml') {
    if (String(raw).trim() === '') return { value: undefined }
    try {
      const value = yaml.load(raw)
      return { value }
    } catch (error) { return { error: error.reason ?? error.message } }
  }
  return { value: String(raw) }
}

export function formatFieldValue(kind, value) {
  if (value === undefined || value === null) return ''
  if (kind === 'yaml') return yaml.dump(value, { flowLevel: Array.isArray(value) ? 0 : 1, lineWidth: -1, noRefs: true }).replace(/\n$/, '')
  return String(value)
}
