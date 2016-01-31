
var debug = require('debug')('metalsmith-permalinks');
var moment = require('moment');
var path = require('path');
var slug = require('slug-component');
var substitute = require('substitute');
var utils = require('./utils');

var basename = path.basename;
var dirname = path.dirname;
var extname = path.extname;
var join = path.join;

var find = utils.arrayFind;
var merge = utils.objectMerge;

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 *
 * @param {Object} options
 *   @property {String} pattern
 *   @property {String or Function} date
 * @return {Function}
 */

function plugin(options){
  options = normalize(options);

  var linksets          = options.linksets;
  var defaultLinkset    = find(linksets, function(ls) { return !!ls.isDefault; });

  if (!defaultLinkset) {
    defaultLinkset = { 
        pattern : options.pattern,
        relative: options.relative,
        date    : options.date
    };
  }

  var dupes = {};

  function findLinkset(file) {
    var set = find(linksets, function(ls) { 
        return Object.keys(ls.match).reduce(function(sofar, key) {
            if (!sofar) { return sofar; }

            if (file[key] === ls.match[key]) { return true; }
            if (file[key] && file[key].indexOf) {
                return file[key].indexOf(ls.match[key]) > -1;
            }

            return false;
        }, true);
    });

    return set || defaultLinkset;
  }

  return function(files, metalsmith, done){
    setImmediate(done);
    Object.keys(files).forEach(function(file){
      var data = files[file];
      debug('checking file: %s', file);

      if (!html(file)) return;
      if (data['permalink'] === false) return;

      var linkset = merge({}, findLinkset(data), defaultLinkset);
      debug('applying pattern: %s to file: %s', linkset.pattern, file);

      var path = replace(linkset.pattern, data, linkset) || resolve(file);
      var fam = family(file, files);

      if (linkset.relative) {
        // track duplicates for relative files to maintain references
        for (var key in fam) {
          var rel = join(path, key);
          dupes[rel] = fam[key];
        }
      }

      // add to path data for use in links in templates
      data.path = '.' == path ? '' : path;

      var out = join(path, options.indexFile || 'index.html');
      delete files[file];
      files[out] = data;
    });

    // add duplicates for relative files after processing to avoid double-dipping
    // note: `dupes` will be empty if `options.relative` is false
    Object.keys(dupes).forEach(function(dupe){
      files[dupe] = dupes[dupe];
    })
  };
}

/**
 * Normalize an options argument.
 *
 * @param {String or Object} options
 * @return {Object}
 */

function normalize(options){
  if ('string' == typeof options) options = { pattern: options };
  options = options || {};
  options.date = typeof options.date === 'string' ? format(options.date) : format('YYYY/MM/DD');
  options.relative = options.hasOwnProperty('relative') ? options.relative : true;
  options.linksets = options.linksets || [];
  return options;
}

/**
 * Return a formatter for a given moment.js format `string`.
 *
 * @param {String} string
 * @return {Function}
 */

function format(string){
  return function(date){
    return moment(date).utc().format(string);
  };
}

/**
 * Get a list of sibling and children files for a given `file` in `files`.
 *
 * @param {String} file
 * @param {Object} files
 * @return {Object}
 */

function family(file, files){
  var dir = dirname(file);
  var ret = {};

  if ('.' == dir) dir = '';

  for (var key in files) {
    if (key == file) continue;
    if (key.indexOf(dir) != 0) continue;
    if (html(key)) continue;
    var rel = key.slice(dir.length);
    ret[rel] = files[key];
  }

  return ret;
}

/**
 * Resolve a permalink path string from an existing file `path`.
 *
 * @param {String} path
 * @return {String}
 */

function resolve(path){
  var ret = dirname(path);
  var base = basename(path, extname(path));
  if (base != 'index') ret = join(ret, base).replace('\\', '/');
  return ret;
}

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {String} pattern (optional)
 * @param {Object} data
 * @param {Object} options
 * @return {String or Null}
 */

function replace(pattern, data, options){
  if (!pattern) return null;
  var keys = params(pattern);
  var ret = {};

  for (var i = 0, key; key = keys[i++];) {
    var val = data[key];
    if (val == null) return null;
    if (val instanceof Date) {
      ret[key] = options.date(val);
    } else {
      ret[key] = slug(val.toString());
    }
  }

  return substitute(pattern, ret);
}

/**
 * Get the params from a `pattern` string.
 *
 * @param {String} pattern
 * @return {Array}
 */

function params(pattern){
  var matcher = /:(\w+)/g;
  var ret = [];
  var m;
  while (m = matcher.exec(pattern)) ret.push(m[1]);
  return ret;
}

/**
 * Check whether a file is an HTML file.
 *
 * @param {String} path
 * @return {Boolean}
 */

function html(path){
  return /.html/.test(extname(path));
}
