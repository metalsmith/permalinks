
var path = require('path');
var replace = require('substitute');
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
      if (!html(file)) return;
      var data = files[file];
      var path;

      if (pattern) {
        var keys = params(pattern);
        var obj = {};
        keys.forEach(function(key){
          if (data[key]) obj[key] = slug(data[key]);
        });
        path = replace(pattern, obj);
      } else {
        path = resolve(file);
      }

      // TODO: actually make it work haha, for cases that aren't index.html the
      // other relative files need to be duplicated into the subfolder, so that
      // relative links to images and such still work

      data.path = path;
      path = join(path, 'index.html');
      delete files[file];
      files[path] = data;
    });
  };
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