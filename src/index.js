import path from 'path'
import { dateFormatter as format } from './date.js'
import slugify from 'slugify'
import * as route from 'regexparam'
import get from 'dlv'

const dupeHandlers = {
  error(targetPath, filesObj, filename, opts) {
    const target = path.join(targetPath, opts.directoryIndex)
    const currentBaseName = path.basename(filename)

    if (filesObj[target] && currentBaseName !== opts.directoryIndex) {
      return new Error(`Destination path collision for source file "${filename}" with target "${target}"`)
    }
    return target
  },
  index(targetPath, filesObj, filename, opts) {
    let target,
      counter = 0,
      postfix = ''
    do {
      target = path.join(`${targetPath}${postfix}`, opts.directoryIndex)
      postfix = `-${++counter}`
    } while (filesObj[target])
    return target
  },
  overwrite(targetPath, filesObj, filename, opts) {
    return path.join(targetPath || '', opts.directoryIndex)
  }
}

/**
 * [Slugify options](https://github.com/simov/slugify#options)
 *
 * @typedef {Object} SlugifyOptions
 * @property {boolean} extend extend known unicode symbols with a `{'char': 'replacement'}` object
 * @property {string} [replacement='-'] replace spaces with replacement character, defaults to `-`
 * @property {RegExp} [remove] remove characters that match regex
 * @property {boolean} [lower=true] convert to lower case, defaults to `true`
 * @property {boolean} [strict=false] strip special characters except replacement, defaults to `false`
 * @property {string} [locale] language code of the locale to use
 * @property {boolean} [trim=true] trim leading and trailing replacement chars, defaults to `true`
 */

/**
 * @callback slugFunction
 * @param {string} filepath
 * @returns {string} slug
 */

/**
 * @callback dateFunction
 * @param {Date} date
 * @returns {string} formattedDate
 */

/**
 * Linkset definition
 *
 * @typedef {Object} Linkset
 * @property {string|string[]|Object.<string,*>} [match="**\/*.html"]
 * * A glob pattern or array of glob patterns passed to {@linkcode Metalsmith.match}, or an object whose `key:value` pairs
 * will be used to match files when at least one `key:value` pair matches, and transform their permalinks according to the rules in this linkset.
 * @property {string} pattern A permalink pattern to transform file paths into, e.g. `blog/:date/:title`
 * @property {SlugifyOptions|slugFunction} [slug] [Slugify options](https://github.com/simov/slugify) or a custom slug function of the form `(pathpart) => string`
 * @property {string|dateFunction} [date='YYYY/MM/DD'] [Date format string](https://github.com/metalsmith/permalinks/#date-formatting) to transform Date link parts into, or a custom date formatting function. Defaults to `YYYY/MM/DD`.
 */

/**
 * `@metalsmith/permalinks` options & default linkset
 *
 * @typedef {Object} Options
 * @property {string} [pattern=':dirname?/:basename'] A permalink pattern to transform file paths into, e.g. `blog/:date/:title`. Default is `:dirname?/:basename`.
 * @property {string} [date='YYYY/MM/DD'] [Date format string](https://github.com/metalsmith/permalinks/#date-formatting) to transform Date link parts into, or a custom date formatting function. Defaults to `YYYY/MM/DD`.
 * @property {string} [directoryIndex='index.html'] Basename of the permalinked file (default: `index.html`)
 * @property {boolean} [trailingSlash=false] Whether a trailing `/` should be added to the `file.permalink` property. Useful to avoid redirects on servers which do not have a built-in rewrite module enabled.
 * @property {'error'|'index'|'overwrite'|Function} [duplicates='error'] How to handle duplicate target URI's.
 * @property {Linkset[]} [linksets] An array of additional linksets
 * @property {SlugifyOptions|slugFunction} [slug] {@link SlugifyOptions} or a custom slug function of the form `(pathpart) => string`
 */

// These are the invalid path chars on Windows, on *nix systems all are valid except forward slash.
// However, it is highly unlikely that anyone would want these to appear in a file path and they can still be overridden if necessary
const invalidPathChars = '[<>:"|?*]'
const defaultSlugifyRemoveChars = '[^\\w\\s$_+~.()!\\-@\\/]+'
const emptyStr = ''
const dash = '-'

const defaultLinkset = {
  match: '**/*.html',
  pattern: ':dirname?/:basename',
  date: {
    format: 'YYYY/MM/DD',
    locale: 'en-US'
  },
  slug: {
    lower: true,
    remove: new RegExp(`${defaultSlugifyRemoveChars}|${invalidPathChars}`, 'g'),
    extend: {
      // by default slugify strips these, resulting in word concatenation. Map these chars to dash to force a word break
      ':': dash,
      '|': dash,
      '/': dash,
      // by default slugify translates these to "smaller" & "greater", unwanted when a <html> tag is in the permalink
      '<': emptyStr,
      '>': emptyStr
    }
  }
}

/** @type {Options} */
const defaultOptions = {
  trailingSlash: false,
  linksets: [],
  duplicates: 'error',
  directoryIndex: 'index.html'
}

/**
 * Maps the slugify function to slug to maintain compatibility
 *
 * @param  {String} text
 * @param  {Object} options
 *
 * @return {String}
 */
function slugFn(options = defaultLinkset.slug) {
  options = Object.assign({}, defaultLinkset.slug, options)
  if (typeof options.extend === 'object' && options.extend !== null) {
    slugify.extend(options.extend)
  }

  return function defaultSlugFn(text) {
    return slugify(text, options)
  }
}

const normalizeLinkset = (linkset, defaultLs = defaultLinkset) => {
  linkset = { ...defaultLs, ...linkset }
  if (typeof linkset.slug !== 'function') {
    linkset.slug = slugFn(linkset.slug)
  }
  if (typeof linkset.date !== 'function') {
    linkset.date =
      typeof linkset.date === 'string'
        ? format(linkset.date, defaultLs.date.locale)
        : format((linkset || defaultLs).date.format, linkset.date.locale)
  }
  return linkset
}

/**
 * Normalize an options argument.
 *
 * @param  {string|Options} options
 * @return {Object}
 */
const normalizeOptions = (options) => {
  if (typeof options === 'string') {
    options = { pattern: options }
  }
  options = Object.assign({}, defaultOptions, options)

  if (options.duplicates && Object.keys(dupeHandlers).includes(options.duplicates)) {
    options.duplicates = dupeHandlers[options.duplicates]
  }
  // eslint-disable-next-line prefer-const
  let { trailingSlash, linksets, duplicates, directoryIndex, ...defaultLs } = options
  defaultLs = normalizeLinkset(defaultLs, defaultLinkset)
  linksets = linksets.map((ls) => normalizeLinkset(ls, defaultLs)).concat([defaultLs])

  return {
    trailingSlash,
    duplicates,
    linksets,
    directoryIndex
  }
}

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {Object} options
 * @param {Object} data
 *
 * @return {Mixed} String or Null
 */
const replace = ({ pattern, ...options }, data) => {
  // regexparam has logic that interprets a dot as start of an extension name
  // we don't want this here, so we replace it temporarily with a NUL char
  const remapped = pattern.replace(/\./g, '\0')
  const { keys } = route.parse(remapped)
  const ret = {}

  for (let i = 0, key; (key = keys[i++]); ) {
    const keypath = key.replace(/\0/g, '.')
    const val = get(data, keypath)
    const isOptional = remapped.match(`${key}\\?`)
    if (!val || (Array.isArray(val) && val.length === 0)) {
      if (isOptional) {
        ret[key] = ''
        continue
      }
      throw new Error(`Could not substitute ':${keypath}' in pattern '${pattern}', '${keypath}' is undefined`)
    }
    if (val instanceof Date) {
      ret[key] = options.date(val)
    } else if (key === 'dirname') {
      ret[key] = val
    } else {
      ret[key] = options.slug(val.toString())
    }
  }

  let transformed = route.inject(remapped, ret)
  if (path.basename(transformed) === path.basename(options.directoryIndex, path.extname(options.directoryIndex)))
    transformed = path.dirname(transformed)
  // handle absolute paths
  if (transformed.startsWith('/')) return transformed.slice(1)
  return transformed
}

/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 *
 * @param {Options} options
 * @returns {import('metalsmith').Plugin}
 */
function permalinks(options) {
  const normalizedOptions = normalizeOptions(options)
  const defaultLinkset = normalizedOptions.linksets[normalizedOptions.linksets.length - 1]

  const findLinkset = (file, path, metalsmith) => {
    const set = normalizedOptions.linksets.find((ls) => {
      if (typeof ls.match === 'string' || Array.isArray(ls.match)) return !!metalsmith.match(ls.match, [path]).length
      return Object.keys(ls.match).some((key) => {
        if (file[key] === ls.match[key]) {
          return true
        }
        if (Array.isArray(file[key]) && file[key].includes(ls.match[key])) {
          return true
        }
      })
    })

    if (!set) return defaultLinkset
    return set
  }

  return function permalinks(files, metalsmith, done) {
    const debug = metalsmith.debug('@metalsmith/permalinks')
    debug.info('Running with options (normalized): %O', normalizedOptions)

    if (normalizedOptions.relative || normalizedOptions.linksets.find((ls) => ls && ls.relative)) {
      return done(new Error('The "relative" option is no longer supported.'))
    }

    const makeUnique = normalizedOptions.duplicates
    const patternMatch = normalizedOptions.linksets[normalizedOptions.linksets.length - 1].match

    metalsmith.match(patternMatch, Object.keys(files)).forEach((file) => {
      // when permalink is false, set the permalink property to the current file path and return
      if (files[file].permalink === false) {
        debug('Skipping permalink for file "%s"', file)
        files[file].permalink = file
        return
      }

      const data = files[file]
      const fileSpecificPermalink = data.permalink
      const hasOwnPermalinkDeclaration = !!fileSpecificPermalink
      const linkset = findLinkset(data, file, metalsmith)
      const permalinkTransformContext = { ...normalizedOptions, ...defaultLinkset, ...linkset }
      if (hasOwnPermalinkDeclaration) permalinkTransformContext.pattern = fileSpecificPermalink

      debug('Applying pattern: "%s" to file: "%s"', linkset.pattern, file)

      let ppath

      // Override the path with `permalink`  option. Before the replace call, so placeholders can also be used in front-matter
      if (Object.prototype.hasOwnProperty.call(data, 'permalink')) {
        ppath = data.permalink
      }

      try {
        ppath = replace(permalinkTransformContext, {
          ...data,
          basename: path.basename(file, path.extname(file)),
          dirname: path.dirname(file) === '.' ? '' : path.dirname(file)
        })
      } catch (err) {
        return done(new Error(`${err.message} for file '${file}'`))
      }

      // invalid on Windows, but best practice not to use them anyway
      if (new RegExp(invalidPathChars).test(ppath)) {
        const msg = `Permalink "${ppath}" for file "${file}" contains invalid filepath characters (one of :|<>"*?) after resolution with linkset pattern "${linkset.pattern}"`
        debug.error(msg)
        return done(new Error(msg))
      }

      const out = makeUnique(path.normalize(ppath), files, file, normalizedOptions)
      if (out instanceof Error) {
        return done(out)
      }

      // add to permalink data for use in links in templates
      const { join, normalize } = path.posix
      // files matched for permalinking that are already at their destination (/index.html) have an empty string permalink ('')
      // normalize('') results in '.', which we don't want here
      let permalink = ppath.length ? normalize(ppath.replace(/\\/g, '/')) : ppath
      // only rewrite data.permalink when a file-specific permalink contains :pattern placeholders
      if (hasOwnPermalinkDeclaration) {
        if (permalink !== fileSpecificPermalink) data.permalink = permalink
      } else {
        // only add trailingSlash when permalink !== ''
        if (permalink && normalizedOptions.trailingSlash) permalink = join(permalink, './')
        data.permalink = permalink
      }

      delete files[file]
      files[out] = data

      debug('Moved file "%s" to "%s" (permalink = "%s")', file, out, data.permalink)
    })

    done()
  }
}

export default permalinks
