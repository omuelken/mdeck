// Serializable contract shared by CLI validation, discovery and rendering.
const body = { body: { description: 'Markdown content' } }
const imageProps = {
  image: { type: 'string', description: 'Image path' },
  alt: { type: 'string', default: '' },
  fit: { type: 'string', enum: ['cover', 'contain'], default: 'cover' },
  position: { type: 'string', default: 'center' },
}

export const builtinManifests = {
  title: {
    name: 'title', title: 'Title slide', frame: 'title', regions: body, properties: imageProps,
    starter: ':::meta\nlayout: title\n:::\n# My Talk\n## A clear subtitle\n',
  },
  chapter: {
    name: 'chapter', title: 'Chapter divider', frame: 'chapter', regions: body, properties: imageProps,
    starter: ':::meta\nlayout: chapter\nnumber: 1\npart: Part One\n:::\n# Chapter title\n\nWhat this chapter covers.\n',
  },
  focus: {
    name: 'focus', title: 'Big statement', regions: body, properties: {},
    starter: ':::meta\nlayout: focus\n:::\n# One strong idea.\n',
  },
  'image-text': {
    name: 'image-text', title: 'Image + text', regions: body, properties: imageProps,
    starter: ':::meta\nlayout: image-text\n:::\n# Visual context\n\nAdd an image using props.image.\n',
  },
  split: {
    name: 'split', title: 'Split content', regions: { ...body, left: {}, right: {} },
    properties: { ratio: { type: 'array', items: { type: 'number', minimum: 0.01 }, minItems: 2, maxItems: 2, default: [1, 1] } },
    starter: ':::meta\nlayout: split\nprops:\n  ratio: [1, 1]\n:::\n# Compare\n\n:::slot left\nLeft content\n:::\n\n:::slot right\nRight content\n:::\n',
  },
  'full-bleed-image': {
    name: 'full-bleed-image', title: 'Full-bleed image', frame: 'none', regions: body,
    properties: { ...imageProps, overlay: { type: 'boolean', default: false } },
    starter: ':::meta\nlayout: full-bleed-image\nprops:\n  overlay: true\n:::\n# Add an image using props.image\n',
  },
  generic: {
    name: 'generic', title: 'Content slide', regions: body, properties: {},
    starter: '# Heading\n\n- First point\n- Second point\n',
  },
}

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
