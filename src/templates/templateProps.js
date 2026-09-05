// Typed template properties: shared by CLI validation, discovery and rendering.
// Built-in template manifests live in assets/extensions/templates/*/extension.toml.

export function resolveTemplateProps(manifest, meta = {}) {
  const result = {}
  for (const [key, schema] of Object.entries(manifest.properties ?? {})) {
    if (schema.default !== undefined) result[key] = structuredClone(schema.default)
    // Preserve legacy top-level fields for built-in layouts.
    if (meta[key] !== undefined) result[key] = meta[key]
  }
  return { ...result, ...(meta.props ?? {}) }
}

export function propertyErrors(value, schema, path) {
  const errors = []
  const valid = schema.type === 'array' ? Array.isArray(value)
    : schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : schema.type === 'integer' ? Number.isInteger(value)
    : typeof value === schema.type && (schema.type !== 'number' || Number.isFinite(value))
  if (!valid) return [`${path} must be ${schema.type}`]
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of: ${schema.enum.join(', ')}`)
  if (typeof value === 'number' && schema.minimum != null && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`)
  if (typeof value === 'number' && schema.maximum != null && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`)
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} items`)
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path} allows at most ${schema.maxItems} items`)
    if (schema.items) value.forEach((item, index) => errors.push(...propertyErrors(item, schema.items, `${path}[${index}]`)))
  }
  return errors
}
