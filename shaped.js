// Shallowly-embedded combinators for writing function contracts.
// Object language terms (e.g. JS constructors, functions) are used to represent metalanguage predicates (e.g. types, arbitrary predicates).
// An informative error message is printed if an assertion is violated.

// null and undefined stand for themselves.
// String, Boolean, and Number stand for types.
// Functions are taken to be arbitrary predicates.
// Singleton arrays denote arbitrary arrays; arrays with two elements may be used to specify a length.
// Object literals with keys denote objects with specific structure (at least the given keys). The "any object" value is {}.
// objMap denotes map-like objects with arbitrary keys.
// oneOf is disjunction and may be used for enumerations.
// any-thing goes, like in TypeScript.

// TODO
// array length is unimplemented
// array, for arrays of specific things
// object, for assertions on both keys and values
// should objects have exactly the given keys, not just at least?
// func for higher-order functions. we have to wrap and return them to assign blame correctly
// suchThat
// pre and post, use a func after?

// Related work
// Hamcrest (though not wrappng native predicates)
// Contracts and blame in Racket
// https://www.contractsjs.org/
// https://codemix.github.io/contractual/

let { shaped, oneOf, objMap, pred, any, func, nullOr } = (function () {
  function Disj(left, right) {
    this.left = left;
    this.right = right;
  }

  function ObjWithValues(p) {
    this.pred = p;
  }

  function Pred(p) {
    this.pred = p;
  }

  function Func(...args) {
    this.args = args.slice(0, -1);
    this.ret = args[args.length - 1];
  }

  function Any() {}

  function NullOr(p) {
    this.pred = p;
  }

  function _toString(o) {
    if (o === Number || o === String || o === Boolean) {
      return o.name;
    } else if (o === undefined || o === null) {
      return JSON.stringify(o);
    } else if (Array.isArray(o)) {
      return `[${o.map((e) => _toString(e)).join(', ')}]`;
    } else if (o instanceof Disj) {
      return `${_toString(o.left)} || ${_toString(o.right)}`;
    } else if (o instanceof ObjWithValues) {
      return `objMap(${_toString(o.pred)})`;
    } else if (o instanceof Pred) {
      return `pred(${_toString(o.pred)})`;
    } else if (o instanceof Function) {
      return `pred(${o.toString()})`;
    } else if (o instanceof Func) {
      return `func(${o.args.map(_toString).join(',')}, ${_toString(o.ret)})`;
    } else if (o instanceof Any) {
      return 'any';
    } else if (o instanceof NullOr) {
      return `nullOr(${o.pred})`;
    } else if (typeof o === 'object') {
      let keys = Object.keys(o)
        .map((k) => k + ': ' + _toString(o[k]))
        .join(', ');
      return `{${keys}}`;
    } else {
      return JSON.stringify(o);
    }
  }

  function checkShape(obj, pattern, path) {
    // console.debug(obj, pattern, path);
    if (
      (typeof obj === 'string' && pattern === String) ||
      (typeof obj === 'number' && pattern === Number) ||
      (typeof obj === 'boolean' && pattern === Boolean) ||
      (typeof obj === 'undefined' && pattern === undefined) ||
      (obj === null && pattern === null)
    ) {
      // we're good
      return obj;
    } else if (Array.isArray(obj) && Array.isArray(pattern)) {
      return obj.map((o) => checkShape(o, pattern[0], [...path, 'array values']));
    } else if (pattern instanceof Disj) {
      try {
        return checkShape(obj, pattern.left, [...path, 'left']);
      } catch (_e) {
        return checkShape(obj, pattern.right, [...path, 'right']);
      }
    } else if (typeof obj === 'object' && pattern instanceof ObjWithValues) {
      // TODO from here on, return so func is handled
      Object.keys(obj).forEach((k) => checkShape(obj[k], pattern.pred, [...path, `values of key ${k}`]));
    } else if (obj instanceof Function && pattern instanceof Func) {
      // good
    } else if (pattern instanceof Pred && pattern.pred(obj)) {
      // good
      return obj;
    } else if (pattern instanceof Function && pattern(obj) === true) {
      // good
      return obj;
    } else if (pattern instanceof Any) {
      // all good
    } else if (obj === null && pattern instanceof NullOr) {
      // all good
      return null;
    } else if (obj !== null && pattern instanceof NullOr) {
      return checkShape(obj, pattern.pred, [...path, 'null or']);
    } else if (typeof obj === 'object' && typeof pattern === 'object') {
      Object.keys(pattern).forEach((k) => {
        checkShape(obj[k], pattern[k], [...path, `[${k}]`]);
      });
    } else {
      throw {
        path,
        msg: _toString(obj) + ' does not conform to ' + _toString(pattern),
      };
    }
  }

  function shaped(obj, pattern) {
    try {
      let path = [];
      return checkShape(obj, pattern, path);
    } catch (e) {
      // the top-level error involving obj and pattern is often so large as to be useless
      // throw _toString(obj) + ' is not of type ' + _toString(pattern) + ' (' + _e + ')';
      throw `${e.msg}; path: ${e.path.join('/')}`;
    }
    return true;
  }

  function oneOf(a, b) {
    return new Disj(a, b);
  }

  function objMap(p) {
    return new ObjWithValues(p);
  }

  function pred(p) {
    return new Pred(p);
  }

  function func(p) {
    return new Func(p);
  }

  let any = new Any();

  function nullOr(p) {
    return new NullOr(p);
  }

  // some tests...
  function shouldFail(f) {
    try {
      f();
    } catch (e) {
      // console.debug(e);
      return;
    }
    throw `should fail: ${f}`;
  }

  shouldFail(() => shaped([1, 2], [(x) => x == 2]));
  shouldFail(() => shaped(null, String));

  // TODO this isn't implemented yet, just passes because it's a function
  // shouldFail(() =>
  shaped(
    (_) => 1,
    func(
      (x) => x > 1,
      (x) => x % 2 === 0
    )
  );
  // );

  // let prod = false;
  let prod = true;

  if (prod) {
    return new Proxy(
      {},
      {
        get: function (_target, _name) {
          return (obj, _pat) => obj;
        },
      }
    );
  } else {
    return { shaped, oneOf, objMap, pred, any, func, nullOr };
  }
})();
