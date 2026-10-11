// What a theme parameter may be set to. A parameter without a type takes any
// text, as before; a typed one says what kind of value it takes, and mdeck
// turns what the author wrote into CSS or says why it cannot:
//
//   size     pixels ("12px", or a number: 12), with min and max in pixels
//   number   a number, with min and max (a strength is one from 0 to 1)
//   switch   1 or 0 (also true and false, on and off, yes and no)
//   choice   one of `choices`
//   font     a CSS font list
//
// The manifest check, `mdeck check`, the slides and the editor all use these
// functions, so they agree on what a value means.

export const PARAM_TYPES = ['size', 'number', 'switch', 'choice', 'font']
export const PARAM_KEYS = ['token', 'title', 'description', 'type', 'min', 'max', 'step', 'choices']
const RANGED = ['size', 'number']
const NUMBER_RE = /^-?(\d+\.?\d*|\.\d+)$/
const SWITCH = new Map([['1', '1'], ['0', '0'], ['true', '1'], ['false', '0'], ['on', '1'], ['off', '0'], ['yes', '1'], ['no', '0']])

// "12px", 12 or "12" as a number of pixels; null when it is not a size.
function pixels(value) {
  const text = String(value).trim().toLowerCase()
  const number = text.endsWith('px') ? text.slice(0, -2).trim() : text
  return NUMBER_RE.test(number) ? Number(number) : null
}

const unit = param => param.type === 'size' ? 'px' : ''

/** The range a parameter was made for, as text ("6px to 20px", "at least 0"), or ''. */
export function paramRange(param) {
  const { min, max } = param
  const u = unit(param)
  if (min != null && max != null) return `${min}${u} to ${max}${u}`
  if (min != null) return `at least ${min}${u}`
  if (max != null) return `at most ${max}${u}`
  return ''
}

/** The kind of value a parameter takes, for listings: " (size, 0px to 48px)", " (1 or 0)", or '' without a type. */
export function paramKind(param) {
  if (!param.type) return ''
  if (param.type === 'switch') return ' (1 or 0)'
  if (param.type === 'choice') return ` (${param.choices.join(', ')})`
  const range = paramRange(param)
  return ` (${param.type}${range ? ', ' + range : ''})`
}

/**
 * The CSS for a value an author set, or why it cannot be used.
 * Returns { value } with a note when it lies outside the range (it is still
 * used: the range is what the theme was made for, not a limit), or { problem }.
 */
export function paramValue(param, raw) {
  const type = param.type
  if (raw == null || (typeof raw === 'object')) return { problem: 'needs a single value' }
  if (!type) return { value: String(raw) }
  const text = String(raw).trim()
  if (!text) return { problem: 'is empty' }
  if (type === 'font') return { value: text }
  if (type === 'switch') {
    const value = SWITCH.get(text.toLowerCase())
    return value ? { value } : { problem: 'is a switch: 1 or 0' }
  }
  if (type === 'choice') {
    return param.choices.includes(text) ? { value: text } : { problem: `must be one of: ${param.choices.join(', ')}` }
  }
  const number = type === 'size' ? pixels(text) : (NUMBER_RE.test(text) ? Number(text) : null)
  if (number == null) return { problem: type === 'size' ? 'is a size in pixels, such as 12px' : 'is a number, such as 0.5' }
  const value = type === 'size' ? `${number}px` : String(number)
  const outside = (param.min != null && number < param.min) || (param.max != null && number > param.max)
  return outside ? { value, note: `is made for ${paramRange(param)}` } : { value }
}

/**
 * What is wrong with a parameter's settings in a manifest, as [key, message]
 * pairs; `fallback` is its default (the token's value), which must fit it too.
 */
export function paramSettingProblems(param, fallback) {
  const problems = []
  for (const key of Object.keys(param)) if (!PARAM_KEYS.includes(key)) problems.push([key, `Unknown parameter setting. Allowed: ${PARAM_KEYS.join(', ')}`])
  for (const key of ['title', 'description']) if (param[key] != null && typeof param[key] !== 'string') problems.push([key, 'must be text'])
  const type = param.type
  if (type == null) {
    for (const key of ['min', 'max', 'step', 'choices']) if (param[key] != null) problems.push([key, 'needs a type (size or number for min, max and step; choice for choices)'])
    return problems
  }
  if (!PARAM_TYPES.includes(type)) return [...problems, ['type', `must be one of: ${PARAM_TYPES.join(', ')}`]]
  for (const key of ['min', 'max', 'step']) {
    if (param[key] == null) continue
    if (!RANGED.includes(type)) problems.push([key, `is for a size or a number, not a ${type}`])
    else if (typeof param[key] !== 'number' || !Number.isFinite(param[key])) problems.push([key, `must be a number${type === 'size' ? ' of pixels, such as 12' : ''}`])
  }
  if (typeof param.step === 'number' && param.step <= 0) problems.push(['step', 'must be more than 0'])
  if (typeof param.min === 'number' && typeof param.max === 'number' && param.min > param.max) problems.push(['max', 'must not be less than min'])
  if (type === 'choice') {
    const choices = param.choices
    if (!Array.isArray(choices) || !choices.length || choices.some(choice => typeof choice !== 'string' || !choice.trim())) problems.push(['choices', 'a choice needs a list of its values, such as choices = ["left", "right"]'])
    else if (new Set(choices).size !== choices.length) problems.push(['choices', 'lists a value twice'])
  } else if (param.choices != null) problems.push(['choices', `is for a choice, not a ${type}`])
  if (problems.length || fallback == null) return problems
  // The default is the token's value: it has to be a value of this type too.
  const result = paramValue(param, fallback)
  if (result.problem) problems.push(['type', `the token's value ${JSON.stringify(fallback)} ${result.problem}`])
  else if (result.note) problems.push(['type', `the token's value ${JSON.stringify(fallback)} lies outside ${paramRange(param)}`])
  else if (type !== 'font' && result.value !== fallback) problems.push(['type', `write the token's value as ${JSON.stringify(result.value)}`])
  return problems
}

/** A parameter's typed settings, as a normalized manifest keeps them. */
export function paramSettings(param) {
  if (!param.type) return {}
  return Object.fromEntries(['type', 'min', 'max', 'step', 'choices'].filter(key => param[key] != null).map(key => [key, key === 'choices' ? [...param[key]] : param[key]]))
}
