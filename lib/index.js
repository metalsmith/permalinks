
var debug = require('debug')('metalsmith-permalinks');
var path = require('path');
var substitute = require('substitute');
var slug = require('slug-component');

var basename = path.basename;
var dirname = path.dirname;
var extname = path.extname;
var join = path.join;

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin to hide drafts from the output.
 *
 * @param {Object} options
 *   @property {String} pattern
 * @return {Function}
 */

function plugin(options){
  options = options || {};
  var pattern = options.pattern;

  return function(files, metalsmith, done){
    setImmediate(done);

    Object.keys(files).forEach(function(file){
      debug('checking file: %s', file);
      if (!html(file)) return;
      var data = files[file];
      debug('permalinking file: %s', file);
      var path = data.path = replace(pattern, data) || resolve(file);

      // TODO: actually make it work haha, for cases that aren't index.html the
      // other relative files need to be duplicated into the subfolder, so that
      // relative links to images and such still work

      path = join(path, 'index.html');
      delete files[file];
      files[path] = data;
    });
  };
}

/**
 * Replace a `pattern` with a file's `data`.
 *
 * @param {String} pattern (optional)
 * @param {Object} data
 * @return {String or Null}
 */

function replace(pattern, data){
  if (!pattern) return null;
  var keys = params(pattern);
  var ret = {};

  for (var i = 0, key; key = keys[i++];) {
    if (!data[key]) return null;
    ret[key] = slug(data[key]);
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

/**
 * Resolve a permalink path string from an existing file `path`.
 *
 * @param {String} path
 * @return {String}
 */

function resolve(path){
  var ret = dirname(path);
  var base = basename(path, extname(path));
  if (base != 'index') ret = join(ret, base);
  return ret;
}