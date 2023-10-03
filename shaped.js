// Shallowly-embedded combinators for writing function contracts.
// Object language terms (e.g. JS constructors, functions) are used to represent metalanguage predicates (e.g. types, arbitrary predicates).
// An informative error message is printed if an assertion is violated.

// null and undefined stand for themselves.
// String, Boolean, and Number stand for types.
// Functions are taken to be arbitrary predicates.
// Singleton arrays denote arbitrary arrays; arrays with two elements may be used to specify a length.
// Object literals with keys denote objects with specific structure (at least the given keys). The "any object" value is {}.
// objMap denotes map-like objects with arbitrary keys, with values constrained by the given predicate.
// oneOf is disjunction and may be used for enumerations.
// any-thing goes, like in TypeScript.

// TODO
// array length is unimplemented
// array, for arrays of specific things
// object, for assertions on both keys and values
// should objects have exactly the given keys, not just at least?
// variadic args for functions
// suchThat

// Related work
// Hamcrest (though not wrappng native predicates)
// Contracts and blame in Racket https://www2.ccs.neu.edu/racket/pubs/icfp2002-ff.pdf
// https://www.contractsjs.org/
// https://codemix.github.io/contractual/

let { shaped, oneOf, objMap, pred, any, func, nullOr, define } = (function () {
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
      return obj.map((o, i) => checkShape(o, pattern[0], [...path, `array value at idx ${i}`]));
    } else if (pattern instanceof Disj) {
      try {
        return checkShape(obj, pattern.left, [...path, `disj ${_toString(pattern.left)}`]);
      } catch (_e) {
        return checkShape(obj, pattern.right, [...path, `disj ${_toString(pattern.right)}`]);
      }
    } else if (typeof obj === 'object' && pattern instanceof ObjWithValues) {
      // TODO from here on, return so func is handled
      Object.keys(obj).forEach((k) => checkShape(obj[k], pattern.pred, [...path, `values of key ${k}`]));
    } else if (pattern instanceof Function && obj instanceof pattern) {
      // user-defined classes, should be before arbitrary predicates
      return obj;
    } else if (obj instanceof Function && pattern instanceof Func) {
      // pre/post
      return (...args) => {
        // as this is a simple library without a preprocessor, the caller will always be blamed for precondition failures, no matter whether the failure is due to a closed-over value (in which case the definition site should be blamed)
        checkShape(args, pattern.args, [...path, 'func args']);
        let res = obj(...args);
        checkShape(res, pattern.ret, [...path, 'func ret']);
        return res;
      };
    } else if (
      (pattern instanceof Pred && pattern.pred(obj) === true) ||
      (pattern instanceof Function && pattern(obj) === true)
    ) {
      // arbitrary predicates
      return obj;
    } else if (pattern instanceof Any) {
      // all good
      return obj;
    } else if (obj === null && pattern instanceof NullOr) {
      // all good
      return null;
    } else if (obj !== null && pattern instanceof NullOr) {
      return checkShape(obj, pattern.pred, [...path, 'null or']);
    } else if (typeof obj === 'object' && typeof pattern === 'object') {
      Object.keys(pattern).forEach((k) => {
        checkShape(obj[k], pattern[k], [...path, `key ${k}`]);
      });
    } else {
      throw {
        path,
        msg: _toString(obj) + ' does not conform to ' + _toString(pattern),
      };
    }
  }

  let useDebugger = false;

  function shaped(obj, pattern) {
    try {
      let path = [];
      return checkShape(obj, pattern, path);
    } catch (e) {
      let msg = `${e.msg}; path: ${e.path.join('/')}`;
      if (useDebugger) {
        console.error(msg);
        debugger;
      } else {
        throw msg;
      }
      // the top-level error involving obj and pattern is often so large as to be useless
      // throw _toString(obj) + ' is not of type ' + _toString(pattern) + ' (' + _e + ')';
      // throw msg;
    }
  }

  function define(pre, post, f) {
    return shaped(f, func(...pre, post));
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

  function func(...p) {
    return new Func(...p);
  }

  let any = new Any();

  function nullOr(p) {
    return new NullOr(p);
  }

  // some tests... uses the fact that we throw until the end of this module
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
  let f = shaped(
    (_) => 3,
    func(
      (x) => x > 1,
      (x) => x % 2 === 0
    )
  );
  shouldFail(() => {
    f(1);
  });
  shouldFail(() => {
    f(2);
  });
  let g = define(
    [(x) => x > 1],
    (x) => x % 2 === 0,
    (_) => 3
  );
  shouldFail(() => {
    g(2);
  });

  if (DEV) {
    // in dev mode, we want to start the debugger
    useDebugger = true;
    return { shaped, oneOf, objMap, pred, any, func, nullOr, define };
  } else {
    // in prod mode, all assertions pass.
    // all predicate constructors are identity functions, but this is fine because they are ignored by shaped.
    return new Proxy(
      {},
      {
        get: function (_target, name) {
          switch (name) {
            case 'define':
              return (...args) => args[args.length - 1];
            default:
              return (obj, _pat) => obj;
          }
        },
      }
    );
  }
})();
