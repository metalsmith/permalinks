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
      return new Error(`Permalinks: Clash with another target file ${target}`)
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
 * @property {boolean} trim trim leading and trailing replacement chars, defaults to `true`
 */

/**
 * @callback slugFunction
 * @param {string} filepath
 * @returns {string} slug
 */

/**
 * Linkset definition
 *
 * @typedef {Object} Linkset
 * @property {Object.<string,*>} match An object whose key:value pairs will be used to match files and transform their permalinks according to the rules in this linkset
 * @property {string} pattern A permalink pattern to transform file paths into, e.g. `blog/:date/:title`
 * @property {SlugifyOptions|slugFunction} [slug] [Slugify options](https://github.com/simov/slugify) or a custom slug function of the form `(pathpart) => string`
 * @property {string} [date='YYYY/MM/DD'] [Moment.js format string](https://momentjs.com/docs/#/displaying/format/) to transform Date link parts into, defaults to `YYYY/MM/DD`.
 */

/**
 * `@metalsmith/permalinks` options & default linkset
 *
 * @typedef {Object} Options
 * @property {string} [pattern=':dirname/:basename'] A permalink pattern to transform file paths into, e.g. `blog/:date/:title`. Default is `:dirname/:basename`.
 * @property {string} [date='YYYY/MM/DD'] [Moment.js format string](https://momentjs.com/docs/#/displaying/format/) to transform Date link parts into, defaults to `YYYY/MM/DD`.
 * @property {string} [directoryIndex='index.html'] Basename of the permalinked file (default: `index.html`)
 * @property {boolean} [trailingSlash=false] Whether a trailing `/` should be added to the `file.permalink` property. Useful to avoid redirects on servers which do not have a built-in rewrite module enabled.
 * @property {'error'|'index'|'overwrite'|Function} [duplicates='error'] How to handle duplicate target URI's.
 * @property {Linkset[]} [linksets] An array of additional linksets
 * @property {SlugifyOptions|slugFunction} [slug] {@link SlugifyOptions} or a custom slug function of the form `(pathpart) => string`
 */

// These are the invalid path chars on Windows, on *nix systems all are valid except forward slash.
// However, it is highly unlikely that anyone would want these to appear in a file path and they can still be overridden if necessary
const invalidPathChars = '[<>:"\'|?*]'
const defaultSlugifyRemoveChars = '[^\\w\\s$_+~.()!\\-@\\/]+'
const emptyStr = ''
const dash = '-'

const defaultLinkset = {
  pattern: ':dirname/:basename',
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
function slugFn(options = defaultOptions.slug) {
  options = Object.assign({}, defaultOptions.slug, options)
  if (typeof options.extend === 'object' && options.extend !== null) {
    slugify.extend(options.extend)
  }

  return function defaultSlugFn(text) {
    return slugify(text, options)
  }
}

/**
 * Check whether a file is an HTML file.
 *
 * @param {string} str The path
 * @return {boolean}
 */
const html = (str) => path.extname(str) === '.html'

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
 * Resolve a permalink path string from an existing file `path`.
 *
 * @param {String} str The path
 * @return {String}
 */
const resolve = (str, directoryIndex = 'index.html') => {
  const base = path.basename(str, path.extname(str))
  let ret = path.dirname(str)
  if (base !== path.basename(directoryIndex, path.extname(directoryIndex))) {
    ret = path.join(ret, base).replace(/\\/g, '/')
  }

  return ret
}

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {string} pattern (optional)
 * @param {Object} data
 * @param {Object} options
 *
 * @return {Mixed} String or Null
 */
const replace = (pattern, data, options) => {
  if (!pattern) return null
  // regexparam has logic that interprets a dot as start of an extension name
  // we don't want this here, so we replace it temporarily with a NUL char
  const remapped = pattern.replace(/\./g, '\0')
  const { keys } = route.parse(remapped)
  const ret = {}

  for (let i = 0, key; (key = keys[i++]); ) {
    const val = get(data, key.replace(/\0/g, '.'))
    const isOptional = remapped.match(`${key}\\?`)
    if (!val || (Array.isArray(val) && val.length === 0)) {
      if (isOptional) {
        ret[key] = ''
        continue
      }
      return null
    }
    if (val instanceof Date) {
      ret[key] = options.date(val)
    } else {
      ret[key] = options.slug(val.toString())
    }
  }

  const transformed = route.inject(remapped, ret)

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

  const findLinkset = (file) => {
    const set = normalizedOptions.linksets.find(
      (ls) =>
        ls.match &&
        Object.keys(ls.match).some((key) => {
          if (file[key] === ls.match[key]) {
            return true
          }
          if (Array.isArray(file[key]) && file[key].includes(ls.match[key])) {
            return true
          }
        })
    )

    if (!set) return defaultLinkset
    return set
  }

  return function permalinks(files, metalsmith, done) {
    const debug = metalsmith.debug('@metalsmith/permalinks')
    debug.info('Running with options: %O', normalizedOptions)

    if (normalizedOptions.relative || normalizedOptions.linksets.find((ls) => ls && ls.relative)) {
      return done(new Error('The "relative" option is no longer supported.'))
    }

    const makeUnique = normalizedOptions.duplicates

    Object.keys(files)
      .filter((file) => html(file) && files[file].permalink !== false)
      .forEach((file) => {
        const data = files[file]
        debug('checking file: %s', file)

        const linkset = findLinkset(data)

        debug('applying pattern: %s to file: %s', linkset.pattern, file)

        let ppath =
          replace(
            linkset.pattern,
            {
              ...data,
              basename:
                path.basename(file) === normalizedOptions.directoryIndex ? '' : path.basename(file, path.extname(file)),
              dirname: path.dirname(file)
            },
            { ...normalizedOptions, ...defaultLinkset, ...linkset }
          ) || resolve(file, normalizedOptions.directoryIndex)

        // invalid on Windows, but best practice not to use them anyway
        if (new RegExp(invalidPathChars).test(ppath)) {
          const msg = `Filepath "${file}" contains invalid filepath characters (one of :|<>"*?) after resolving as linkset pattern "${linkset.pattern}"`
          debug.error(msg)
          done(new Error(msg))
        }

        // Override the path with `permalink`  option
        if (Object.prototype.hasOwnProperty.call(data, 'permalink')) {
          ppath = data.permalink
        }

        const out = makeUnique(path.normalize(ppath), files, file, normalizedOptions)
        if (out instanceof Error) {
          return done(out)
        }

        // add to permalink data for use in links in templates
        let permalink = path.posix.join('.', ppath.replace(/\\/g, '/'))
        if (normalizedOptions.trailingSlash) {
          permalink = path.posix.join(permalink, './')
        }

        // contrary to the 2.x "path" property, the permalink property does not override previously set file metadata
        if (!data.permalink) {
          data.permalink = permalink
        }

        delete files[file]
        files[out] = data
      })

    done()
  }
}

export default permalinks
