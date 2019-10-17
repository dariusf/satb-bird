// Tiny DSL for asserting that data has a given shape
function Disj(left, right) {
  this.left = left;
  this.right = right;
}

export function or(a, b) {
  return new Disj(a, b);
}

function _toString(o) {
  if (o === Number || o === String || o === Boolean) {
    return o.name;
  } else if (Array.isArray(o)) {
    return '[' + o.map(e => _toString(e)).join(', ') + ']';
  } else if (o instanceof Disj) {
    return _toString(o.left) + ' || ' + _toString(o.right);
  } else if (o === undefined || o === null) {
    return JSON.stringify(o);
  } else if (typeof o === 'object') {
    return (
      '{' +
      Object.keys(o)
        .map(k => k + ': ' + _toString(o[k]))
        .join(', ') +
      '}'
    );
  } else {
    return JSON.stringify(o);
  }
}

function _shape(obj, pattern) {
  if (
    (typeof obj === 'string' && pattern === String) ||
    (typeof obj === 'number' && pattern === Number) ||
    (typeof obj === 'boolean' && pattern === Boolean) ||
    (typeof obj === 'undefined' && pattern === undefined) ||
    (obj === null && pattern === null)
  ) {
    // we're good
  } else if (Array.isArray(obj) && Array.isArray(pattern)) {
    obj.forEach(o => _shape(o, pattern[0]));
  } else if (pattern instanceof Disj) {
    try {
      _shape(obj, pattern.left);
    } catch (_e) {
      _shape(obj, pattern.right);
    }
  } else if (typeof obj === 'object' && typeof pattern === 'object') {
    Object.keys(pattern).forEach(k => {
      _shape(obj[k], pattern[k]);
    });
  } else {
    throw _toString(obj) + ' is not of type ' + _toString(pattern);
  }
}

export function shaped(obj, pattern) {
  try {
    _shape(obj, pattern);
  } catch (_e) {
    // Ignore the root cause and fail this check
    // TODO print a path expression here
    throw _toString(obj) + ' is not of type ' + _toString(pattern) + ' (' + _e + ')';
  }
  return true;
}

export default { or, shaped };
