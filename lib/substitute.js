
/**
 * Expose `substitute`
 */

module.exports = substitute;

/**
 * Type.
 */

var type = Object.prototype.toString;

/**
 * Substitute `:prop` with the given `obj` in `str`
 *
 * @param {String} str
 * @param {Object or Array} obj
 * @param {RegExp} expr
 * @return {String}
 * @api public
 */

function substitute(str, obj, expr){
  if (!obj) throw new TypeError('expected an object');
  expr = expr || /:(\w+)/g;
  return str.replace(expr, function(_, prop){
    switch (type.call(obj)) {
      case '[object Object]':
        return null != obj[prop] ? obj[prop] : _;
      case '[object Array]':
        var val = obj.shift();
        return null != val ? val : _;
    }
  });
}
