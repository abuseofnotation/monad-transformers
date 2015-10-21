(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports.promise = {
  name: 'promise',
  of: function of(val) {
    return function (resolve) {
      return resolve(val);
    };
  },
  map: function map(funk, val) {
    return function (resolve) {
      val(function (value) {
        return resolve(funk(value));
      });
    };
  },

  flat: function flat(val, innerMonad) {
    return function (resolve) {
      val(function (i) {
        innerMonad.map(function (innerPromise) {
          innerPromise(function (value) {
            resolve(innerMonad.map(function () {
              return value;
            }, i));
          });
        }, i);
      });
    };
  }
};

},{}],2:[function(require,module,exports){
'use strict';

exports.id = {
  name: 'ID',
  of: function of(val) {
    return { idVal: val };
  },
  chain: function chain(funk, val) {
    return val.chain(function (innerId) {
      return funk(innerId.idVal);
    });
  },
  lift: function lift(val) {
    return val.chain(function (innerValue) {
      return val.of({ idVal: innerValue });
    });
  }
};

exports.maybe = {
  name: 'Maybe',
  of: function of(val) {
    return { maybeVal: val };
  },
  chain: function chain(funk, val) {
    return val.chain(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
    });
  },
  lift: function lift(val) {
    return val.chain(function (innerValue) {
      return val.of({ maybeVal: innerValue });
    });
  },
  nothing: function nothing() {
    return { maybeValue: undefined };
  },
  get: function get(key, val) {
    return { maybeVal: val[key] };
  }
};
exports.list = {
  name: 'List',
  of: function of(val) {
    return val.constructor === Array ? val : [val];
  },
  chain: function chain(funk, val) {
    return val.chain(function (innerList) {
      val;
      debugger;
      return innerList.reduce(function (list, val) {
        return list.concat(funk(val));
      }, []);
    });
  },
  lift: function lift(val) {
    return val.chain(function (innerValue) {
      debugger;
      return val.of([innerValue]);
    });
  }
};

},{}],3:[function(require,module,exports){
'use strict';

exports.prim = require('./prim');
exports.data = require('./data');
exports.comp = require('./comp');

var idProto = {
  // The 'of' function wraps a value in a monad.
  // In the case of the identity monad, we don't do anything, so we don't really
  // need to wrap it.
  of: function of(val) {
    return val;
  },
  // identity monad's chain implementation.
  // Since no packing and unpacking takes place,
  // all we have to do is to apply the function
  chain: function chain(funk) {
    return funk(this._value);
  }
};

// Unwraps a wrapped value
var unwrap = function unwrap(val) {
  if (!val.hasOwnProperty('_value')) {
    throw JSON.stringify(val) + ' is not a wrapped value';
  }
  return val._value;
};

// Wraps a value in a specified prototype
var wrapIn = function wrapIn(proto, val) {
  var obj = Object.create(proto);
  obj._value = val;
  return Object.freeze(obj);
};

exports.make = function make_monad(outer, inner) {
  // The constructor function creates a new object and wraps it in the stack prototype
  function create(val) {
    return wrapIn(stackProto, val);
  }

  // Define the prototype of the outer monad.
  var outerProto = {
    of: outer.of,
    // Here we just take the 'chain' function from the monad's definition,
    // and apply it to the value, placed in the object's '_value' property
    // When we stack monad transformer must have a real at the bottom.
    // That is why we wrap our value in an ID monad
    chain: function chain(funk) {
      return outer.chain(funk, wrapIn(idProto, this._value));
    }
  };

  // Define the prototype of the resulting monad stack
  var stackProto = {
    prototype: stackProto,

    // Add chain function
    chain: function chain(funk) {
      var funkAndUnwrap = function funkAndUnwrap(val) {
        return unwrap(funk(val));
      };
      return create(inner.chain(funkAndUnwrap, wrapIn(outerProto, this._value)));
    },

    // Add 'map' and 'of' functions
    of: function of(value) {
      return create(outer.of(inner.of(value)));
    },
    map: function map(funk) {
      var _this = this;

      return this.chain(function (val) {
        return _this.of(funk(val));
      });
    }
  };

  // Lifts a value from the outer type to a full stack
  var liftOuter = stackProto['lift' + outer.name] = function (val) {
    return create(inner.lift(wrapIn(outerProto, val)));
  };
  var liftInner = stackProto['lift' + inner.name] = function (val) {
    return create(outer.of(val));
  };

  // Add variants of 'chain' composed with lift, which work in inner and outer values
  stackProto['chain' + inner.name] = function (funk) {
    return this.chain(function (val) {
      return liftInner(funk(val));
    });
  };
  stackProto['chain' + outer.name] = function (funk) {
    return this.chain(function (val) {
      return liftOuter(funk(val));
    });
  };

  // Using the lift operations, lift all monad helpers and assign them to the stack object:
  var extend = function extend(outer) {
    Object.keys(outer).filter(function (key) {
      return key !== 'of' && key !== 'chain' && key !== 'lift';
    }).forEach(function (key) {
      stackProto[key] = function () {
        var args = Array.prototype.slice.call(arguments);

        return this.chain(function (val) {
          args.push(val);
          return stackProto['lift' + outer.name](outer[key].apply(null, args));
        });
      };
    });
  };
  extend(outer);
  extend(inner);
  // Add aliases to the monads themselves
  stackProto[inner.name] = inner;
  stackProto[outer.name] = outer;

  // Add relevant prototype properties to the constructor
  create.of = stackProto.of;
  create['lift' + outer.name] = stackProto['lift' + outer.name];
  create['lift' + inner.name] = stackProto['lift' + inner.name];

  // Stack constructor
  return create;
};

},{"./comp":1,"./data":2,"./prim":4}],4:[function(require,module,exports){
"use strict";

},{}],5:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],7:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],8:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":7,"_process":6,"inherits":5}],9:[function(require,module,exports){
/**
 * Sinon core utilities. For internal use only.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
var sinon = (function () { // eslint-disable-line no-unused-vars
    "use strict";

    var sinonModule;
    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        sinonModule = module.exports = require("./sinon/util/core");
        require("./sinon/extend");
        require("./sinon/walk");
        require("./sinon/typeOf");
        require("./sinon/times_in_words");
        require("./sinon/spy");
        require("./sinon/call");
        require("./sinon/behavior");
        require("./sinon/stub");
        require("./sinon/mock");
        require("./sinon/collection");
        require("./sinon/assert");
        require("./sinon/sandbox");
        require("./sinon/test");
        require("./sinon/test_case");
        require("./sinon/match");
        require("./sinon/format");
        require("./sinon/log_error");
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require, module.exports, module);
        sinonModule = module.exports;
    } else {
        sinonModule = {};
    }

    return sinonModule;
}());

},{"./sinon/assert":10,"./sinon/behavior":11,"./sinon/call":12,"./sinon/collection":13,"./sinon/extend":14,"./sinon/format":15,"./sinon/log_error":16,"./sinon/match":17,"./sinon/mock":18,"./sinon/sandbox":19,"./sinon/spy":20,"./sinon/stub":21,"./sinon/test":22,"./sinon/test_case":23,"./sinon/times_in_words":24,"./sinon/typeOf":25,"./sinon/util/core":26,"./sinon/walk":33}],10:[function(require,module,exports){
(function (global){
/**
 * @depend times_in_words.js
 * @depend util/core.js
 * @depend match.js
 * @depend format.js
 */
/**
 * Assertions matching the test spy retrieval interface.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal, global) {
    "use strict";

    var slice = Array.prototype.slice;

    function makeApi(sinon) {
        var assert;

        function verifyIsStub() {
            var method;

            for (var i = 0, l = arguments.length; i < l; ++i) {
                method = arguments[i];

                if (!method) {
                    assert.fail("fake is not a spy");
                }

                if (method.proxy && method.proxy.isSinonProxy) {
                    verifyIsStub(method.proxy);
                } else {
                    if (typeof method !== "function") {
                        assert.fail(method + " is not a function");
                    }

                    if (typeof method.getCall !== "function") {
                        assert.fail(method + " is not stubbed");
                    }
                }

            }
        }

        function failAssertion(object, msg) {
            object = object || global;
            var failMethod = object.fail || assert.fail;
            failMethod.call(object, msg);
        }

        function mirrorPropAsAssertion(name, method, message) {
            if (arguments.length === 2) {
                message = method;
                method = name;
            }

            assert[name] = function (fake) {
                verifyIsStub(fake);

                var args = slice.call(arguments, 1);
                var failed = false;

                if (typeof method === "function") {
                    failed = !method(fake);
                } else {
                    failed = typeof fake[method] === "function" ?
                        !fake[method].apply(fake, args) : !fake[method];
                }

                if (failed) {
                    failAssertion(this, (fake.printf || fake.proxy.printf).apply(fake, [message].concat(args)));
                } else {
                    assert.pass(name);
                }
            };
        }

        function exposedName(prefix, prop) {
            return !prefix || /^fail/.test(prop) ? prop :
                prefix + prop.slice(0, 1).toUpperCase() + prop.slice(1);
        }

        assert = {
            failException: "AssertError",

            fail: function fail(message) {
                var error = new Error(message);
                error.name = this.failException || assert.failException;

                throw error;
            },

            pass: function pass() {},

            callOrder: function assertCallOrder() {
                verifyIsStub.apply(null, arguments);
                var expected = "";
                var actual = "";

                if (!sinon.calledInOrder(arguments)) {
                    try {
                        expected = [].join.call(arguments, ", ");
                        var calls = slice.call(arguments);
                        var i = calls.length;
                        while (i) {
                            if (!calls[--i].called) {
                                calls.splice(i, 1);
                            }
                        }
                        actual = sinon.orderByFirstCall(calls).join(", ");
                    } catch (e) {
                        // If this fails, we'll just fall back to the blank string
                    }

                    failAssertion(this, "expected " + expected + " to be " +
                                "called in order but were called as " + actual);
                } else {
                    assert.pass("callOrder");
                }
            },

            callCount: function assertCallCount(method, count) {
                verifyIsStub(method);

                if (method.callCount !== count) {
                    var msg = "expected %n to be called " + sinon.timesInWords(count) +
                        " but was called %c%C";
                    failAssertion(this, method.printf(msg));
                } else {
                    assert.pass("callCount");
                }
            },

            expose: function expose(target, options) {
                if (!target) {
                    throw new TypeError("target is null or undefined");
                }

                var o = options || {};
                var prefix = typeof o.prefix === "undefined" && "assert" || o.prefix;
                var includeFail = typeof o.includeFail === "undefined" || !!o.includeFail;

                for (var method in this) {
                    if (method !== "expose" && (includeFail || !/^(fail)/.test(method))) {
                        target[exposedName(prefix, method)] = this[method];
                    }
                }

                return target;
            },

            match: function match(actual, expectation) {
                var matcher = sinon.match(expectation);
                if (matcher.test(actual)) {
                    assert.pass("match");
                } else {
                    var formatted = [
                        "expected value to match",
                        "    expected = " + sinon.format(expectation),
                        "    actual = " + sinon.format(actual)
                    ];

                    failAssertion(this, formatted.join("\n"));
                }
            }
        };

        mirrorPropAsAssertion("called", "expected %n to have been called at least once but was never called");
        mirrorPropAsAssertion("notCalled", function (spy) {
            return !spy.called;
        }, "expected %n to not have been called but was called %c%C");
        mirrorPropAsAssertion("calledOnce", "expected %n to be called once but was called %c%C");
        mirrorPropAsAssertion("calledTwice", "expected %n to be called twice but was called %c%C");
        mirrorPropAsAssertion("calledThrice", "expected %n to be called thrice but was called %c%C");
        mirrorPropAsAssertion("calledOn", "expected %n to be called with %1 as this but was called with %t");
        mirrorPropAsAssertion(
            "alwaysCalledOn",
            "expected %n to always be called with %1 as this but was called with %t"
        );
        mirrorPropAsAssertion("calledWithNew", "expected %n to be called with new");
        mirrorPropAsAssertion("alwaysCalledWithNew", "expected %n to always be called with new");
        mirrorPropAsAssertion("calledWith", "expected %n to be called with arguments %*%C");
        mirrorPropAsAssertion("calledWithMatch", "expected %n to be called with match %*%C");
        mirrorPropAsAssertion("alwaysCalledWith", "expected %n to always be called with arguments %*%C");
        mirrorPropAsAssertion("alwaysCalledWithMatch", "expected %n to always be called with match %*%C");
        mirrorPropAsAssertion("calledWithExactly", "expected %n to be called with exact arguments %*%C");
        mirrorPropAsAssertion("alwaysCalledWithExactly", "expected %n to always be called with exact arguments %*%C");
        mirrorPropAsAssertion("neverCalledWith", "expected %n to never be called with arguments %*%C");
        mirrorPropAsAssertion("neverCalledWithMatch", "expected %n to never be called with match %*%C");
        mirrorPropAsAssertion("threw", "%n did not throw exception%C");
        mirrorPropAsAssertion("alwaysThrew", "%n did not always throw exception%C");

        sinon.assert = assert;
        return assert;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./match");
        require("./format");
        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon, // eslint-disable-line no-undef
    typeof global !== "undefined" ? global : self
));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./format":15,"./match":17,"./util/core":26}],11:[function(require,module,exports){
(function (process){
/**
 * @depend util/core.js
 * @depend extend.js
 */
/**
 * Stub behavior
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @author Tim Fischbach (mail@timfischbach.de)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    var slice = Array.prototype.slice;
    var join = Array.prototype.join;
    var useLeftMostCallback = -1;
    var useRightMostCallback = -2;

    var nextTick = (function () {
        if (typeof process === "object" && typeof process.nextTick === "function") {
            return process.nextTick;
        }

        if (typeof setImmediate === "function") {
            return setImmediate;
        }

        return function (callback) {
            setTimeout(callback, 0);
        };
    })();

    function throwsException(error, message) {
        if (typeof error === "string") {
            this.exception = new Error(message || "");
            this.exception.name = error;
        } else if (!error) {
            this.exception = new Error("Error");
        } else {
            this.exception = error;
        }

        return this;
    }

    function getCallback(behavior, args) {
        var callArgAt = behavior.callArgAt;

        if (callArgAt >= 0) {
            return args[callArgAt];
        }

        var argumentList;

        if (callArgAt === useLeftMostCallback) {
            argumentList = args;
        }

        if (callArgAt === useRightMostCallback) {
            argumentList = slice.call(args).reverse();
        }

        var callArgProp = behavior.callArgProp;

        for (var i = 0, l = argumentList.length; i < l; ++i) {
            if (!callArgProp && typeof argumentList[i] === "function") {
                return argumentList[i];
            }

            if (callArgProp && argumentList[i] &&
                typeof argumentList[i][callArgProp] === "function") {
                return argumentList[i][callArgProp];
            }
        }

        return null;
    }

    function makeApi(sinon) {
        function getCallbackError(behavior, func, args) {
            if (behavior.callArgAt < 0) {
                var msg;

                if (behavior.callArgProp) {
                    msg = sinon.functionName(behavior.stub) +
                        " expected to yield to '" + behavior.callArgProp +
                        "', but no object with such a property was passed.";
                } else {
                    msg = sinon.functionName(behavior.stub) +
                        " expected to yield, but no callback was passed.";
                }

                if (args.length > 0) {
                    msg += " Received [" + join.call(args, ", ") + "]";
                }

                return msg;
            }

            return "argument at index " + behavior.callArgAt + " is not a function: " + func;
        }

        function callCallback(behavior, args) {
            if (typeof behavior.callArgAt === "number") {
                var func = getCallback(behavior, args);

                if (typeof func !== "function") {
                    throw new TypeError(getCallbackError(behavior, func, args));
                }

                if (behavior.callbackAsync) {
                    nextTick(function () {
                        func.apply(behavior.callbackContext, behavior.callbackArguments);
                    });
                } else {
                    func.apply(behavior.callbackContext, behavior.callbackArguments);
                }
            }
        }

        var proto = {
            create: function create(stub) {
                var behavior = sinon.extend({}, sinon.behavior);
                delete behavior.create;
                behavior.stub = stub;

                return behavior;
            },

            isPresent: function isPresent() {
                return (typeof this.callArgAt === "number" ||
                        this.exception ||
                        typeof this.returnArgAt === "number" ||
                        this.returnThis ||
                        this.returnValueDefined);
            },

            invoke: function invoke(context, args) {
                callCallback(this, args);

                if (this.exception) {
                    throw this.exception;
                } else if (typeof this.returnArgAt === "number") {
                    return args[this.returnArgAt];
                } else if (this.returnThis) {
                    return context;
                }

                return this.returnValue;
            },

            onCall: function onCall(index) {
                return this.stub.onCall(index);
            },

            onFirstCall: function onFirstCall() {
                return this.stub.onFirstCall();
            },

            onSecondCall: function onSecondCall() {
                return this.stub.onSecondCall();
            },

            onThirdCall: function onThirdCall() {
                return this.stub.onThirdCall();
            },

            withArgs: function withArgs(/* arguments */) {
                throw new Error(
                    "Defining a stub by invoking \"stub.onCall(...).withArgs(...)\" " +
                    "is not supported. Use \"stub.withArgs(...).onCall(...)\" " +
                    "to define sequential behavior for calls with certain arguments."
                );
            },

            callsArg: function callsArg(pos) {
                if (typeof pos !== "number") {
                    throw new TypeError("argument index is not number");
                }

                this.callArgAt = pos;
                this.callbackArguments = [];
                this.callbackContext = undefined;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            callsArgOn: function callsArgOn(pos, context) {
                if (typeof pos !== "number") {
                    throw new TypeError("argument index is not number");
                }
                if (typeof context !== "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = pos;
                this.callbackArguments = [];
                this.callbackContext = context;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            callsArgWith: function callsArgWith(pos) {
                if (typeof pos !== "number") {
                    throw new TypeError("argument index is not number");
                }

                this.callArgAt = pos;
                this.callbackArguments = slice.call(arguments, 1);
                this.callbackContext = undefined;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            callsArgOnWith: function callsArgWith(pos, context) {
                if (typeof pos !== "number") {
                    throw new TypeError("argument index is not number");
                }
                if (typeof context !== "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = pos;
                this.callbackArguments = slice.call(arguments, 2);
                this.callbackContext = context;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            yields: function () {
                this.callArgAt = useLeftMostCallback;
                this.callbackArguments = slice.call(arguments, 0);
                this.callbackContext = undefined;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            yieldsRight: function () {
                this.callArgAt = useRightMostCallback;
                this.callbackArguments = slice.call(arguments, 0);
                this.callbackContext = undefined;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            yieldsOn: function (context) {
                if (typeof context !== "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = useLeftMostCallback;
                this.callbackArguments = slice.call(arguments, 1);
                this.callbackContext = context;
                this.callArgProp = undefined;
                this.callbackAsync = false;

                return this;
            },

            yieldsTo: function (prop) {
                this.callArgAt = useLeftMostCallback;
                this.callbackArguments = slice.call(arguments, 1);
                this.callbackContext = undefined;
                this.callArgProp = prop;
                this.callbackAsync = false;

                return this;
            },

            yieldsToOn: function (prop, context) {
                if (typeof context !== "object") {
                    throw new TypeError("argument context is not an object");
                }

                this.callArgAt = useLeftMostCallback;
                this.callbackArguments = slice.call(arguments, 2);
                this.callbackContext = context;
                this.callArgProp = prop;
                this.callbackAsync = false;

                return this;
            },

            throws: throwsException,
            throwsException: throwsException,

            returns: function returns(value) {
                this.returnValue = value;
                this.returnValueDefined = true;
                this.exception = undefined;

                return this;
            },

            returnsArg: function returnsArg(pos) {
                if (typeof pos !== "number") {
                    throw new TypeError("argument index is not number");
                }

                this.returnArgAt = pos;

                return this;
            },

            returnsThis: function returnsThis() {
                this.returnThis = true;

                return this;
            }
        };

        function createAsyncVersion(syncFnName) {
            return function () {
                var result = this[syncFnName].apply(this, arguments);
                this.callbackAsync = true;
                return result;
            };
        }

        // create asynchronous versions of callsArg* and yields* methods
        for (var method in proto) {
            // need to avoid creating anotherasync versions of the newly added async methods
            if (proto.hasOwnProperty(method) && method.match(/^(callsArg|yields)/) && !method.match(/Async/)) {
                proto[method + "Async"] = createAsyncVersion(method);
            }
        }

        sinon.behavior = proto;
        return proto;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./extend");
        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

}).call(this,require('_process'))

},{"./extend":14,"./util/core":26,"_process":6}],12:[function(require,module,exports){
/**
  * @depend util/core.js
  * @depend match.js
  * @depend format.js
  */
/**
  * Spy calls
  *
  * @author Christian Johansen (christian@cjohansen.no)
  * @author Maximilian Antoni (mail@maxantoni.de)
  * @license BSD
  *
  * Copyright (c) 2010-2013 Christian Johansen
  * Copyright (c) 2013 Maximilian Antoni
  */
(function (sinonGlobal) {
    "use strict";

    var slice = Array.prototype.slice;

    function makeApi(sinon) {
        function throwYieldError(proxy, text, args) {
            var msg = sinon.functionName(proxy) + text;
            if (args.length) {
                msg += " Received [" + slice.call(args).join(", ") + "]";
            }
            throw new Error(msg);
        }

        var callProto = {
            calledOn: function calledOn(thisValue) {
                if (sinon.match && sinon.match.isMatcher(thisValue)) {
                    return thisValue.test(this.thisValue);
                }
                return this.thisValue === thisValue;
            },

            calledWith: function calledWith() {
                var l = arguments.length;
                if (l > this.args.length) {
                    return false;
                }
                for (var i = 0; i < l; i += 1) {
                    if (!sinon.deepEqual(arguments[i], this.args[i])) {
                        return false;
                    }
                }

                return true;
            },

            calledWithMatch: function calledWithMatch() {
                var l = arguments.length;
                if (l > this.args.length) {
                    return false;
                }
                for (var i = 0; i < l; i += 1) {
                    var actual = this.args[i];
                    var expectation = arguments[i];
                    if (!sinon.match || !sinon.match(expectation).test(actual)) {
                        return false;
                    }
                }
                return true;
            },

            calledWithExactly: function calledWithExactly() {
                return arguments.length === this.args.length &&
                    this.calledWith.apply(this, arguments);
            },

            notCalledWith: function notCalledWith() {
                return !this.calledWith.apply(this, arguments);
            },

            notCalledWithMatch: function notCalledWithMatch() {
                return !this.calledWithMatch.apply(this, arguments);
            },

            returned: function returned(value) {
                return sinon.deepEqual(value, this.returnValue);
            },

            threw: function threw(error) {
                if (typeof error === "undefined" || !this.exception) {
                    return !!this.exception;
                }

                return this.exception === error || this.exception.name === error;
            },

            calledWithNew: function calledWithNew() {
                return this.proxy.prototype && this.thisValue instanceof this.proxy;
            },

            calledBefore: function (other) {
                return this.callId < other.callId;
            },

            calledAfter: function (other) {
                return this.callId > other.callId;
            },

            callArg: function (pos) {
                this.args[pos]();
            },

            callArgOn: function (pos, thisValue) {
                this.args[pos].apply(thisValue);
            },

            callArgWith: function (pos) {
                this.callArgOnWith.apply(this, [pos, null].concat(slice.call(arguments, 1)));
            },

            callArgOnWith: function (pos, thisValue) {
                var args = slice.call(arguments, 2);
                this.args[pos].apply(thisValue, args);
            },

            "yield": function () {
                this.yieldOn.apply(this, [null].concat(slice.call(arguments, 0)));
            },

            yieldOn: function (thisValue) {
                var args = this.args;
                for (var i = 0, l = args.length; i < l; ++i) {
                    if (typeof args[i] === "function") {
                        args[i].apply(thisValue, slice.call(arguments, 1));
                        return;
                    }
                }
                throwYieldError(this.proxy, " cannot yield since no callback was passed.", args);
            },

            yieldTo: function (prop) {
                this.yieldToOn.apply(this, [prop, null].concat(slice.call(arguments, 1)));
            },

            yieldToOn: function (prop, thisValue) {
                var args = this.args;
                for (var i = 0, l = args.length; i < l; ++i) {
                    if (args[i] && typeof args[i][prop] === "function") {
                        args[i][prop].apply(thisValue, slice.call(arguments, 2));
                        return;
                    }
                }
                throwYieldError(this.proxy, " cannot yield to '" + prop +
                    "' since no callback was passed.", args);
            },

            getStackFrames: function () {
                // Omit the error message and the two top stack frames in sinon itself:
                return this.stack && this.stack.split("\n").slice(3);
            },

            toString: function () {
                var callStr = this.proxy.toString() + "(";
                var args = [];

                for (var i = 0, l = this.args.length; i < l; ++i) {
                    args.push(sinon.format(this.args[i]));
                }

                callStr = callStr + args.join(", ") + ")";

                if (typeof this.returnValue !== "undefined") {
                    callStr += " => " + sinon.format(this.returnValue);
                }

                if (this.exception) {
                    callStr += " !" + this.exception.name;

                    if (this.exception.message) {
                        callStr += "(" + this.exception.message + ")";
                    }
                }
                if (this.stack) {
                    callStr += this.getStackFrames()[0].replace(/^\s*(?:at\s+|@)?/, " at ");

                }

                return callStr;
            }
        };

        callProto.invokeCallback = callProto.yield;

        function createSpyCall(spy, thisValue, args, returnValue, exception, id, stack) {
            if (typeof id !== "number") {
                throw new TypeError("Call id is not a number");
            }
            var proxyCall = sinon.create(callProto);
            proxyCall.proxy = spy;
            proxyCall.thisValue = thisValue;
            proxyCall.args = args;
            proxyCall.returnValue = returnValue;
            proxyCall.exception = exception;
            proxyCall.callId = id;
            proxyCall.stack = stack;

            return proxyCall;
        }
        createSpyCall.toString = callProto.toString; // used by mocks

        sinon.spyCall = createSpyCall;
        return createSpyCall;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./match");
        require("./format");
        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./format":15,"./match":17,"./util/core":26}],13:[function(require,module,exports){
/**
 * @depend util/core.js
 * @depend spy.js
 * @depend stub.js
 * @depend mock.js
 */
/**
 * Collections of stubs, spies and mocks.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    var push = [].push;
    var hasOwnProperty = Object.prototype.hasOwnProperty;

    function getFakes(fakeCollection) {
        if (!fakeCollection.fakes) {
            fakeCollection.fakes = [];
        }

        return fakeCollection.fakes;
    }

    function each(fakeCollection, method) {
        var fakes = getFakes(fakeCollection);

        for (var i = 0, l = fakes.length; i < l; i += 1) {
            if (typeof fakes[i][method] === "function") {
                fakes[i][method]();
            }
        }
    }

    function compact(fakeCollection) {
        var fakes = getFakes(fakeCollection);
        var i = 0;
        while (i < fakes.length) {
            fakes.splice(i, 1);
        }
    }

    function makeApi(sinon) {
        var collection = {
            verify: function resolve() {
                each(this, "verify");
            },

            restore: function restore() {
                each(this, "restore");
                compact(this);
            },

            reset: function restore() {
                each(this, "reset");
            },

            verifyAndRestore: function verifyAndRestore() {
                var exception;

                try {
                    this.verify();
                } catch (e) {
                    exception = e;
                }

                this.restore();

                if (exception) {
                    throw exception;
                }
            },

            add: function add(fake) {
                push.call(getFakes(this), fake);
                return fake;
            },

            spy: function spy() {
                return this.add(sinon.spy.apply(sinon, arguments));
            },

            stub: function stub(object, property, value) {
                if (property) {
                    var original = object[property];

                    if (typeof original !== "function") {
                        if (!hasOwnProperty.call(object, property)) {
                            throw new TypeError("Cannot stub non-existent own property " + property);
                        }

                        object[property] = value;

                        return this.add({
                            restore: function () {
                                object[property] = original;
                            }
                        });
                    }
                }
                if (!property && !!object && typeof object === "object") {
                    var stubbedObj = sinon.stub.apply(sinon, arguments);

                    for (var prop in stubbedObj) {
                        if (typeof stubbedObj[prop] === "function") {
                            this.add(stubbedObj[prop]);
                        }
                    }

                    return stubbedObj;
                }

                return this.add(sinon.stub.apply(sinon, arguments));
            },

            mock: function mock() {
                return this.add(sinon.mock.apply(sinon, arguments));
            },

            inject: function inject(obj) {
                var col = this;

                obj.spy = function () {
                    return col.spy.apply(col, arguments);
                };

                obj.stub = function () {
                    return col.stub.apply(col, arguments);
                };

                obj.mock = function () {
                    return col.mock.apply(col, arguments);
                };

                return obj;
            }
        };

        sinon.collection = collection;
        return collection;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./mock");
        require("./spy");
        require("./stub");
        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./mock":18,"./spy":20,"./stub":21,"./util/core":26}],14:[function(require,module,exports){
/**
 * @depend util/core.js
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {

        // Adapted from https://developer.mozilla.org/en/docs/ECMAScript_DontEnum_attribute#JScript_DontEnum_Bug
        var hasDontEnumBug = (function () {
            var obj = {
                constructor: function () {
                    return "0";
                },
                toString: function () {
                    return "1";
                },
                valueOf: function () {
                    return "2";
                },
                toLocaleString: function () {
                    return "3";
                },
                prototype: function () {
                    return "4";
                },
                isPrototypeOf: function () {
                    return "5";
                },
                propertyIsEnumerable: function () {
                    return "6";
                },
                hasOwnProperty: function () {
                    return "7";
                },
                length: function () {
                    return "8";
                },
                unique: function () {
                    return "9";
                }
            };

            var result = [];
            for (var prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    result.push(obj[prop]());
                }
            }
            return result.join("") !== "0123456789";
        })();

        /* Public: Extend target in place with all (own) properties from sources in-order. Thus, last source will
         *         override properties in previous sources.
         *
         * target - The Object to extend
         * sources - Objects to copy properties from.
         *
         * Returns the extended target
         */
        function extend(target /*, sources */) {
            var sources = Array.prototype.slice.call(arguments, 1);
            var source, i, prop;

            for (i = 0; i < sources.length; i++) {
                source = sources[i];

                for (prop in source) {
                    if (source.hasOwnProperty(prop)) {
                        target[prop] = source[prop];
                    }
                }

                // Make sure we copy (own) toString method even when in JScript with DontEnum bug
                // See https://developer.mozilla.org/en/docs/ECMAScript_DontEnum_attribute#JScript_DontEnum_Bug
                if (hasDontEnumBug && source.hasOwnProperty("toString") && source.toString !== target.toString) {
                    target.toString = source.toString;
                }
            }

            return target;
        }

        sinon.extend = extend;
        return sinon.extend;
    }

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        module.exports = makeApi(sinon);
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./util/core":26}],15:[function(require,module,exports){
/**
 * @depend util/core.js
 */
/**
 * Format functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2014 Christian Johansen
 */
(function (sinonGlobal, formatio) {
    "use strict";

    function makeApi(sinon) {
        function valueFormatter(value) {
            return "" + value;
        }

        function getFormatioFormatter() {
            var formatter = formatio.configure({
                    quoteStrings: false,
                    limitChildrenCount: 250
                });

            function format() {
                return formatter.ascii.apply(formatter, arguments);
            }

            return format;
        }

        function getNodeFormatter() {
            try {
                var util = require("util");
            } catch (e) {
                /* Node, but no util module - would be very old, but better safe than sorry */
            }

            function format(v) {
                var isObjectWithNativeToString = typeof v === "object" && v.toString === Object.prototype.toString;
                return isObjectWithNativeToString ? util.inspect(v) : v;
            }

            return util ? format : valueFormatter;
        }

        var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
        var formatter;

        if (isNode) {
            try {
                formatio = require("formatio");
            }
            catch (e) {} // eslint-disable-line no-empty
        }

        if (formatio) {
            formatter = getFormatioFormatter();
        } else if (isNode) {
            formatter = getNodeFormatter();
        } else {
            formatter = valueFormatter;
        }

        sinon.format = formatter;
        return sinon.format;
    }

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        module.exports = makeApi(sinon);
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon, // eslint-disable-line no-undef
    typeof formatio === "object" && formatio // eslint-disable-line no-undef
));

},{"./util/core":26,"formatio":34,"util":8}],16:[function(require,module,exports){
/**
 * @depend util/core.js
 */
/**
 * Logs errors
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2014 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    // cache a reference to setTimeout, so that our reference won't be stubbed out
    // when using fake timers and errors will still get logged
    // https://github.com/cjohansen/Sinon.JS/issues/381
    var realSetTimeout = setTimeout;

    function makeApi(sinon) {

        function log() {}

        function logError(label, err) {
            var msg = label + " threw exception: ";

            function throwLoggedError() {
                err.message = msg + err.message;
                throw err;
            }

            sinon.log(msg + "[" + err.name + "] " + err.message);

            if (err.stack) {
                sinon.log(err.stack);
            }

            if (logError.useImmediateExceptions) {
                throwLoggedError();
            } else {
                logError.setTimeout(throwLoggedError, 0);
            }
        }

        // When set to true, any errors logged will be thrown immediately;
        // If set to false, the errors will be thrown in separate execution frame.
        logError.useImmediateExceptions = false;

        // wrap realSetTimeout with something we can stub in tests
        logError.setTimeout = function (func, timeout) {
            realSetTimeout(func, timeout);
        };

        var exports = {};
        exports.log = sinon.log = log;
        exports.logError = sinon.logError = logError;

        return exports;
    }

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        module.exports = makeApi(sinon);
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./util/core":26}],17:[function(require,module,exports){
/**
 * @depend util/core.js
 * @depend typeOf.js
 */
/*jslint eqeqeq: false, onevar: false, plusplus: false*/
/*global module, require, sinon*/
/**
 * Match functions
 *
 * @author Maximilian Antoni (mail@maxantoni.de)
 * @license BSD
 *
 * Copyright (c) 2012 Maximilian Antoni
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        function assertType(value, type, name) {
            var actual = sinon.typeOf(value);
            if (actual !== type) {
                throw new TypeError("Expected type of " + name + " to be " +
                    type + ", but was " + actual);
            }
        }

        var matcher = {
            toString: function () {
                return this.message;
            }
        };

        function isMatcher(object) {
            return matcher.isPrototypeOf(object);
        }

        function matchObject(expectation, actual) {
            if (actual === null || actual === undefined) {
                return false;
            }
            for (var key in expectation) {
                if (expectation.hasOwnProperty(key)) {
                    var exp = expectation[key];
                    var act = actual[key];
                    if (isMatcher(exp)) {
                        if (!exp.test(act)) {
                            return false;
                        }
                    } else if (sinon.typeOf(exp) === "object") {
                        if (!matchObject(exp, act)) {
                            return false;
                        }
                    } else if (!sinon.deepEqual(exp, act)) {
                        return false;
                    }
                }
            }
            return true;
        }

        function match(expectation, message) {
            var m = sinon.create(matcher);
            var type = sinon.typeOf(expectation);
            switch (type) {
            case "object":
                if (typeof expectation.test === "function") {
                    m.test = function (actual) {
                        return expectation.test(actual) === true;
                    };
                    m.message = "match(" + sinon.functionName(expectation.test) + ")";
                    return m;
                }
                var str = [];
                for (var key in expectation) {
                    if (expectation.hasOwnProperty(key)) {
                        str.push(key + ": " + expectation[key]);
                    }
                }
                m.test = function (actual) {
                    return matchObject(expectation, actual);
                };
                m.message = "match(" + str.join(", ") + ")";
                break;
            case "number":
                m.test = function (actual) {
                    // we need type coercion here
                    return expectation == actual; // eslint-disable-line eqeqeq
                };
                break;
            case "string":
                m.test = function (actual) {
                    if (typeof actual !== "string") {
                        return false;
                    }
                    return actual.indexOf(expectation) !== -1;
                };
                m.message = "match(\"" + expectation + "\")";
                break;
            case "regexp":
                m.test = function (actual) {
                    if (typeof actual !== "string") {
                        return false;
                    }
                    return expectation.test(actual);
                };
                break;
            case "function":
                m.test = expectation;
                if (message) {
                    m.message = message;
                } else {
                    m.message = "match(" + sinon.functionName(expectation) + ")";
                }
                break;
            default:
                m.test = function (actual) {
                    return sinon.deepEqual(expectation, actual);
                };
            }
            if (!m.message) {
                m.message = "match(" + expectation + ")";
            }
            return m;
        }

        matcher.or = function (m2) {
            if (!arguments.length) {
                throw new TypeError("Matcher expected");
            } else if (!isMatcher(m2)) {
                m2 = match(m2);
            }
            var m1 = this;
            var or = sinon.create(matcher);
            or.test = function (actual) {
                return m1.test(actual) || m2.test(actual);
            };
            or.message = m1.message + ".or(" + m2.message + ")";
            return or;
        };

        matcher.and = function (m2) {
            if (!arguments.length) {
                throw new TypeError("Matcher expected");
            } else if (!isMatcher(m2)) {
                m2 = match(m2);
            }
            var m1 = this;
            var and = sinon.create(matcher);
            and.test = function (actual) {
                return m1.test(actual) && m2.test(actual);
            };
            and.message = m1.message + ".and(" + m2.message + ")";
            return and;
        };

        match.isMatcher = isMatcher;

        match.any = match(function () {
            return true;
        }, "any");

        match.defined = match(function (actual) {
            return actual !== null && actual !== undefined;
        }, "defined");

        match.truthy = match(function (actual) {
            return !!actual;
        }, "truthy");

        match.falsy = match(function (actual) {
            return !actual;
        }, "falsy");

        match.same = function (expectation) {
            return match(function (actual) {
                return expectation === actual;
            }, "same(" + expectation + ")");
        };

        match.typeOf = function (type) {
            assertType(type, "string", "type");
            return match(function (actual) {
                return sinon.typeOf(actual) === type;
            }, "typeOf(\"" + type + "\")");
        };

        match.instanceOf = function (type) {
            assertType(type, "function", "type");
            return match(function (actual) {
                return actual instanceof type;
            }, "instanceOf(" + sinon.functionName(type) + ")");
        };

        function createPropertyMatcher(propertyTest, messagePrefix) {
            return function (property, value) {
                assertType(property, "string", "property");
                var onlyProperty = arguments.length === 1;
                var message = messagePrefix + "(\"" + property + "\"";
                if (!onlyProperty) {
                    message += ", " + value;
                }
                message += ")";
                return match(function (actual) {
                    if (actual === undefined || actual === null ||
                            !propertyTest(actual, property)) {
                        return false;
                    }
                    return onlyProperty || sinon.deepEqual(value, actual[property]);
                }, message);
            };
        }

        match.has = createPropertyMatcher(function (actual, property) {
            if (typeof actual === "object") {
                return property in actual;
            }
            return actual[property] !== undefined;
        }, "has");

        match.hasOwn = createPropertyMatcher(function (actual, property) {
            return actual.hasOwnProperty(property);
        }, "hasOwn");

        match.bool = match.typeOf("boolean");
        match.number = match.typeOf("number");
        match.string = match.typeOf("string");
        match.object = match.typeOf("object");
        match.func = match.typeOf("function");
        match.array = match.typeOf("array");
        match.regexp = match.typeOf("regexp");
        match.date = match.typeOf("date");

        sinon.match = match;
        return match;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./typeOf");
        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./typeOf":25,"./util/core":26}],18:[function(require,module,exports){
/**
 * @depend times_in_words.js
 * @depend util/core.js
 * @depend call.js
 * @depend extend.js
 * @depend match.js
 * @depend spy.js
 * @depend stub.js
 * @depend format.js
 */
/**
 * Mock functions.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        var push = [].push;
        var match = sinon.match;

        function mock(object) {
            // if (typeof console !== undefined && console.warn) {
            //     console.warn("mock will be removed from Sinon.JS v2.0");
            // }

            if (!object) {
                return sinon.expectation.create("Anonymous mock");
            }

            return mock.create(object);
        }

        function each(collection, callback) {
            if (!collection) {
                return;
            }

            for (var i = 0, l = collection.length; i < l; i += 1) {
                callback(collection[i]);
            }
        }

        function arrayEquals(arr1, arr2, compareLength) {
            if (compareLength && (arr1.length !== arr2.length)) {
                return false;
            }

            for (var i = 0, l = arr1.length; i < l; i++) {
                if (!sinon.deepEqual(arr1[i], arr2[i])) {
                    return false;
                }
            }
            return true;
        }

        sinon.extend(mock, {
            create: function create(object) {
                if (!object) {
                    throw new TypeError("object is null");
                }

                var mockObject = sinon.extend({}, mock);
                mockObject.object = object;
                delete mockObject.create;

                return mockObject;
            },

            expects: function expects(method) {
                if (!method) {
                    throw new TypeError("method is falsy");
                }

                if (!this.expectations) {
                    this.expectations = {};
                    this.proxies = [];
                }

                if (!this.expectations[method]) {
                    this.expectations[method] = [];
                    var mockObject = this;

                    sinon.wrapMethod(this.object, method, function () {
                        return mockObject.invokeMethod(method, this, arguments);
                    });

                    push.call(this.proxies, method);
                }

                var expectation = sinon.expectation.create(method);
                push.call(this.expectations[method], expectation);

                return expectation;
            },

            restore: function restore() {
                var object = this.object;

                each(this.proxies, function (proxy) {
                    if (typeof object[proxy].restore === "function") {
                        object[proxy].restore();
                    }
                });
            },

            verify: function verify() {
                var expectations = this.expectations || {};
                var messages = [];
                var met = [];

                each(this.proxies, function (proxy) {
                    each(expectations[proxy], function (expectation) {
                        if (!expectation.met()) {
                            push.call(messages, expectation.toString());
                        } else {
                            push.call(met, expectation.toString());
                        }
                    });
                });

                this.restore();

                if (messages.length > 0) {
                    sinon.expectation.fail(messages.concat(met).join("\n"));
                } else if (met.length > 0) {
                    sinon.expectation.pass(messages.concat(met).join("\n"));
                }

                return true;
            },

            invokeMethod: function invokeMethod(method, thisValue, args) {
                var expectations = this.expectations && this.expectations[method] ? this.expectations[method] : [];
                var expectationsWithMatchingArgs = [];
                var currentArgs = args || [];
                var i, available;

                for (i = 0; i < expectations.length; i += 1) {
                    var expectedArgs = expectations[i].expectedArguments || [];
                    if (arrayEquals(expectedArgs, currentArgs, expectations[i].expectsExactArgCount)) {
                        expectationsWithMatchingArgs.push(expectations[i]);
                    }
                }

                for (i = 0; i < expectationsWithMatchingArgs.length; i += 1) {
                    if (!expectationsWithMatchingArgs[i].met() &&
                        expectationsWithMatchingArgs[i].allowsCall(thisValue, args)) {
                        return expectationsWithMatchingArgs[i].apply(thisValue, args);
                    }
                }

                var messages = [];
                var exhausted = 0;

                for (i = 0; i < expectationsWithMatchingArgs.length; i += 1) {
                    if (expectationsWithMatchingArgs[i].allowsCall(thisValue, args)) {
                        available = available || expectationsWithMatchingArgs[i];
                    } else {
                        exhausted += 1;
                    }
                }

                if (available && exhausted === 0) {
                    return available.apply(thisValue, args);
                }

                for (i = 0; i < expectations.length; i += 1) {
                    push.call(messages, "    " + expectations[i].toString());
                }

                messages.unshift("Unexpected call: " + sinon.spyCall.toString.call({
                    proxy: method,
                    args: args
                }));

                sinon.expectation.fail(messages.join("\n"));
            }
        });

        var times = sinon.timesInWords;
        var slice = Array.prototype.slice;

        function callCountInWords(callCount) {
            if (callCount === 0) {
                return "never called";
            }

            return "called " + times(callCount);
        }

        function expectedCallCountInWords(expectation) {
            var min = expectation.minCalls;
            var max = expectation.maxCalls;

            if (typeof min === "number" && typeof max === "number") {
                var str = times(min);

                if (min !== max) {
                    str = "at least " + str + " and at most " + times(max);
                }

                return str;
            }

            if (typeof min === "number") {
                return "at least " + times(min);
            }

            return "at most " + times(max);
        }

        function receivedMinCalls(expectation) {
            var hasMinLimit = typeof expectation.minCalls === "number";
            return !hasMinLimit || expectation.callCount >= expectation.minCalls;
        }

        function receivedMaxCalls(expectation) {
            if (typeof expectation.maxCalls !== "number") {
                return false;
            }

            return expectation.callCount === expectation.maxCalls;
        }

        function verifyMatcher(possibleMatcher, arg) {
            var isMatcher = match && match.isMatcher(possibleMatcher);

            return isMatcher && possibleMatcher.test(arg) || true;
        }

        sinon.expectation = {
            minCalls: 1,
            maxCalls: 1,

            create: function create(methodName) {
                var expectation = sinon.extend(sinon.stub.create(), sinon.expectation);
                delete expectation.create;
                expectation.method = methodName;

                return expectation;
            },

            invoke: function invoke(func, thisValue, args) {
                this.verifyCallAllowed(thisValue, args);

                return sinon.spy.invoke.apply(this, arguments);
            },

            atLeast: function atLeast(num) {
                if (typeof num !== "number") {
                    throw new TypeError("'" + num + "' is not number");
                }

                if (!this.limitsSet) {
                    this.maxCalls = null;
                    this.limitsSet = true;
                }

                this.minCalls = num;

                return this;
            },

            atMost: function atMost(num) {
                if (typeof num !== "number") {
                    throw new TypeError("'" + num + "' is not number");
                }

                if (!this.limitsSet) {
                    this.minCalls = null;
                    this.limitsSet = true;
                }

                this.maxCalls = num;

                return this;
            },

            never: function never() {
                return this.exactly(0);
            },

            once: function once() {
                return this.exactly(1);
            },

            twice: function twice() {
                return this.exactly(2);
            },

            thrice: function thrice() {
                return this.exactly(3);
            },

            exactly: function exactly(num) {
                if (typeof num !== "number") {
                    throw new TypeError("'" + num + "' is not a number");
                }

                this.atLeast(num);
                return this.atMost(num);
            },

            met: function met() {
                return !this.failed && receivedMinCalls(this);
            },

            verifyCallAllowed: function verifyCallAllowed(thisValue, args) {
                if (receivedMaxCalls(this)) {
                    this.failed = true;
                    sinon.expectation.fail(this.method + " already called " + times(this.maxCalls));
                }

                if ("expectedThis" in this && this.expectedThis !== thisValue) {
                    sinon.expectation.fail(this.method + " called with " + thisValue + " as thisValue, expected " +
                        this.expectedThis);
                }

                if (!("expectedArguments" in this)) {
                    return;
                }

                if (!args) {
                    sinon.expectation.fail(this.method + " received no arguments, expected " +
                        sinon.format(this.expectedArguments));
                }

                if (args.length < this.expectedArguments.length) {
                    sinon.expectation.fail(this.method + " received too few arguments (" + sinon.format(args) +
                        "), expected " + sinon.format(this.expectedArguments));
                }

                if (this.expectsExactArgCount &&
                    args.length !== this.expectedArguments.length) {
                    sinon.expectation.fail(this.method + " received too many arguments (" + sinon.format(args) +
                        "), expected " + sinon.format(this.expectedArguments));
                }

                for (var i = 0, l = this.expectedArguments.length; i < l; i += 1) {

                    if (!verifyMatcher(this.expectedArguments[i], args[i])) {
                        sinon.expectation.fail(this.method + " received wrong arguments " + sinon.format(args) +
                            ", didn't match " + this.expectedArguments.toString());
                    }

                    if (!sinon.deepEqual(this.expectedArguments[i], args[i])) {
                        sinon.expectation.fail(this.method + " received wrong arguments " + sinon.format(args) +
                            ", expected " + sinon.format(this.expectedArguments));
                    }
                }
            },

            allowsCall: function allowsCall(thisValue, args) {
                if (this.met() && receivedMaxCalls(this)) {
                    return false;
                }

                if ("expectedThis" in this && this.expectedThis !== thisValue) {
                    return false;
                }

                if (!("expectedArguments" in this)) {
                    return true;
                }

                args = args || [];

                if (args.length < this.expectedArguments.length) {
                    return false;
                }

                if (this.expectsExactArgCount &&
                    args.length !== this.expectedArguments.length) {
                    return false;
                }

                for (var i = 0, l = this.expectedArguments.length; i < l; i += 1) {
                    if (!verifyMatcher(this.expectedArguments[i], args[i])) {
                        return false;
                    }

                    if (!sinon.deepEqual(this.expectedArguments[i], args[i])) {
                        return false;
                    }
                }

                return true;
            },

            withArgs: function withArgs() {
                this.expectedArguments = slice.call(arguments);
                return this;
            },

            withExactArgs: function withExactArgs() {
                this.withArgs.apply(this, arguments);
                this.expectsExactArgCount = true;
                return this;
            },

            on: function on(thisValue) {
                this.expectedThis = thisValue;
                return this;
            },

            toString: function () {
                var args = (this.expectedArguments || []).slice();

                if (!this.expectsExactArgCount) {
                    push.call(args, "[...]");
                }

                var callStr = sinon.spyCall.toString.call({
                    proxy: this.method || "anonymous mock expectation",
                    args: args
                });

                var message = callStr.replace(", [...", "[, ...") + " " +
                    expectedCallCountInWords(this);

                if (this.met()) {
                    return "Expectation met: " + message;
                }

                return "Expected " + message + " (" +
                    callCountInWords(this.callCount) + ")";
            },

            verify: function verify() {
                if (!this.met()) {
                    sinon.expectation.fail(this.toString());
                } else {
                    sinon.expectation.pass(this.toString());
                }

                return true;
            },

            pass: function pass(message) {
                sinon.assert.pass(message);
            },

            fail: function fail(message) {
                var exception = new Error(message);
                exception.name = "ExpectationError";

                throw exception;
            }
        };

        sinon.mock = mock;
        return mock;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./times_in_words");
        require("./call");
        require("./extend");
        require("./match");
        require("./spy");
        require("./stub");
        require("./format");

        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./call":12,"./extend":14,"./format":15,"./match":17,"./spy":20,"./stub":21,"./times_in_words":24,"./util/core":26}],19:[function(require,module,exports){
/**
 * @depend util/core.js
 * @depend extend.js
 * @depend collection.js
 * @depend util/fake_timers.js
 * @depend util/fake_server_with_clock.js
 */
/**
 * Manages fake collections as well as fake utilities such as Sinon's
 * timers and fake XHR implementation in one convenient object.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        var push = [].push;

        function exposeValue(sandbox, config, key, value) {
            if (!value) {
                return;
            }

            if (config.injectInto && !(key in config.injectInto)) {
                config.injectInto[key] = value;
                sandbox.injectedKeys.push(key);
            } else {
                push.call(sandbox.args, value);
            }
        }

        function prepareSandboxFromConfig(config) {
            var sandbox = sinon.create(sinon.sandbox);

            if (config.useFakeServer) {
                if (typeof config.useFakeServer === "object") {
                    sandbox.serverPrototype = config.useFakeServer;
                }

                sandbox.useFakeServer();
            }

            if (config.useFakeTimers) {
                if (typeof config.useFakeTimers === "object") {
                    sandbox.useFakeTimers.apply(sandbox, config.useFakeTimers);
                } else {
                    sandbox.useFakeTimers();
                }
            }

            return sandbox;
        }

        sinon.sandbox = sinon.extend(sinon.create(sinon.collection), {
            useFakeTimers: function useFakeTimers() {
                this.clock = sinon.useFakeTimers.apply(sinon, arguments);

                return this.add(this.clock);
            },

            serverPrototype: sinon.fakeServer,

            useFakeServer: function useFakeServer() {
                var proto = this.serverPrototype || sinon.fakeServer;

                if (!proto || !proto.create) {
                    return null;
                }

                this.server = proto.create();
                return this.add(this.server);
            },

            inject: function (obj) {
                sinon.collection.inject.call(this, obj);

                if (this.clock) {
                    obj.clock = this.clock;
                }

                if (this.server) {
                    obj.server = this.server;
                    obj.requests = this.server.requests;
                }

                obj.match = sinon.match;

                return obj;
            },

            restore: function () {
                sinon.collection.restore.apply(this, arguments);
                this.restoreContext();
            },

            restoreContext: function () {
                if (this.injectedKeys) {
                    for (var i = 0, j = this.injectedKeys.length; i < j; i++) {
                        delete this.injectInto[this.injectedKeys[i]];
                    }
                    this.injectedKeys = [];
                }
            },

            create: function (config) {
                if (!config) {
                    return sinon.create(sinon.sandbox);
                }

                var sandbox = prepareSandboxFromConfig(config);
                sandbox.args = sandbox.args || [];
                sandbox.injectedKeys = [];
                sandbox.injectInto = config.injectInto;
                var prop,
                    value;
                var exposed = sandbox.inject({});

                if (config.properties) {
                    for (var i = 0, l = config.properties.length; i < l; i++) {
                        prop = config.properties[i];
                        value = exposed[prop] || prop === "sandbox" && sandbox;
                        exposeValue(sandbox, config, prop, value);
                    }
                } else {
                    exposeValue(sandbox, config, "sandbox", value);
                }

                return sandbox;
            },

            match: sinon.match
        });

        sinon.sandbox.useFakeXMLHttpRequest = sinon.sandbox.useFakeServer;

        return sinon.sandbox;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        require("./extend");
        require("./util/fake_server_with_clock");
        require("./util/fake_timers");
        require("./collection");
        module.exports = makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./collection":13,"./extend":14,"./util/core":26,"./util/fake_server_with_clock":29,"./util/fake_timers":30}],20:[function(require,module,exports){
/**
  * @depend times_in_words.js
  * @depend util/core.js
  * @depend extend.js
  * @depend call.js
  * @depend format.js
  */
/**
  * Spy functions
  *
  * @author Christian Johansen (christian@cjohansen.no)
  * @license BSD
  *
  * Copyright (c) 2010-2013 Christian Johansen
  */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        var push = Array.prototype.push;
        var slice = Array.prototype.slice;
        var callId = 0;

        function spy(object, property, types) {
            if (!property && typeof object === "function") {
                return spy.create(object);
            }

            if (!object && !property) {
                return spy.create(function () { });
            }

            if (types) {
                var methodDesc = sinon.getPropertyDescriptor(object, property);
                for (var i = 0; i < types.length; i++) {
                    methodDesc[types[i]] = spy.create(methodDesc[types[i]]);
                }
                return sinon.wrapMethod(object, property, methodDesc);
            }

            return sinon.wrapMethod(object, property, spy.create(object[property]));
        }

        function matchingFake(fakes, args, strict) {
            if (!fakes) {
                return undefined;
            }

            for (var i = 0, l = fakes.length; i < l; i++) {
                if (fakes[i].matches(args, strict)) {
                    return fakes[i];
                }
            }
        }

        function incrementCallCount() {
            this.called = true;
            this.callCount += 1;
            this.notCalled = false;
            this.calledOnce = this.callCount === 1;
            this.calledTwice = this.callCount === 2;
            this.calledThrice = this.callCount === 3;
        }

        function createCallProperties() {
            this.firstCall = this.getCall(0);
            this.secondCall = this.getCall(1);
            this.thirdCall = this.getCall(2);
            this.lastCall = this.getCall(this.callCount - 1);
        }

        var vars = "a,b,c,d,e,f,g,h,i,j,k,l";
        function createProxy(func, proxyLength) {
            // Retain the function length:
            var p;
            if (proxyLength) {
                eval("p = (function proxy(" + vars.substring(0, proxyLength * 2 - 1) + // eslint-disable-line no-eval
                    ") { return p.invoke(func, this, slice.call(arguments)); });");
            } else {
                p = function proxy() {
                    return p.invoke(func, this, slice.call(arguments));
                };
            }
            p.isSinonProxy = true;
            return p;
        }

        var uuid = 0;

        // Public API
        var spyApi = {
            reset: function () {
                if (this.invoking) {
                    var err = new Error("Cannot reset Sinon function while invoking it. " +
                                        "Move the call to .reset outside of the callback.");
                    err.name = "InvalidResetException";
                    throw err;
                }

                this.called = false;
                this.notCalled = true;
                this.calledOnce = false;
                this.calledTwice = false;
                this.calledThrice = false;
                this.callCount = 0;
                this.firstCall = null;
                this.secondCall = null;
                this.thirdCall = null;
                this.lastCall = null;
                this.args = [];
                this.returnValues = [];
                this.thisValues = [];
                this.exceptions = [];
                this.callIds = [];
                this.stacks = [];
                if (this.fakes) {
                    for (var i = 0; i < this.fakes.length; i++) {
                        this.fakes[i].reset();
                    }
                }

                return this;
            },

            create: function create(func, spyLength) {
                var name;

                if (typeof func !== "function") {
                    func = function () { };
                } else {
                    name = sinon.functionName(func);
                }

                if (!spyLength) {
                    spyLength = func.length;
                }

                var proxy = createProxy(func, spyLength);

                sinon.extend(proxy, spy);
                delete proxy.create;
                sinon.extend(proxy, func);

                proxy.reset();
                proxy.prototype = func.prototype;
                proxy.displayName = name || "spy";
                proxy.toString = sinon.functionToString;
                proxy.instantiateFake = sinon.spy.create;
                proxy.id = "spy#" + uuid++;

                return proxy;
            },

            invoke: function invoke(func, thisValue, args) {
                var matching = matchingFake(this.fakes, args);
                var exception, returnValue;

                incrementCallCount.call(this);
                push.call(this.thisValues, thisValue);
                push.call(this.args, args);
                push.call(this.callIds, callId++);

                // Make call properties available from within the spied function:
                createCallProperties.call(this);

                try {
                    this.invoking = true;

                    if (matching) {
                        returnValue = matching.invoke(func, thisValue, args);
                    } else {
                        returnValue = (this.func || func).apply(thisValue, args);
                    }

                    var thisCall = this.getCall(this.callCount - 1);
                    if (thisCall.calledWithNew() && typeof returnValue !== "object") {
                        returnValue = thisValue;
                    }
                } catch (e) {
                    exception = e;
                } finally {
                    delete this.invoking;
                }

                push.call(this.exceptions, exception);
                push.call(this.returnValues, returnValue);
                push.call(this.stacks, new Error().stack);

                // Make return value and exception available in the calls:
                createCallProperties.call(this);

                if (exception !== undefined) {
                    throw exception;
                }

                return returnValue;
            },

            named: function named(name) {
                this.displayName = name;
                return this;
            },

            getCall: function getCall(i) {
                if (i < 0 || i >= this.callCount) {
                    return null;
                }

                return sinon.spyCall(this, this.thisValues[i], this.args[i],
                                        this.returnValues[i], this.exceptions[i],
                                        this.callIds[i], this.stacks[i]);
            },

            getCalls: function () {
                var calls = [];
                var i;

                for (i = 0; i < this.callCount; i++) {
                    calls.push(this.getCall(i));
                }

                return calls;
            },

            calledBefore: function calledBefore(spyFn) {
                if (!this.called) {
                    return false;
                }

                if (!spyFn.called) {
                    return true;
                }

                return this.callIds[0] < spyFn.callIds[spyFn.callIds.length - 1];
            },

            calledAfter: function calledAfter(spyFn) {
                if (!this.called || !spyFn.called) {
                    return false;
                }

                return this.callIds[this.callCount - 1] > spyFn.callIds[spyFn.callCount - 1];
            },

            withArgs: function () {
                var args = slice.call(arguments);

                if (this.fakes) {
                    var match = matchingFake(this.fakes, args, true);

                    if (match) {
                        return match;
                    }
                } else {
                    this.fakes = [];
                }

                var original = this;
                var fake = this.instantiateFake();
                fake.matchingAguments = args;
                fake.parent = this;
                push.call(this.fakes, fake);

                fake.withArgs = function () {
                    return original.withArgs.apply(original, arguments);
                };

                for (var i = 0; i < this.args.length; i++) {
                    if (fake.matches(this.args[i])) {
                        incrementCallCount.call(fake);
                        push.call(fake.thisValues, this.thisValues[i]);
                        push.call(fake.args, this.args[i]);
                        push.call(fake.returnValues, this.returnValues[i]);
                        push.call(fake.exceptions, this.exceptions[i]);
                        push.call(fake.callIds, this.callIds[i]);
                    }
                }
                createCallProperties.call(fake);

                return fake;
            },

            matches: function (args, strict) {
                var margs = this.matchingAguments;

                if (margs.length <= args.length &&
                    sinon.deepEqual(margs, args.slice(0, margs.length))) {
                    return !strict || margs.length === args.length;
                }
            },

            printf: function (format) {
                var spyInstance = this;
                var args = slice.call(arguments, 1);
                var formatter;

                return (format || "").replace(/%(.)/g, function (match, specifyer) {
                    formatter = spyApi.formatters[specifyer];

                    if (typeof formatter === "function") {
                        return formatter.call(null, spyInstance, args);
                    } else if (!isNaN(parseInt(specifyer, 10))) {
                        return sinon.format(args[specifyer - 1]);
                    }

                    return "%" + specifyer;
                });
            }
        };

        function delegateToCalls(method, matchAny, actual, notCalled) {
            spyApi[method] = function () {
                if (!this.called) {
                    if (notCalled) {
                        return notCalled.apply(this, arguments);
                    }
                    return false;
                }

                var currentCall;
                var matches = 0;

                for (var i = 0, l = this.callCount; i < l; i += 1) {
                    currentCall = this.getCall(i);

                    if (currentCall[actual || method].apply(currentCall, arguments)) {
                        matches += 1;

                        if (matchAny) {
                            return true;
                        }
                    }
                }

                return matches === this.callCount;
            };
        }

        delegateToCalls("calledOn", true);
        delegateToCalls("alwaysCalledOn", false, "calledOn");
        delegateToCalls("calledWith", true);
        delegateToCalls("calledWithMatch", true);
        delegateToCalls("alwaysCalledWith", false, "calledWith");
        delegateToCalls("alwaysCalledWithMatch", false, "calledWithMatch");
        delegateToCalls("calledWithExactly", true);
        delegateToCalls("alwaysCalledWithExactly", false, "calledWithExactly");
        delegateToCalls("neverCalledWith", false, "notCalledWith", function () {
            return true;
        });
        delegateToCalls("neverCalledWithMatch", false, "notCalledWithMatch", function () {
            return true;
        });
        delegateToCalls("threw", true);
        delegateToCalls("alwaysThrew", false, "threw");
        delegateToCalls("returned", true);
        delegateToCalls("alwaysReturned", false, "returned");
        delegateToCalls("calledWithNew", true);
        delegateToCalls("alwaysCalledWithNew", false, "calledWithNew");
        delegateToCalls("callArg", false, "callArgWith", function () {
            throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
        });
        spyApi.callArgWith = spyApi.callArg;
        delegateToCalls("callArgOn", false, "callArgOnWith", function () {
            throw new Error(this.toString() + " cannot call arg since it was not yet invoked.");
        });
        spyApi.callArgOnWith = spyApi.callArgOn;
        delegateToCalls("yield", false, "yield", function () {
            throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
        });
        // "invokeCallback" is an alias for "yield" since "yield" is invalid in strict mode.
        spyApi.invokeCallback = spyApi.yield;
        delegateToCalls("yieldOn", false, "yieldOn", function () {
            throw new Error(this.toString() + " cannot yield since it was not yet invoked.");
        });
        delegateToCalls("yieldTo", false, "yieldTo", function (property) {
            throw new Error(this.toString() + " cannot yield to '" + property +
                "' since it was not yet invoked.");
        });
        delegateToCalls("yieldToOn", false, "yieldToOn", function (property) {
            throw new Error(this.toString() + " cannot yield to '" + property +
                "' since it was not yet invoked.");
        });

        spyApi.formatters = {
            c: function (spyInstance) {
                return sinon.timesInWords(spyInstance.callCount);
            },

            n: function (spyInstance) {
                return spyInstance.toString();
            },

            C: function (spyInstance) {
                var calls = [];

                for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
                    var stringifiedCall = "    " + spyInstance.getCall(i).toString();
                    if (/\n/.test(calls[i - 1])) {
                        stringifiedCall = "\n" + stringifiedCall;
                    }
                    push.call(calls, stringifiedCall);
                }

                return calls.length > 0 ? "\n" + calls.join("\n") : "";
            },

            t: function (spyInstance) {
                var objects = [];

                for (var i = 0, l = spyInstance.callCount; i < l; ++i) {
                    push.call(objects, sinon.format(spyInstance.thisValues[i]));
                }

                return objects.join(", ");
            },

            "*": function (spyInstance, args) {
                var formatted = [];

                for (var i = 0, l = args.length; i < l; ++i) {
                    push.call(formatted, sinon.format(args[i]));
                }

                return formatted.join(", ");
            }
        };

        sinon.extend(spy, spyApi);

        spy.spyCall = sinon.spyCall;
        sinon.spy = spy;

        return spy;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var core = require("./util/core");
        require("./call");
        require("./extend");
        require("./times_in_words");
        require("./format");
        module.exports = makeApi(core);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./call":12,"./extend":14,"./format":15,"./times_in_words":24,"./util/core":26}],21:[function(require,module,exports){
/**
 * @depend util/core.js
 * @depend extend.js
 * @depend spy.js
 * @depend behavior.js
 * @depend walk.js
 */
/**
 * Stub functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        function stub(object, property, func) {
            if (!!func && typeof func !== "function" && typeof func !== "object") {
                throw new TypeError("Custom stub should be a function or a property descriptor");
            }

            var wrapper;

            if (func) {
                if (typeof func === "function") {
                    wrapper = sinon.spy && sinon.spy.create ? sinon.spy.create(func) : func;
                } else {
                    wrapper = func;
                    if (sinon.spy && sinon.spy.create) {
                        var types = sinon.objectKeys(wrapper);
                        for (var i = 0; i < types.length; i++) {
                            wrapper[types[i]] = sinon.spy.create(wrapper[types[i]]);
                        }
                    }
                }
            } else {
                var stubLength = 0;
                if (typeof object === "object" && typeof object[property] === "function") {
                    stubLength = object[property].length;
                }
                wrapper = stub.create(stubLength);
            }

            if (!object && typeof property === "undefined") {
                return sinon.stub.create();
            }

            if (typeof property === "undefined" && typeof object === "object") {
                sinon.walk(object || {}, function (value, prop, propOwner) {
                    // we don't want to stub things like toString(), valueOf(), etc. so we only stub if the object
                    // is not Object.prototype
                    if (
                        propOwner !== Object.prototype &&
                        prop !== "constructor" &&
                        typeof sinon.getPropertyDescriptor(propOwner, prop).value === "function"
                    ) {
                        stub(object, prop);
                    }
                });

                return object;
            }

            return sinon.wrapMethod(object, property, wrapper);
        }


        /*eslint-disable no-use-before-define*/
        function getParentBehaviour(stubInstance) {
            return (stubInstance.parent && getCurrentBehavior(stubInstance.parent));
        }

        function getDefaultBehavior(stubInstance) {
            return stubInstance.defaultBehavior ||
                    getParentBehaviour(stubInstance) ||
                    sinon.behavior.create(stubInstance);
        }

        function getCurrentBehavior(stubInstance) {
            var behavior = stubInstance.behaviors[stubInstance.callCount - 1];
            return behavior && behavior.isPresent() ? behavior : getDefaultBehavior(stubInstance);
        }
        /*eslint-enable no-use-before-define*/

        var uuid = 0;

        var proto = {
            create: function create(stubLength) {
                var functionStub = function () {
                    return getCurrentBehavior(functionStub).invoke(this, arguments);
                };

                functionStub.id = "stub#" + uuid++;
                var orig = functionStub;
                functionStub = sinon.spy.create(functionStub, stubLength);
                functionStub.func = orig;

                sinon.extend(functionStub, stub);
                functionStub.instantiateFake = sinon.stub.create;
                functionStub.displayName = "stub";
                functionStub.toString = sinon.functionToString;

                functionStub.defaultBehavior = null;
                functionStub.behaviors = [];

                return functionStub;
            },

            resetBehavior: function () {
                var i;

                this.defaultBehavior = null;
                this.behaviors = [];

                delete this.returnValue;
                delete this.returnArgAt;
                this.returnThis = false;

                if (this.fakes) {
                    for (i = 0; i < this.fakes.length; i++) {
                        this.fakes[i].resetBehavior();
                    }
                }
            },

            onCall: function onCall(index) {
                if (!this.behaviors[index]) {
                    this.behaviors[index] = sinon.behavior.create(this);
                }

                return this.behaviors[index];
            },

            onFirstCall: function onFirstCall() {
                return this.onCall(0);
            },

            onSecondCall: function onSecondCall() {
                return this.onCall(1);
            },

            onThirdCall: function onThirdCall() {
                return this.onCall(2);
            }
        };

        function createBehavior(behaviorMethod) {
            return function () {
                this.defaultBehavior = this.defaultBehavior || sinon.behavior.create(this);
                this.defaultBehavior[behaviorMethod].apply(this.defaultBehavior, arguments);
                return this;
            };
        }

        for (var method in sinon.behavior) {
            if (sinon.behavior.hasOwnProperty(method) &&
                !proto.hasOwnProperty(method) &&
                method !== "create" &&
                method !== "withArgs" &&
                method !== "invoke") {
                proto[method] = createBehavior(method);
            }
        }

        sinon.extend(stub, proto);
        sinon.stub = stub;

        return stub;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var core = require("./util/core");
        require("./behavior");
        require("./spy");
        require("./extend");
        module.exports = makeApi(core);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./behavior":11,"./extend":14,"./spy":20,"./util/core":26}],22:[function(require,module,exports){
/**
 * @depend util/core.js
 * @depend sandbox.js
 */
/**
 * Test function, sandboxes fakes
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        var slice = Array.prototype.slice;

        function test(callback) {
            var type = typeof callback;

            if (type !== "function") {
                throw new TypeError("sinon.test needs to wrap a test function, got " + type);
            }

            function sinonSandboxedTest() {
                var config = sinon.getConfig(sinon.config);
                config.injectInto = config.injectIntoThis && this || config.injectInto;
                var sandbox = sinon.sandbox.create(config);
                var args = slice.call(arguments);
                var oldDone = args.length && args[args.length - 1];
                var exception, result;

                if (typeof oldDone === "function") {
                    args[args.length - 1] = function sinonDone(res) {
                        if (res) {
                            sandbox.restore();
                        } else {
                            sandbox.verifyAndRestore();
                        }
                        oldDone(res);
                    };
                }

                try {
                    result = callback.apply(this, args.concat(sandbox.args));
                } catch (e) {
                    exception = e;
                }

                if (typeof oldDone !== "function") {
                    if (typeof exception !== "undefined") {
                        sandbox.restore();
                        throw exception;
                    } else {
                        sandbox.verifyAndRestore();
                    }
                }

                return result;
            }

            if (callback.length) {
                return function sinonAsyncSandboxedTest(done) { // eslint-disable-line no-unused-vars
                    return sinonSandboxedTest.apply(this, arguments);
                };
            }

            return sinonSandboxedTest;
        }

        test.config = {
            injectIntoThis: true,
            injectInto: null,
            properties: ["spy", "stub", "mock", "clock", "server", "requests"],
            useFakeTimers: true,
            useFakeServer: true
        };

        sinon.test = test;
        return test;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var core = require("./util/core");
        require("./sandbox");
        module.exports = makeApi(core);
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require, module.exports, module);
    } else if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(typeof sinon === "object" && sinon || null)); // eslint-disable-line no-undef

},{"./sandbox":19,"./util/core":26}],23:[function(require,module,exports){
/**
 * @depend util/core.js
 * @depend test.js
 */
/**
 * Test case, sandboxes all test functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    function createTest(property, setUp, tearDown) {
        return function () {
            if (setUp) {
                setUp.apply(this, arguments);
            }

            var exception, result;

            try {
                result = property.apply(this, arguments);
            } catch (e) {
                exception = e;
            }

            if (tearDown) {
                tearDown.apply(this, arguments);
            }

            if (exception) {
                throw exception;
            }

            return result;
        };
    }

    function makeApi(sinon) {
        function testCase(tests, prefix) {
            if (!tests || typeof tests !== "object") {
                throw new TypeError("sinon.testCase needs an object with test functions");
            }

            prefix = prefix || "test";
            var rPrefix = new RegExp("^" + prefix);
            var methods = {};
            var setUp = tests.setUp;
            var tearDown = tests.tearDown;
            var testName,
                property,
                method;

            for (testName in tests) {
                if (tests.hasOwnProperty(testName) && !/^(setUp|tearDown)$/.test(testName)) {
                    property = tests[testName];

                    if (typeof property === "function" && rPrefix.test(testName)) {
                        method = property;

                        if (setUp || tearDown) {
                            method = createTest(property, setUp, tearDown);
                        }

                        methods[testName] = sinon.test(method);
                    } else {
                        methods[testName] = tests[testName];
                    }
                }
            }

            return methods;
        }

        sinon.testCase = testCase;
        return testCase;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var core = require("./util/core");
        require("./test");
        module.exports = makeApi(core);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./test":22,"./util/core":26}],24:[function(require,module,exports){
/**
 * @depend util/core.js
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {

        function timesInWords(count) {
            switch (count) {
                case 1:
                    return "once";
                case 2:
                    return "twice";
                case 3:
                    return "thrice";
                default:
                    return (count || 0) + " times";
            }
        }

        sinon.timesInWords = timesInWords;
        return sinon.timesInWords;
    }

    function loadDependencies(require, exports, module) {
        var core = require("./util/core");
        module.exports = makeApi(core);
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./util/core":26}],25:[function(require,module,exports){
/**
 * @depend util/core.js
 */
/**
 * Format functions
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2014 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        function typeOf(value) {
            if (value === null) {
                return "null";
            } else if (value === undefined) {
                return "undefined";
            }
            var string = Object.prototype.toString.call(value);
            return string.substring(8, string.length - 1).toLowerCase();
        }

        sinon.typeOf = typeOf;
        return sinon.typeOf;
    }

    function loadDependencies(require, exports, module) {
        var core = require("./util/core");
        module.exports = makeApi(core);
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./util/core":26}],26:[function(require,module,exports){
/**
 * @depend ../../sinon.js
 */
/**
 * Sinon core utilities. For internal use only.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal) {
    "use strict";

    var div = typeof document !== "undefined" && document.createElement("div");
    var hasOwn = Object.prototype.hasOwnProperty;

    function isDOMNode(obj) {
        var success = false;

        try {
            obj.appendChild(div);
            success = div.parentNode === obj;
        } catch (e) {
            return false;
        } finally {
            try {
                obj.removeChild(div);
            } catch (e) {
                // Remove failed, not much we can do about that
            }
        }

        return success;
    }

    function isElement(obj) {
        return div && obj && obj.nodeType === 1 && isDOMNode(obj);
    }

    function isFunction(obj) {
        return typeof obj === "function" || !!(obj && obj.constructor && obj.call && obj.apply);
    }

    function isReallyNaN(val) {
        return typeof val === "number" && isNaN(val);
    }

    function mirrorProperties(target, source) {
        for (var prop in source) {
            if (!hasOwn.call(target, prop)) {
                target[prop] = source[prop];
            }
        }
    }

    function isRestorable(obj) {
        return typeof obj === "function" && typeof obj.restore === "function" && obj.restore.sinon;
    }

    // Cheap way to detect if we have ES5 support.
    var hasES5Support = "keys" in Object;

    function makeApi(sinon) {
        sinon.wrapMethod = function wrapMethod(object, property, method) {
            if (!object) {
                throw new TypeError("Should wrap property of object");
            }

            if (typeof method !== "function" && typeof method !== "object") {
                throw new TypeError("Method wrapper should be a function or a property descriptor");
            }

            function checkWrappedMethod(wrappedMethod) {
                var error;

                if (!isFunction(wrappedMethod)) {
                    error = new TypeError("Attempted to wrap " + (typeof wrappedMethod) + " property " +
                                        property + " as function");
                } else if (wrappedMethod.restore && wrappedMethod.restore.sinon) {
                    error = new TypeError("Attempted to wrap " + property + " which is already wrapped");
                } else if (wrappedMethod.calledBefore) {
                    var verb = wrappedMethod.returns ? "stubbed" : "spied on";
                    error = new TypeError("Attempted to wrap " + property + " which is already " + verb);
                }

                if (error) {
                    if (wrappedMethod && wrappedMethod.stackTrace) {
                        error.stack += "\n--------------\n" + wrappedMethod.stackTrace;
                    }
                    throw error;
                }
            }

            var error, wrappedMethod, i;

            // IE 8 does not support hasOwnProperty on the window object and Firefox has a problem
            // when using hasOwn.call on objects from other frames.
            var owned = object.hasOwnProperty ? object.hasOwnProperty(property) : hasOwn.call(object, property);

            if (hasES5Support) {
                var methodDesc = (typeof method === "function") ? {value: method} : method;
                var wrappedMethodDesc = sinon.getPropertyDescriptor(object, property);

                if (!wrappedMethodDesc) {
                    error = new TypeError("Attempted to wrap " + (typeof wrappedMethod) + " property " +
                                        property + " as function");
                } else if (wrappedMethodDesc.restore && wrappedMethodDesc.restore.sinon) {
                    error = new TypeError("Attempted to wrap " + property + " which is already wrapped");
                }
                if (error) {
                    if (wrappedMethodDesc && wrappedMethodDesc.stackTrace) {
                        error.stack += "\n--------------\n" + wrappedMethodDesc.stackTrace;
                    }
                    throw error;
                }

                var types = sinon.objectKeys(methodDesc);
                for (i = 0; i < types.length; i++) {
                    wrappedMethod = wrappedMethodDesc[types[i]];
                    checkWrappedMethod(wrappedMethod);
                }

                mirrorProperties(methodDesc, wrappedMethodDesc);
                for (i = 0; i < types.length; i++) {
                    mirrorProperties(methodDesc[types[i]], wrappedMethodDesc[types[i]]);
                }
                Object.defineProperty(object, property, methodDesc);
            } else {
                wrappedMethod = object[property];
                checkWrappedMethod(wrappedMethod);
                object[property] = method;
                method.displayName = property;
            }

            method.displayName = property;

            // Set up a stack trace which can be used later to find what line of
            // code the original method was created on.
            method.stackTrace = (new Error("Stack Trace for original")).stack;

            method.restore = function () {
                // For prototype properties try to reset by delete first.
                // If this fails (ex: localStorage on mobile safari) then force a reset
                // via direct assignment.
                if (!owned) {
                    // In some cases `delete` may throw an error
                    try {
                        delete object[property];
                    } catch (e) {} // eslint-disable-line no-empty
                    // For native code functions `delete` fails without throwing an error
                    // on Chrome < 43, PhantomJS, etc.
                } else if (hasES5Support) {
                    Object.defineProperty(object, property, wrappedMethodDesc);
                }

                // Use strict equality comparison to check failures then force a reset
                // via direct assignment.
                if (object[property] === method) {
                    object[property] = wrappedMethod;
                }
            };

            method.restore.sinon = true;

            if (!hasES5Support) {
                mirrorProperties(method, wrappedMethod);
            }

            return method;
        };

        sinon.create = function create(proto) {
            var F = function () {};
            F.prototype = proto;
            return new F();
        };

        sinon.deepEqual = function deepEqual(a, b) {
            if (sinon.match && sinon.match.isMatcher(a)) {
                return a.test(b);
            }

            if (typeof a !== "object" || typeof b !== "object") {
                return isReallyNaN(a) && isReallyNaN(b) || a === b;
            }

            if (isElement(a) || isElement(b)) {
                return a === b;
            }

            if (a === b) {
                return true;
            }

            if ((a === null && b !== null) || (a !== null && b === null)) {
                return false;
            }

            if (a instanceof RegExp && b instanceof RegExp) {
                return (a.source === b.source) && (a.global === b.global) &&
                    (a.ignoreCase === b.ignoreCase) && (a.multiline === b.multiline);
            }

            var aString = Object.prototype.toString.call(a);
            if (aString !== Object.prototype.toString.call(b)) {
                return false;
            }

            if (aString === "[object Date]") {
                return a.valueOf() === b.valueOf();
            }

            var prop;
            var aLength = 0;
            var bLength = 0;

            if (aString === "[object Array]" && a.length !== b.length) {
                return false;
            }

            for (prop in a) {
                if (a.hasOwnProperty(prop)) {
                    aLength += 1;

                    if (!(prop in b)) {
                        return false;
                    }

                    if (!deepEqual(a[prop], b[prop])) {
                        return false;
                    }
                }
            }

            for (prop in b) {
                if (b.hasOwnProperty(prop)) {
                    bLength += 1;
                }
            }

            return aLength === bLength;
        };

        sinon.functionName = function functionName(func) {
            var name = func.displayName || func.name;

            // Use function decomposition as a last resort to get function
            // name. Does not rely on function decomposition to work - if it
            // doesn't debugging will be slightly less informative
            // (i.e. toString will say 'spy' rather than 'myFunc').
            if (!name) {
                var matches = func.toString().match(/function ([^\s\(]+)/);
                name = matches && matches[1];
            }

            return name;
        };

        sinon.functionToString = function toString() {
            if (this.getCall && this.callCount) {
                var thisValue,
                    prop;
                var i = this.callCount;

                while (i--) {
                    thisValue = this.getCall(i).thisValue;

                    for (prop in thisValue) {
                        if (thisValue[prop] === this) {
                            return prop;
                        }
                    }
                }
            }

            return this.displayName || "sinon fake";
        };

        sinon.objectKeys = function objectKeys(obj) {
            if (obj !== Object(obj)) {
                throw new TypeError("sinon.objectKeys called on a non-object");
            }

            var keys = [];
            var key;
            for (key in obj) {
                if (hasOwn.call(obj, key)) {
                    keys.push(key);
                }
            }

            return keys;
        };

        sinon.getPropertyDescriptor = function getPropertyDescriptor(object, property) {
            var proto = object;
            var descriptor;

            while (proto && !(descriptor = Object.getOwnPropertyDescriptor(proto, property))) {
                proto = Object.getPrototypeOf(proto);
            }
            return descriptor;
        };

        sinon.getConfig = function (custom) {
            var config = {};
            custom = custom || {};
            var defaults = sinon.defaultConfig;

            for (var prop in defaults) {
                if (defaults.hasOwnProperty(prop)) {
                    config[prop] = custom.hasOwnProperty(prop) ? custom[prop] : defaults[prop];
                }
            }

            return config;
        };

        sinon.defaultConfig = {
            injectIntoThis: true,
            injectInto: null,
            properties: ["spy", "stub", "mock", "clock", "server", "requests"],
            useFakeTimers: true,
            useFakeServer: true
        };

        sinon.timesInWords = function timesInWords(count) {
            return count === 1 && "once" ||
                count === 2 && "twice" ||
                count === 3 && "thrice" ||
                (count || 0) + " times";
        };

        sinon.calledInOrder = function (spies) {
            for (var i = 1, l = spies.length; i < l; i++) {
                if (!spies[i - 1].calledBefore(spies[i]) || !spies[i].called) {
                    return false;
                }
            }

            return true;
        };

        sinon.orderByFirstCall = function (spies) {
            return spies.sort(function (a, b) {
                // uuid, won't ever be equal
                var aCall = a.getCall(0);
                var bCall = b.getCall(0);
                var aId = aCall && aCall.callId || -1;
                var bId = bCall && bCall.callId || -1;

                return aId < bId ? -1 : 1;
            });
        };

        sinon.createStubInstance = function (constructor) {
            if (typeof constructor !== "function") {
                throw new TypeError("The constructor should be a function.");
            }
            return sinon.stub(sinon.create(constructor.prototype));
        };

        sinon.restore = function (object) {
            if (object !== null && typeof object === "object") {
                for (var prop in object) {
                    if (isRestorable(object[prop])) {
                        object[prop].restore();
                    }
                }
            } else if (isRestorable(object)) {
                object.restore();
            }
        };

        return sinon;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports) {
        makeApi(exports);
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{}],27:[function(require,module,exports){
/**
 * Minimal Event interface implementation
 *
 * Original implementation by Sven Fuchs: https://gist.github.com/995028
 * Modifications and tests by Christian Johansen.
 *
 * @author Sven Fuchs (svenfuchs@artweb-design.de)
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2011 Sven Fuchs, Christian Johansen
 */
if (typeof sinon === "undefined") {
    this.sinon = {};
}

(function () {
    "use strict";

    var push = [].push;

    function makeApi(sinon) {
        sinon.Event = function Event(type, bubbles, cancelable, target) {
            this.initEvent(type, bubbles, cancelable, target);
        };

        sinon.Event.prototype = {
            initEvent: function (type, bubbles, cancelable, target) {
                this.type = type;
                this.bubbles = bubbles;
                this.cancelable = cancelable;
                this.target = target;
            },

            stopPropagation: function () {},

            preventDefault: function () {
                this.defaultPrevented = true;
            }
        };

        sinon.ProgressEvent = function ProgressEvent(type, progressEventRaw, target) {
            this.initEvent(type, false, false, target);
            this.loaded = progressEventRaw.loaded || null;
            this.total = progressEventRaw.total || null;
            this.lengthComputable = !!progressEventRaw.total;
        };

        sinon.ProgressEvent.prototype = new sinon.Event();

        sinon.ProgressEvent.prototype.constructor = sinon.ProgressEvent;

        sinon.CustomEvent = function CustomEvent(type, customData, target) {
            this.initEvent(type, false, false, target);
            this.detail = customData.detail || null;
        };

        sinon.CustomEvent.prototype = new sinon.Event();

        sinon.CustomEvent.prototype.constructor = sinon.CustomEvent;

        sinon.EventTarget = {
            addEventListener: function addEventListener(event, listener) {
                this.eventListeners = this.eventListeners || {};
                this.eventListeners[event] = this.eventListeners[event] || [];
                push.call(this.eventListeners[event], listener);
            },

            removeEventListener: function removeEventListener(event, listener) {
                var listeners = this.eventListeners && this.eventListeners[event] || [];

                for (var i = 0, l = listeners.length; i < l; ++i) {
                    if (listeners[i] === listener) {
                        return listeners.splice(i, 1);
                    }
                }
            },

            dispatchEvent: function dispatchEvent(event) {
                var type = event.type;
                var listeners = this.eventListeners && this.eventListeners[type] || [];

                for (var i = 0; i < listeners.length; i++) {
                    if (typeof listeners[i] === "function") {
                        listeners[i].call(this, event);
                    } else {
                        listeners[i].handleEvent(event);
                    }
                }

                return !!event.defaultPrevented;
            }
        };
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require) {
        var sinon = require("./core");
        makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require);
    } else {
        makeApi(sinon); // eslint-disable-line no-undef
    }
}());

},{"./core":26}],28:[function(require,module,exports){
/**
 * @depend fake_xdomain_request.js
 * @depend fake_xml_http_request.js
 * @depend ../format.js
 * @depend ../log_error.js
 */
/**
 * The Sinon "server" mimics a web server that receives requests from
 * sinon.FakeXMLHttpRequest and provides an API to respond to those requests,
 * both synchronously and asynchronously. To respond synchronuously, canned
 * answers have to be provided upfront.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function () {
    "use strict";

    var push = [].push;

    function responseArray(handler) {
        var response = handler;

        if (Object.prototype.toString.call(handler) !== "[object Array]") {
            response = [200, {}, handler];
        }

        if (typeof response[2] !== "string") {
            throw new TypeError("Fake server response body should be string, but was " +
                                typeof response[2]);
        }

        return response;
    }

    var wloc = typeof window !== "undefined" ? window.location : {};
    var rCurrLoc = new RegExp("^" + wloc.protocol + "//" + wloc.host);

    function matchOne(response, reqMethod, reqUrl) {
        var rmeth = response.method;
        var matchMethod = !rmeth || rmeth.toLowerCase() === reqMethod.toLowerCase();
        var url = response.url;
        var matchUrl = !url || url === reqUrl || (typeof url.test === "function" && url.test(reqUrl));

        return matchMethod && matchUrl;
    }

    function match(response, request) {
        var requestUrl = request.url;

        if (!/^https?:\/\//.test(requestUrl) || rCurrLoc.test(requestUrl)) {
            requestUrl = requestUrl.replace(rCurrLoc, "");
        }

        if (matchOne(response, this.getHTTPMethod(request), requestUrl)) {
            if (typeof response.response === "function") {
                var ru = response.url;
                var args = [request].concat(ru && typeof ru.exec === "function" ? ru.exec(requestUrl).slice(1) : []);
                return response.response.apply(response, args);
            }

            return true;
        }

        return false;
    }

    function makeApi(sinon) {
        sinon.fakeServer = {
            create: function (config) {
                var server = sinon.create(this);
                server.configure(config);
                if (!sinon.xhr.supportsCORS) {
                    this.xhr = sinon.useFakeXDomainRequest();
                } else {
                    this.xhr = sinon.useFakeXMLHttpRequest();
                }
                server.requests = [];

                this.xhr.onCreate = function (xhrObj) {
                    server.addRequest(xhrObj);
                };

                return server;
            },
            configure: function (config) {
                var whitelist = {
                    "autoRespond": true,
                    "autoRespondAfter": true,
                    "respondImmediately": true,
                    "fakeHTTPMethods": true
                };
                var setting;

                config = config || {};
                for (setting in config) {
                    if (whitelist.hasOwnProperty(setting) && config.hasOwnProperty(setting)) {
                        this[setting] = config[setting];
                    }
                }
            },
            addRequest: function addRequest(xhrObj) {
                var server = this;
                push.call(this.requests, xhrObj);

                xhrObj.onSend = function () {
                    server.handleRequest(this);

                    if (server.respondImmediately) {
                        server.respond();
                    } else if (server.autoRespond && !server.responding) {
                        setTimeout(function () {
                            server.responding = false;
                            server.respond();
                        }, server.autoRespondAfter || 10);

                        server.responding = true;
                    }
                };
            },

            getHTTPMethod: function getHTTPMethod(request) {
                if (this.fakeHTTPMethods && /post/i.test(request.method)) {
                    var matches = (request.requestBody || "").match(/_method=([^\b;]+)/);
                    return matches ? matches[1] : request.method;
                }

                return request.method;
            },

            handleRequest: function handleRequest(xhr) {
                if (xhr.async) {
                    if (!this.queue) {
                        this.queue = [];
                    }

                    push.call(this.queue, xhr);
                } else {
                    this.processRequest(xhr);
                }
            },

            log: function log(response, request) {
                var str;

                str = "Request:\n" + sinon.format(request) + "\n\n";
                str += "Response:\n" + sinon.format(response) + "\n\n";

                sinon.log(str);
            },

            respondWith: function respondWith(method, url, body) {
                if (arguments.length === 1 && typeof method !== "function") {
                    this.response = responseArray(method);
                    return;
                }

                if (!this.responses) {
                    this.responses = [];
                }

                if (arguments.length === 1) {
                    body = method;
                    url = method = null;
                }

                if (arguments.length === 2) {
                    body = url;
                    url = method;
                    method = null;
                }

                push.call(this.responses, {
                    method: method,
                    url: url,
                    response: typeof body === "function" ? body : responseArray(body)
                });
            },

            respond: function respond() {
                if (arguments.length > 0) {
                    this.respondWith.apply(this, arguments);
                }

                var queue = this.queue || [];
                var requests = queue.splice(0, queue.length);

                for (var i = 0; i < requests.length; i++) {
                    this.processRequest(requests[i]);
                }
            },

            processRequest: function processRequest(request) {
                try {
                    if (request.aborted) {
                        return;
                    }

                    var response = this.response || [404, {}, ""];

                    if (this.responses) {
                        for (var l = this.responses.length, i = l - 1; i >= 0; i--) {
                            if (match.call(this, this.responses[i], request)) {
                                response = this.responses[i].response;
                                break;
                            }
                        }
                    }

                    if (request.readyState !== 4) {
                        this.log(response, request);

                        request.respond(response[0], response[1], response[2]);
                    }
                } catch (e) {
                    sinon.logError("Fake server request processing", e);
                }
            },

            restore: function restore() {
                return this.xhr.restore && this.xhr.restore.apply(this.xhr, arguments);
            }
        };
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./core");
        require("./fake_xdomain_request");
        require("./fake_xml_http_request");
        require("../format");
        makeApi(sinon);
        module.exports = sinon;
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require, module.exports, module);
    } else {
        makeApi(sinon); // eslint-disable-line no-undef
    }
}());

},{"../format":15,"./core":26,"./fake_xdomain_request":31,"./fake_xml_http_request":32}],29:[function(require,module,exports){
/**
 * @depend fake_server.js
 * @depend fake_timers.js
 */
/**
 * Add-on for sinon.fakeServer that automatically handles a fake timer along with
 * the FakeXMLHttpRequest. The direct inspiration for this add-on is jQuery
 * 1.3.x, which does not use xhr object's onreadystatehandler at all - instead,
 * it polls the object for completion with setInterval. Dispite the direct
 * motivation, there is nothing jQuery-specific in this file, so it can be used
 * in any environment where the ajax implementation depends on setInterval or
 * setTimeout.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function () {
    "use strict";

    function makeApi(sinon) {
        function Server() {}
        Server.prototype = sinon.fakeServer;

        sinon.fakeServerWithClock = new Server();

        sinon.fakeServerWithClock.addRequest = function addRequest(xhr) {
            if (xhr.async) {
                if (typeof setTimeout.clock === "object") {
                    this.clock = setTimeout.clock;
                } else {
                    this.clock = sinon.useFakeTimers();
                    this.resetClock = true;
                }

                if (!this.longestTimeout) {
                    var clockSetTimeout = this.clock.setTimeout;
                    var clockSetInterval = this.clock.setInterval;
                    var server = this;

                    this.clock.setTimeout = function (fn, timeout) {
                        server.longestTimeout = Math.max(timeout, server.longestTimeout || 0);

                        return clockSetTimeout.apply(this, arguments);
                    };

                    this.clock.setInterval = function (fn, timeout) {
                        server.longestTimeout = Math.max(timeout, server.longestTimeout || 0);

                        return clockSetInterval.apply(this, arguments);
                    };
                }
            }

            return sinon.fakeServer.addRequest.call(this, xhr);
        };

        sinon.fakeServerWithClock.respond = function respond() {
            var returnVal = sinon.fakeServer.respond.apply(this, arguments);

            if (this.clock) {
                this.clock.tick(this.longestTimeout || 0);
                this.longestTimeout = 0;

                if (this.resetClock) {
                    this.clock.restore();
                    this.resetClock = false;
                }
            }

            return returnVal;
        };

        sinon.fakeServerWithClock.restore = function restore() {
            if (this.clock) {
                this.clock.restore();
            }

            return sinon.fakeServer.restore.apply(this, arguments);
        };
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require) {
        var sinon = require("./core");
        require("./fake_server");
        require("./fake_timers");
        makeApi(sinon);
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require);
    } else {
        makeApi(sinon); // eslint-disable-line no-undef
    }
}());

},{"./core":26,"./fake_server":28,"./fake_timers":30}],30:[function(require,module,exports){
/**
 * Fake timer API
 * setTimeout
 * setInterval
 * clearTimeout
 * clearInterval
 * tick
 * reset
 * Date
 *
 * Inspired by jsUnitMockTimeOut from JsUnit
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function () {
    "use strict";

    function makeApi(s, lol) {
        /*global lolex */
        var llx = typeof lolex !== "undefined" ? lolex : lol;

        s.useFakeTimers = function () {
            var now;
            var methods = Array.prototype.slice.call(arguments);

            if (typeof methods[0] === "string") {
                now = 0;
            } else {
                now = methods.shift();
            }

            var clock = llx.install(now || 0, methods);
            clock.restore = clock.uninstall;
            return clock;
        };

        s.clock = {
            create: function (now) {
                return llx.createClock(now);
            }
        };

        s.timers = {
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setImmediate: (typeof setImmediate !== "undefined" ? setImmediate : undefined),
            clearImmediate: (typeof clearImmediate !== "undefined" ? clearImmediate : undefined),
            setInterval: setInterval,
            clearInterval: clearInterval,
            Date: Date
        };
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, epxorts, module, lolex) {
        var core = require("./core");
        makeApi(core, lolex);
        module.exports = core;
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require, module.exports, module, require("lolex"));
    } else {
        makeApi(sinon); // eslint-disable-line no-undef
    }
}());

},{"./core":26,"lolex":35}],31:[function(require,module,exports){
(function (global){
/**
 * @depend core.js
 * @depend ../extend.js
 * @depend event.js
 * @depend ../log_error.js
 */
/**
 * Fake XDomainRequest object
 */
if (typeof sinon === "undefined") {
    this.sinon = {};
}

// wrapper for global
(function (global) {
    "use strict";

    var xdr = { XDomainRequest: global.XDomainRequest };
    xdr.GlobalXDomainRequest = global.XDomainRequest;
    xdr.supportsXDR = typeof xdr.GlobalXDomainRequest !== "undefined";
    xdr.workingXDR = xdr.supportsXDR ? xdr.GlobalXDomainRequest : false;

    function makeApi(sinon) {
        sinon.xdr = xdr;

        function FakeXDomainRequest() {
            this.readyState = FakeXDomainRequest.UNSENT;
            this.requestBody = null;
            this.requestHeaders = {};
            this.status = 0;
            this.timeout = null;

            if (typeof FakeXDomainRequest.onCreate === "function") {
                FakeXDomainRequest.onCreate(this);
            }
        }

        function verifyState(x) {
            if (x.readyState !== FakeXDomainRequest.OPENED) {
                throw new Error("INVALID_STATE_ERR");
            }

            if (x.sendFlag) {
                throw new Error("INVALID_STATE_ERR");
            }
        }

        function verifyRequestSent(x) {
            if (x.readyState === FakeXDomainRequest.UNSENT) {
                throw new Error("Request not sent");
            }
            if (x.readyState === FakeXDomainRequest.DONE) {
                throw new Error("Request done");
            }
        }

        function verifyResponseBodyType(body) {
            if (typeof body !== "string") {
                var error = new Error("Attempted to respond to fake XDomainRequest with " +
                                    body + ", which is not a string.");
                error.name = "InvalidBodyException";
                throw error;
            }
        }

        sinon.extend(FakeXDomainRequest.prototype, sinon.EventTarget, {
            open: function open(method, url) {
                this.method = method;
                this.url = url;

                this.responseText = null;
                this.sendFlag = false;

                this.readyStateChange(FakeXDomainRequest.OPENED);
            },

            readyStateChange: function readyStateChange(state) {
                this.readyState = state;
                var eventName = "";
                switch (this.readyState) {
                case FakeXDomainRequest.UNSENT:
                    break;
                case FakeXDomainRequest.OPENED:
                    break;
                case FakeXDomainRequest.LOADING:
                    if (this.sendFlag) {
                        //raise the progress event
                        eventName = "onprogress";
                    }
                    break;
                case FakeXDomainRequest.DONE:
                    if (this.isTimeout) {
                        eventName = "ontimeout";
                    } else if (this.errorFlag || (this.status < 200 || this.status > 299)) {
                        eventName = "onerror";
                    } else {
                        eventName = "onload";
                    }
                    break;
                }

                // raising event (if defined)
                if (eventName) {
                    if (typeof this[eventName] === "function") {
                        try {
                            this[eventName]();
                        } catch (e) {
                            sinon.logError("Fake XHR " + eventName + " handler", e);
                        }
                    }
                }
            },

            send: function send(data) {
                verifyState(this);

                if (!/^(get|head)$/i.test(this.method)) {
                    this.requestBody = data;
                }
                this.requestHeaders["Content-Type"] = "text/plain;charset=utf-8";

                this.errorFlag = false;
                this.sendFlag = true;
                this.readyStateChange(FakeXDomainRequest.OPENED);

                if (typeof this.onSend === "function") {
                    this.onSend(this);
                }
            },

            abort: function abort() {
                this.aborted = true;
                this.responseText = null;
                this.errorFlag = true;

                if (this.readyState > sinon.FakeXDomainRequest.UNSENT && this.sendFlag) {
                    this.readyStateChange(sinon.FakeXDomainRequest.DONE);
                    this.sendFlag = false;
                }
            },

            setResponseBody: function setResponseBody(body) {
                verifyRequestSent(this);
                verifyResponseBodyType(body);

                var chunkSize = this.chunkSize || 10;
                var index = 0;
                this.responseText = "";

                do {
                    this.readyStateChange(FakeXDomainRequest.LOADING);
                    this.responseText += body.substring(index, index + chunkSize);
                    index += chunkSize;
                } while (index < body.length);

                this.readyStateChange(FakeXDomainRequest.DONE);
            },

            respond: function respond(status, contentType, body) {
                // content-type ignored, since XDomainRequest does not carry this
                // we keep the same syntax for respond(...) as for FakeXMLHttpRequest to ease
                // test integration across browsers
                this.status = typeof status === "number" ? status : 200;
                this.setResponseBody(body || "");
            },

            simulatetimeout: function simulatetimeout() {
                this.status = 0;
                this.isTimeout = true;
                // Access to this should actually throw an error
                this.responseText = undefined;
                this.readyStateChange(FakeXDomainRequest.DONE);
            }
        });

        sinon.extend(FakeXDomainRequest, {
            UNSENT: 0,
            OPENED: 1,
            LOADING: 3,
            DONE: 4
        });

        sinon.useFakeXDomainRequest = function useFakeXDomainRequest() {
            sinon.FakeXDomainRequest.restore = function restore(keepOnCreate) {
                if (xdr.supportsXDR) {
                    global.XDomainRequest = xdr.GlobalXDomainRequest;
                }

                delete sinon.FakeXDomainRequest.restore;

                if (keepOnCreate !== true) {
                    delete sinon.FakeXDomainRequest.onCreate;
                }
            };
            if (xdr.supportsXDR) {
                global.XDomainRequest = sinon.FakeXDomainRequest;
            }
            return sinon.FakeXDomainRequest;
        };

        sinon.FakeXDomainRequest = FakeXDomainRequest;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./core");
        require("../extend");
        require("./event");
        require("../log_error");
        makeApi(sinon);
        module.exports = sinon;
    }

    if (isAMD) {
        define(loadDependencies);
    } else if (isNode) {
        loadDependencies(require, module.exports, module);
    } else {
        makeApi(sinon); // eslint-disable-line no-undef
    }
})(typeof global !== "undefined" ? global : self);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../extend":14,"../log_error":16,"./core":26,"./event":27}],32:[function(require,module,exports){
(function (global){
/**
 * @depend core.js
 * @depend ../extend.js
 * @depend event.js
 * @depend ../log_error.js
 */
/**
 * Fake XMLHttpRequest object
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
(function (sinonGlobal, global) {
    "use strict";

    function getWorkingXHR(globalScope) {
        var supportsXHR = typeof globalScope.XMLHttpRequest !== "undefined";
        if (supportsXHR) {
            return globalScope.XMLHttpRequest;
        }

        var supportsActiveX = typeof globalScope.ActiveXObject !== "undefined";
        if (supportsActiveX) {
            return function () {
                return new globalScope.ActiveXObject("MSXML2.XMLHTTP.3.0");
            };
        }

        return false;
    }

    var supportsProgress = typeof ProgressEvent !== "undefined";
    var supportsCustomEvent = typeof CustomEvent !== "undefined";
    var supportsFormData = typeof FormData !== "undefined";
    var supportsArrayBuffer = typeof ArrayBuffer !== "undefined";
    var supportsBlob = typeof Blob === "function";
    var sinonXhr = { XMLHttpRequest: global.XMLHttpRequest };
    sinonXhr.GlobalXMLHttpRequest = global.XMLHttpRequest;
    sinonXhr.GlobalActiveXObject = global.ActiveXObject;
    sinonXhr.supportsActiveX = typeof sinonXhr.GlobalActiveXObject !== "undefined";
    sinonXhr.supportsXHR = typeof sinonXhr.GlobalXMLHttpRequest !== "undefined";
    sinonXhr.workingXHR = getWorkingXHR(global);
    sinonXhr.supportsCORS = sinonXhr.supportsXHR && "withCredentials" in (new sinonXhr.GlobalXMLHttpRequest());

    var unsafeHeaders = {
        "Accept-Charset": true,
        "Accept-Encoding": true,
        Connection: true,
        "Content-Length": true,
        Cookie: true,
        Cookie2: true,
        "Content-Transfer-Encoding": true,
        Date: true,
        Expect: true,
        Host: true,
        "Keep-Alive": true,
        Referer: true,
        TE: true,
        Trailer: true,
        "Transfer-Encoding": true,
        Upgrade: true,
        "User-Agent": true,
        Via: true
    };

    // An upload object is created for each
    // FakeXMLHttpRequest and allows upload
    // events to be simulated using uploadProgress
    // and uploadError.
    function UploadProgress() {
        this.eventListeners = {
            progress: [],
            load: [],
            abort: [],
            error: []
        };
    }

    UploadProgress.prototype.addEventListener = function addEventListener(event, listener) {
        this.eventListeners[event].push(listener);
    };

    UploadProgress.prototype.removeEventListener = function removeEventListener(event, listener) {
        var listeners = this.eventListeners[event] || [];

        for (var i = 0, l = listeners.length; i < l; ++i) {
            if (listeners[i] === listener) {
                return listeners.splice(i, 1);
            }
        }
    };

    UploadProgress.prototype.dispatchEvent = function dispatchEvent(event) {
        var listeners = this.eventListeners[event.type] || [];

        for (var i = 0, listener; (listener = listeners[i]) != null; i++) {
            listener(event);
        }
    };

    // Note that for FakeXMLHttpRequest to work pre ES5
    // we lose some of the alignment with the spec.
    // To ensure as close a match as possible,
    // set responseType before calling open, send or respond;
    function FakeXMLHttpRequest() {
        this.readyState = FakeXMLHttpRequest.UNSENT;
        this.requestHeaders = {};
        this.requestBody = null;
        this.status = 0;
        this.statusText = "";
        this.upload = new UploadProgress();
        this.responseType = "";
        this.response = "";
        if (sinonXhr.supportsCORS) {
            this.withCredentials = false;
        }

        var xhr = this;
        var events = ["loadstart", "load", "abort", "loadend"];

        function addEventListener(eventName) {
            xhr.addEventListener(eventName, function (event) {
                var listener = xhr["on" + eventName];

                if (listener && typeof listener === "function") {
                    listener.call(this, event);
                }
            });
        }

        for (var i = events.length - 1; i >= 0; i--) {
            addEventListener(events[i]);
        }

        if (typeof FakeXMLHttpRequest.onCreate === "function") {
            FakeXMLHttpRequest.onCreate(this);
        }
    }

    function verifyState(xhr) {
        if (xhr.readyState !== FakeXMLHttpRequest.OPENED) {
            throw new Error("INVALID_STATE_ERR");
        }

        if (xhr.sendFlag) {
            throw new Error("INVALID_STATE_ERR");
        }
    }

    function getHeader(headers, header) {
        header = header.toLowerCase();

        for (var h in headers) {
            if (h.toLowerCase() === header) {
                return h;
            }
        }

        return null;
    }

    // filtering to enable a white-list version of Sinon FakeXhr,
    // where whitelisted requests are passed through to real XHR
    function each(collection, callback) {
        if (!collection) {
            return;
        }

        for (var i = 0, l = collection.length; i < l; i += 1) {
            callback(collection[i]);
        }
    }
    function some(collection, callback) {
        for (var index = 0; index < collection.length; index++) {
            if (callback(collection[index]) === true) {
                return true;
            }
        }
        return false;
    }
    // largest arity in XHR is 5 - XHR#open
    var apply = function (obj, method, args) {
        switch (args.length) {
        case 0: return obj[method]();
        case 1: return obj[method](args[0]);
        case 2: return obj[method](args[0], args[1]);
        case 3: return obj[method](args[0], args[1], args[2]);
        case 4: return obj[method](args[0], args[1], args[2], args[3]);
        case 5: return obj[method](args[0], args[1], args[2], args[3], args[4]);
        }
    };

    FakeXMLHttpRequest.filters = [];
    FakeXMLHttpRequest.addFilter = function addFilter(fn) {
        this.filters.push(fn);
    };
    var IE6Re = /MSIE 6/;
    FakeXMLHttpRequest.defake = function defake(fakeXhr, xhrArgs) {
        var xhr = new sinonXhr.workingXHR(); // eslint-disable-line new-cap

        each([
            "open",
            "setRequestHeader",
            "send",
            "abort",
            "getResponseHeader",
            "getAllResponseHeaders",
            "addEventListener",
            "overrideMimeType",
            "removeEventListener"
        ], function (method) {
            fakeXhr[method] = function () {
                return apply(xhr, method, arguments);
            };
        });

        var copyAttrs = function (args) {
            each(args, function (attr) {
                try {
                    fakeXhr[attr] = xhr[attr];
                } catch (e) {
                    if (!IE6Re.test(navigator.userAgent)) {
                        throw e;
                    }
                }
            });
        };

        var stateChange = function stateChange() {
            fakeXhr.readyState = xhr.readyState;
            if (xhr.readyState >= FakeXMLHttpRequest.HEADERS_RECEIVED) {
                copyAttrs(["status", "statusText"]);
            }
            if (xhr.readyState >= FakeXMLHttpRequest.LOADING) {
                copyAttrs(["responseText", "response"]);
            }
            if (xhr.readyState === FakeXMLHttpRequest.DONE) {
                copyAttrs(["responseXML"]);
            }
            if (fakeXhr.onreadystatechange) {
                fakeXhr.onreadystatechange.call(fakeXhr, { target: fakeXhr });
            }
        };

        if (xhr.addEventListener) {
            for (var event in fakeXhr.eventListeners) {
                if (fakeXhr.eventListeners.hasOwnProperty(event)) {

                    /*eslint-disable no-loop-func*/
                    each(fakeXhr.eventListeners[event], function (handler) {
                        xhr.addEventListener(event, handler);
                    });
                    /*eslint-enable no-loop-func*/
                }
            }
            xhr.addEventListener("readystatechange", stateChange);
        } else {
            xhr.onreadystatechange = stateChange;
        }
        apply(xhr, "open", xhrArgs);
    };
    FakeXMLHttpRequest.useFilters = false;

    function verifyRequestOpened(xhr) {
        if (xhr.readyState !== FakeXMLHttpRequest.OPENED) {
            throw new Error("INVALID_STATE_ERR - " + xhr.readyState);
        }
    }

    function verifyRequestSent(xhr) {
        if (xhr.readyState === FakeXMLHttpRequest.DONE) {
            throw new Error("Request done");
        }
    }

    function verifyHeadersReceived(xhr) {
        if (xhr.async && xhr.readyState !== FakeXMLHttpRequest.HEADERS_RECEIVED) {
            throw new Error("No headers received");
        }
    }

    function verifyResponseBodyType(body) {
        if (typeof body !== "string") {
            var error = new Error("Attempted to respond to fake XMLHttpRequest with " +
                                 body + ", which is not a string.");
            error.name = "InvalidBodyException";
            throw error;
        }
    }

    function convertToArrayBuffer(body) {
        var buffer = new ArrayBuffer(body.length);
        var view = new Uint8Array(buffer);
        for (var i = 0; i < body.length; i++) {
            var charCode = body.charCodeAt(i);
            if (charCode >= 256) {
                throw new TypeError("arraybuffer or blob responseTypes require binary string, " +
                                    "invalid character " + body[i] + " found.");
            }
            view[i] = charCode;
        }
        return buffer;
    }

    function isXmlContentType(contentType) {
        return !contentType || /(text\/xml)|(application\/xml)|(\+xml)/.test(contentType);
    }

    function convertResponseBody(responseType, contentType, body) {
        if (responseType === "" || responseType === "text") {
            return body;
        } else if (supportsArrayBuffer && responseType === "arraybuffer") {
            return convertToArrayBuffer(body);
        } else if (responseType === "json") {
            try {
                return JSON.parse(body);
            } catch (e) {
                // Return parsing failure as null
                return null;
            }
        } else if (supportsBlob && responseType === "blob") {
            var blobOptions = {};
            if (contentType) {
                blobOptions.type = contentType;
            }
            return new Blob([convertToArrayBuffer(body)], blobOptions);
        } else if (responseType === "document") {
            if (isXmlContentType(contentType)) {
                return FakeXMLHttpRequest.parseXML(body);
            }
            return null;
        }
        throw new Error("Invalid responseType " + responseType);
    }

    function clearResponse(xhr) {
        if (xhr.responseType === "" || xhr.responseType === "text") {
            xhr.response = xhr.responseText = "";
        } else {
            xhr.response = xhr.responseText = null;
        }
        xhr.responseXML = null;
    }

    FakeXMLHttpRequest.parseXML = function parseXML(text) {
        // Treat empty string as parsing failure
        if (text !== "") {
            try {
                if (typeof DOMParser !== "undefined") {
                    var parser = new DOMParser();
                    return parser.parseFromString(text, "text/xml");
                }
                var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = "false";
                xmlDoc.loadXML(text);
                return xmlDoc;
            } catch (e) {
                // Unable to parse XML - no biggie
            }
        }

        return null;
    };

    FakeXMLHttpRequest.statusCodes = {
        100: "Continue",
        101: "Switching Protocols",
        200: "OK",
        201: "Created",
        202: "Accepted",
        203: "Non-Authoritative Information",
        204: "No Content",
        205: "Reset Content",
        206: "Partial Content",
        207: "Multi-Status",
        300: "Multiple Choice",
        301: "Moved Permanently",
        302: "Found",
        303: "See Other",
        304: "Not Modified",
        305: "Use Proxy",
        307: "Temporary Redirect",
        400: "Bad Request",
        401: "Unauthorized",
        402: "Payment Required",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        406: "Not Acceptable",
        407: "Proxy Authentication Required",
        408: "Request Timeout",
        409: "Conflict",
        410: "Gone",
        411: "Length Required",
        412: "Precondition Failed",
        413: "Request Entity Too Large",
        414: "Request-URI Too Long",
        415: "Unsupported Media Type",
        416: "Requested Range Not Satisfiable",
        417: "Expectation Failed",
        422: "Unprocessable Entity",
        500: "Internal Server Error",
        501: "Not Implemented",
        502: "Bad Gateway",
        503: "Service Unavailable",
        504: "Gateway Timeout",
        505: "HTTP Version Not Supported"
    };

    function makeApi(sinon) {
        sinon.xhr = sinonXhr;

        sinon.extend(FakeXMLHttpRequest.prototype, sinon.EventTarget, {
            async: true,

            open: function open(method, url, async, username, password) {
                this.method = method;
                this.url = url;
                this.async = typeof async === "boolean" ? async : true;
                this.username = username;
                this.password = password;
                clearResponse(this);
                this.requestHeaders = {};
                this.sendFlag = false;

                if (FakeXMLHttpRequest.useFilters === true) {
                    var xhrArgs = arguments;
                    var defake = some(FakeXMLHttpRequest.filters, function (filter) {
                        return filter.apply(this, xhrArgs);
                    });
                    if (defake) {
                        return FakeXMLHttpRequest.defake(this, arguments);
                    }
                }
                this.readyStateChange(FakeXMLHttpRequest.OPENED);
            },

            readyStateChange: function readyStateChange(state) {
                this.readyState = state;

                var readyStateChangeEvent = new sinon.Event("readystatechange", false, false, this);

                if (typeof this.onreadystatechange === "function") {
                    try {
                        this.onreadystatechange(readyStateChangeEvent);
                    } catch (e) {
                        sinon.logError("Fake XHR onreadystatechange handler", e);
                    }
                }

                switch (this.readyState) {
                    case FakeXMLHttpRequest.DONE:
                        if (supportsProgress) {
                            this.upload.dispatchEvent(new sinon.ProgressEvent("progress", {loaded: 100, total: 100}));
                            this.dispatchEvent(new sinon.ProgressEvent("progress", {loaded: 100, total: 100}));
                        }
                        this.upload.dispatchEvent(new sinon.Event("load", false, false, this));
                        this.dispatchEvent(new sinon.Event("load", false, false, this));
                        this.dispatchEvent(new sinon.Event("loadend", false, false, this));
                        break;
                }

                this.dispatchEvent(readyStateChangeEvent);
            },

            setRequestHeader: function setRequestHeader(header, value) {
                verifyState(this);

                if (unsafeHeaders[header] || /^(Sec-|Proxy-)/.test(header)) {
                    throw new Error("Refused to set unsafe header \"" + header + "\"");
                }

                if (this.requestHeaders[header]) {
                    this.requestHeaders[header] += "," + value;
                } else {
                    this.requestHeaders[header] = value;
                }
            },

            // Helps testing
            setResponseHeaders: function setResponseHeaders(headers) {
                verifyRequestOpened(this);
                this.responseHeaders = {};

                for (var header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        this.responseHeaders[header] = headers[header];
                    }
                }

                if (this.async) {
                    this.readyStateChange(FakeXMLHttpRequest.HEADERS_RECEIVED);
                } else {
                    this.readyState = FakeXMLHttpRequest.HEADERS_RECEIVED;
                }
            },

            // Currently treats ALL data as a DOMString (i.e. no Document)
            send: function send(data) {
                verifyState(this);

                if (!/^(get|head)$/i.test(this.method)) {
                    var contentType = getHeader(this.requestHeaders, "Content-Type");
                    if (this.requestHeaders[contentType]) {
                        var value = this.requestHeaders[contentType].split(";");
                        this.requestHeaders[contentType] = value[0] + ";charset=utf-8";
                    } else if (supportsFormData && !(data instanceof FormData)) {
                        this.requestHeaders["Content-Type"] = "text/plain;charset=utf-8";
                    }

                    this.requestBody = data;
                }

                this.errorFlag = false;
                this.sendFlag = this.async;
                clearResponse(this);
                this.readyStateChange(FakeXMLHttpRequest.OPENED);

                if (typeof this.onSend === "function") {
                    this.onSend(this);
                }

                this.dispatchEvent(new sinon.Event("loadstart", false, false, this));
            },

            abort: function abort() {
                this.aborted = true;
                clearResponse(this);
                this.errorFlag = true;
                this.requestHeaders = {};
                this.responseHeaders = {};

                if (this.readyState > FakeXMLHttpRequest.UNSENT && this.sendFlag) {
                    this.readyStateChange(FakeXMLHttpRequest.DONE);
                    this.sendFlag = false;
                }

                this.readyState = FakeXMLHttpRequest.UNSENT;

                this.dispatchEvent(new sinon.Event("abort", false, false, this));

                this.upload.dispatchEvent(new sinon.Event("abort", false, false, this));

                if (typeof this.onerror === "function") {
                    this.onerror();
                }
            },

            getResponseHeader: function getResponseHeader(header) {
                if (this.readyState < FakeXMLHttpRequest.HEADERS_RECEIVED) {
                    return null;
                }

                if (/^Set-Cookie2?$/i.test(header)) {
                    return null;
                }

                header = getHeader(this.responseHeaders, header);

                return this.responseHeaders[header] || null;
            },

            getAllResponseHeaders: function getAllResponseHeaders() {
                if (this.readyState < FakeXMLHttpRequest.HEADERS_RECEIVED) {
                    return "";
                }

                var headers = "";

                for (var header in this.responseHeaders) {
                    if (this.responseHeaders.hasOwnProperty(header) &&
                        !/^Set-Cookie2?$/i.test(header)) {
                        headers += header + ": " + this.responseHeaders[header] + "\r\n";
                    }
                }

                return headers;
            },

            setResponseBody: function setResponseBody(body) {
                verifyRequestSent(this);
                verifyHeadersReceived(this);
                verifyResponseBodyType(body);
                var contentType = this.getResponseHeader("Content-Type");

                var isTextResponse = this.responseType === "" || this.responseType === "text";
                clearResponse(this);
                if (this.async) {
                    var chunkSize = this.chunkSize || 10;
                    var index = 0;

                    do {
                        this.readyStateChange(FakeXMLHttpRequest.LOADING);

                        if (isTextResponse) {
                            this.responseText = this.response += body.substring(index, index + chunkSize);
                        }
                        index += chunkSize;
                    } while (index < body.length);
                }

                this.response = convertResponseBody(this.responseType, contentType, body);
                if (isTextResponse) {
                    this.responseText = this.response;
                }

                if (this.responseType === "document") {
                    this.responseXML = this.response;
                } else if (this.responseType === "" && isXmlContentType(contentType)) {
                    this.responseXML = FakeXMLHttpRequest.parseXML(this.responseText);
                }
                this.readyStateChange(FakeXMLHttpRequest.DONE);
            },

            respond: function respond(status, headers, body) {
                this.status = typeof status === "number" ? status : 200;
                this.statusText = FakeXMLHttpRequest.statusCodes[this.status];
                this.setResponseHeaders(headers || {});
                this.setResponseBody(body || "");
            },

            uploadProgress: function uploadProgress(progressEventRaw) {
                if (supportsProgress) {
                    this.upload.dispatchEvent(new sinon.ProgressEvent("progress", progressEventRaw));
                }
            },

            downloadProgress: function downloadProgress(progressEventRaw) {
                if (supportsProgress) {
                    this.dispatchEvent(new sinon.ProgressEvent("progress", progressEventRaw));
                }
            },

            uploadError: function uploadError(error) {
                if (supportsCustomEvent) {
                    this.upload.dispatchEvent(new sinon.CustomEvent("error", {detail: error}));
                }
            }
        });

        sinon.extend(FakeXMLHttpRequest, {
            UNSENT: 0,
            OPENED: 1,
            HEADERS_RECEIVED: 2,
            LOADING: 3,
            DONE: 4
        });

        sinon.useFakeXMLHttpRequest = function () {
            FakeXMLHttpRequest.restore = function restore(keepOnCreate) {
                if (sinonXhr.supportsXHR) {
                    global.XMLHttpRequest = sinonXhr.GlobalXMLHttpRequest;
                }

                if (sinonXhr.supportsActiveX) {
                    global.ActiveXObject = sinonXhr.GlobalActiveXObject;
                }

                delete FakeXMLHttpRequest.restore;

                if (keepOnCreate !== true) {
                    delete FakeXMLHttpRequest.onCreate;
                }
            };
            if (sinonXhr.supportsXHR) {
                global.XMLHttpRequest = FakeXMLHttpRequest;
            }

            if (sinonXhr.supportsActiveX) {
                global.ActiveXObject = function ActiveXObject(objId) {
                    if (objId === "Microsoft.XMLHTTP" || /^Msxml2\.XMLHTTP/i.test(objId)) {

                        return new FakeXMLHttpRequest();
                    }

                    return new sinonXhr.GlobalActiveXObject(objId);
                };
            }

            return FakeXMLHttpRequest;
        };

        sinon.FakeXMLHttpRequest = FakeXMLHttpRequest;
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    function loadDependencies(require, exports, module) {
        var sinon = require("./core");
        require("../extend");
        require("./event");
        require("../log_error");
        makeApi(sinon);
        module.exports = sinon;
    }

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon, // eslint-disable-line no-undef
    typeof global !== "undefined" ? global : self
));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../extend":14,"../log_error":16,"./core":26,"./event":27}],33:[function(require,module,exports){
/**
 * @depend util/core.js
 */
(function (sinonGlobal) {
    "use strict";

    function makeApi(sinon) {
        function walkInternal(obj, iterator, context, originalObj) {
            var proto, prop;

            if (typeof Object.getOwnPropertyNames !== "function") {
                // We explicitly want to enumerate through all of the prototype's properties
                // in this case, therefore we deliberately leave out an own property check.
                /* eslint-disable guard-for-in */
                for (prop in obj) {
                    iterator.call(context, obj[prop], prop, obj);
                }
                /* eslint-enable guard-for-in */

                return;
            }

            Object.getOwnPropertyNames(obj).forEach(function (k) {
                var target = typeof Object.getOwnPropertyDescriptor(obj, k).get === "function" ?
                    originalObj : obj;
                iterator.call(context, target[k], k, target);
            });

            proto = Object.getPrototypeOf(obj);
            if (proto) {
                walkInternal(proto, iterator, context, originalObj);
            }
        }

        /* Public: walks the prototype chain of an object and iterates over every own property
         * name encountered. The iterator is called in the same fashion that Array.prototype.forEach
         * works, where it is passed the value, key, and own object as the 1st, 2nd, and 3rd positional
         * argument, respectively. In cases where Object.getOwnPropertyNames is not available, walk will
         * default to using a simple for..in loop.
         *
         * obj - The object to walk the prototype chain for.
         * iterator - The function to be called on each pass of the walk.
         * context - (Optional) When given, the iterator will be called with this object as the receiver.
         */
        function walk(obj, iterator, context) {
            return walkInternal(obj, iterator, context, obj);
        }

        sinon.walk = walk;
        return sinon.walk;
    }

    function loadDependencies(require, exports, module) {
        var sinon = require("./util/core");
        module.exports = makeApi(sinon);
    }

    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var isAMD = typeof define === "function" && typeof define.amd === "object" && define.amd;

    if (isAMD) {
        define(loadDependencies);
        return;
    }

    if (isNode) {
        loadDependencies(require, module.exports, module);
        return;
    }

    if (sinonGlobal) {
        makeApi(sinonGlobal);
    }
}(
    typeof sinon === "object" && sinon // eslint-disable-line no-undef
));

},{"./util/core":26}],34:[function(require,module,exports){
(function (global){
((typeof define === "function" && define.amd && function (m) {
    define("formatio", ["samsam"], m);
}) || (typeof module === "object" && function (m) {
    module.exports = m(require("samsam"));
}) || function (m) { this.formatio = m(this.samsam); }
)(function (samsam) {
    "use strict";

    var formatio = {
        excludeConstructors: ["Object", /^.$/],
        quoteStrings: true,
        limitChildrenCount: 0
    };

    var hasOwn = Object.prototype.hasOwnProperty;

    var specialObjects = [];
    if (typeof global !== "undefined") {
        specialObjects.push({ object: global, value: "[object global]" });
    }
    if (typeof document !== "undefined") {
        specialObjects.push({
            object: document,
            value: "[object HTMLDocument]"
        });
    }
    if (typeof window !== "undefined") {
        specialObjects.push({ object: window, value: "[object Window]" });
    }

    function functionName(func) {
        if (!func) { return ""; }
        if (func.displayName) { return func.displayName; }
        if (func.name) { return func.name; }
        var matches = func.toString().match(/function\s+([^\(]+)/m);
        return (matches && matches[1]) || "";
    }

    function constructorName(f, object) {
        var name = functionName(object && object.constructor);
        var excludes = f.excludeConstructors ||
                formatio.excludeConstructors || [];

        var i, l;
        for (i = 0, l = excludes.length; i < l; ++i) {
            if (typeof excludes[i] === "string" && excludes[i] === name) {
                return "";
            } else if (excludes[i].test && excludes[i].test(name)) {
                return "";
            }
        }

        return name;
    }

    function isCircular(object, objects) {
        if (typeof object !== "object") { return false; }
        var i, l;
        for (i = 0, l = objects.length; i < l; ++i) {
            if (objects[i] === object) { return true; }
        }
        return false;
    }

    function ascii(f, object, processed, indent) {
        if (typeof object === "string") {
            var qs = f.quoteStrings;
            var quote = typeof qs !== "boolean" || qs;
            return processed || quote ? '"' + object + '"' : object;
        }

        if (typeof object === "function" && !(object instanceof RegExp)) {
            return ascii.func(object);
        }

        processed = processed || [];

        if (isCircular(object, processed)) { return "[Circular]"; }

        if (Object.prototype.toString.call(object) === "[object Array]") {
            return ascii.array.call(f, object, processed);
        }

        if (!object) { return String((1/object) === -Infinity ? "-0" : object); }
        if (samsam.isElement(object)) { return ascii.element(object); }

        if (typeof object.toString === "function" &&
                object.toString !== Object.prototype.toString) {
            return object.toString();
        }

        var i, l;
        for (i = 0, l = specialObjects.length; i < l; i++) {
            if (object === specialObjects[i].object) {
                return specialObjects[i].value;
            }
        }

        return ascii.object.call(f, object, processed, indent);
    }

    ascii.func = function (func) {
        return "function " + functionName(func) + "() {}";
    };

    ascii.array = function (array, processed) {
        processed = processed || [];
        processed.push(array);
        var pieces = [];
        var i, l;
        l = (this.limitChildrenCount > 0) ? 
            Math.min(this.limitChildrenCount, array.length) : array.length;

        for (i = 0; i < l; ++i) {
            pieces.push(ascii(this, array[i], processed));
        }

        if(l < array.length)
            pieces.push("[... " + (array.length - l) + " more elements]");

        return "[" + pieces.join(", ") + "]";
    };

    ascii.object = function (object, processed, indent) {
        processed = processed || [];
        processed.push(object);
        indent = indent || 0;
        var pieces = [], properties = samsam.keys(object).sort();
        var length = 3;
        var prop, str, obj, i, k, l;
        l = (this.limitChildrenCount > 0) ? 
            Math.min(this.limitChildrenCount, properties.length) : properties.length;

        for (i = 0; i < l; ++i) {
            prop = properties[i];
            obj = object[prop];

            if (isCircular(obj, processed)) {
                str = "[Circular]";
            } else {
                str = ascii(this, obj, processed, indent + 2);
            }

            str = (/\s/.test(prop) ? '"' + prop + '"' : prop) + ": " + str;
            length += str.length;
            pieces.push(str);
        }

        var cons = constructorName(this, object);
        var prefix = cons ? "[" + cons + "] " : "";
        var is = "";
        for (i = 0, k = indent; i < k; ++i) { is += " "; }

        if(l < properties.length)
            pieces.push("[... " + (properties.length - l) + " more elements]");

        if (length + indent > 80) {
            return prefix + "{\n  " + is + pieces.join(",\n  " + is) + "\n" +
                is + "}";
        }
        return prefix + "{ " + pieces.join(", ") + " }";
    };

    ascii.element = function (element) {
        var tagName = element.tagName.toLowerCase();
        var attrs = element.attributes, attr, pairs = [], attrName, i, l, val;

        for (i = 0, l = attrs.length; i < l; ++i) {
            attr = attrs.item(i);
            attrName = attr.nodeName.toLowerCase().replace("html:", "");
            val = attr.nodeValue;
            if (attrName !== "contenteditable" || val !== "inherit") {
                if (!!val) { pairs.push(attrName + "=\"" + val + "\""); }
            }
        }

        var formatted = "<" + tagName + (pairs.length > 0 ? " " : "");
        var content = element.innerHTML;

        if (content.length > 20) {
            content = content.substr(0, 20) + "[...]";
        }

        var res = formatted + pairs.join(" ") + ">" + content +
                "</" + tagName + ">";

        return res.replace(/ contentEditable="inherit"/, "");
    };

    function Formatio(options) {
        for (var opt in options) {
            this[opt] = options[opt];
        }
    }

    Formatio.prototype = {
        functionName: functionName,

        configure: function (options) {
            return new Formatio(options);
        },

        constructorName: function (object) {
            return constructorName(this, object);
        },

        ascii: function (object, processed, indent) {
            return ascii(this, object, processed, indent);
        }
    };

    return Formatio.prototype;
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"samsam":36}],35:[function(require,module,exports){
(function (global){
/*global global, window*/
/**
 * @author Christian Johansen (christian@cjohansen.no) and contributors
 * @license BSD
 *
 * Copyright (c) 2010-2014 Christian Johansen
 */

(function (global) {
    "use strict";

    // Make properties writable in IE, as per
    // http://www.adequatelygood.com/Replacing-setTimeout-Globally.html
    // JSLint being anal
    var glbl = global;

    global.setTimeout = glbl.setTimeout;
    global.clearTimeout = glbl.clearTimeout;
    global.setInterval = glbl.setInterval;
    global.clearInterval = glbl.clearInterval;
    global.Date = glbl.Date;

    // setImmediate is not a standard function
    // avoid adding the prop to the window object if not present
    if('setImmediate' in global) {
        global.setImmediate = glbl.setImmediate;
        global.clearImmediate = glbl.clearImmediate;
    }

    // node expects setTimeout/setInterval to return a fn object w/ .ref()/.unref()
    // browsers, a number.
    // see https://github.com/cjohansen/Sinon.JS/pull/436

    var NOOP = function () { return undefined; };
    var timeoutResult = setTimeout(NOOP, 0);
    var addTimerReturnsObject = typeof timeoutResult === "object";
    clearTimeout(timeoutResult);

    var NativeDate = Date;
    var uniqueTimerId = 1;

    /**
     * Parse strings like "01:10:00" (meaning 1 hour, 10 minutes, 0 seconds) into
     * number of milliseconds. This is used to support human-readable strings passed
     * to clock.tick()
     */
    function parseTime(str) {
        if (!str) {
            return 0;
        }

        var strings = str.split(":");
        var l = strings.length, i = l;
        var ms = 0, parsed;

        if (l > 3 || !/^(\d\d:){0,2}\d\d?$/.test(str)) {
            throw new Error("tick only understands numbers and 'h:m:s'");
        }

        while (i--) {
            parsed = parseInt(strings[i], 10);

            if (parsed >= 60) {
                throw new Error("Invalid time " + str);
            }

            ms += parsed * Math.pow(60, (l - i - 1));
        }

        return ms * 1000;
    }

    /**
     * Used to grok the `now` parameter to createClock.
     */
    function getEpoch(epoch) {
        if (!epoch) { return 0; }
        if (typeof epoch.getTime === "function") { return epoch.getTime(); }
        if (typeof epoch === "number") { return epoch; }
        throw new TypeError("now should be milliseconds since UNIX epoch");
    }

    function inRange(from, to, timer) {
        return timer && timer.callAt >= from && timer.callAt <= to;
    }

    function mirrorDateProperties(target, source) {
        var prop;
        for (prop in source) {
            if (source.hasOwnProperty(prop)) {
                target[prop] = source[prop];
            }
        }

        // set special now implementation
        if (source.now) {
            target.now = function now() {
                return target.clock.now;
            };
        } else {
            delete target.now;
        }

        // set special toSource implementation
        if (source.toSource) {
            target.toSource = function toSource() {
                return source.toSource();
            };
        } else {
            delete target.toSource;
        }

        // set special toString implementation
        target.toString = function toString() {
            return source.toString();
        };

        target.prototype = source.prototype;
        target.parse = source.parse;
        target.UTC = source.UTC;
        target.prototype.toUTCString = source.prototype.toUTCString;

        return target;
    }

    function createDate() {
        function ClockDate(year, month, date, hour, minute, second, ms) {
            // Defensive and verbose to avoid potential harm in passing
            // explicit undefined when user does not pass argument
            switch (arguments.length) {
            case 0:
                return new NativeDate(ClockDate.clock.now);
            case 1:
                return new NativeDate(year);
            case 2:
                return new NativeDate(year, month);
            case 3:
                return new NativeDate(year, month, date);
            case 4:
                return new NativeDate(year, month, date, hour);
            case 5:
                return new NativeDate(year, month, date, hour, minute);
            case 6:
                return new NativeDate(year, month, date, hour, minute, second);
            default:
                return new NativeDate(year, month, date, hour, minute, second, ms);
            }
        }

        return mirrorDateProperties(ClockDate, NativeDate);
    }

    function addTimer(clock, timer) {
        if (timer.func === undefined) {
            throw new Error("Callback must be provided to timer calls");
        }

        if (!clock.timers) {
            clock.timers = {};
        }

        timer.id = uniqueTimerId++;
        timer.createdAt = clock.now;
        timer.callAt = clock.now + (timer.delay || (clock.duringTick ? 1 : 0));

        clock.timers[timer.id] = timer;

        if (addTimerReturnsObject) {
            return {
                id: timer.id,
                ref: NOOP,
                unref: NOOP
            };
        }

        return timer.id;
    }


    function compareTimers(a, b) {
        // Sort first by absolute timing
        if (a.callAt < b.callAt) {
            return -1;
        }
        if (a.callAt > b.callAt) {
            return 1;
        }

        // Sort next by immediate, immediate timers take precedence
        if (a.immediate && !b.immediate) {
            return -1;
        }
        if (!a.immediate && b.immediate) {
            return 1;
        }

        // Sort next by creation time, earlier-created timers take precedence
        if (a.createdAt < b.createdAt) {
            return -1;
        }
        if (a.createdAt > b.createdAt) {
            return 1;
        }

        // Sort next by id, lower-id timers take precedence
        if (a.id < b.id) {
            return -1;
        }
        if (a.id > b.id) {
            return 1;
        }

        // As timer ids are unique, no fallback `0` is necessary
    }

    function firstTimerInRange(clock, from, to) {
        var timers = clock.timers,
            timer = null,
            id,
            isInRange;

        for (id in timers) {
            if (timers.hasOwnProperty(id)) {
                isInRange = inRange(from, to, timers[id]);

                if (isInRange && (!timer || compareTimers(timer, timers[id]) === 1)) {
                    timer = timers[id];
                }
            }
        }

        return timer;
    }

    function callTimer(clock, timer) {
        var exception;

        if (typeof timer.interval === "number") {
            clock.timers[timer.id].callAt += timer.interval;
        } else {
            delete clock.timers[timer.id];
        }

        try {
            if (typeof timer.func === "function") {
                timer.func.apply(null, timer.args);
            } else {
                eval(timer.func);
            }
        } catch (e) {
            exception = e;
        }

        if (!clock.timers[timer.id]) {
            if (exception) {
                throw exception;
            }
            return;
        }

        if (exception) {
            throw exception;
        }
    }

    function timerType(timer) {
        if (timer.immediate) {
            return "Immediate";
        } else if (typeof timer.interval !== "undefined") {
            return "Interval";
        } else {
            return "Timeout";
        }
    }

    function clearTimer(clock, timerId, ttype) {
        if (!timerId) {
            // null appears to be allowed in most browsers, and appears to be
            // relied upon by some libraries, like Bootstrap carousel
            return;
        }

        if (!clock.timers) {
            clock.timers = [];
        }

        // in Node, timerId is an object with .ref()/.unref(), and
        // its .id field is the actual timer id.
        if (typeof timerId === "object") {
            timerId = timerId.id;
        }

        if (clock.timers.hasOwnProperty(timerId)) {
            // check that the ID matches a timer of the correct type
            var timer = clock.timers[timerId];
            if (timerType(timer) === ttype) {
                delete clock.timers[timerId];
            } else {
				throw new Error("Cannot clear timer: timer created with set" + ttype + "() but cleared with clear" + timerType(timer) + "()");
			}
        }
    }

    function uninstall(clock, target) {
        var method,
            i,
            l;

        for (i = 0, l = clock.methods.length; i < l; i++) {
            method = clock.methods[i];

            if (target[method].hadOwnProperty) {
                target[method] = clock["_" + method];
            } else {
                try {
                    delete target[method];
                } catch (ignore) {}
            }
        }

        // Prevent multiple executions which will completely remove these props
        clock.methods = [];
    }

    function hijackMethod(target, method, clock) {
        var prop;

        clock[method].hadOwnProperty = Object.prototype.hasOwnProperty.call(target, method);
        clock["_" + method] = target[method];

        if (method === "Date") {
            var date = mirrorDateProperties(clock[method], target[method]);
            target[method] = date;
        } else {
            target[method] = function () {
                return clock[method].apply(clock, arguments);
            };

            for (prop in clock[method]) {
                if (clock[method].hasOwnProperty(prop)) {
                    target[method][prop] = clock[method][prop];
                }
            }
        }

        target[method].clock = clock;
    }

    var timers = {
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setImmediate: global.setImmediate,
        clearImmediate: global.clearImmediate,
        setInterval: setInterval,
        clearInterval: clearInterval,
        Date: Date
    };

    var keys = Object.keys || function (obj) {
        var ks = [],
            key;

        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                ks.push(key);
            }
        }

        return ks;
    };

    exports.timers = timers;

    function createClock(now) {
        var clock = {
            now: getEpoch(now),
            timeouts: {},
            Date: createDate()
        };

        clock.Date.clock = clock;

        clock.setTimeout = function setTimeout(func, timeout) {
            return addTimer(clock, {
                func: func,
                args: Array.prototype.slice.call(arguments, 2),
                delay: timeout
            });
        };

        clock.clearTimeout = function clearTimeout(timerId) {
            return clearTimer(clock, timerId, "Timeout");
        };

        clock.setInterval = function setInterval(func, timeout) {
            return addTimer(clock, {
                func: func,
                args: Array.prototype.slice.call(arguments, 2),
                delay: timeout,
                interval: timeout
            });
        };

        clock.clearInterval = function clearInterval(timerId) {
            return clearTimer(clock, timerId, "Interval");
        };

        clock.setImmediate = function setImmediate(func) {
            return addTimer(clock, {
                func: func,
                args: Array.prototype.slice.call(arguments, 1),
                immediate: true
            });
        };

        clock.clearImmediate = function clearImmediate(timerId) {
            return clearTimer(clock, timerId, "Immediate");
        };

        clock.tick = function tick(ms) {
            ms = typeof ms === "number" ? ms : parseTime(ms);
            var tickFrom = clock.now, tickTo = clock.now + ms, previous = clock.now;
            var timer = firstTimerInRange(clock, tickFrom, tickTo);
            var oldNow;

            clock.duringTick = true;

            var firstException;
            while (timer && tickFrom <= tickTo) {
                if (clock.timers[timer.id]) {
                    tickFrom = clock.now = timer.callAt;
                    try {
                        oldNow = clock.now;
                        callTimer(clock, timer);
                        // compensate for any setSystemTime() call during timer callback
                        if (oldNow !== clock.now) {
                            tickFrom += clock.now - oldNow;
                            tickTo += clock.now - oldNow;
                            previous += clock.now - oldNow;
                        }
                    } catch (e) {
                        firstException = firstException || e;
                    }
                }

                timer = firstTimerInRange(clock, previous, tickTo);
                previous = tickFrom;
            }

            clock.duringTick = false;
            clock.now = tickTo;

            if (firstException) {
                throw firstException;
            }

            return clock.now;
        };

        clock.reset = function reset() {
            clock.timers = {};
        };

        clock.setSystemTime = function setSystemTime(now) {
            // determine time difference
            var newNow = getEpoch(now);
            var difference = newNow - clock.now;

            // update 'system clock'
            clock.now = newNow;

            // update timers and intervals to keep them stable
            for (var id in clock.timers) {
                if (clock.timers.hasOwnProperty(id)) {
                    var timer = clock.timers[id];
                    timer.createdAt += difference;
                    timer.callAt += difference;
                }
            }
        };

        return clock;
    }
    exports.createClock = createClock;

    exports.install = function install(target, now, toFake) {
        var i,
            l;

        if (typeof target === "number") {
            toFake = now;
            now = target;
            target = null;
        }

        if (!target) {
            target = global;
        }

        var clock = createClock(now);

        clock.uninstall = function () {
            uninstall(clock, target);
        };

        clock.methods = toFake || [];

        if (clock.methods.length === 0) {
            clock.methods = keys(timers);
        }

        for (i = 0, l = clock.methods.length; i < l; i++) {
            hijackMethod(target, clock.methods[i], clock);
        }

        return clock;
    };

}(global || this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],36:[function(require,module,exports){
((typeof define === "function" && define.amd && function (m) { define("samsam", m); }) ||
 (typeof module === "object" &&
      function (m) { module.exports = m(); }) || // Node
 function (m) { this.samsam = m(); } // Browser globals
)(function () {
    var o = Object.prototype;
    var div = typeof document !== "undefined" && document.createElement("div");

    function isNaN(value) {
        // Unlike global isNaN, this avoids type coercion
        // typeof check avoids IE host object issues, hat tip to
        // lodash
        var val = value; // JsLint thinks value !== value is "weird"
        return typeof value === "number" && value !== val;
    }

    function getClass(value) {
        // Returns the internal [[Class]] by calling Object.prototype.toString
        // with the provided value as this. Return value is a string, naming the
        // internal class, e.g. "Array"
        return o.toString.call(value).split(/[ \]]/)[1];
    }

    /**
     * @name samsam.isArguments
     * @param Object object
     *
     * Returns ``true`` if ``object`` is an ``arguments`` object,
     * ``false`` otherwise.
     */
    function isArguments(object) {
        if (getClass(object) === 'Arguments') { return true; }
        if (typeof object !== "object" || typeof object.length !== "number" ||
                getClass(object) === "Array") {
            return false;
        }
        if (typeof object.callee == "function") { return true; }
        try {
            object[object.length] = 6;
            delete object[object.length];
        } catch (e) {
            return true;
        }
        return false;
    }

    /**
     * @name samsam.isElement
     * @param Object object
     *
     * Returns ``true`` if ``object`` is a DOM element node. Unlike
     * Underscore.js/lodash, this function will return ``false`` if ``object``
     * is an *element-like* object, i.e. a regular object with a ``nodeType``
     * property that holds the value ``1``.
     */
    function isElement(object) {
        if (!object || object.nodeType !== 1 || !div) { return false; }
        try {
            object.appendChild(div);
            object.removeChild(div);
        } catch (e) {
            return false;
        }
        return true;
    }

    /**
     * @name samsam.keys
     * @param Object object
     *
     * Return an array of own property names.
     */
    function keys(object) {
        var ks = [], prop;
        for (prop in object) {
            if (o.hasOwnProperty.call(object, prop)) { ks.push(prop); }
        }
        return ks;
    }

    /**
     * @name samsam.isDate
     * @param Object value
     *
     * Returns true if the object is a ``Date``, or *date-like*. Duck typing
     * of date objects work by checking that the object has a ``getTime``
     * function whose return value equals the return value from the object's
     * ``valueOf``.
     */
    function isDate(value) {
        return typeof value.getTime == "function" &&
            value.getTime() == value.valueOf();
    }

    /**
     * @name samsam.isNegZero
     * @param Object value
     *
     * Returns ``true`` if ``value`` is ``-0``.
     */
    function isNegZero(value) {
        return value === 0 && 1 / value === -Infinity;
    }

    /**
     * @name samsam.equal
     * @param Object obj1
     * @param Object obj2
     *
     * Returns ``true`` if two objects are strictly equal. Compared to
     * ``===`` there are two exceptions:
     *
     *   - NaN is considered equal to NaN
     *   - -0 and +0 are not considered equal
     */
    function identical(obj1, obj2) {
        if (obj1 === obj2 || (isNaN(obj1) && isNaN(obj2))) {
            return obj1 !== 0 || isNegZero(obj1) === isNegZero(obj2);
        }
    }


    /**
     * @name samsam.deepEqual
     * @param Object obj1
     * @param Object obj2
     *
     * Deep equal comparison. Two values are "deep equal" if:
     *
     *   - They are equal, according to samsam.identical
     *   - They are both date objects representing the same time
     *   - They are both arrays containing elements that are all deepEqual
     *   - They are objects with the same set of properties, and each property
     *     in ``obj1`` is deepEqual to the corresponding property in ``obj2``
     *
     * Supports cyclic objects.
     */
    function deepEqualCyclic(obj1, obj2) {

        // used for cyclic comparison
        // contain already visited objects
        var objects1 = [],
            objects2 = [],
        // contain pathes (position in the object structure)
        // of the already visited objects
        // indexes same as in objects arrays
            paths1 = [],
            paths2 = [],
        // contains combinations of already compared objects
        // in the manner: { "$1['ref']$2['ref']": true }
            compared = {};

        /**
         * used to check, if the value of a property is an object
         * (cyclic logic is only needed for objects)
         * only needed for cyclic logic
         */
        function isObject(value) {

            if (typeof value === 'object' && value !== null &&
                    !(value instanceof Boolean) &&
                    !(value instanceof Date)    &&
                    !(value instanceof Number)  &&
                    !(value instanceof RegExp)  &&
                    !(value instanceof String)) {

                return true;
            }

            return false;
        }

        /**
         * returns the index of the given object in the
         * given objects array, -1 if not contained
         * only needed for cyclic logic
         */
        function getIndex(objects, obj) {

            var i;
            for (i = 0; i < objects.length; i++) {
                if (objects[i] === obj) {
                    return i;
                }
            }

            return -1;
        }

        // does the recursion for the deep equal check
        return (function deepEqual(obj1, obj2, path1, path2) {
            var type1 = typeof obj1;
            var type2 = typeof obj2;

            // == null also matches undefined
            if (obj1 === obj2 ||
                    isNaN(obj1) || isNaN(obj2) ||
                    obj1 == null || obj2 == null ||
                    type1 !== "object" || type2 !== "object") {

                return identical(obj1, obj2);
            }

            // Elements are only equal if identical(expected, actual)
            if (isElement(obj1) || isElement(obj2)) { return false; }

            var isDate1 = isDate(obj1), isDate2 = isDate(obj2);
            if (isDate1 || isDate2) {
                if (!isDate1 || !isDate2 || obj1.getTime() !== obj2.getTime()) {
                    return false;
                }
            }

            if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
                if (obj1.toString() !== obj2.toString()) { return false; }
            }

            var class1 = getClass(obj1);
            var class2 = getClass(obj2);
            var keys1 = keys(obj1);
            var keys2 = keys(obj2);

            if (isArguments(obj1) || isArguments(obj2)) {
                if (obj1.length !== obj2.length) { return false; }
            } else {
                if (type1 !== type2 || class1 !== class2 ||
                        keys1.length !== keys2.length) {
                    return false;
                }
            }

            var key, i, l,
                // following vars are used for the cyclic logic
                value1, value2,
                isObject1, isObject2,
                index1, index2,
                newPath1, newPath2;

            for (i = 0, l = keys1.length; i < l; i++) {
                key = keys1[i];
                if (!o.hasOwnProperty.call(obj2, key)) {
                    return false;
                }

                // Start of the cyclic logic

                value1 = obj1[key];
                value2 = obj2[key];

                isObject1 = isObject(value1);
                isObject2 = isObject(value2);

                // determine, if the objects were already visited
                // (it's faster to check for isObject first, than to
                // get -1 from getIndex for non objects)
                index1 = isObject1 ? getIndex(objects1, value1) : -1;
                index2 = isObject2 ? getIndex(objects2, value2) : -1;

                // determine the new pathes of the objects
                // - for non cyclic objects the current path will be extended
                //   by current property name
                // - for cyclic objects the stored path is taken
                newPath1 = index1 !== -1
                    ? paths1[index1]
                    : path1 + '[' + JSON.stringify(key) + ']';
                newPath2 = index2 !== -1
                    ? paths2[index2]
                    : path2 + '[' + JSON.stringify(key) + ']';

                // stop recursion if current objects are already compared
                if (compared[newPath1 + newPath2]) {
                    return true;
                }

                // remember the current objects and their pathes
                if (index1 === -1 && isObject1) {
                    objects1.push(value1);
                    paths1.push(newPath1);
                }
                if (index2 === -1 && isObject2) {
                    objects2.push(value2);
                    paths2.push(newPath2);
                }

                // remember that the current objects are already compared
                if (isObject1 && isObject2) {
                    compared[newPath1 + newPath2] = true;
                }

                // End of cyclic logic

                // neither value1 nor value2 is a cycle
                // continue with next level
                if (!deepEqual(value1, value2, newPath1, newPath2)) {
                    return false;
                }
            }

            return true;

        }(obj1, obj2, '$1', '$2'));
    }

    var match;

    function arrayContains(array, subset) {
        if (subset.length === 0) { return true; }
        var i, l, j, k;
        for (i = 0, l = array.length; i < l; ++i) {
            if (match(array[i], subset[0])) {
                for (j = 0, k = subset.length; j < k; ++j) {
                    if (!match(array[i + j], subset[j])) { return false; }
                }
                return true;
            }
        }
        return false;
    }

    /**
     * @name samsam.match
     * @param Object object
     * @param Object matcher
     *
     * Compare arbitrary value ``object`` with matcher.
     */
    match = function match(object, matcher) {
        if (matcher && typeof matcher.test === "function") {
            return matcher.test(object);
        }

        if (typeof matcher === "function") {
            return matcher(object) === true;
        }

        if (typeof matcher === "string") {
            matcher = matcher.toLowerCase();
            var notNull = typeof object === "string" || !!object;
            return notNull &&
                (String(object)).toLowerCase().indexOf(matcher) >= 0;
        }

        if (typeof matcher === "number") {
            return matcher === object;
        }

        if (typeof matcher === "boolean") {
            return matcher === object;
        }

        if (typeof(matcher) === "undefined") {
            return typeof(object) === "undefined";
        }

        if (matcher === null) {
            return object === null;
        }

        if (getClass(object) === "Array" && getClass(matcher) === "Array") {
            return arrayContains(object, matcher);
        }

        if (matcher && typeof matcher === "object") {
            if (matcher === object) {
                return true;
            }
            var prop;
            for (prop in matcher) {
                var value = object[prop];
                if (typeof value === "undefined" &&
                        typeof object.getAttribute === "function") {
                    value = object.getAttribute(prop);
                }
                if (matcher[prop] === null || typeof matcher[prop] === 'undefined') {
                    if (value !== matcher[prop]) {
                        return false;
                    }
                } else if (typeof  value === "undefined" || !match(value, matcher[prop])) {
                    return false;
                }
            }
            return true;
        }

        throw new Error("Matcher was not a string, a number, a " +
                        "function, a boolean or an object");
    };

    return {
        isArguments: isArguments,
        isElement: isElement,
        isDate: isDate,
        isNegZero: isNegZero,
        identical: identical,
        deepEqual: deepEqualCyclic,
        match: match,
        keys: keys
    };
});

},{}],37:[function(require,module,exports){
'use strict';

var sonne = require('../lib/main');
var sinon = require('sinon');

var maybeID = sonne.make(sonne.data.maybe, sonne.data.id);
var IDMaybe = sonne.make(sonne.data.id, sonne.data.maybe);
var maybeStacks = [IDMaybe, maybeID];

var maybeList = sonne.make(sonne.data.maybe, sonne.data.list);
var listMaybe = sonne.make(sonne.data.list, sonne.data.maybe);
var listStacks = [maybeList, listMaybe];

var monads = maybeStacks;

module.exports = {
  Maybe: function Maybe(test) {
    maybeStacks.forEach(function (maybe) {

      var spy = sinon.spy(function (a) {
        return a;
      });
      maybe.of(4).map(function (val) {
        return val + 1;
      }).chainMaybe(function (val) {
        test.equals(val, 5, 'A call to "map" modifies the value, and packs it again');
        return { maybeVal: undefined };
      }).map(spy);
      test.equals(spy.called, false, "After a val is set to undefined, functions are no longer called");

      spy = sinon.spy(function (a) {
        return a;
      });
      maybe.of({ foo: { baz: "bar" } }).get("foo").get("baz").map(spy);
      test.equals(spy.lastCall.returnValue, 'bar');

      spy = sinon.spy(function (a) {
        return a;
      });
      maybe.of({ foo: "bar" }).get("bar").map(spy);
      test.equals(spy.called, false, 'When you get an undefined value, maybe is not called ');
    });
    test.done();
  },
  chain: function chain(test) {
    var val = 5;
    monads.forEach(function (monad) {
      var spy = sinon.spy(function (a) {
        return a;
      });
      monad.of(val).chain(function (val) {
        return monad.of(val);
      }).map(spy);
      test.equals(spy.firstCall.returnValue, val, "Unpacking a monad and packing it again yeilds the same structure");
      test.throws(function () {
        return monad.of(4).chain(function (val) {
          return monad.of(val)._value;
        });
      }, "The chain method expects a wrapped value");
    });
    test.done();
  },
  /*List (test){
    maybeID
    listMaybe
    test.deepEqual(maybeList.of([1,2,3]).map((a)=>(a+1)), maybeList.of([2,3,4]), "foo")
    debugger
    listStacks.forEach((list) =>{
      list.of([1,2,3])
    })
    test.done()
  },*/
  test: function test(_test) {
    debugger;
    _test.done();
  }

};

},{"../lib/main":3,"sinon":9}],38:[function(require,module,exports){
(function (global){
"use strict";

exports.basic = require("./basic");
if (global.v8debug) {
  global.v8debug.Debug.setBreakOnException();
}
global.tests = module.exports;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./basic":37}]},{},[38])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2NvbXAuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2RhdGEuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24uanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2Fzc2VydC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vYmVoYXZpb3IuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2NhbGwuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2NvbGxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2V4dGVuZC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vZm9ybWF0LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9sb2dfZXJyb3IuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL21hdGNoLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9tb2NrLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9zYW5kYm94LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9zcHkuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3N0dWIuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3Rlc3QuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3Rlc3RfY2FzZS5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vdGltZXNfaW5fd29yZHMuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3R5cGVPZi5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vdXRpbC9jb3JlLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi91dGlsL2V2ZW50LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi91dGlsL2Zha2Vfc2VydmVyLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi91dGlsL2Zha2Vfc2VydmVyX3dpdGhfY2xvY2suanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3V0aWwvZmFrZV90aW1lcnMuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3V0aWwvZmFrZV94ZG9tYWluX3JlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3V0aWwvZmFrZV94bWxfaHR0cF9yZXF1ZXN0LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi93YWxrLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL25vZGVfbW9kdWxlcy9mb3JtYXRpby9saWIvZm9ybWF0aW8uanMiLCJub2RlX21vZHVsZXMvc2lub24vbm9kZV9tb2R1bGVzL2xvbGV4L3NyYy9sb2xleC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9ub2RlX21vZHVsZXMvc2Ftc2FtL2xpYi9zYW1zYW0uanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvdGVzdC9iYXNpYy5qcyIsImM6L2dpdC1wcm9qZWN0cy9zb25uZS90ZXN0L3Rlc3RzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLENBQUMsT0FBTyxHQUFHO0FBQ2hCLE1BQUksRUFBRSxTQUFTO0FBQ2YsSUFBRSxFQUFFLFlBQVUsR0FBRyxFQUFFO0FBQUMsV0FBTyxVQUFVLE9BQU8sRUFBRTtBQUFFLGFBQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0tBQUMsQ0FBQTtHQUFFO0FBQ3RFLEtBQUcsRUFBRSxhQUFVLElBQUksRUFBRSxHQUFHLEVBQUU7QUFDeEIsV0FBTyxVQUFVLE9BQU8sRUFBRTtBQUN4QixTQUFHLENBQUMsVUFBVSxLQUFLLEVBQUU7QUFDbkIsZUFBTyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7T0FDNUIsQ0FBQyxDQUFBO0tBQ0gsQ0FBQTtHQUNGOztBQUVELE1BQUksRUFBRSxjQUFVLEdBQUcsRUFBRSxVQUFVLEVBQUU7QUFDL0IsV0FBTyxVQUFVLE9BQU8sRUFBRTtBQUN4QixTQUFHLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFDZixrQkFBVSxDQUFDLEdBQUcsQ0FBQyxVQUFVLFlBQVksRUFBRTtBQUNyQyxzQkFBWSxDQUFDLFVBQVUsS0FBSyxFQUFFO0FBQzVCLG1CQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxZQUFZO0FBQUMscUJBQU8sS0FBSyxDQUFBO2FBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO1dBQ3ZELENBQUMsQ0FBQTtTQUNILEVBQUUsQ0FBQyxDQUFDLENBQUE7T0FFTixDQUFDLENBQUE7S0FDSCxDQUFBO0dBQ0Y7Q0FDRixDQUFBOzs7OztBQ3ZCRCxPQUFPLENBQUMsRUFBRSxHQUFHO0FBQ1gsTUFBSSxFQUFFLElBQUk7QUFDVixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7QUFBRSxXQUFPLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFBO0dBQUU7QUFDakMsT0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUNoQixXQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxPQUFPLEVBQUU7QUFDbEMsYUFBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFBO0tBQzNCLENBQUMsQ0FBQTtHQUNIO0FBQ0QsTUFBSSxFQUFDLGNBQUMsR0FBRyxFQUFFO0FBQ1QsV0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsVUFBVSxFQUFFO0FBQUMsYUFBTyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUMsS0FBSyxFQUFFLFVBQVUsRUFBQyxDQUFDLENBQUE7S0FBQyxDQUFDLENBQUE7R0FDN0U7Q0FDRixDQUFBOztBQUVELE9BQU8sQ0FBQyxLQUFLLEdBQUc7QUFDZCxNQUFJLEVBQUUsT0FBTztBQUNiLElBQUUsRUFBQyxZQUFDLEdBQUcsRUFBRTtBQUFFLFdBQU8sRUFBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLENBQUE7R0FBRTtBQUNwQyxPQUFLLEVBQUMsZUFBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQ2hCLFdBQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLFVBQVUsRUFBRTtBQUNyQyxhQUFPLFVBQVUsQ0FBQyxRQUFRLEtBQUssU0FBUyxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFBO0tBQ2xGLENBQUMsQ0FBQTtHQUNIO0FBQ0QsTUFBSSxFQUFDLGNBQUMsR0FBRyxFQUFFO0FBQ1QsV0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsVUFBVSxFQUFFO0FBQUMsYUFBTyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUMsUUFBUSxFQUFFLFVBQVUsRUFBQyxDQUFDLENBQUE7S0FBQyxDQUFDLENBQUE7R0FDaEY7QUFDRCxTQUFPLEVBQUMsbUJBQUc7QUFBRSxXQUFPLEVBQUMsVUFBVSxFQUFFLFNBQVMsRUFBQyxDQUFBO0dBQUM7QUFDNUMsS0FBRyxFQUFDLGFBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUFFLFdBQU8sRUFBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUE7R0FBQztDQUM5QyxDQUFBO0FBQ0QsT0FBTyxDQUFDLElBQUksR0FBRztBQUNiLE1BQUksRUFBRSxNQUFNO0FBQ1osSUFBRSxFQUFDLFlBQUMsR0FBRyxFQUFFO0FBQ1AsV0FBTyxHQUFHLENBQUMsV0FBVyxLQUFLLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtHQUMvQztBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBRSxHQUFHLEVBQUU7QUFDaEIsV0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsU0FBUyxFQUFFO0FBQ3BDLFNBQUcsQ0FBQTtBQUNILGVBQVE7QUFDUixhQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBQyxJQUFJLEVBQUUsR0FBRztlQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO09BQUEsRUFBRSxFQUFFLENBQUMsQ0FBQTtLQUNuRSxDQUFDLENBQUE7R0FDSDtBQUNELE1BQUksRUFBQyxjQUFDLEdBQUcsRUFBRTtBQUNULFdBQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLFVBQVUsRUFBRTtBQUNyQyxlQUFRO0FBQ1IsYUFBTyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQTtLQUM1QixDQUFDLENBQUE7R0FDSDtDQUNGLENBQUE7Ozs7O0FDN0NELE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2hDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2hDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBOztBQUVoQyxJQUFNLE9BQU8sR0FBRzs7OztBQUlkLElBQUUsRUFBQyxZQUFDLEdBQUcsRUFBRTtBQUNQLFdBQU8sR0FBRyxDQUFBO0dBQ1g7Ozs7QUFJRCxPQUFLLEVBQUMsZUFBQyxJQUFJLEVBQUU7QUFDWCxXQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7R0FDekI7Q0FDRixDQUFBOzs7QUFHRCxJQUFNLE1BQU0sR0FBRyxTQUFULE1BQU0sQ0FBSSxHQUFHLEVBQUs7QUFDdEIsTUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUU7QUFBQyxVQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcseUJBQXlCLENBQUE7R0FBQztBQUMxRixTQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUE7Q0FDbEIsQ0FBQTs7O0FBR0QsSUFBTSxNQUFNLEdBQUcsU0FBVCxNQUFNLENBQUksS0FBSyxFQUFFLEdBQUcsRUFBSztBQUM3QixNQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzlCLEtBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFBO0FBQ2hCLFNBQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQTtDQUMxQixDQUFBOztBQUVELE9BQU8sQ0FBQyxJQUFJLEdBQUcsU0FBUyxVQUFVLENBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTs7QUFFaEQsV0FBUyxNQUFNLENBQUUsR0FBRyxFQUFFO0FBQ3BCLFdBQU8sTUFBTSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQTtHQUMvQjs7O0FBR0QsTUFBTSxVQUFVLEdBQUc7QUFDakIsTUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFOzs7OztBQUtaLFNBQUssRUFBQyxlQUFDLElBQUksRUFBRTtBQUNYLGFBQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQTtLQUN2RDtHQUNGLENBQUE7OztBQUdELE1BQU0sVUFBVSxHQUFHO0FBQ2pCLGFBQVMsRUFBRSxVQUFVOzs7QUFHckIsU0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFO0FBQ1gsVUFBTSxhQUFhLEdBQUcsU0FBaEIsYUFBYSxDQUFJLEdBQUc7ZUFBSyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO09BQUEsQ0FBQTtBQUNoRCxhQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7S0FDM0U7OztBQUdELE1BQUUsRUFBQyxZQUFDLEtBQUssRUFBRTtBQUNULGFBQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7S0FDekM7QUFDRCxPQUFHLEVBQUMsYUFBQyxJQUFJLEVBQUU7OztBQUNULGFBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUc7ZUFBSyxNQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7T0FBQSxDQUFDLENBQUE7S0FDL0M7R0FDRixDQUFBOzs7QUFHRCxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFDLEdBQUc7V0FBSyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7R0FBQSxDQUFBO0FBQzNHLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQUMsR0FBRztXQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0dBQUEsQ0FBQTs7O0FBR3JGLFlBQVUsQ0FBRyxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQVUsSUFBSSxFQUFFO0FBQ3BELFdBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUc7YUFBSyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQUEsQ0FBQyxDQUFBO0dBQ2pELENBQUE7QUFDRCxZQUFVLENBQUcsT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLElBQUksRUFBRTtBQUNwRCxXQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBQyxHQUFHO2FBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUFBLENBQUMsQ0FBQTtHQUNqRCxDQUFBOzs7QUFHRCxNQUFNLE1BQU0sR0FBRyxTQUFULE1BQU0sQ0FBSSxLQUFLLEVBQUs7QUFDeEIsVUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FDZixNQUFNLENBQUMsVUFBQyxHQUFHO2FBQU0sR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEtBQUssT0FBTyxJQUFJLEdBQUcsS0FBSyxNQUFNO0tBQUMsQ0FBQyxDQUNwRSxPQUFPLENBQUMsVUFBQyxHQUFHLEVBQUs7QUFDaEIsZ0JBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxZQUFZO0FBQzVCLFlBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQTs7QUFFbEQsZUFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsR0FBRyxFQUFLO0FBQ3pCLGNBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDZCxpQkFBTyxVQUFVLENBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO1NBQ3ZFLENBQUMsQ0FBQTtPQUNILENBQUE7S0FDRixDQUFDLENBQUE7R0FDTCxDQUFBO0FBQ0QsUUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQ2IsUUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBOztBQUViLFlBQVUsQ0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsS0FBSyxDQUFBO0FBQ2pDLFlBQVUsQ0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsS0FBSyxDQUFBOzs7QUFHakMsUUFBTSxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFBO0FBQ3pCLFFBQU0sQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQVUsQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxDQUFBO0FBQ25FLFFBQU0sQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQVUsQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxDQUFBOzs7QUFHbkUsU0FBTyxNQUFNLENBQUE7Q0FDZCxDQUFBOzs7QUM3R0Q7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQy9OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1c0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDL1lBLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQTtBQUNsQyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7O0FBRTVCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUN6RCxJQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDM0QsSUFBSSxXQUFXLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUE7O0FBRXBDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM3RCxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDN0QsSUFBSSxVQUFVLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUE7O0FBRXZDLElBQUksTUFBTSxHQUFHLFdBQVcsQ0FBQTs7QUFFeEIsTUFBTSxDQUFDLE9BQU8sR0FBRztBQUNiLE9BQUssRUFBQyxlQUFDLElBQUksRUFBRTtBQUNYLGVBQVcsQ0FBQyxPQUFPLENBQUMsVUFBQyxLQUFLLEVBQUk7O0FBRTVCLFVBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFDO2VBQUssQ0FBQztPQUFBLENBQUMsQ0FBQTtBQUM3QixXQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUNSLEdBQUcsQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUFDLGVBQU8sR0FBRyxHQUFHLENBQUMsQ0FBQTtPQUFDLENBQUMsQ0FDcEMsVUFBVSxDQUFDLFVBQUMsR0FBRyxFQUFJO0FBQ2xCLFlBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSx3REFBd0QsQ0FBQyxDQUFBO0FBQzdFLGVBQU8sRUFBQyxRQUFRLEVBQUMsU0FBUyxFQUFDLENBQUE7T0FDNUIsQ0FBQyxDQUNILEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNULFVBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsaUVBQWlFLENBQUMsQ0FBQTs7QUFFakcsU0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFDO2VBQUssQ0FBQztPQUFBLENBQUMsQ0FBQTtBQUN6QixXQUFLLENBQUMsRUFBRSxDQUFDLEVBQUMsR0FBRyxFQUFDLEVBQUMsR0FBRyxFQUFDLEtBQUssRUFBQyxFQUFDLENBQUMsQ0FDeEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUNWLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FDVixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDWCxVQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFBOztBQUU1QyxTQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQUM7ZUFBSyxDQUFDO09BQUEsQ0FBQyxDQUFBO0FBQ3pCLFdBQUssQ0FBQyxFQUFFLENBQUMsRUFBQyxHQUFHLEVBQUMsS0FBSyxFQUFDLENBQUMsQ0FDbEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUNWLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNYLFVBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsdURBQXVELENBQUMsQ0FBQTtLQUN4RixDQUFDLENBQUE7QUFDRixRQUFJLENBQUMsSUFBSSxFQUFFLENBQUE7R0FDWjtBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBQztBQUNWLFFBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUNiLFVBQU0sQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLLEVBQUk7QUFDdEIsVUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQUM7ZUFBSyxDQUFDO09BQUEsQ0FBQyxDQUFBO0FBQzdCLFdBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQ1YsS0FBSyxDQUFDLFVBQUMsR0FBRztlQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDO09BQUEsQ0FBQyxDQUM1QixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDWCxVQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxrRUFBa0UsQ0FBQyxDQUFBO0FBQy9HLFVBQUksQ0FBQyxNQUFNLENBQUM7ZUFBSyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUc7aUJBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNO1NBQUEsQ0FBRTtPQUFDLEVBQUUsMENBQTBDLENBQUMsQ0FBQTtLQUMvRyxDQUFDLENBQUE7QUFDRixRQUFJLENBQUMsSUFBSSxFQUFFLENBQUE7R0FDWjs7Ozs7Ozs7Ozs7QUFXRCxNQUFJLEVBQUMsY0FBQyxLQUFJLEVBQUM7QUFDVCxhQUFRO0FBQ1IsU0FBSSxDQUFDLElBQUksRUFBRSxDQUFBO0dBQ1o7O0NBRUYsQ0FBQTs7Ozs7O0FDckVILE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBQ2xDLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRTtBQUNsQixRQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFBO0NBQzNDO0FBQ0QsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydHMucHJvbWlzZSA9IHtcclxuICBuYW1lOiAncHJvbWlzZScsXHJcbiAgb2Y6IGZ1bmN0aW9uICh2YWwpIHtyZXR1cm4gZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUodmFsKX0gfSxcclxuICBtYXA6IGZ1bmN0aW9uIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAocmVzb2x2ZSkge1xyXG4gICAgICB2YWwoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoZnVuayh2YWx1ZSkpXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgZmxhdDogZnVuY3Rpb24gKHZhbCwgaW5uZXJNb25hZCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChyZXNvbHZlKSB7XHJcbiAgICAgIHZhbChmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgIGlubmVyTW9uYWQubWFwKGZ1bmN0aW9uIChpbm5lclByb21pc2UpIHtcclxuICAgICAgICAgIGlubmVyUHJvbWlzZShmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShpbm5lck1vbmFkLm1hcChmdW5jdGlvbiAoKSB7cmV0dXJuIHZhbHVlfSwgaSkpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH0sIGkpXHJcblxyXG4gICAgICB9KVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJRCcsXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4ge2lkVmFsOiB2YWwgfSB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVySWQpIHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVyVmFsdWUpIHtyZXR1cm4gdmFsLm9mKHtpZFZhbDogaW5uZXJWYWx1ZX0pfSlcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydHMubWF5YmUgPSB7XHJcbiAgbmFtZTogJ01heWJlJyxcclxuICBvZiAodmFsKSB7IHJldHVybiB7bWF5YmVWYWw6IHZhbCB9IH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJNYXliZSkge1xyXG4gICAgICByZXR1cm4gaW5uZXJNYXliZS5tYXliZVZhbCA9PT0gdW5kZWZpbmVkID8gaW5uZXJNYXliZSA6IGZ1bmsoaW5uZXJNYXliZS5tYXliZVZhbClcclxuICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVyVmFsdWUpIHtyZXR1cm4gdmFsLm9mKHttYXliZVZhbDogaW5uZXJWYWx1ZX0pfSlcclxuICB9LFxyXG4gIG5vdGhpbmcgKCkgeyByZXR1cm4ge21heWJlVmFsdWU6IHVuZGVmaW5lZH19LFxyXG4gIGdldCAoa2V5LCB2YWwpIHsgcmV0dXJuIHttYXliZVZhbDogdmFsW2tleV19fVxyXG59XHJcbmV4cG9ydHMubGlzdCA9IHtcclxuICBuYW1lOiAnTGlzdCcsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jb25zdHJ1Y3RvciA9PT0gQXJyYXkgPyB2YWwgOiBbdmFsXVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJMaXN0KSB7XHJcbiAgICAgIHZhbFxyXG4gICAgICBkZWJ1Z2dlclxyXG4gICAgICByZXR1cm4gaW5uZXJMaXN0LnJlZHVjZSgobGlzdCwgdmFsKSA9PiBsaXN0LmNvbmNhdChmdW5rKHZhbCkpLCBbXSlcclxuICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVyVmFsdWUpIHtcclxuICAgICAgZGVidWdnZXJcclxuICAgICAgcmV0dXJuIHZhbC5vZihbaW5uZXJWYWx1ZV0pXHJcbiAgICB9KVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLnByaW0gPSByZXF1aXJlKCcuL3ByaW0nKVxyXG5leHBvcnRzLmRhdGEgPSByZXF1aXJlKCcuL2RhdGEnKVxyXG5leHBvcnRzLmNvbXAgPSByZXF1aXJlKCcuL2NvbXAnKVxyXG5cclxuY29uc3QgaWRQcm90byA9IHtcclxuICAvLyBUaGUgJ29mJyBmdW5jdGlvbiB3cmFwcyBhIHZhbHVlIGluIGEgbW9uYWQuXHJcbiAgLy8gSW4gdGhlIGNhc2Ugb2YgdGhlIGlkZW50aXR5IG1vbmFkLCB3ZSBkb24ndCBkbyBhbnl0aGluZywgc28gd2UgZG9uJ3QgcmVhbGx5XHJcbiAgLy8gbmVlZCB0byB3cmFwIGl0LlxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWxcclxuICB9LFxyXG4gIC8vIGlkZW50aXR5IG1vbmFkJ3MgY2hhaW4gaW1wbGVtZW50YXRpb24uXHJcbiAgLy8gU2luY2Ugbm8gcGFja2luZyBhbmQgdW5wYWNraW5nIHRha2VzIHBsYWNlLFxyXG4gIC8vIGFsbCB3ZSBoYXZlIHRvIGRvIGlzIHRvIGFwcGx5IHRoZSBmdW5jdGlvblxyXG4gIGNoYWluIChmdW5rKSB7XHJcbiAgICByZXR1cm4gZnVuayh0aGlzLl92YWx1ZSlcclxuICB9XHJcbn1cclxuXHJcbi8vIFVud3JhcHMgYSB3cmFwcGVkIHZhbHVlXHJcbmNvbnN0IHVud3JhcCA9ICh2YWwpID0+IHtcclxuICBpZiAoIXZhbC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJykpIHt0aHJvdyBKU09OLnN0cmluZ2lmeSh2YWwpICsgJyBpcyBub3QgYSB3cmFwcGVkIHZhbHVlJ31cclxuICByZXR1cm4gdmFsLl92YWx1ZVxyXG59XHJcblxyXG4vLyBXcmFwcyBhIHZhbHVlIGluIGEgc3BlY2lmaWVkIHByb3RvdHlwZVxyXG5jb25zdCB3cmFwSW4gPSAocHJvdG8sIHZhbCkgPT4ge1xyXG4gIHZhciBvYmogPSBPYmplY3QuY3JlYXRlKHByb3RvKVxyXG4gIG9iai5fdmFsdWUgPSB2YWxcclxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShvYmopXHJcbn1cclxuXHJcbmV4cG9ydHMubWFrZSA9IGZ1bmN0aW9uIG1ha2VfbW9uYWQgKG91dGVyLCBpbm5lcikge1xyXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IG9iamVjdCBhbmQgd3JhcHMgaXQgaW4gdGhlIHN0YWNrIHByb3RvdHlwZVxyXG4gIGZ1bmN0aW9uIGNyZWF0ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gd3JhcEluKHN0YWNrUHJvdG8sIHZhbClcclxuICB9XHJcblxyXG4gIC8vIERlZmluZSB0aGUgcHJvdG90eXBlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICBjb25zdCBvdXRlclByb3RvID0ge1xyXG4gICAgb2Y6IG91dGVyLm9mLFxyXG4gICAgLy8gSGVyZSB3ZSBqdXN0IHRha2UgdGhlICdjaGFpbicgZnVuY3Rpb24gZnJvbSB0aGUgbW9uYWQncyBkZWZpbml0aW9uLFxyXG4gICAgLy8gYW5kIGFwcGx5IGl0IHRvIHRoZSB2YWx1ZSwgcGxhY2VkIGluIHRoZSBvYmplY3QncyAnX3ZhbHVlJyBwcm9wZXJ0eVxyXG4gICAgLy8gV2hlbiB3ZSBzdGFjayBtb25hZCB0cmFuc2Zvcm1lciBtdXN0IGhhdmUgYSByZWFsIGF0IHRoZSBib3R0b20uXHJcbiAgICAvLyBUaGF0IGlzIHdoeSB3ZSB3cmFwIG91ciB2YWx1ZSBpbiBhbiBJRCBtb25hZFxyXG4gICAgY2hhaW4gKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIG91dGVyLmNoYWluKGZ1bmssIHdyYXBJbihpZFByb3RvLCB0aGlzLl92YWx1ZSkpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IHtcclxuICAgIHByb3RvdHlwZTogc3RhY2tQcm90byxcclxuXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICByZXR1cm4gY3JlYXRlKGlubmVyLmNoYWluKGZ1bmtBbmRVbndyYXAsIHdyYXBJbihvdXRlclByb3RvLCB0aGlzLl92YWx1ZSkpKVxyXG4gICAgfSxcclxuXHJcbiAgICAvLyBBZGQgJ21hcCcgYW5kICdvZicgZnVuY3Rpb25zXHJcbiAgICBvZiAodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZShvdXRlci5vZihpbm5lci5vZih2YWx1ZSkpKVxyXG4gICAgfSxcclxuICAgIG1hcCAoZnVuaykge1xyXG4gICAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB0aGlzLm9mKGZ1bmsodmFsKSkpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBMaWZ0cyBhIHZhbHVlIGZyb20gdGhlIG91dGVyIHR5cGUgdG8gYSBmdWxsIHN0YWNrXHJcbiAgY29uc3QgbGlmdE91dGVyID0gc3RhY2tQcm90byBbICdsaWZ0JyArIG91dGVyLm5hbWUgXSA9ICh2YWwpID0+IGNyZWF0ZShpbm5lci5saWZ0KHdyYXBJbihvdXRlclByb3RvLCB2YWwpKSlcclxuICBjb25zdCBsaWZ0SW5uZXIgPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdID0gKHZhbCkgPT4gY3JlYXRlKG91dGVyLm9mKHZhbCkpXHJcblxyXG4gIC8vIEFkZCB2YXJpYW50cyBvZiAnY2hhaW4nIGNvbXBvc2VkIHdpdGggbGlmdCwgd2hpY2ggd29yayBpbiBpbm5lciBhbmQgb3V0ZXIgdmFsdWVzXHJcbiAgc3RhY2tQcm90byBbICdjaGFpbicgKyBpbm5lci5uYW1lIF0gPSBmdW5jdGlvbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gbGlmdElubmVyKGZ1bmsodmFsKSkpXHJcbiAgfVxyXG4gIHN0YWNrUHJvdG8gWyAnY2hhaW4nICsgb3V0ZXIubmFtZSBdID0gZnVuY3Rpb24gKGZ1bmspIHtcclxuICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IGxpZnRPdXRlcihmdW5rKHZhbCkpKVxyXG4gIH1cclxuXHJcbiAgLy8gVXNpbmcgdGhlIGxpZnQgb3BlcmF0aW9ucywgbGlmdCBhbGwgbW9uYWQgaGVscGVycyBhbmQgYXNzaWduIHRoZW0gdG8gdGhlIHN0YWNrIG9iamVjdDpcclxuICBjb25zdCBleHRlbmQgPSAob3V0ZXIpID0+IHtcclxuICAgIE9iamVjdC5rZXlzKG91dGVyKVxyXG4gICAgICAuZmlsdGVyKChrZXkpID0+IChrZXkgIT09ICdvZicgJiYga2V5ICE9PSAnY2hhaW4nICYmIGtleSAhPT0gJ2xpZnQnKSlcclxuICAgICAgLmZvckVhY2goKGtleSkgPT4ge1xyXG4gICAgICAgIHN0YWNrUHJvdG9ba2V5XSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXHJcblxyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICAgICAgICBhcmdzLnB1c2godmFsKVxyXG4gICAgICAgICAgICByZXR1cm4gc3RhY2tQcm90b1sgJ2xpZnQnICsgb3V0ZXIubmFtZSBdKG91dGVyW2tleV0uYXBwbHkobnVsbCwgYXJncykpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICB9XHJcbiAgZXh0ZW5kKG91dGVyKVxyXG4gIGV4dGVuZChpbm5lcilcclxuICAvLyBBZGQgYWxpYXNlcyB0byB0aGUgbW9uYWRzIHRoZW1zZWx2ZXNcclxuICBzdGFja1Byb3RvIFsgaW5uZXIubmFtZSBdID0gaW5uZXJcclxuICBzdGFja1Byb3RvIFsgb3V0ZXIubmFtZSBdID0gb3V0ZXJcclxuXHJcbiAgLy8gQWRkIHJlbGV2YW50IHByb3RvdHlwZSBwcm9wZXJ0aWVzIHRvIHRoZSBjb25zdHJ1Y3RvclxyXG4gIGNyZWF0ZS5vZiA9IHN0YWNrUHJvdG8ub2ZcclxuICBjcmVhdGUgWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0gPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgb3V0ZXIubmFtZSBdXHJcbiAgY3JlYXRlIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdID0gc3RhY2tQcm90byBbICdsaWZ0JyArIGlubmVyLm5hbWUgXVxyXG5cclxuICAvLyBTdGFjayBjb25zdHJ1Y3RvclxyXG4gIHJldHVybiBjcmVhdGVcclxufVxyXG4iLCJcInVzZSBzdHJpY3RcIjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklpSXNJbVpwYkdVaU9pSmpPaTluYVhRdGNISnZhbVZqZEhNdmMyOXVibVV2YkdsaUwzQnlhVzB1YW5NaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNlcxMTkiLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIGFyZyAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0J1xuICAgICYmIHR5cGVvZiBhcmcuY29weSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcuZmlsbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICYmIHR5cGVvZiBhcmcucmVhZFVJbnQ4ID09PSAnZnVuY3Rpb24nO1xufSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cbiIsIi8qKlxuICogU2lub24gY29yZSB1dGlsaXRpZXMuIEZvciBpbnRlcm5hbCB1c2Ugb25seS5cbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG52YXIgc2lub24gPSAoZnVuY3Rpb24gKCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgc2lub25Nb2R1bGU7XG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHNpbm9uTW9kdWxlID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9zaW5vbi91dGlsL2NvcmVcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL2V4dGVuZFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vd2Fsa1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vdHlwZU9mXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi90aW1lc19pbl93b3Jkc1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vc3B5XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9jYWxsXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9iZWhhdmlvclwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vc3R1YlwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vbW9ja1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vY29sbGVjdGlvblwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vYXNzZXJ0XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9zYW5kYm94XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi90ZXN0XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi90ZXN0X2Nhc2VcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL21hdGNoXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9mb3JtYXRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL2xvZ19lcnJvclwiKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHNpbm9uTW9kdWxlID0gbW9kdWxlLmV4cG9ydHM7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2lub25Nb2R1bGUgPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2lub25Nb2R1bGU7XG59KCkpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHRpbWVzX2luX3dvcmRzLmpzXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCBtYXRjaC5qc1xuICogQGRlcGVuZCBmb3JtYXQuanNcbiAqL1xuLyoqXG4gKiBBc3NlcnRpb25zIG1hdGNoaW5nIHRoZSB0ZXN0IHNweSByZXRyaWV2YWwgaW50ZXJmYWNlLlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwsIGdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICB2YXIgYXNzZXJ0O1xuXG4gICAgICAgIGZ1bmN0aW9uIHZlcmlmeUlzU3R1YigpIHtcbiAgICAgICAgICAgIHZhciBtZXRob2Q7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgICAgIG1ldGhvZCA9IGFyZ3VtZW50c1tpXTtcblxuICAgICAgICAgICAgICAgIGlmICghbWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydC5mYWlsKFwiZmFrZSBpcyBub3QgYSBzcHlcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG1ldGhvZC5wcm94eSAmJiBtZXRob2QucHJveHkuaXNTaW5vblByb3h5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmeUlzU3R1YihtZXRob2QucHJveHkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWV0aG9kICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydC5mYWlsKG1ldGhvZCArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXRob2QuZ2V0Q2FsbCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NlcnQuZmFpbChtZXRob2QgKyBcIiBpcyBub3Qgc3R1YmJlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZmFpbEFzc2VydGlvbihvYmplY3QsIG1zZykge1xuICAgICAgICAgICAgb2JqZWN0ID0gb2JqZWN0IHx8IGdsb2JhbDtcbiAgICAgICAgICAgIHZhciBmYWlsTWV0aG9kID0gb2JqZWN0LmZhaWwgfHwgYXNzZXJ0LmZhaWw7XG4gICAgICAgICAgICBmYWlsTWV0aG9kLmNhbGwob2JqZWN0LCBtc2cpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbWlycm9yUHJvcEFzQXNzZXJ0aW9uKG5hbWUsIG1ldGhvZCwgbWVzc2FnZSkge1xuICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlID0gbWV0aG9kO1xuICAgICAgICAgICAgICAgIG1ldGhvZCA9IG5hbWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFzc2VydFtuYW1lXSA9IGZ1bmN0aW9uIChmYWtlKSB7XG4gICAgICAgICAgICAgICAgdmVyaWZ5SXNTdHViKGZha2UpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgdmFyIGZhaWxlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXRob2QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBmYWlsZWQgPSAhbWV0aG9kKGZha2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZhaWxlZCA9IHR5cGVvZiBmYWtlW21ldGhvZF0gPT09IFwiZnVuY3Rpb25cIiA/XG4gICAgICAgICAgICAgICAgICAgICAgICAhZmFrZVttZXRob2RdLmFwcGx5KGZha2UsIGFyZ3MpIDogIWZha2VbbWV0aG9kXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZmFpbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGZhaWxBc3NlcnRpb24odGhpcywgKGZha2UucHJpbnRmIHx8IGZha2UucHJveHkucHJpbnRmKS5hcHBseShmYWtlLCBbbWVzc2FnZV0uY29uY2F0KGFyZ3MpKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0LnBhc3MobmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGV4cG9zZWROYW1lKHByZWZpeCwgcHJvcCkge1xuICAgICAgICAgICAgcmV0dXJuICFwcmVmaXggfHwgL15mYWlsLy50ZXN0KHByb3ApID8gcHJvcCA6XG4gICAgICAgICAgICAgICAgcHJlZml4ICsgcHJvcC5zbGljZSgwLCAxKS50b1VwcGVyQ2FzZSgpICsgcHJvcC5zbGljZSgxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2VydCA9IHtcbiAgICAgICAgICAgIGZhaWxFeGNlcHRpb246IFwiQXNzZXJ0RXJyb3JcIixcblxuICAgICAgICAgICAgZmFpbDogZnVuY3Rpb24gZmFpbChtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIGVycm9yLm5hbWUgPSB0aGlzLmZhaWxFeGNlcHRpb24gfHwgYXNzZXJ0LmZhaWxFeGNlcHRpb247XG5cbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHBhc3M6IGZ1bmN0aW9uIHBhc3MoKSB7fSxcblxuICAgICAgICAgICAgY2FsbE9yZGVyOiBmdW5jdGlvbiBhc3NlcnRDYWxsT3JkZXIoKSB7XG4gICAgICAgICAgICAgICAgdmVyaWZ5SXNTdHViLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkID0gXCJcIjtcbiAgICAgICAgICAgICAgICB2YXIgYWN0dWFsID0gXCJcIjtcblxuICAgICAgICAgICAgICAgIGlmICghc2lub24uY2FsbGVkSW5PcmRlcihhcmd1bWVudHMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZCA9IFtdLmpvaW4uY2FsbChhcmd1bWVudHMsIFwiLCBcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbHMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaSA9IGNhbGxzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYWxsc1stLWldLmNhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxscy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0dWFsID0gc2lub24ub3JkZXJCeUZpcnN0Q2FsbChjYWxscykuam9pbihcIiwgXCIpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGZhaWxzLCB3ZSdsbCBqdXN0IGZhbGwgYmFjayB0byB0aGUgYmxhbmsgc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBmYWlsQXNzZXJ0aW9uKHRoaXMsIFwiZXhwZWN0ZWQgXCIgKyBleHBlY3RlZCArIFwiIHRvIGJlIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJjYWxsZWQgaW4gb3JkZXIgYnV0IHdlcmUgY2FsbGVkIGFzIFwiICsgYWN0dWFsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQucGFzcyhcImNhbGxPcmRlclwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsQ291bnQ6IGZ1bmN0aW9uIGFzc2VydENhbGxDb3VudChtZXRob2QsIGNvdW50KSB7XG4gICAgICAgICAgICAgICAgdmVyaWZ5SXNTdHViKG1ldGhvZCk7XG5cbiAgICAgICAgICAgICAgICBpZiAobWV0aG9kLmNhbGxDb3VudCAhPT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1zZyA9IFwiZXhwZWN0ZWQgJW4gdG8gYmUgY2FsbGVkIFwiICsgc2lub24udGltZXNJbldvcmRzKGNvdW50KSArXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiBidXQgd2FzIGNhbGxlZCAlYyVDXCI7XG4gICAgICAgICAgICAgICAgICAgIGZhaWxBc3NlcnRpb24odGhpcywgbWV0aG9kLnByaW50Zihtc2cpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQucGFzcyhcImNhbGxDb3VudFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBleHBvc2U6IGZ1bmN0aW9uIGV4cG9zZSh0YXJnZXQsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwidGFyZ2V0IGlzIG51bGwgb3IgdW5kZWZpbmVkXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICAgICAgICB2YXIgcHJlZml4ID0gdHlwZW9mIG8ucHJlZml4ID09PSBcInVuZGVmaW5lZFwiICYmIFwiYXNzZXJ0XCIgfHwgby5wcmVmaXg7XG4gICAgICAgICAgICAgICAgdmFyIGluY2x1ZGVGYWlsID0gdHlwZW9mIG8uaW5jbHVkZUZhaWwgPT09IFwidW5kZWZpbmVkXCIgfHwgISFvLmluY2x1ZGVGYWlsO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbWV0aG9kIGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1ldGhvZCAhPT0gXCJleHBvc2VcIiAmJiAoaW5jbHVkZUZhaWwgfHwgIS9eKGZhaWwpLy50ZXN0KG1ldGhvZCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRbZXhwb3NlZE5hbWUocHJlZml4LCBtZXRob2QpXSA9IHRoaXNbbWV0aG9kXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBtYXRjaDogZnVuY3Rpb24gbWF0Y2goYWN0dWFsLCBleHBlY3RhdGlvbikge1xuICAgICAgICAgICAgICAgIHZhciBtYXRjaGVyID0gc2lub24ubWF0Y2goZXhwZWN0YXRpb24pO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVyLnRlc3QoYWN0dWFsKSkge1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQucGFzcyhcIm1hdGNoXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmb3JtYXR0ZWQgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcImV4cGVjdGVkIHZhbHVlIHRvIG1hdGNoXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiAgICBleHBlY3RlZCA9IFwiICsgc2lub24uZm9ybWF0KGV4cGVjdGF0aW9uKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiICAgIGFjdHVhbCA9IFwiICsgc2lub24uZm9ybWF0KGFjdHVhbClcbiAgICAgICAgICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgICAgICAgICBmYWlsQXNzZXJ0aW9uKHRoaXMsIGZvcm1hdHRlZC5qb2luKFwiXFxuXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiY2FsbGVkXCIsIFwiZXhwZWN0ZWQgJW4gdG8gaGF2ZSBiZWVuIGNhbGxlZCBhdCBsZWFzdCBvbmNlIGJ1dCB3YXMgbmV2ZXIgY2FsbGVkXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJub3RDYWxsZWRcIiwgZnVuY3Rpb24gKHNweSkge1xuICAgICAgICAgICAgcmV0dXJuICFzcHkuY2FsbGVkO1xuICAgICAgICB9LCBcImV4cGVjdGVkICVuIHRvIG5vdCBoYXZlIGJlZW4gY2FsbGVkIGJ1dCB3YXMgY2FsbGVkICVjJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImNhbGxlZE9uY2VcIiwgXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgb25jZSBidXQgd2FzIGNhbGxlZCAlYyVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRUd2ljZVwiLCBcImV4cGVjdGVkICVuIHRvIGJlIGNhbGxlZCB0d2ljZSBidXQgd2FzIGNhbGxlZCAlYyVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRUaHJpY2VcIiwgXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgdGhyaWNlIGJ1dCB3YXMgY2FsbGVkICVjJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImNhbGxlZE9uXCIsIFwiZXhwZWN0ZWQgJW4gdG8gYmUgY2FsbGVkIHdpdGggJTEgYXMgdGhpcyBidXQgd2FzIGNhbGxlZCB3aXRoICV0XCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXG4gICAgICAgICAgICBcImFsd2F5c0NhbGxlZE9uXCIsXG4gICAgICAgICAgICBcImV4cGVjdGVkICVuIHRvIGFsd2F5cyBiZSBjYWxsZWQgd2l0aCAlMSBhcyB0aGlzIGJ1dCB3YXMgY2FsbGVkIHdpdGggJXRcIlxuICAgICAgICApO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRXaXRoTmV3XCIsIFwiZXhwZWN0ZWQgJW4gdG8gYmUgY2FsbGVkIHdpdGggbmV3XCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJhbHdheXNDYWxsZWRXaXRoTmV3XCIsIFwiZXhwZWN0ZWQgJW4gdG8gYWx3YXlzIGJlIGNhbGxlZCB3aXRoIG5ld1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiY2FsbGVkV2l0aFwiLCBcImV4cGVjdGVkICVuIHRvIGJlIGNhbGxlZCB3aXRoIGFyZ3VtZW50cyAlKiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRXaXRoTWF0Y2hcIiwgXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgd2l0aCBtYXRjaCAlKiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJhbHdheXNDYWxsZWRXaXRoXCIsIFwiZXhwZWN0ZWQgJW4gdG8gYWx3YXlzIGJlIGNhbGxlZCB3aXRoIGFyZ3VtZW50cyAlKiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJhbHdheXNDYWxsZWRXaXRoTWF0Y2hcIiwgXCJleHBlY3RlZCAlbiB0byBhbHdheXMgYmUgY2FsbGVkIHdpdGggbWF0Y2ggJSolQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiY2FsbGVkV2l0aEV4YWN0bHlcIiwgXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgd2l0aCBleGFjdCBhcmd1bWVudHMgJSolQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiYWx3YXlzQ2FsbGVkV2l0aEV4YWN0bHlcIiwgXCJleHBlY3RlZCAlbiB0byBhbHdheXMgYmUgY2FsbGVkIHdpdGggZXhhY3QgYXJndW1lbnRzICUqJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcIm5ldmVyQ2FsbGVkV2l0aFwiLCBcImV4cGVjdGVkICVuIHRvIG5ldmVyIGJlIGNhbGxlZCB3aXRoIGFyZ3VtZW50cyAlKiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJuZXZlckNhbGxlZFdpdGhNYXRjaFwiLCBcImV4cGVjdGVkICVuIHRvIG5ldmVyIGJlIGNhbGxlZCB3aXRoIG1hdGNoICUqJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcInRocmV3XCIsIFwiJW4gZGlkIG5vdCB0aHJvdyBleGNlcHRpb24lQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiYWx3YXlzVGhyZXdcIiwgXCIlbiBkaWQgbm90IGFsd2F5cyB0aHJvdyBleGNlcHRpb24lQ1wiKTtcblxuICAgICAgICBzaW5vbi5hc3NlcnQgPSBhc3NlcnQ7XG4gICAgICAgIHJldHVybiBhc3NlcnQ7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vbWF0Y2hcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zvcm1hdFwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHNlbGZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCBleHRlbmQuanNcbiAqL1xuLyoqXG4gKiBTdHViIGJlaGF2aW9yXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAYXV0aG9yIFRpbSBGaXNjaGJhY2ggKG1haWxAdGltZmlzY2hiYWNoLmRlKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbiAgICB2YXIgam9pbiA9IEFycmF5LnByb3RvdHlwZS5qb2luO1xuICAgIHZhciB1c2VMZWZ0TW9zdENhbGxiYWNrID0gLTE7XG4gICAgdmFyIHVzZVJpZ2h0TW9zdENhbGxiYWNrID0gLTI7XG5cbiAgICB2YXIgbmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MubmV4dFRpY2sgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2s7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICByZXR1cm4gc2V0SW1tZWRpYXRlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgMCk7XG4gICAgICAgIH07XG4gICAgfSkoKTtcblxuICAgIGZ1bmN0aW9uIHRocm93c0V4Y2VwdGlvbihlcnJvciwgbWVzc2FnZSkge1xuICAgICAgICBpZiAodHlwZW9mIGVycm9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB0aGlzLmV4Y2VwdGlvbiA9IG5ldyBFcnJvcihtZXNzYWdlIHx8IFwiXCIpO1xuICAgICAgICAgICAgdGhpcy5leGNlcHRpb24ubmFtZSA9IGVycm9yO1xuICAgICAgICB9IGVsc2UgaWYgKCFlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5leGNlcHRpb24gPSBuZXcgRXJyb3IoXCJFcnJvclwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXhjZXB0aW9uID0gZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRDYWxsYmFjayhiZWhhdmlvciwgYXJncykge1xuICAgICAgICB2YXIgY2FsbEFyZ0F0ID0gYmVoYXZpb3IuY2FsbEFyZ0F0O1xuXG4gICAgICAgIGlmIChjYWxsQXJnQXQgPj0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGFyZ3NbY2FsbEFyZ0F0XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhcmd1bWVudExpc3Q7XG5cbiAgICAgICAgaWYgKGNhbGxBcmdBdCA9PT0gdXNlTGVmdE1vc3RDYWxsYmFjaykge1xuICAgICAgICAgICAgYXJndW1lbnRMaXN0ID0gYXJncztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYWxsQXJnQXQgPT09IHVzZVJpZ2h0TW9zdENhbGxiYWNrKSB7XG4gICAgICAgICAgICBhcmd1bWVudExpc3QgPSBzbGljZS5jYWxsKGFyZ3MpLnJldmVyc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYWxsQXJnUHJvcCA9IGJlaGF2aW9yLmNhbGxBcmdQcm9wO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJndW1lbnRMaXN0Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgaWYgKCFjYWxsQXJnUHJvcCAmJiB0eXBlb2YgYXJndW1lbnRMaXN0W2ldID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJndW1lbnRMaXN0W2ldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2FsbEFyZ1Byb3AgJiYgYXJndW1lbnRMaXN0W2ldICYmXG4gICAgICAgICAgICAgICAgdHlwZW9mIGFyZ3VtZW50TGlzdFtpXVtjYWxsQXJnUHJvcF0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcmd1bWVudExpc3RbaV1bY2FsbEFyZ1Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBmdW5jdGlvbiBnZXRDYWxsYmFja0Vycm9yKGJlaGF2aW9yLCBmdW5jLCBhcmdzKSB7XG4gICAgICAgICAgICBpZiAoYmVoYXZpb3IuY2FsbEFyZ0F0IDwgMCkge1xuICAgICAgICAgICAgICAgIHZhciBtc2c7XG5cbiAgICAgICAgICAgICAgICBpZiAoYmVoYXZpb3IuY2FsbEFyZ1Byb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgbXNnID0gc2lub24uZnVuY3Rpb25OYW1lKGJlaGF2aW9yLnN0dWIpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiIGV4cGVjdGVkIHRvIHlpZWxkIHRvICdcIiArIGJlaGF2aW9yLmNhbGxBcmdQcm9wICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiJywgYnV0IG5vIG9iamVjdCB3aXRoIHN1Y2ggYSBwcm9wZXJ0eSB3YXMgcGFzc2VkLlwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1zZyA9IHNpbm9uLmZ1bmN0aW9uTmFtZShiZWhhdmlvci5zdHViKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiBleHBlY3RlZCB0byB5aWVsZCwgYnV0IG5vIGNhbGxiYWNrIHdhcyBwYXNzZWQuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBtc2cgKz0gXCIgUmVjZWl2ZWQgW1wiICsgam9pbi5jYWxsKGFyZ3MsIFwiLCBcIikgKyBcIl1cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbXNnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gXCJhcmd1bWVudCBhdCBpbmRleCBcIiArIGJlaGF2aW9yLmNhbGxBcmdBdCArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uOiBcIiArIGZ1bmM7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYWxsQ2FsbGJhY2soYmVoYXZpb3IsIGFyZ3MpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYmVoYXZpb3IuY2FsbEFyZ0F0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZ1bmMgPSBnZXRDYWxsYmFjayhiZWhhdmlvciwgYXJncyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGdldENhbGxiYWNrRXJyb3IoYmVoYXZpb3IsIGZ1bmMsIGFyZ3MpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYmVoYXZpb3IuY2FsbGJhY2tBc3luYykge1xuICAgICAgICAgICAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGx5KGJlaGF2aW9yLmNhbGxiYWNrQ29udGV4dCwgYmVoYXZpb3IuY2FsbGJhY2tBcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGx5KGJlaGF2aW9yLmNhbGxiYWNrQ29udGV4dCwgYmVoYXZpb3IuY2FsbGJhY2tBcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcm90byA9IHtcbiAgICAgICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gY3JlYXRlKHN0dWIpIHtcbiAgICAgICAgICAgICAgICB2YXIgYmVoYXZpb3IgPSBzaW5vbi5leHRlbmQoe30sIHNpbm9uLmJlaGF2aW9yKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgYmVoYXZpb3IuY3JlYXRlO1xuICAgICAgICAgICAgICAgIGJlaGF2aW9yLnN0dWIgPSBzdHViO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJlaGF2aW9yO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaXNQcmVzZW50OiBmdW5jdGlvbiBpc1ByZXNlbnQoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICh0eXBlb2YgdGhpcy5jYWxsQXJnQXQgPT09IFwibnVtYmVyXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXhjZXB0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdGhpcy5yZXR1cm5BcmdBdCA9PT0gXCJudW1iZXJcIiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXR1cm5UaGlzIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJldHVyblZhbHVlRGVmaW5lZCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBpbnZva2U6IGZ1bmN0aW9uIGludm9rZShjb250ZXh0LCBhcmdzKSB7XG4gICAgICAgICAgICAgICAgY2FsbENhbGxiYWNrKHRoaXMsIGFyZ3MpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IHRoaXMuZXhjZXB0aW9uO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMucmV0dXJuQXJnQXQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFyZ3NbdGhpcy5yZXR1cm5BcmdBdF07XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJldHVyblRoaXMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWU7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvbkNhbGw6IGZ1bmN0aW9uIG9uQ2FsbChpbmRleCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnN0dWIub25DYWxsKGluZGV4KTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uRmlyc3RDYWxsOiBmdW5jdGlvbiBvbkZpcnN0Q2FsbCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zdHViLm9uRmlyc3RDYWxsKCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvblNlY29uZENhbGw6IGZ1bmN0aW9uIG9uU2Vjb25kQ2FsbCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zdHViLm9uU2Vjb25kQ2FsbCgpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25UaGlyZENhbGw6IGZ1bmN0aW9uIG9uVGhpcmRDYWxsKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnN0dWIub25UaGlyZENhbGwoKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHdpdGhBcmdzOiBmdW5jdGlvbiB3aXRoQXJncygvKiBhcmd1bWVudHMgKi8pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIFwiRGVmaW5pbmcgYSBzdHViIGJ5IGludm9raW5nIFxcXCJzdHViLm9uQ2FsbCguLi4pLndpdGhBcmdzKC4uLilcXFwiIFwiICtcbiAgICAgICAgICAgICAgICAgICAgXCJpcyBub3Qgc3VwcG9ydGVkLiBVc2UgXFxcInN0dWIud2l0aEFyZ3MoLi4uKS5vbkNhbGwoLi4uKVxcXCIgXCIgK1xuICAgICAgICAgICAgICAgICAgICBcInRvIGRlZmluZSBzZXF1ZW50aWFsIGJlaGF2aW9yIGZvciBjYWxscyB3aXRoIGNlcnRhaW4gYXJndW1lbnRzLlwiXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxzQXJnOiBmdW5jdGlvbiBjYWxsc0FyZyhwb3MpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHBvcyAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgaW5kZXggaXMgbm90IG51bWJlclwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdBdCA9IHBvcztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnUHJvcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbHNBcmdPbjogZnVuY3Rpb24gY2FsbHNBcmdPbihwb3MsIGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHBvcyAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgaW5kZXggaXMgbm90IG51bWJlclwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBjb250ZXh0IGlzIG5vdCBhbiBvYmplY3RcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnQXQgPSBwb3M7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FyZ3VtZW50cyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdQcm9wID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBc3luYyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsc0FyZ1dpdGg6IGZ1bmN0aW9uIGNhbGxzQXJnV2l0aChwb3MpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHBvcyAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgaW5kZXggaXMgbm90IG51bWJlclwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdBdCA9IHBvcztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxzQXJnT25XaXRoOiBmdW5jdGlvbiBjYWxsc0FyZ1dpdGgocG9zLCBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwb3MgIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImFyZ3VtZW50IGluZGV4IGlzIG5vdCBudW1iZXJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgY29udGV4dCBpcyBub3QgYW4gb2JqZWN0XCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gcG9zO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBcmd1bWVudHMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHlpZWxkczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gdXNlTGVmdE1vc3RDYWxsYmFjaztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHlpZWxkc1JpZ2h0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnQXQgPSB1c2VSaWdodE1vc3RDYWxsYmFjaztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHlpZWxkc09uOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgY29udGV4dCBpcyBub3QgYW4gb2JqZWN0XCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gdXNlTGVmdE1vc3RDYWxsYmFjaztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdQcm9wID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBc3luYyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB5aWVsZHNUbzogZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdBdCA9IHVzZUxlZnRNb3N0Q2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FyZ3VtZW50cyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQ29udGV4dCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdQcm9wID0gcHJvcDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRzVG9PbjogZnVuY3Rpb24gKHByb3AsIGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImFyZ3VtZW50IGNvbnRleHQgaXMgbm90IGFuIG9iamVjdFwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdBdCA9IHVzZUxlZnRNb3N0Q2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FyZ3VtZW50cyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQ29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnUHJvcCA9IHByb3A7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHRocm93czogdGhyb3dzRXhjZXB0aW9uLFxuICAgICAgICAgICAgdGhyb3dzRXhjZXB0aW9uOiB0aHJvd3NFeGNlcHRpb24sXG5cbiAgICAgICAgICAgIHJldHVybnM6IGZ1bmN0aW9uIHJldHVybnModmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJldHVyblZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXR1cm5WYWx1ZURlZmluZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhjZXB0aW9uID0gdW5kZWZpbmVkO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXR1cm5zQXJnOiBmdW5jdGlvbiByZXR1cm5zQXJnKHBvcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcG9zICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpbmRleCBpcyBub3QgbnVtYmVyXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMucmV0dXJuQXJnQXQgPSBwb3M7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJldHVybnNUaGlzOiBmdW5jdGlvbiByZXR1cm5zVGhpcygpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJldHVyblRoaXMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gY3JlYXRlQXN5bmNWZXJzaW9uKHN5bmNGbk5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHRoaXNbc3luY0ZuTmFtZV0uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFzeW5jaHJvbm91cyB2ZXJzaW9ucyBvZiBjYWxsc0FyZyogYW5kIHlpZWxkcyogbWV0aG9kc1xuICAgICAgICBmb3IgKHZhciBtZXRob2QgaW4gcHJvdG8pIHtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gYXZvaWQgY3JlYXRpbmcgYW5vdGhlcmFzeW5jIHZlcnNpb25zIG9mIHRoZSBuZXdseSBhZGRlZCBhc3luYyBtZXRob2RzXG4gICAgICAgICAgICBpZiAocHJvdG8uaGFzT3duUHJvcGVydHkobWV0aG9kKSAmJiBtZXRob2QubWF0Y2goL14oY2FsbHNBcmd8eWllbGRzKS8pICYmICFtZXRob2QubWF0Y2goL0FzeW5jLykpIHtcbiAgICAgICAgICAgICAgICBwcm90b1ttZXRob2QgKyBcIkFzeW5jXCJdID0gY3JlYXRlQXN5bmNWZXJzaW9uKG1ldGhvZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzaW5vbi5iZWhhdmlvciA9IHByb3RvO1xuICAgICAgICByZXR1cm4gcHJvdG87XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZXh0ZW5kXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAgKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICAqIEBkZXBlbmQgbWF0Y2guanNcbiAgKiBAZGVwZW5kIGZvcm1hdC5qc1xuICAqL1xuLyoqXG4gICogU3B5IGNhbGxzXG4gICpcbiAgKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAgKiBAYXV0aG9yIE1heGltaWxpYW4gQW50b25pIChtYWlsQG1heGFudG9uaS5kZSlcbiAgKiBAbGljZW5zZSBCU0RcbiAgKlxuICAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICAqIENvcHlyaWdodCAoYykgMjAxMyBNYXhpbWlsaWFuIEFudG9uaVxuICAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBmdW5jdGlvbiB0aHJvd1lpZWxkRXJyb3IocHJveHksIHRleHQsIGFyZ3MpIHtcbiAgICAgICAgICAgIHZhciBtc2cgPSBzaW5vbi5mdW5jdGlvbk5hbWUocHJveHkpICsgdGV4dDtcbiAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIG1zZyArPSBcIiBSZWNlaXZlZCBbXCIgKyBzbGljZS5jYWxsKGFyZ3MpLmpvaW4oXCIsIFwiKSArIFwiXVwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2FsbFByb3RvID0ge1xuICAgICAgICAgICAgY2FsbGVkT246IGZ1bmN0aW9uIGNhbGxlZE9uKHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChzaW5vbi5tYXRjaCAmJiBzaW5vbi5tYXRjaC5pc01hdGNoZXIodGhpc1ZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1ZhbHVlLnRlc3QodGhpcy50aGlzVmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy50aGlzVmFsdWUgPT09IHRoaXNWYWx1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxlZFdpdGg6IGZ1bmN0aW9uIGNhbGxlZFdpdGgoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGlmIChsID4gdGhpcy5hcmdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2lub24uZGVlcEVxdWFsKGFyZ3VtZW50c1tpXSwgdGhpcy5hcmdzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsZWRXaXRoTWF0Y2g6IGZ1bmN0aW9uIGNhbGxlZFdpdGhNYXRjaCgpIHtcbiAgICAgICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgaWYgKGwgPiB0aGlzLmFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFjdHVhbCA9IHRoaXMuYXJnc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGV4cGVjdGF0aW9uID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXNpbm9uLm1hdGNoIHx8ICFzaW5vbi5tYXRjaChleHBlY3RhdGlvbikudGVzdChhY3R1YWwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsZWRXaXRoRXhhY3RseTogZnVuY3Rpb24gY2FsbGVkV2l0aEV4YWN0bHkoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyZ3VtZW50cy5sZW5ndGggPT09IHRoaXMuYXJncy5sZW5ndGggJiZcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWxsZWRXaXRoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBub3RDYWxsZWRXaXRoOiBmdW5jdGlvbiBub3RDYWxsZWRXaXRoKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhdGhpcy5jYWxsZWRXaXRoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBub3RDYWxsZWRXaXRoTWF0Y2g6IGZ1bmN0aW9uIG5vdENhbGxlZFdpdGhNYXRjaCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIXRoaXMuY2FsbGVkV2l0aE1hdGNoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXR1cm5lZDogZnVuY3Rpb24gcmV0dXJuZWQodmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2lub24uZGVlcEVxdWFsKHZhbHVlLCB0aGlzLnJldHVyblZhbHVlKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHRocmV3OiBmdW5jdGlvbiB0aHJldyhlcnJvcikge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZXJyb3IgPT09IFwidW5kZWZpbmVkXCIgfHwgIXRoaXMuZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhIXRoaXMuZXhjZXB0aW9uO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4Y2VwdGlvbiA9PT0gZXJyb3IgfHwgdGhpcy5leGNlcHRpb24ubmFtZSA9PT0gZXJyb3I7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsZWRXaXRoTmV3OiBmdW5jdGlvbiBjYWxsZWRXaXRoTmV3KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnByb3h5LnByb3RvdHlwZSAmJiB0aGlzLnRoaXNWYWx1ZSBpbnN0YW5jZW9mIHRoaXMucHJveHk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsZWRCZWZvcmU6IGZ1bmN0aW9uIChvdGhlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhbGxJZCA8IG90aGVyLmNhbGxJZDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxlZEFmdGVyOiBmdW5jdGlvbiAob3RoZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jYWxsSWQgPiBvdGhlci5jYWxsSWQ7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsQXJnOiBmdW5jdGlvbiAocG9zKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcmdzW3Bvc10oKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxBcmdPbjogZnVuY3Rpb24gKHBvcywgdGhpc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcmdzW3Bvc10uYXBwbHkodGhpc1ZhbHVlKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxBcmdXaXRoOiBmdW5jdGlvbiAocG9zKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnT25XaXRoLmFwcGx5KHRoaXMsIFtwb3MsIG51bGxdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxBcmdPbldpdGg6IGZ1bmN0aW9uIChwb3MsIHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXJnc1twb3NdLmFwcGx5KHRoaXNWYWx1ZSwgYXJncyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBcInlpZWxkXCI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnlpZWxkT24uYXBwbHkodGhpcywgW251bGxdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMCkpKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHlpZWxkT246IGZ1bmN0aW9uICh0aGlzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IHRoaXMuYXJncztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGFyZ3MubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXJnc1tpXSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzW2ldLmFwcGx5KHRoaXNWYWx1ZSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aHJvd1lpZWxkRXJyb3IodGhpcy5wcm94eSwgXCIgY2Fubm90IHlpZWxkIHNpbmNlIG5vIGNhbGxiYWNrIHdhcyBwYXNzZWQuXCIsIGFyZ3MpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRUbzogZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnlpZWxkVG9Pbi5hcHBseSh0aGlzLCBbcHJvcCwgbnVsbF0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRUb09uOiBmdW5jdGlvbiAocHJvcCwgdGhpc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSB0aGlzLmFyZ3M7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmdzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXJnc1tpXSAmJiB0eXBlb2YgYXJnc1tpXVtwcm9wXSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzW2ldW3Byb3BdLmFwcGx5KHRoaXNWYWx1ZSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aHJvd1lpZWxkRXJyb3IodGhpcy5wcm94eSwgXCIgY2Fubm90IHlpZWxkIHRvICdcIiArIHByb3AgK1xuICAgICAgICAgICAgICAgICAgICBcIicgc2luY2Ugbm8gY2FsbGJhY2sgd2FzIHBhc3NlZC5cIiwgYXJncyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXRTdGFja0ZyYW1lczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIE9taXQgdGhlIGVycm9yIG1lc3NhZ2UgYW5kIHRoZSB0d28gdG9wIHN0YWNrIGZyYW1lcyBpbiBzaW5vbiBpdHNlbGY6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RhY2sgJiYgdGhpcy5zdGFjay5zcGxpdChcIlxcblwiKS5zbGljZSgzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhbGxTdHIgPSB0aGlzLnByb3h5LnRvU3RyaW5nKCkgKyBcIihcIjtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmFyZ3MubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MucHVzaChzaW5vbi5mb3JtYXQodGhpcy5hcmdzW2ldKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2FsbFN0ciA9IGNhbGxTdHIgKyBhcmdzLmpvaW4oXCIsIFwiKSArIFwiKVwiO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLnJldHVyblZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxTdHIgKz0gXCIgPT4gXCIgKyBzaW5vbi5mb3JtYXQodGhpcy5yZXR1cm5WYWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxTdHIgKz0gXCIgIVwiICsgdGhpcy5leGNlcHRpb24ubmFtZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5leGNlcHRpb24ubWVzc2FnZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbFN0ciArPSBcIihcIiArIHRoaXMuZXhjZXB0aW9uLm1lc3NhZ2UgKyBcIilcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdGFjaykge1xuICAgICAgICAgICAgICAgICAgICBjYWxsU3RyICs9IHRoaXMuZ2V0U3RhY2tGcmFtZXMoKVswXS5yZXBsYWNlKC9eXFxzKig/OmF0XFxzK3xAKT8vLCBcIiBhdCBcIik7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbFN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBjYWxsUHJvdG8uaW52b2tlQ2FsbGJhY2sgPSBjYWxsUHJvdG8ueWllbGQ7XG5cbiAgICAgICAgZnVuY3Rpb24gY3JlYXRlU3B5Q2FsbChzcHksIHRoaXNWYWx1ZSwgYXJncywgcmV0dXJuVmFsdWUsIGV4Y2VwdGlvbiwgaWQsIHN0YWNrKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGlkICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbGwgaWQgaXMgbm90IGEgbnVtYmVyXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHByb3h5Q2FsbCA9IHNpbm9uLmNyZWF0ZShjYWxsUHJvdG8pO1xuICAgICAgICAgICAgcHJveHlDYWxsLnByb3h5ID0gc3B5O1xuICAgICAgICAgICAgcHJveHlDYWxsLnRoaXNWYWx1ZSA9IHRoaXNWYWx1ZTtcbiAgICAgICAgICAgIHByb3h5Q2FsbC5hcmdzID0gYXJncztcbiAgICAgICAgICAgIHByb3h5Q2FsbC5yZXR1cm5WYWx1ZSA9IHJldHVyblZhbHVlO1xuICAgICAgICAgICAgcHJveHlDYWxsLmV4Y2VwdGlvbiA9IGV4Y2VwdGlvbjtcbiAgICAgICAgICAgIHByb3h5Q2FsbC5jYWxsSWQgPSBpZDtcbiAgICAgICAgICAgIHByb3h5Q2FsbC5zdGFjayA9IHN0YWNrO1xuXG4gICAgICAgICAgICByZXR1cm4gcHJveHlDYWxsO1xuICAgICAgICB9XG4gICAgICAgIGNyZWF0ZVNweUNhbGwudG9TdHJpbmcgPSBjYWxsUHJvdG8udG9TdHJpbmc7IC8vIHVzZWQgYnkgbW9ja3NcblxuICAgICAgICBzaW5vbi5zcHlDYWxsID0gY3JlYXRlU3B5Q2FsbDtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNweUNhbGw7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vbWF0Y2hcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zvcm1hdFwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCBzcHkuanNcbiAqIEBkZXBlbmQgc3R1Yi5qc1xuICogQGRlcGVuZCBtb2NrLmpzXG4gKi9cbi8qKlxuICogQ29sbGVjdGlvbnMgb2Ygc3R1YnMsIHNwaWVzIGFuZCBtb2Nrcy5cbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgcHVzaCA9IFtdLnB1c2g7XG4gICAgdmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuICAgIGZ1bmN0aW9uIGdldEZha2VzKGZha2VDb2xsZWN0aW9uKSB7XG4gICAgICAgIGlmICghZmFrZUNvbGxlY3Rpb24uZmFrZXMpIHtcbiAgICAgICAgICAgIGZha2VDb2xsZWN0aW9uLmZha2VzID0gW107XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFrZUNvbGxlY3Rpb24uZmFrZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZWFjaChmYWtlQ29sbGVjdGlvbiwgbWV0aG9kKSB7XG4gICAgICAgIHZhciBmYWtlcyA9IGdldEZha2VzKGZha2VDb2xsZWN0aW9uKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGZha2VzLmxlbmd0aDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmYWtlc1tpXVttZXRob2RdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBmYWtlc1tpXVttZXRob2RdKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb21wYWN0KGZha2VDb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBmYWtlcyA9IGdldEZha2VzKGZha2VDb2xsZWN0aW9uKTtcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB3aGlsZSAoaSA8IGZha2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgZmFrZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHtcbiAgICAgICAgICAgIHZlcmlmeTogZnVuY3Rpb24gcmVzb2x2ZSgpIHtcbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMsIFwidmVyaWZ5XCIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzdG9yZTogZnVuY3Rpb24gcmVzdG9yZSgpIHtcbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMsIFwicmVzdG9yZVwiKTtcbiAgICAgICAgICAgICAgICBjb21wYWN0KHRoaXMpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzZXQ6IGZ1bmN0aW9uIHJlc3RvcmUoKSB7XG4gICAgICAgICAgICAgICAgZWFjaCh0aGlzLCBcInJlc2V0XCIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmVyaWZ5QW5kUmVzdG9yZTogZnVuY3Rpb24gdmVyaWZ5QW5kUmVzdG9yZSgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXhjZXB0aW9uO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52ZXJpZnkoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VwdGlvbiA9IGU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5yZXN0b3JlKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBhZGQ6IGZ1bmN0aW9uIGFkZChmYWtlKSB7XG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKGdldEZha2VzKHRoaXMpLCBmYWtlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFrZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHNweTogZnVuY3Rpb24gc3B5KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZChzaW5vbi5zcHkuYXBwbHkoc2lub24sIGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc3R1YjogZnVuY3Rpb24gc3R1YihvYmplY3QsIHByb3BlcnR5LCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3JpZ2luYWwgPSBvYmplY3RbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb3JpZ2luYWwgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBzdHViIG5vbi1leGlzdGVudCBvd24gcHJvcGVydHkgXCIgKyBwcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFtwcm9wZXJ0eV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFtwcm9wZXJ0eV0gPSBvcmlnaW5hbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXByb3BlcnR5ICYmICEhb2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0dWJiZWRPYmogPSBzaW5vbi5zdHViLmFwcGx5KHNpbm9uLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gc3R1YmJlZE9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBzdHViYmVkT2JqW3Byb3BdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZChzdHViYmVkT2JqW3Byb3BdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHViYmVkT2JqO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZChzaW5vbi5zdHViLmFwcGx5KHNpbm9uLCBhcmd1bWVudHMpKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG1vY2s6IGZ1bmN0aW9uIG1vY2soKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHNpbm9uLm1vY2suYXBwbHkoc2lub24sIGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaW5qZWN0OiBmdW5jdGlvbiBpbmplY3Qob2JqKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbCA9IHRoaXM7XG5cbiAgICAgICAgICAgICAgICBvYmouc3B5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29sLnNweS5hcHBseShjb2wsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIG9iai5zdHViID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29sLnN0dWIuYXBwbHkoY29sLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBvYmoubW9jayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbC5tb2NrLmFwcGx5KGNvbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5jb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb247XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vbW9ja1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc3B5XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zdHViXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcblxuICAgICAgICAvLyBBZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vZG9jcy9FQ01BU2NyaXB0X0RvbnRFbnVtX2F0dHJpYnV0ZSNKU2NyaXB0X0RvbnRFbnVtX0J1Z1xuICAgICAgICB2YXIgaGFzRG9udEVudW1CdWcgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG9iaiA9IHtcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIwXCI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIxXCI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB2YWx1ZU9mOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjJcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHRvTG9jYWxlU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjNcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb3RvdHlwZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCI0XCI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpc1Byb3RvdHlwZU9mOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjVcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHByb3BlcnR5SXNFbnVtZXJhYmxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjZcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGhhc093blByb3BlcnR5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjdcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGxlbmd0aDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCI4XCI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB1bmlxdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiOVwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gb2JqKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChvYmpbcHJvcF0oKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5qb2luKFwiXCIpICE9PSBcIjAxMjM0NTY3ODlcIjtcbiAgICAgICAgfSkoKTtcblxuICAgICAgICAvKiBQdWJsaWM6IEV4dGVuZCB0YXJnZXQgaW4gcGxhY2Ugd2l0aCBhbGwgKG93bikgcHJvcGVydGllcyBmcm9tIHNvdXJjZXMgaW4tb3JkZXIuIFRodXMsIGxhc3Qgc291cmNlIHdpbGxcbiAgICAgICAgICogICAgICAgICBvdmVycmlkZSBwcm9wZXJ0aWVzIGluIHByZXZpb3VzIHNvdXJjZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIHRhcmdldCAtIFRoZSBPYmplY3QgdG8gZXh0ZW5kXG4gICAgICAgICAqIHNvdXJjZXMgLSBPYmplY3RzIHRvIGNvcHkgcHJvcGVydGllcyBmcm9tLlxuICAgICAgICAgKlxuICAgICAgICAgKiBSZXR1cm5zIHRoZSBleHRlbmRlZCB0YXJnZXRcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIGV4dGVuZCh0YXJnZXQgLyosIHNvdXJjZXMgKi8pIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2VzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgIHZhciBzb3VyY2UsIGksIHByb3A7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgc291cmNlID0gc291cmNlc1tpXTtcblxuICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHdlIGNvcHkgKG93bikgdG9TdHJpbmcgbWV0aG9kIGV2ZW4gd2hlbiBpbiBKU2NyaXB0IHdpdGggRG9udEVudW0gYnVnXG4gICAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL2RvY3MvRUNNQVNjcmlwdF9Eb250RW51bV9hdHRyaWJ1dGUjSlNjcmlwdF9Eb250RW51bV9CdWdcbiAgICAgICAgICAgICAgICBpZiAoaGFzRG9udEVudW1CdWcgJiYgc291cmNlLmhhc093blByb3BlcnR5KFwidG9TdHJpbmdcIikgJiYgc291cmNlLnRvU3RyaW5nICE9PSB0YXJnZXQudG9TdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnRvU3RyaW5nID0gc291cmNlLnRvU3RyaW5nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLmV4dGVuZCA9IGV4dGVuZDtcbiAgICAgICAgcmV0dXJuIHNpbm9uLmV4dGVuZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi91dGlsL2NvcmVcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKi9cbi8qKlxuICogRm9ybWF0IGZ1bmN0aW9uc1xuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTQgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwsIGZvcm1hdGlvKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIHZhbHVlRm9ybWF0dGVyKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJcIiArIHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Rm9ybWF0aW9Gb3JtYXR0ZXIoKSB7XG4gICAgICAgICAgICB2YXIgZm9ybWF0dGVyID0gZm9ybWF0aW8uY29uZmlndXJlKHtcbiAgICAgICAgICAgICAgICAgICAgcXVvdGVTdHJpbmdzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbGltaXRDaGlsZHJlbkNvdW50OiAyNTBcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gZm9ybWF0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXR0ZXIuYXNjaWkuYXBwbHkoZm9ybWF0dGVyLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Tm9kZUZvcm1hdHRlcigpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIHV0aWwgPSByZXF1aXJlKFwidXRpbFwiKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvKiBOb2RlLCBidXQgbm8gdXRpbCBtb2R1bGUgLSB3b3VsZCBiZSB2ZXJ5IG9sZCwgYnV0IGJldHRlciBzYWZlIHRoYW4gc29ycnkgKi9cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gZm9ybWF0KHYpIHtcbiAgICAgICAgICAgICAgICB2YXIgaXNPYmplY3RXaXRoTmF0aXZlVG9TdHJpbmcgPSB0eXBlb2YgdiA9PT0gXCJvYmplY3RcIiAmJiB2LnRvU3RyaW5nID09PSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuICAgICAgICAgICAgICAgIHJldHVybiBpc09iamVjdFdpdGhOYXRpdmVUb1N0cmluZyA/IHV0aWwuaW5zcGVjdCh2KSA6IHY7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB1dGlsID8gZm9ybWF0IDogdmFsdWVGb3JtYXR0ZXI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgICAgICB2YXIgZm9ybWF0dGVyO1xuXG4gICAgICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0aW8gPSByZXF1aXJlKFwiZm9ybWF0aW9cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1lbXB0eVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZvcm1hdGlvKSB7XG4gICAgICAgICAgICBmb3JtYXR0ZXIgPSBnZXRGb3JtYXRpb0Zvcm1hdHRlcigpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzTm9kZSkge1xuICAgICAgICAgICAgZm9ybWF0dGVyID0gZ2V0Tm9kZUZvcm1hdHRlcigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9ybWF0dGVyID0gdmFsdWVGb3JtYXR0ZXI7XG4gICAgICAgIH1cblxuICAgICAgICBzaW5vbi5mb3JtYXQgPSBmb3JtYXR0ZXI7XG4gICAgICAgIHJldHVybiBzaW5vbi5mb3JtYXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgdHlwZW9mIGZvcm1hdGlvID09PSBcIm9iamVjdFwiICYmIGZvcm1hdGlvIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICovXG4vKipcbiAqIExvZ3MgZXJyb3JzXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxNCBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLy8gY2FjaGUgYSByZWZlcmVuY2UgdG8gc2V0VGltZW91dCwgc28gdGhhdCBvdXIgcmVmZXJlbmNlIHdvbid0IGJlIHN0dWJiZWQgb3V0XG4gICAgLy8gd2hlbiB1c2luZyBmYWtlIHRpbWVycyBhbmQgZXJyb3JzIHdpbGwgc3RpbGwgZ2V0IGxvZ2dlZFxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9jam9oYW5zZW4vU2lub24uSlMvaXNzdWVzLzM4MVxuICAgIHZhciByZWFsU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gbG9nKCkge31cblxuICAgICAgICBmdW5jdGlvbiBsb2dFcnJvcihsYWJlbCwgZXJyKSB7XG4gICAgICAgICAgICB2YXIgbXNnID0gbGFiZWwgKyBcIiB0aHJldyBleGNlcHRpb246IFwiO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiB0aHJvd0xvZ2dlZEVycm9yKCkge1xuICAgICAgICAgICAgICAgIGVyci5tZXNzYWdlID0gbXNnICsgZXJyLm1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzaW5vbi5sb2cobXNnICsgXCJbXCIgKyBlcnIubmFtZSArIFwiXSBcIiArIGVyci5tZXNzYWdlKTtcblxuICAgICAgICAgICAgaWYgKGVyci5zdGFjaykge1xuICAgICAgICAgICAgICAgIHNpbm9uLmxvZyhlcnIuc3RhY2spO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobG9nRXJyb3IudXNlSW1tZWRpYXRlRXhjZXB0aW9ucykge1xuICAgICAgICAgICAgICAgIHRocm93TG9nZ2VkRXJyb3IoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3Iuc2V0VGltZW91dCh0aHJvd0xvZ2dlZEVycm9yLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoZW4gc2V0IHRvIHRydWUsIGFueSBlcnJvcnMgbG9nZ2VkIHdpbGwgYmUgdGhyb3duIGltbWVkaWF0ZWx5O1xuICAgICAgICAvLyBJZiBzZXQgdG8gZmFsc2UsIHRoZSBlcnJvcnMgd2lsbCBiZSB0aHJvd24gaW4gc2VwYXJhdGUgZXhlY3V0aW9uIGZyYW1lLlxuICAgICAgICBsb2dFcnJvci51c2VJbW1lZGlhdGVFeGNlcHRpb25zID0gZmFsc2U7XG5cbiAgICAgICAgLy8gd3JhcCByZWFsU2V0VGltZW91dCB3aXRoIHNvbWV0aGluZyB3ZSBjYW4gc3R1YiBpbiB0ZXN0c1xuICAgICAgICBsb2dFcnJvci5zZXRUaW1lb3V0ID0gZnVuY3Rpb24gKGZ1bmMsIHRpbWVvdXQpIHtcbiAgICAgICAgICAgIHJlYWxTZXRUaW1lb3V0KGZ1bmMsIHRpbWVvdXQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBleHBvcnRzID0ge307XG4gICAgICAgIGV4cG9ydHMubG9nID0gc2lub24ubG9nID0gbG9nO1xuICAgICAgICBleHBvcnRzLmxvZ0Vycm9yID0gc2lub24ubG9nRXJyb3IgPSBsb2dFcnJvcjtcblxuICAgICAgICByZXR1cm4gZXhwb3J0cztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi91dGlsL2NvcmVcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIHR5cGVPZi5qc1xuICovXG4vKmpzbGludCBlcWVxZXE6IGZhbHNlLCBvbmV2YXI6IGZhbHNlLCBwbHVzcGx1czogZmFsc2UqL1xuLypnbG9iYWwgbW9kdWxlLCByZXF1aXJlLCBzaW5vbiovXG4vKipcbiAqIE1hdGNoIGZ1bmN0aW9uc1xuICpcbiAqIEBhdXRob3IgTWF4aW1pbGlhbiBBbnRvbmkgKG1haWxAbWF4YW50b25pLmRlKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEyIE1heGltaWxpYW4gQW50b25pXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgZnVuY3Rpb24gYXNzZXJ0VHlwZSh2YWx1ZSwgdHlwZSwgbmFtZSkge1xuICAgICAgICAgICAgdmFyIGFjdHVhbCA9IHNpbm9uLnR5cGVPZih2YWx1ZSk7XG4gICAgICAgICAgICBpZiAoYWN0dWFsICE9PSB0eXBlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkV4cGVjdGVkIHR5cGUgb2YgXCIgKyBuYW1lICsgXCIgdG8gYmUgXCIgK1xuICAgICAgICAgICAgICAgICAgICB0eXBlICsgXCIsIGJ1dCB3YXMgXCIgKyBhY3R1YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG1hdGNoZXIgPSB7XG4gICAgICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1lc3NhZ2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gaXNNYXRjaGVyKG9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoZXIuaXNQcm90b3R5cGVPZihvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbWF0Y2hPYmplY3QoZXhwZWN0YXRpb24sIGFjdHVhbCkge1xuICAgICAgICAgICAgaWYgKGFjdHVhbCA9PT0gbnVsbCB8fCBhY3R1YWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBleHBlY3RhdGlvbikge1xuICAgICAgICAgICAgICAgIGlmIChleHBlY3RhdGlvbi5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBleHAgPSBleHBlY3RhdGlvbltrZXldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWN0ID0gYWN0dWFsW2tleV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc01hdGNoZXIoZXhwKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFleHAudGVzdChhY3QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNpbm9uLnR5cGVPZihleHApID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW1hdGNoT2JqZWN0KGV4cCwgYWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghc2lub24uZGVlcEVxdWFsKGV4cCwgYWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBtYXRjaChleHBlY3RhdGlvbiwgbWVzc2FnZSkge1xuICAgICAgICAgICAgdmFyIG0gPSBzaW5vbi5jcmVhdGUobWF0Y2hlcik7XG4gICAgICAgICAgICB2YXIgdHlwZSA9IHNpbm9uLnR5cGVPZihleHBlY3RhdGlvbik7XG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJvYmplY3RcIjpcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGF0aW9uLnRlc3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBtLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0YXRpb24udGVzdChhY3R1YWwpID09PSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBtLm1lc3NhZ2UgPSBcIm1hdGNoKFwiICsgc2lub24uZnVuY3Rpb25OYW1lKGV4cGVjdGF0aW9uLnRlc3QpICsgXCIpXCI7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgc3RyID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHBlY3RhdGlvbi5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHIucHVzaChrZXkgKyBcIjogXCIgKyBleHBlY3RhdGlvbltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaE9iamVjdChleHBlY3RhdGlvbiwgYWN0dWFsKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIG0ubWVzc2FnZSA9IFwibWF0Y2goXCIgKyBzdHIuam9pbihcIiwgXCIpICsgXCIpXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgICAgICAgICAgbS50ZXN0ID0gZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBuZWVkIHR5cGUgY29lcmNpb24gaGVyZVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0YXRpb24gPT0gYWN0dWFsOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgICAgICAgICAgbS50ZXN0ID0gZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdHVhbCAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY3R1YWwuaW5kZXhPZihleHBlY3RhdGlvbikgIT09IC0xO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgbS5tZXNzYWdlID0gXCJtYXRjaChcXFwiXCIgKyBleHBlY3RhdGlvbiArIFwiXFxcIilcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJyZWdleHBcIjpcbiAgICAgICAgICAgICAgICBtLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYWN0dWFsICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdGF0aW9uLnRlc3QoYWN0dWFsKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgICAgICAgICAgbS50ZXN0ID0gZXhwZWN0YXRpb247XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbS5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtLm1lc3NhZ2UgPSBcIm1hdGNoKFwiICsgc2lub24uZnVuY3Rpb25OYW1lKGV4cGVjdGF0aW9uKSArIFwiKVwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgbS50ZXN0ID0gZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2lub24uZGVlcEVxdWFsKGV4cGVjdGF0aW9uLCBhY3R1YWwpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW0ubWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIG0ubWVzc2FnZSA9IFwibWF0Y2goXCIgKyBleHBlY3RhdGlvbiArIFwiKVwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgIH1cblxuICAgICAgICBtYXRjaGVyLm9yID0gZnVuY3Rpb24gKG0yKSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiTWF0Y2hlciBleHBlY3RlZFwiKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWlzTWF0Y2hlcihtMikpIHtcbiAgICAgICAgICAgICAgICBtMiA9IG1hdGNoKG0yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBtMSA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgb3IgPSBzaW5vbi5jcmVhdGUobWF0Y2hlcik7XG4gICAgICAgICAgICBvci50ZXN0ID0gZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtMS50ZXN0KGFjdHVhbCkgfHwgbTIudGVzdChhY3R1YWwpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG9yLm1lc3NhZ2UgPSBtMS5tZXNzYWdlICsgXCIub3IoXCIgKyBtMi5tZXNzYWdlICsgXCIpXCI7XG4gICAgICAgICAgICByZXR1cm4gb3I7XG4gICAgICAgIH07XG5cbiAgICAgICAgbWF0Y2hlci5hbmQgPSBmdW5jdGlvbiAobTIpIHtcbiAgICAgICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJNYXRjaGVyIGV4cGVjdGVkXCIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghaXNNYXRjaGVyKG0yKSkge1xuICAgICAgICAgICAgICAgIG0yID0gbWF0Y2gobTIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG0xID0gdGhpcztcbiAgICAgICAgICAgIHZhciBhbmQgPSBzaW5vbi5jcmVhdGUobWF0Y2hlcik7XG4gICAgICAgICAgICBhbmQudGVzdCA9IGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbTEudGVzdChhY3R1YWwpICYmIG0yLnRlc3QoYWN0dWFsKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhbmQubWVzc2FnZSA9IG0xLm1lc3NhZ2UgKyBcIi5hbmQoXCIgKyBtMi5tZXNzYWdlICsgXCIpXCI7XG4gICAgICAgICAgICByZXR1cm4gYW5kO1xuICAgICAgICB9O1xuXG4gICAgICAgIG1hdGNoLmlzTWF0Y2hlciA9IGlzTWF0Y2hlcjtcblxuICAgICAgICBtYXRjaC5hbnkgPSBtYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSwgXCJhbnlcIik7XG5cbiAgICAgICAgbWF0Y2guZGVmaW5lZCA9IG1hdGNoKGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgIHJldHVybiBhY3R1YWwgIT09IG51bGwgJiYgYWN0dWFsICE9PSB1bmRlZmluZWQ7XG4gICAgICAgIH0sIFwiZGVmaW5lZFwiKTtcblxuICAgICAgICBtYXRjaC50cnV0aHkgPSBtYXRjaChmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICByZXR1cm4gISFhY3R1YWw7XG4gICAgICAgIH0sIFwidHJ1dGh5XCIpO1xuXG4gICAgICAgIG1hdGNoLmZhbHN5ID0gbWF0Y2goZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgcmV0dXJuICFhY3R1YWw7XG4gICAgICAgIH0sIFwiZmFsc3lcIik7XG5cbiAgICAgICAgbWF0Y2guc2FtZSA9IGZ1bmN0aW9uIChleHBlY3RhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoKGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0YXRpb24gPT09IGFjdHVhbDtcbiAgICAgICAgICAgIH0sIFwic2FtZShcIiArIGV4cGVjdGF0aW9uICsgXCIpXCIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIG1hdGNoLnR5cGVPZiA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICBhc3NlcnRUeXBlKHR5cGUsIFwic3RyaW5nXCIsIFwidHlwZVwiKTtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaChmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLnR5cGVPZihhY3R1YWwpID09PSB0eXBlO1xuICAgICAgICAgICAgfSwgXCJ0eXBlT2YoXFxcIlwiICsgdHlwZSArIFwiXFxcIilcIik7XG4gICAgICAgIH07XG5cbiAgICAgICAgbWF0Y2guaW5zdGFuY2VPZiA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICBhc3NlcnRUeXBlKHR5cGUsIFwiZnVuY3Rpb25cIiwgXCJ0eXBlXCIpO1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoKGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYWN0dWFsIGluc3RhbmNlb2YgdHlwZTtcbiAgICAgICAgICAgIH0sIFwiaW5zdGFuY2VPZihcIiArIHNpbm9uLmZ1bmN0aW9uTmFtZSh0eXBlKSArIFwiKVwiKTtcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVQcm9wZXJ0eU1hdGNoZXIocHJvcGVydHlUZXN0LCBtZXNzYWdlUHJlZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHByb3BlcnR5LCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGFzc2VydFR5cGUocHJvcGVydHksIFwic3RyaW5nXCIsIFwicHJvcGVydHlcIik7XG4gICAgICAgICAgICAgICAgdmFyIG9ubHlQcm9wZXJ0eSA9IGFyZ3VtZW50cy5sZW5ndGggPT09IDE7XG4gICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSBtZXNzYWdlUHJlZml4ICsgXCIoXFxcIlwiICsgcHJvcGVydHkgKyBcIlxcXCJcIjtcbiAgICAgICAgICAgICAgICBpZiAoIW9ubHlQcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlICs9IFwiLCBcIiArIHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtZXNzYWdlICs9IFwiKVwiO1xuICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaChmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY3R1YWwgPT09IHVuZGVmaW5lZCB8fCBhY3R1YWwgPT09IG51bGwgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAhcHJvcGVydHlUZXN0KGFjdHVhbCwgcHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9ubHlQcm9wZXJ0eSB8fCBzaW5vbi5kZWVwRXF1YWwodmFsdWUsIGFjdHVhbFtwcm9wZXJ0eV0pO1xuICAgICAgICAgICAgICAgIH0sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdGNoLmhhcyA9IGNyZWF0ZVByb3BlcnR5TWF0Y2hlcihmdW5jdGlvbiAoYWN0dWFsLCBwcm9wZXJ0eSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhY3R1YWwgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvcGVydHkgaW4gYWN0dWFsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGFjdHVhbFtwcm9wZXJ0eV0gIT09IHVuZGVmaW5lZDtcbiAgICAgICAgfSwgXCJoYXNcIik7XG5cbiAgICAgICAgbWF0Y2guaGFzT3duID0gY3JlYXRlUHJvcGVydHlNYXRjaGVyKGZ1bmN0aW9uIChhY3R1YWwsIHByb3BlcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gYWN0dWFsLmhhc093blByb3BlcnR5KHByb3BlcnR5KTtcbiAgICAgICAgfSwgXCJoYXNPd25cIik7XG5cbiAgICAgICAgbWF0Y2guYm9vbCA9IG1hdGNoLnR5cGVPZihcImJvb2xlYW5cIik7XG4gICAgICAgIG1hdGNoLm51bWJlciA9IG1hdGNoLnR5cGVPZihcIm51bWJlclwiKTtcbiAgICAgICAgbWF0Y2guc3RyaW5nID0gbWF0Y2gudHlwZU9mKFwic3RyaW5nXCIpO1xuICAgICAgICBtYXRjaC5vYmplY3QgPSBtYXRjaC50eXBlT2YoXCJvYmplY3RcIik7XG4gICAgICAgIG1hdGNoLmZ1bmMgPSBtYXRjaC50eXBlT2YoXCJmdW5jdGlvblwiKTtcbiAgICAgICAgbWF0Y2guYXJyYXkgPSBtYXRjaC50eXBlT2YoXCJhcnJheVwiKTtcbiAgICAgICAgbWF0Y2gucmVnZXhwID0gbWF0Y2gudHlwZU9mKFwicmVnZXhwXCIpO1xuICAgICAgICBtYXRjaC5kYXRlID0gbWF0Y2gudHlwZU9mKFwiZGF0ZVwiKTtcblxuICAgICAgICBzaW5vbi5tYXRjaCA9IG1hdGNoO1xuICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vdHlwZU9mXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdGltZXNfaW5fd29yZHMuanNcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIGNhbGwuanNcbiAqIEBkZXBlbmQgZXh0ZW5kLmpzXG4gKiBAZGVwZW5kIG1hdGNoLmpzXG4gKiBAZGVwZW5kIHNweS5qc1xuICogQGRlcGVuZCBzdHViLmpzXG4gKiBAZGVwZW5kIGZvcm1hdC5qc1xuICovXG4vKipcbiAqIE1vY2sgZnVuY3Rpb25zLlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgdmFyIHB1c2ggPSBbXS5wdXNoO1xuICAgICAgICB2YXIgbWF0Y2ggPSBzaW5vbi5tYXRjaDtcblxuICAgICAgICBmdW5jdGlvbiBtb2NrKG9iamVjdCkge1xuICAgICAgICAgICAgLy8gaWYgKHR5cGVvZiBjb25zb2xlICE9PSB1bmRlZmluZWQgJiYgY29uc29sZS53YXJuKSB7XG4gICAgICAgICAgICAvLyAgICAgY29uc29sZS53YXJuKFwibW9jayB3aWxsIGJlIHJlbW92ZWQgZnJvbSBTaW5vbi5KUyB2Mi4wXCIpO1xuICAgICAgICAgICAgLy8gfVxuXG4gICAgICAgICAgICBpZiAoIW9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaW5vbi5leHBlY3RhdGlvbi5jcmVhdGUoXCJBbm9ueW1vdXMgbW9ja1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vY2suY3JlYXRlKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBlYWNoKGNvbGxlY3Rpb24sIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBpZiAoIWNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY29sbGVjdGlvbi5sZW5ndGg7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhjb2xsZWN0aW9uW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGFycmF5RXF1YWxzKGFycjEsIGFycjIsIGNvbXBhcmVMZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChjb21wYXJlTGVuZ3RoICYmIChhcnIxLmxlbmd0aCAhPT0gYXJyMi5sZW5ndGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGFycjEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzaW5vbi5kZWVwRXF1YWwoYXJyMVtpXSwgYXJyMltpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgc2lub24uZXh0ZW5kKG1vY2ssIHtcbiAgICAgICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gY3JlYXRlKG9iamVjdCkge1xuICAgICAgICAgICAgICAgIGlmICghb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJvYmplY3QgaXMgbnVsbFwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgbW9ja09iamVjdCA9IHNpbm9uLmV4dGVuZCh7fSwgbW9jayk7XG4gICAgICAgICAgICAgICAgbW9ja09iamVjdC5vYmplY3QgPSBvYmplY3Q7XG4gICAgICAgICAgICAgICAgZGVsZXRlIG1vY2tPYmplY3QuY3JlYXRlO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vY2tPYmplY3Q7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBleHBlY3RzOiBmdW5jdGlvbiBleHBlY3RzKG1ldGhvZCkge1xuICAgICAgICAgICAgICAgIGlmICghbWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJtZXRob2QgaXMgZmFsc3lcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmV4cGVjdGF0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4cGVjdGF0aW9ucyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb3hpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZXhwZWN0YXRpb25zW21ldGhvZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5leHBlY3RhdGlvbnNbbWV0aG9kXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbW9ja09iamVjdCA9IHRoaXM7XG5cbiAgICAgICAgICAgICAgICAgICAgc2lub24ud3JhcE1ldGhvZCh0aGlzLm9iamVjdCwgbWV0aG9kLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9ja09iamVjdC5pbnZva2VNZXRob2QobWV0aG9kLCB0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5wcm94aWVzLCBtZXRob2QpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBleHBlY3RhdGlvbiA9IHNpbm9uLmV4cGVjdGF0aW9uLmNyZWF0ZShtZXRob2QpO1xuICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLmV4cGVjdGF0aW9uc1ttZXRob2RdLCBleHBlY3RhdGlvbik7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0YXRpb247XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiByZXN0b3JlKCkge1xuICAgICAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLm9iamVjdDtcblxuICAgICAgICAgICAgICAgIGVhY2godGhpcy5wcm94aWVzLCBmdW5jdGlvbiAocHJveHkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmplY3RbcHJveHldLnJlc3RvcmUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W3Byb3h5XS5yZXN0b3JlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHZlcmlmeTogZnVuY3Rpb24gdmVyaWZ5KCkge1xuICAgICAgICAgICAgICAgIHZhciBleHBlY3RhdGlvbnMgPSB0aGlzLmV4cGVjdGF0aW9ucyB8fCB7fTtcbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgbWV0ID0gW107XG5cbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMucHJveGllcywgZnVuY3Rpb24gKHByb3h5KSB7XG4gICAgICAgICAgICAgICAgICAgIGVhY2goZXhwZWN0YXRpb25zW3Byb3h5XSwgZnVuY3Rpb24gKGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWV4cGVjdGF0aW9uLm1ldCgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKG1lc3NhZ2VzLCBleHBlY3RhdGlvbi50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKG1ldCwgZXhwZWN0YXRpb24udG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5yZXN0b3JlKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAobWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKG1lc3NhZ2VzLmNvbmNhdChtZXQpLmpvaW4oXCJcXG5cIikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWV0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24ucGFzcyhtZXNzYWdlcy5jb25jYXQobWV0KS5qb2luKFwiXFxuXCIpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGludm9rZU1ldGhvZDogZnVuY3Rpb24gaW52b2tlTWV0aG9kKG1ldGhvZCwgdGhpc1ZhbHVlLCBhcmdzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGF0aW9ucyA9IHRoaXMuZXhwZWN0YXRpb25zICYmIHRoaXMuZXhwZWN0YXRpb25zW21ldGhvZF0gPyB0aGlzLmV4cGVjdGF0aW9uc1ttZXRob2RdIDogW107XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3MgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudEFyZ3MgPSBhcmdzIHx8IFtdO1xuICAgICAgICAgICAgICAgIHZhciBpLCBhdmFpbGFibGU7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZXhwZWN0YXRpb25zLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBleHBlY3RlZEFyZ3MgPSBleHBlY3RhdGlvbnNbaV0uZXhwZWN0ZWRBcmd1bWVudHMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcnJheUVxdWFscyhleHBlY3RlZEFyZ3MsIGN1cnJlbnRBcmdzLCBleHBlY3RhdGlvbnNbaV0uZXhwZWN0c0V4YWN0QXJnQ291bnQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzLnB1c2goZXhwZWN0YXRpb25zW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXhwZWN0YXRpb25zV2l0aE1hdGNoaW5nQXJnc1tpXS5tZXQoKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0YXRpb25zV2l0aE1hdGNoaW5nQXJnc1tpXS5hbGxvd3NDYWxsKHRoaXNWYWx1ZSwgYXJncykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzW2ldLmFwcGx5KHRoaXNWYWx1ZSwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgZXhoYXVzdGVkID0gMDtcblxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzW2ldLmFsbG93c0NhbGwodGhpc1ZhbHVlLCBhcmdzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlID0gYXZhaWxhYmxlIHx8IGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3NbaV07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGhhdXN0ZWQgKz0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhdmFpbGFibGUgJiYgZXhoYXVzdGVkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhdmFpbGFibGUuYXBwbHkodGhpc1ZhbHVlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZXhwZWN0YXRpb25zLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChtZXNzYWdlcywgXCIgICAgXCIgKyBleHBlY3RhdGlvbnNbaV0udG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWVzc2FnZXMudW5zaGlmdChcIlVuZXhwZWN0ZWQgY2FsbDogXCIgKyBzaW5vbi5zcHlDYWxsLnRvU3RyaW5nLmNhbGwoe1xuICAgICAgICAgICAgICAgICAgICBwcm94eTogbWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBhcmdzXG4gICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24uZmFpbChtZXNzYWdlcy5qb2luKFwiXFxuXCIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHRpbWVzID0gc2lub24udGltZXNJbldvcmRzO1xuICAgICAgICB2YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbiAgICAgICAgZnVuY3Rpb24gY2FsbENvdW50SW5Xb3JkcyhjYWxsQ291bnQpIHtcbiAgICAgICAgICAgIGlmIChjYWxsQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJuZXZlciBjYWxsZWRcIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIFwiY2FsbGVkIFwiICsgdGltZXMoY2FsbENvdW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGV4cGVjdGVkQ2FsbENvdW50SW5Xb3JkcyhleHBlY3RhdGlvbikge1xuICAgICAgICAgICAgdmFyIG1pbiA9IGV4cGVjdGF0aW9uLm1pbkNhbGxzO1xuICAgICAgICAgICAgdmFyIG1heCA9IGV4cGVjdGF0aW9uLm1heENhbGxzO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIG1pbiA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2YgbWF4ID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0ciA9IHRpbWVzKG1pbik7XG5cbiAgICAgICAgICAgICAgICBpZiAobWluICE9PSBtYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyID0gXCJhdCBsZWFzdCBcIiArIHN0ciArIFwiIGFuZCBhdCBtb3N0IFwiICsgdGltZXMobWF4KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIG1pbiA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBcImF0IGxlYXN0IFwiICsgdGltZXMobWluKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIFwiYXQgbW9zdCBcIiArIHRpbWVzKG1heCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiByZWNlaXZlZE1pbkNhbGxzKGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICB2YXIgaGFzTWluTGltaXQgPSB0eXBlb2YgZXhwZWN0YXRpb24ubWluQ2FsbHMgPT09IFwibnVtYmVyXCI7XG4gICAgICAgICAgICByZXR1cm4gIWhhc01pbkxpbWl0IHx8IGV4cGVjdGF0aW9uLmNhbGxDb3VudCA+PSBleHBlY3RhdGlvbi5taW5DYWxscztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVkTWF4Q2FsbHMoZXhwZWN0YXRpb24pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0YXRpb24ubWF4Q2FsbHMgIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBleHBlY3RhdGlvbi5jYWxsQ291bnQgPT09IGV4cGVjdGF0aW9uLm1heENhbGxzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gdmVyaWZ5TWF0Y2hlcihwb3NzaWJsZU1hdGNoZXIsIGFyZykge1xuICAgICAgICAgICAgdmFyIGlzTWF0Y2hlciA9IG1hdGNoICYmIG1hdGNoLmlzTWF0Y2hlcihwb3NzaWJsZU1hdGNoZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4gaXNNYXRjaGVyICYmIHBvc3NpYmxlTWF0Y2hlci50ZXN0KGFyZykgfHwgdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uID0ge1xuICAgICAgICAgICAgbWluQ2FsbHM6IDEsXG4gICAgICAgICAgICBtYXhDYWxsczogMSxcblxuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiBjcmVhdGUobWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBleHBlY3RhdGlvbiA9IHNpbm9uLmV4dGVuZChzaW5vbi5zdHViLmNyZWF0ZSgpLCBzaW5vbi5leHBlY3RhdGlvbik7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGV4cGVjdGF0aW9uLmNyZWF0ZTtcbiAgICAgICAgICAgICAgICBleHBlY3RhdGlvbi5tZXRob2QgPSBtZXRob2ROYW1lO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdGF0aW9uO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaW52b2tlOiBmdW5jdGlvbiBpbnZva2UoZnVuYywgdGhpc1ZhbHVlLCBhcmdzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy52ZXJpZnlDYWxsQWxsb3dlZCh0aGlzVmFsdWUsIGFyZ3MpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLnNweS5pbnZva2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGF0TGVhc3Q6IGZ1bmN0aW9uIGF0TGVhc3QobnVtKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBudW0gIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIidcIiArIG51bSArIFwiJyBpcyBub3QgbnVtYmVyXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5saW1pdHNTZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXhDYWxscyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGltaXRzU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLm1pbkNhbGxzID0gbnVtO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBhdE1vc3Q6IGZ1bmN0aW9uIGF0TW9zdChudW0pIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG51bSAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiJ1wiICsgbnVtICsgXCInIGlzIG5vdCBudW1iZXJcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmxpbWl0c1NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1pbkNhbGxzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saW1pdHNTZXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMubWF4Q2FsbHMgPSBudW07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG5ldmVyOiBmdW5jdGlvbiBuZXZlcigpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5leGFjdGx5KDApO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25jZTogZnVuY3Rpb24gb25jZSgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5leGFjdGx5KDEpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdHdpY2U6IGZ1bmN0aW9uIHR3aWNlKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4YWN0bHkoMik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB0aHJpY2U6IGZ1bmN0aW9uIHRocmljZSgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5leGFjdGx5KDMpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZXhhY3RseTogZnVuY3Rpb24gZXhhY3RseShudW0pIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG51bSAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiJ1wiICsgbnVtICsgXCInIGlzIG5vdCBhIG51bWJlclwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmF0TGVhc3QobnVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hdE1vc3QobnVtKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG1ldDogZnVuY3Rpb24gbWV0KCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhdGhpcy5mYWlsZWQgJiYgcmVjZWl2ZWRNaW5DYWxscyh0aGlzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHZlcmlmeUNhbGxBbGxvd2VkOiBmdW5jdGlvbiB2ZXJpZnlDYWxsQWxsb3dlZCh0aGlzVmFsdWUsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVjZWl2ZWRNYXhDYWxscyh0aGlzKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLmZhaWwodGhpcy5tZXRob2QgKyBcIiBhbHJlYWR5IGNhbGxlZCBcIiArIHRpbWVzKHRoaXMubWF4Q2FsbHMpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoXCJleHBlY3RlZFRoaXNcIiBpbiB0aGlzICYmIHRoaXMuZXhwZWN0ZWRUaGlzICE9PSB0aGlzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24uZmFpbCh0aGlzLm1ldGhvZCArIFwiIGNhbGxlZCB3aXRoIFwiICsgdGhpc1ZhbHVlICsgXCIgYXMgdGhpc1ZhbHVlLCBleHBlY3RlZCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4cGVjdGVkVGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCEoXCJleHBlY3RlZEFyZ3VtZW50c1wiIGluIHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24uZmFpbCh0aGlzLm1ldGhvZCArIFwiIHJlY2VpdmVkIG5vIGFyZ3VtZW50cywgZXhwZWN0ZWQgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lub24uZm9ybWF0KHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPCB0aGlzLmV4cGVjdGVkQXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMubWV0aG9kICsgXCIgcmVjZWl2ZWQgdG9vIGZldyBhcmd1bWVudHMgKFwiICsgc2lub24uZm9ybWF0KGFyZ3MpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiKSwgZXhwZWN0ZWQgXCIgKyBzaW5vbi5mb3JtYXQodGhpcy5leHBlY3RlZEFyZ3VtZW50cykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmV4cGVjdHNFeGFjdEFyZ0NvdW50ICYmXG4gICAgICAgICAgICAgICAgICAgIGFyZ3MubGVuZ3RoICE9PSB0aGlzLmV4cGVjdGVkQXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMubWV0aG9kICsgXCIgcmVjZWl2ZWQgdG9vIG1hbnkgYXJndW1lbnRzIChcIiArIHNpbm9uLmZvcm1hdChhcmdzKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiksIGV4cGVjdGVkIFwiICsgc2lub24uZm9ybWF0KHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF2ZXJpZnlNYXRjaGVyKHRoaXMuZXhwZWN0ZWRBcmd1bWVudHNbaV0sIGFyZ3NbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMubWV0aG9kICsgXCIgcmVjZWl2ZWQgd3JvbmcgYXJndW1lbnRzIFwiICsgc2lub24uZm9ybWF0KGFyZ3MpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiwgZGlkbid0IG1hdGNoIFwiICsgdGhpcy5leHBlY3RlZEFyZ3VtZW50cy50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghc2lub24uZGVlcEVxdWFsKHRoaXMuZXhwZWN0ZWRBcmd1bWVudHNbaV0sIGFyZ3NbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMubWV0aG9kICsgXCIgcmVjZWl2ZWQgd3JvbmcgYXJndW1lbnRzIFwiICsgc2lub24uZm9ybWF0KGFyZ3MpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiwgZXhwZWN0ZWQgXCIgKyBzaW5vbi5mb3JtYXQodGhpcy5leHBlY3RlZEFyZ3VtZW50cykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgYWxsb3dzQ2FsbDogZnVuY3Rpb24gYWxsb3dzQ2FsbCh0aGlzVmFsdWUsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXQoKSAmJiByZWNlaXZlZE1heENhbGxzKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoXCJleHBlY3RlZFRoaXNcIiBpbiB0aGlzICYmIHRoaXMuZXhwZWN0ZWRUaGlzICE9PSB0aGlzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghKFwiZXhwZWN0ZWRBcmd1bWVudHNcIiBpbiB0aGlzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhcmdzID0gYXJncyB8fCBbXTtcblxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8IHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5leHBlY3RzRXhhY3RBcmdDb3VudCAmJlxuICAgICAgICAgICAgICAgICAgICBhcmdzLmxlbmd0aCAhPT0gdGhpcy5leHBlY3RlZEFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5leHBlY3RlZEFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF2ZXJpZnlNYXRjaGVyKHRoaXMuZXhwZWN0ZWRBcmd1bWVudHNbaV0sIGFyZ3NbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXNpbm9uLmRlZXBFcXVhbCh0aGlzLmV4cGVjdGVkQXJndW1lbnRzW2ldLCBhcmdzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB3aXRoQXJnczogZnVuY3Rpb24gd2l0aEFyZ3MoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leHBlY3RlZEFyZ3VtZW50cyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHdpdGhFeGFjdEFyZ3M6IGZ1bmN0aW9uIHdpdGhFeGFjdEFyZ3MoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aXRoQXJncy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhwZWN0c0V4YWN0QXJnQ291bnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb246IGZ1bmN0aW9uIG9uKHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZXhwZWN0ZWRUaGlzID0gdGhpc1ZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdG9TdHJpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9ICh0aGlzLmV4cGVjdGVkQXJndW1lbnRzIHx8IFtdKS5zbGljZSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmV4cGVjdHNFeGFjdEFyZ0NvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChhcmdzLCBcIlsuLi5dXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBjYWxsU3RyID0gc2lub24uc3B5Q2FsbC50b1N0cmluZy5jYWxsKHtcbiAgICAgICAgICAgICAgICAgICAgcHJveHk6IHRoaXMubWV0aG9kIHx8IFwiYW5vbnltb3VzIG1vY2sgZXhwZWN0YXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgYXJnczogYXJnc1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSBjYWxsU3RyLnJlcGxhY2UoXCIsIFsuLi5cIiwgXCJbLCAuLi5cIikgKyBcIiBcIiArXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQ2FsbENvdW50SW5Xb3Jkcyh0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1ldCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIkV4cGVjdGF0aW9uIG1ldDogXCIgKyBtZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBcIkV4cGVjdGVkIFwiICsgbWVzc2FnZSArIFwiIChcIiArXG4gICAgICAgICAgICAgICAgICAgIGNhbGxDb3VudEluV29yZHModGhpcy5jYWxsQ291bnQpICsgXCIpXCI7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB2ZXJpZnk6IGZ1bmN0aW9uIHZlcmlmeSgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubWV0KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24uZmFpbCh0aGlzLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLnBhc3ModGhpcy50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHBhc3M6IGZ1bmN0aW9uIHBhc3MobWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIHNpbm9uLmFzc2VydC5wYXNzKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZmFpbDogZnVuY3Rpb24gZmFpbChtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV4Y2VwdGlvbiA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBleGNlcHRpb24ubmFtZSA9IFwiRXhwZWN0YXRpb25FcnJvclwiO1xuXG4gICAgICAgICAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLm1vY2sgPSBtb2NrO1xuICAgICAgICByZXR1cm4gbW9jaztcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi90aW1lc19pbl93b3Jkc1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vY2FsbFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZXh0ZW5kXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9tYXRjaFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc3B5XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zdHViXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9mb3JtYXRcIik7XG5cbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCBleHRlbmQuanNcbiAqIEBkZXBlbmQgY29sbGVjdGlvbi5qc1xuICogQGRlcGVuZCB1dGlsL2Zha2VfdGltZXJzLmpzXG4gKiBAZGVwZW5kIHV0aWwvZmFrZV9zZXJ2ZXJfd2l0aF9jbG9jay5qc1xuICovXG4vKipcbiAqIE1hbmFnZXMgZmFrZSBjb2xsZWN0aW9ucyBhcyB3ZWxsIGFzIGZha2UgdXRpbGl0aWVzIHN1Y2ggYXMgU2lub24nc1xuICogdGltZXJzIGFuZCBmYWtlIFhIUiBpbXBsZW1lbnRhdGlvbiBpbiBvbmUgY29udmVuaWVudCBvYmplY3QuXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICB2YXIgcHVzaCA9IFtdLnB1c2g7XG5cbiAgICAgICAgZnVuY3Rpb24gZXhwb3NlVmFsdWUoc2FuZGJveCwgY29uZmlnLCBrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY29uZmlnLmluamVjdEludG8gJiYgIShrZXkgaW4gY29uZmlnLmluamVjdEludG8pKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnLmluamVjdEludG9ba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHNhbmRib3guaW5qZWN0ZWRLZXlzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHNhbmRib3guYXJncywgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcHJlcGFyZVNhbmRib3hGcm9tQ29uZmlnKGNvbmZpZykge1xuICAgICAgICAgICAgdmFyIHNhbmRib3ggPSBzaW5vbi5jcmVhdGUoc2lub24uc2FuZGJveCk7XG5cbiAgICAgICAgICAgIGlmIChjb25maWcudXNlRmFrZVNlcnZlcikge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29uZmlnLnVzZUZha2VTZXJ2ZXIgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2FuZGJveC5zZXJ2ZXJQcm90b3R5cGUgPSBjb25maWcudXNlRmFrZVNlcnZlcjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzYW5kYm94LnVzZUZha2VTZXJ2ZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNvbmZpZy51c2VGYWtlVGltZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb25maWcudXNlRmFrZVRpbWVycyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICBzYW5kYm94LnVzZUZha2VUaW1lcnMuYXBwbHkoc2FuZGJveCwgY29uZmlnLnVzZUZha2VUaW1lcnMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNhbmRib3gudXNlRmFrZVRpbWVycygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNhbmRib3g7XG4gICAgICAgIH1cblxuICAgICAgICBzaW5vbi5zYW5kYm94ID0gc2lub24uZXh0ZW5kKHNpbm9uLmNyZWF0ZShzaW5vbi5jb2xsZWN0aW9uKSwge1xuICAgICAgICAgICAgdXNlRmFrZVRpbWVyczogZnVuY3Rpb24gdXNlRmFrZVRpbWVycygpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2NrID0gc2lub24udXNlRmFrZVRpbWVycy5hcHBseShzaW5vbiwgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZCh0aGlzLmNsb2NrKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHNlcnZlclByb3RvdHlwZTogc2lub24uZmFrZVNlcnZlcixcblxuICAgICAgICAgICAgdXNlRmFrZVNlcnZlcjogZnVuY3Rpb24gdXNlRmFrZVNlcnZlcigpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvdG8gPSB0aGlzLnNlcnZlclByb3RvdHlwZSB8fCBzaW5vbi5mYWtlU2VydmVyO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFwcm90byB8fCAhcHJvdG8uY3JlYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2VydmVyID0gcHJvdG8uY3JlYXRlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHRoaXMuc2VydmVyKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGluamVjdDogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICAgICAgICAgIHNpbm9uLmNvbGxlY3Rpb24uaW5qZWN0LmNhbGwodGhpcywgb2JqKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iai5jbG9jayA9IHRoaXMuY2xvY2s7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2VydmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iai5zZXJ2ZXIgPSB0aGlzLnNlcnZlcjtcbiAgICAgICAgICAgICAgICAgICAgb2JqLnJlcXVlc3RzID0gdGhpcy5zZXJ2ZXIucmVxdWVzdHM7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgb2JqLm1hdGNoID0gc2lub24ubWF0Y2g7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzdG9yZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNpbm9uLmNvbGxlY3Rpb24ucmVzdG9yZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVzdG9yZUNvbnRleHQoKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlc3RvcmVDb250ZXh0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaW5qZWN0ZWRLZXlzKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBqID0gdGhpcy5pbmplY3RlZEtleXMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5pbmplY3RJbnRvW3RoaXMuaW5qZWN0ZWRLZXlzW2ldXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmluamVjdGVkS2V5cyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICAgICAgICAgIGlmICghY29uZmlnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzaW5vbi5jcmVhdGUoc2lub24uc2FuZGJveCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHNhbmRib3ggPSBwcmVwYXJlU2FuZGJveEZyb21Db25maWcoY29uZmlnKTtcbiAgICAgICAgICAgICAgICBzYW5kYm94LmFyZ3MgPSBzYW5kYm94LmFyZ3MgfHwgW107XG4gICAgICAgICAgICAgICAgc2FuZGJveC5pbmplY3RlZEtleXMgPSBbXTtcbiAgICAgICAgICAgICAgICBzYW5kYm94LmluamVjdEludG8gPSBjb25maWcuaW5qZWN0SW50bztcbiAgICAgICAgICAgICAgICB2YXIgcHJvcCxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU7XG4gICAgICAgICAgICAgICAgdmFyIGV4cG9zZWQgPSBzYW5kYm94LmluamVjdCh7fSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoY29uZmlnLnByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjb25maWcucHJvcGVydGllcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3AgPSBjb25maWcucHJvcGVydGllc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gZXhwb3NlZFtwcm9wXSB8fCBwcm9wID09PSBcInNhbmRib3hcIiAmJiBzYW5kYm94O1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3NlVmFsdWUoc2FuZGJveCwgY29uZmlnLCBwcm9wLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBleHBvc2VWYWx1ZShzYW5kYm94LCBjb25maWcsIFwic2FuZGJveFwiLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNhbmRib3g7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBtYXRjaDogc2lub24ubWF0Y2hcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2lub24uc2FuZGJveC51c2VGYWtlWE1MSHR0cFJlcXVlc3QgPSBzaW5vbi5zYW5kYm94LnVzZUZha2VTZXJ2ZXI7XG5cbiAgICAgICAgcmV0dXJuIHNpbm9uLnNhbmRib3g7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZXh0ZW5kXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi91dGlsL2Zha2Vfc2VydmVyX3dpdGhfY2xvY2tcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3V0aWwvZmFrZV90aW1lcnNcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2NvbGxlY3Rpb25cIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICAqIEBkZXBlbmQgdGltZXNfaW5fd29yZHMuanNcbiAgKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICAqIEBkZXBlbmQgZXh0ZW5kLmpzXG4gICogQGRlcGVuZCBjYWxsLmpzXG4gICogQGRlcGVuZCBmb3JtYXQuanNcbiAgKi9cbi8qKlxuICAqIFNweSBmdW5jdGlvbnNcbiAgKlxuICAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICAqIEBsaWNlbnNlIEJTRFxuICAqXG4gICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHZhciBwdXNoID0gQXJyYXkucHJvdG90eXBlLnB1c2g7XG4gICAgICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbiAgICAgICAgdmFyIGNhbGxJZCA9IDA7XG5cbiAgICAgICAgZnVuY3Rpb24gc3B5KG9iamVjdCwgcHJvcGVydHksIHR5cGVzKSB7XG4gICAgICAgICAgICBpZiAoIXByb3BlcnR5ICYmIHR5cGVvZiBvYmplY3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBzcHkuY3JlYXRlKG9iamVjdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghb2JqZWN0ICYmICFwcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzcHkuY3JlYXRlKGZ1bmN0aW9uICgpIHsgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlcykge1xuICAgICAgICAgICAgICAgIHZhciBtZXRob2REZXNjID0gc2lub24uZ2V0UHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgcHJvcGVydHkpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kRGVzY1t0eXBlc1tpXV0gPSBzcHkuY3JlYXRlKG1ldGhvZERlc2NbdHlwZXNbaV1dKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLndyYXBNZXRob2Qob2JqZWN0LCBwcm9wZXJ0eSwgbWV0aG9kRGVzYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzaW5vbi53cmFwTWV0aG9kKG9iamVjdCwgcHJvcGVydHksIHNweS5jcmVhdGUob2JqZWN0W3Byb3BlcnR5XSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbWF0Y2hpbmdGYWtlKGZha2VzLCBhcmdzLCBzdHJpY3QpIHtcbiAgICAgICAgICAgIGlmICghZmFrZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGZha2VzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChmYWtlc1tpXS5tYXRjaGVzKGFyZ3MsIHN0cmljdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZha2VzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGluY3JlbWVudENhbGxDb3VudCgpIHtcbiAgICAgICAgICAgIHRoaXMuY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuY2FsbENvdW50ICs9IDE7XG4gICAgICAgICAgICB0aGlzLm5vdENhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5jYWxsZWRPbmNlID0gdGhpcy5jYWxsQ291bnQgPT09IDE7XG4gICAgICAgICAgICB0aGlzLmNhbGxlZFR3aWNlID0gdGhpcy5jYWxsQ291bnQgPT09IDI7XG4gICAgICAgICAgICB0aGlzLmNhbGxlZFRocmljZSA9IHRoaXMuY2FsbENvdW50ID09PSAzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY3JlYXRlQ2FsbFByb3BlcnRpZXMoKSB7XG4gICAgICAgICAgICB0aGlzLmZpcnN0Q2FsbCA9IHRoaXMuZ2V0Q2FsbCgwKTtcbiAgICAgICAgICAgIHRoaXMuc2Vjb25kQ2FsbCA9IHRoaXMuZ2V0Q2FsbCgxKTtcbiAgICAgICAgICAgIHRoaXMudGhpcmRDYWxsID0gdGhpcy5nZXRDYWxsKDIpO1xuICAgICAgICAgICAgdGhpcy5sYXN0Q2FsbCA9IHRoaXMuZ2V0Q2FsbCh0aGlzLmNhbGxDb3VudCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHZhcnMgPSBcImEsYixjLGQsZSxmLGcsaCxpLGosayxsXCI7XG4gICAgICAgIGZ1bmN0aW9uIGNyZWF0ZVByb3h5KGZ1bmMsIHByb3h5TGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBSZXRhaW4gdGhlIGZ1bmN0aW9uIGxlbmd0aDpcbiAgICAgICAgICAgIHZhciBwO1xuICAgICAgICAgICAgaWYgKHByb3h5TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZXZhbChcInAgPSAoZnVuY3Rpb24gcHJveHkoXCIgKyB2YXJzLnN1YnN0cmluZygwLCBwcm94eUxlbmd0aCAqIDIgLSAxKSArIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZXZhbFxuICAgICAgICAgICAgICAgICAgICBcIikgeyByZXR1cm4gcC5pbnZva2UoZnVuYywgdGhpcywgc2xpY2UuY2FsbChhcmd1bWVudHMpKTsgfSk7XCIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwID0gZnVuY3Rpb24gcHJveHkoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwLmludm9rZShmdW5jLCB0aGlzLCBzbGljZS5jYWxsKGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwLmlzU2lub25Qcm94eSA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB1dWlkID0gMDtcblxuICAgICAgICAvLyBQdWJsaWMgQVBJXG4gICAgICAgIHZhciBzcHlBcGkgPSB7XG4gICAgICAgICAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmludm9raW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoXCJDYW5ub3QgcmVzZXQgU2lub24gZnVuY3Rpb24gd2hpbGUgaW52b2tpbmcgaXQuIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIk1vdmUgdGhlIGNhbGwgdG8gLnJlc2V0IG91dHNpZGUgb2YgdGhlIGNhbGxiYWNrLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgZXJyLm5hbWUgPSBcIkludmFsaWRSZXNldEV4Y2VwdGlvblwiO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLm5vdENhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsZWRPbmNlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsZWRUd2ljZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGVkVGhyaWNlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQ291bnQgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyc3RDYWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLnNlY29uZENhbGwgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMudGhpcmRDYWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmxhc3RDYWxsID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmFyZ3MgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLnJldHVyblZhbHVlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMudGhpc1ZhbHVlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuZXhjZXB0aW9ucyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbElkcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2tzID0gW107XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZmFrZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmZha2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZha2VzW2ldLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gY3JlYXRlKGZ1bmMsIHNweUxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBuYW1lO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgZnVuYyA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBuYW1lID0gc2lub24uZnVuY3Rpb25OYW1lKGZ1bmMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghc3B5TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNweUxlbmd0aCA9IGZ1bmMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBwcm94eSA9IGNyZWF0ZVByb3h5KGZ1bmMsIHNweUxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICBzaW5vbi5leHRlbmQocHJveHksIHNweSk7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHByb3h5LmNyZWF0ZTtcbiAgICAgICAgICAgICAgICBzaW5vbi5leHRlbmQocHJveHksIGZ1bmMpO1xuXG4gICAgICAgICAgICAgICAgcHJveHkucmVzZXQoKTtcbiAgICAgICAgICAgICAgICBwcm94eS5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgICAgICAgICBwcm94eS5kaXNwbGF5TmFtZSA9IG5hbWUgfHwgXCJzcHlcIjtcbiAgICAgICAgICAgICAgICBwcm94eS50b1N0cmluZyA9IHNpbm9uLmZ1bmN0aW9uVG9TdHJpbmc7XG4gICAgICAgICAgICAgICAgcHJveHkuaW5zdGFudGlhdGVGYWtlID0gc2lub24uc3B5LmNyZWF0ZTtcbiAgICAgICAgICAgICAgICBwcm94eS5pZCA9IFwic3B5I1wiICsgdXVpZCsrO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaW52b2tlOiBmdW5jdGlvbiBpbnZva2UoZnVuYywgdGhpc1ZhbHVlLCBhcmdzKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoaW5nID0gbWF0Y2hpbmdGYWtlKHRoaXMuZmFrZXMsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIHZhciBleGNlcHRpb24sIHJldHVyblZhbHVlO1xuXG4gICAgICAgICAgICAgICAgaW5jcmVtZW50Q2FsbENvdW50LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMudGhpc1ZhbHVlcywgdGhpc1ZhbHVlKTtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5hcmdzLCBhcmdzKTtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5jYWxsSWRzLCBjYWxsSWQrKyk7XG5cbiAgICAgICAgICAgICAgICAvLyBNYWtlIGNhbGwgcHJvcGVydGllcyBhdmFpbGFibGUgZnJvbSB3aXRoaW4gdGhlIHNwaWVkIGZ1bmN0aW9uOlxuICAgICAgICAgICAgICAgIGNyZWF0ZUNhbGxQcm9wZXJ0aWVzLmNhbGwodGhpcyk7XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmludm9raW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblZhbHVlID0gbWF0Y2hpbmcuaW52b2tlKGZ1bmMsIHRoaXNWYWx1ZSwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5WYWx1ZSA9ICh0aGlzLmZ1bmMgfHwgZnVuYykuYXBwbHkodGhpc1ZhbHVlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHZhciB0aGlzQ2FsbCA9IHRoaXMuZ2V0Q2FsbCh0aGlzLmNhbGxDb3VudCAtIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpc0NhbGwuY2FsbGVkV2l0aE5ldygpICYmIHR5cGVvZiByZXR1cm5WYWx1ZSAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUgPSB0aGlzVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VwdGlvbiA9IGU7XG4gICAgICAgICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuaW52b2tpbmc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMuZXhjZXB0aW9ucywgZXhjZXB0aW9uKTtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5yZXR1cm5WYWx1ZXMsIHJldHVyblZhbHVlKTtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5zdGFja3MsIG5ldyBFcnJvcigpLnN0YWNrKTtcblxuICAgICAgICAgICAgICAgIC8vIE1ha2UgcmV0dXJuIHZhbHVlIGFuZCBleGNlcHRpb24gYXZhaWxhYmxlIGluIHRoZSBjYWxsczpcbiAgICAgICAgICAgICAgICBjcmVhdGVDYWxsUHJvcGVydGllcy5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGV4Y2VwdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBuYW1lZDogZnVuY3Rpb24gbmFtZWQobmFtZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheU5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZ2V0Q2FsbDogZnVuY3Rpb24gZ2V0Q2FsbChpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGkgPCAwIHx8IGkgPj0gdGhpcy5jYWxsQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLnNweUNhbGwodGhpcywgdGhpcy50aGlzVmFsdWVzW2ldLCB0aGlzLmFyZ3NbaV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXR1cm5WYWx1ZXNbaV0sIHRoaXMuZXhjZXB0aW9uc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxJZHNbaV0sIHRoaXMuc3RhY2tzW2ldKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGdldENhbGxzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhbGxzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jYWxsQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjYWxscy5wdXNoKHRoaXMuZ2V0Q2FsbChpKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbGVkQmVmb3JlOiBmdW5jdGlvbiBjYWxsZWRCZWZvcmUoc3B5Rm4pIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXNweUZuLmNhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jYWxsSWRzWzBdIDwgc3B5Rm4uY2FsbElkc1tzcHlGbi5jYWxsSWRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbGVkQWZ0ZXI6IGZ1bmN0aW9uIGNhbGxlZEFmdGVyKHNweUZuKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNhbGxlZCB8fCAhc3B5Rm4uY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jYWxsSWRzW3RoaXMuY2FsbENvdW50IC0gMV0gPiBzcHlGbi5jYWxsSWRzW3NweUZuLmNhbGxDb3VudCAtIDFdO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgd2l0aEFyZ3M6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZha2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaCA9IG1hdGNoaW5nRmFrZSh0aGlzLmZha2VzLCBhcmdzLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFrZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgb3JpZ2luYWwgPSB0aGlzO1xuICAgICAgICAgICAgICAgIHZhciBmYWtlID0gdGhpcy5pbnN0YW50aWF0ZUZha2UoKTtcbiAgICAgICAgICAgICAgICBmYWtlLm1hdGNoaW5nQWd1bWVudHMgPSBhcmdzO1xuICAgICAgICAgICAgICAgIGZha2UucGFyZW50ID0gdGhpcztcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5mYWtlcywgZmFrZSk7XG5cbiAgICAgICAgICAgICAgICBmYWtlLndpdGhBcmdzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWwud2l0aEFyZ3MuYXBwbHkob3JpZ2luYWwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmYWtlLm1hdGNoZXModGhpcy5hcmdzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jcmVtZW50Q2FsbENvdW50LmNhbGwoZmFrZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwoZmFrZS50aGlzVmFsdWVzLCB0aGlzLnRoaXNWYWx1ZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGZha2UuYXJncywgdGhpcy5hcmdzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChmYWtlLnJldHVyblZhbHVlcywgdGhpcy5yZXR1cm5WYWx1ZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGZha2UuZXhjZXB0aW9ucywgdGhpcy5leGNlcHRpb25zW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChmYWtlLmNhbGxJZHMsIHRoaXMuY2FsbElkc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3JlYXRlQ2FsbFByb3BlcnRpZXMuY2FsbChmYWtlKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmYWtlO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbWF0Y2hlczogZnVuY3Rpb24gKGFyZ3MsIHN0cmljdCkge1xuICAgICAgICAgICAgICAgIHZhciBtYXJncyA9IHRoaXMubWF0Y2hpbmdBZ3VtZW50cztcblxuICAgICAgICAgICAgICAgIGlmIChtYXJncy5sZW5ndGggPD0gYXJncy5sZW5ndGggJiZcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZGVlcEVxdWFsKG1hcmdzLCBhcmdzLnNsaWNlKDAsIG1hcmdzLmxlbmd0aCkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhc3RyaWN0IHx8IG1hcmdzLmxlbmd0aCA9PT0gYXJncy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcHJpbnRmOiBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHNweUluc3RhbmNlID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICB2YXIgZm9ybWF0dGVyO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIChmb3JtYXQgfHwgXCJcIikucmVwbGFjZSgvJSguKS9nLCBmdW5jdGlvbiAobWF0Y2gsIHNwZWNpZnllcikge1xuICAgICAgICAgICAgICAgICAgICBmb3JtYXR0ZXIgPSBzcHlBcGkuZm9ybWF0dGVyc1tzcGVjaWZ5ZXJdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZm9ybWF0dGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXR0ZXIuY2FsbChudWxsLCBzcHlJbnN0YW5jZSwgYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWlzTmFOKHBhcnNlSW50KHNwZWNpZnllciwgMTApKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLmZvcm1hdChhcmdzW3NwZWNpZnllciAtIDFdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIiVcIiArIHNwZWNpZnllcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBkZWxlZ2F0ZVRvQ2FsbHMobWV0aG9kLCBtYXRjaEFueSwgYWN0dWFsLCBub3RDYWxsZWQpIHtcbiAgICAgICAgICAgIHNweUFwaVttZXRob2RdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jYWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vdENhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vdENhbGxlZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudENhbGw7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSAwO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNhbGxDb3VudDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50Q2FsbCA9IHRoaXMuZ2V0Q2FsbChpKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudENhbGxbYWN0dWFsIHx8IG1ldGhvZF0uYXBwbHkoY3VycmVudENhbGwsIGFyZ3VtZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZXMgKz0gMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoQW55KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2hlcyA9PT0gdGhpcy5jYWxsQ291bnQ7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiY2FsbGVkT25cIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImFsd2F5c0NhbGxlZE9uXCIsIGZhbHNlLCBcImNhbGxlZE9uXCIpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJjYWxsZWRXaXRoXCIsIHRydWUpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJjYWxsZWRXaXRoTWF0Y2hcIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImFsd2F5c0NhbGxlZFdpdGhcIiwgZmFsc2UsIFwiY2FsbGVkV2l0aFwiKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiYWx3YXlzQ2FsbGVkV2l0aE1hdGNoXCIsIGZhbHNlLCBcImNhbGxlZFdpdGhNYXRjaFwiKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiY2FsbGVkV2l0aEV4YWN0bHlcIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImFsd2F5c0NhbGxlZFdpdGhFeGFjdGx5XCIsIGZhbHNlLCBcImNhbGxlZFdpdGhFeGFjdGx5XCIpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJuZXZlckNhbGxlZFdpdGhcIiwgZmFsc2UsIFwibm90Q2FsbGVkV2l0aFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcIm5ldmVyQ2FsbGVkV2l0aE1hdGNoXCIsIGZhbHNlLCBcIm5vdENhbGxlZFdpdGhNYXRjaFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcInRocmV3XCIsIHRydWUpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJhbHdheXNUaHJld1wiLCBmYWxzZSwgXCJ0aHJld1wiKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwicmV0dXJuZWRcIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImFsd2F5c1JldHVybmVkXCIsIGZhbHNlLCBcInJldHVybmVkXCIpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJjYWxsZWRXaXRoTmV3XCIsIHRydWUpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJhbHdheXNDYWxsZWRXaXRoTmV3XCIsIGZhbHNlLCBcImNhbGxlZFdpdGhOZXdcIik7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImNhbGxBcmdcIiwgZmFsc2UsIFwiY2FsbEFyZ1dpdGhcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHRoaXMudG9TdHJpbmcoKSArIFwiIGNhbm5vdCBjYWxsIGFyZyBzaW5jZSBpdCB3YXMgbm90IHlldCBpbnZva2VkLlwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNweUFwaS5jYWxsQXJnV2l0aCA9IHNweUFwaS5jYWxsQXJnO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJjYWxsQXJnT25cIiwgZmFsc2UsIFwiY2FsbEFyZ09uV2l0aFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGhpcy50b1N0cmluZygpICsgXCIgY2Fubm90IGNhbGwgYXJnIHNpbmNlIGl0IHdhcyBub3QgeWV0IGludm9rZWQuXCIpO1xuICAgICAgICB9KTtcbiAgICAgICAgc3B5QXBpLmNhbGxBcmdPbldpdGggPSBzcHlBcGkuY2FsbEFyZ09uO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJ5aWVsZFwiLCBmYWxzZSwgXCJ5aWVsZFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGhpcy50b1N0cmluZygpICsgXCIgY2Fubm90IHlpZWxkIHNpbmNlIGl0IHdhcyBub3QgeWV0IGludm9rZWQuXCIpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gXCJpbnZva2VDYWxsYmFja1wiIGlzIGFuIGFsaWFzIGZvciBcInlpZWxkXCIgc2luY2UgXCJ5aWVsZFwiIGlzIGludmFsaWQgaW4gc3RyaWN0IG1vZGUuXG4gICAgICAgIHNweUFwaS5pbnZva2VDYWxsYmFjayA9IHNweUFwaS55aWVsZDtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwieWllbGRPblwiLCBmYWxzZSwgXCJ5aWVsZE9uXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcih0aGlzLnRvU3RyaW5nKCkgKyBcIiBjYW5ub3QgeWllbGQgc2luY2UgaXQgd2FzIG5vdCB5ZXQgaW52b2tlZC5cIik7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJ5aWVsZFRvXCIsIGZhbHNlLCBcInlpZWxkVG9cIiwgZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGhpcy50b1N0cmluZygpICsgXCIgY2Fubm90IHlpZWxkIHRvICdcIiArIHByb3BlcnR5ICtcbiAgICAgICAgICAgICAgICBcIicgc2luY2UgaXQgd2FzIG5vdCB5ZXQgaW52b2tlZC5cIik7XG4gICAgICAgIH0pO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJ5aWVsZFRvT25cIiwgZmFsc2UsIFwieWllbGRUb09uXCIsIGZ1bmN0aW9uIChwcm9wZXJ0eSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHRoaXMudG9TdHJpbmcoKSArIFwiIGNhbm5vdCB5aWVsZCB0byAnXCIgKyBwcm9wZXJ0eSArXG4gICAgICAgICAgICAgICAgXCInIHNpbmNlIGl0IHdhcyBub3QgeWV0IGludm9rZWQuXCIpO1xuICAgICAgICB9KTtcblxuICAgICAgICBzcHlBcGkuZm9ybWF0dGVycyA9IHtcbiAgICAgICAgICAgIGM6IGZ1bmN0aW9uIChzcHlJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaW5vbi50aW1lc0luV29yZHMoc3B5SW5zdGFuY2UuY2FsbENvdW50KTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG46IGZ1bmN0aW9uIChzcHlJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzcHlJbnN0YW5jZS50b1N0cmluZygpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgQzogZnVuY3Rpb24gKHNweUluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhbGxzID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHNweUluc3RhbmNlLmNhbGxDb3VudDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3RyaW5naWZpZWRDYWxsID0gXCIgICAgXCIgKyBzcHlJbnN0YW5jZS5nZXRDYWxsKGkpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICgvXFxuLy50ZXN0KGNhbGxzW2kgLSAxXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmluZ2lmaWVkQ2FsbCA9IFwiXFxuXCIgKyBzdHJpbmdpZmllZENhbGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGNhbGxzLCBzdHJpbmdpZmllZENhbGwpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxscy5sZW5ndGggPiAwID8gXCJcXG5cIiArIGNhbGxzLmpvaW4oXCJcXG5cIikgOiBcIlwiO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdDogZnVuY3Rpb24gKHNweUluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gc3B5SW5zdGFuY2UuY2FsbENvdW50OyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChvYmplY3RzLCBzaW5vbi5mb3JtYXQoc3B5SW5zdGFuY2UudGhpc1ZhbHVlc1tpXSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBvYmplY3RzLmpvaW4oXCIsIFwiKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIFwiKlwiOiBmdW5jdGlvbiAoc3B5SW5zdGFuY2UsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgZm9ybWF0dGVkID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGFyZ3MubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChmb3JtYXR0ZWQsIHNpbm9uLmZvcm1hdChhcmdzW2ldKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcm1hdHRlZC5qb2luKFwiLCBcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZXh0ZW5kKHNweSwgc3B5QXBpKTtcblxuICAgICAgICBzcHkuc3B5Q2FsbCA9IHNpbm9uLnNweUNhbGw7XG4gICAgICAgIHNpbm9uLnNweSA9IHNweTtcblxuICAgICAgICByZXR1cm4gc3B5O1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgY29yZSA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vY2FsbFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZXh0ZW5kXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi90aW1lc19pbl93b3Jkc1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZm9ybWF0XCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoY29yZSk7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqIEBkZXBlbmQgZXh0ZW5kLmpzXG4gKiBAZGVwZW5kIHNweS5qc1xuICogQGRlcGVuZCBiZWhhdmlvci5qc1xuICogQGRlcGVuZCB3YWxrLmpzXG4gKi9cbi8qKlxuICogU3R1YiBmdW5jdGlvbnNcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIHN0dWIob2JqZWN0LCBwcm9wZXJ0eSwgZnVuYykge1xuICAgICAgICAgICAgaWYgKCEhZnVuYyAmJiB0eXBlb2YgZnVuYyAhPT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBmdW5jICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkN1c3RvbSBzdHViIHNob3VsZCBiZSBhIGZ1bmN0aW9uIG9yIGEgcHJvcGVydHkgZGVzY3JpcHRvclwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdyYXBwZXI7XG5cbiAgICAgICAgICAgIGlmIChmdW5jKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlciA9IHNpbm9uLnNweSAmJiBzaW5vbi5zcHkuY3JlYXRlID8gc2lub24uc3B5LmNyZWF0ZShmdW5jKSA6IGZ1bmM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlciA9IGZ1bmM7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzaW5vbi5zcHkgJiYgc2lub24uc3B5LmNyZWF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHR5cGVzID0gc2lub24ub2JqZWN0S2V5cyh3cmFwcGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cmFwcGVyW3R5cGVzW2ldXSA9IHNpbm9uLnNweS5jcmVhdGUod3JhcHBlclt0eXBlc1tpXV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgc3R1Ykxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG9iamVjdFtwcm9wZXJ0eV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBzdHViTGVuZ3RoID0gb2JqZWN0W3Byb3BlcnR5XS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdyYXBwZXIgPSBzdHViLmNyZWF0ZShzdHViTGVuZ3RoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFvYmplY3QgJiYgdHlwZW9mIHByb3BlcnR5ID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLnN0dWIuY3JlYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHkgPT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIG9iamVjdCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIHNpbm9uLndhbGsob2JqZWN0IHx8IHt9LCBmdW5jdGlvbiAodmFsdWUsIHByb3AsIHByb3BPd25lcikge1xuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBkb24ndCB3YW50IHRvIHN0dWIgdGhpbmdzIGxpa2UgdG9TdHJpbmcoKSwgdmFsdWVPZigpLCBldGMuIHNvIHdlIG9ubHkgc3R1YiBpZiB0aGUgb2JqZWN0XG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIG5vdCBPYmplY3QucHJvdG90eXBlXG4gICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BPd25lciAhPT0gT2JqZWN0LnByb3RvdHlwZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCAhPT0gXCJjb25zdHJ1Y3RvclwiICYmXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2Ygc2lub24uZ2V0UHJvcGVydHlEZXNjcmlwdG9yKHByb3BPd25lciwgcHJvcCkudmFsdWUgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0dWIob2JqZWN0LCBwcm9wKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uLndyYXBNZXRob2Qob2JqZWN0LCBwcm9wZXJ0eSwgd3JhcHBlcik7XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8qZXNsaW50LWRpc2FibGUgbm8tdXNlLWJlZm9yZS1kZWZpbmUqL1xuICAgICAgICBmdW5jdGlvbiBnZXRQYXJlbnRCZWhhdmlvdXIoc3R1Ykluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gKHN0dWJJbnN0YW5jZS5wYXJlbnQgJiYgZ2V0Q3VycmVudEJlaGF2aW9yKHN0dWJJbnN0YW5jZS5wYXJlbnQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldERlZmF1bHRCZWhhdmlvcihzdHViSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHViSW5zdGFuY2UuZGVmYXVsdEJlaGF2aW9yIHx8XG4gICAgICAgICAgICAgICAgICAgIGdldFBhcmVudEJlaGF2aW91cihzdHViSW5zdGFuY2UpIHx8XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmJlaGF2aW9yLmNyZWF0ZShzdHViSW5zdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Q3VycmVudEJlaGF2aW9yKHN0dWJJbnN0YW5jZSkge1xuICAgICAgICAgICAgdmFyIGJlaGF2aW9yID0gc3R1Ykluc3RhbmNlLmJlaGF2aW9yc1tzdHViSW5zdGFuY2UuY2FsbENvdW50IC0gMV07XG4gICAgICAgICAgICByZXR1cm4gYmVoYXZpb3IgJiYgYmVoYXZpb3IuaXNQcmVzZW50KCkgPyBiZWhhdmlvciA6IGdldERlZmF1bHRCZWhhdmlvcihzdHViSW5zdGFuY2UpO1xuICAgICAgICB9XG4gICAgICAgIC8qZXNsaW50LWVuYWJsZSBuby11c2UtYmVmb3JlLWRlZmluZSovXG5cbiAgICAgICAgdmFyIHV1aWQgPSAwO1xuXG4gICAgICAgIHZhciBwcm90byA9IHtcbiAgICAgICAgICAgIGNyZWF0ZTogZnVuY3Rpb24gY3JlYXRlKHN0dWJMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZnVuY3Rpb25TdHViID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0Q3VycmVudEJlaGF2aW9yKGZ1bmN0aW9uU3R1YikuaW52b2tlKHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3R1Yi5pZCA9IFwic3R1YiNcIiArIHV1aWQrKztcbiAgICAgICAgICAgICAgICB2YXIgb3JpZyA9IGZ1bmN0aW9uU3R1YjtcbiAgICAgICAgICAgICAgICBmdW5jdGlvblN0dWIgPSBzaW5vbi5zcHkuY3JlYXRlKGZ1bmN0aW9uU3R1Yiwgc3R1Ykxlbmd0aCk7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TdHViLmZ1bmMgPSBvcmlnO1xuXG4gICAgICAgICAgICAgICAgc2lub24uZXh0ZW5kKGZ1bmN0aW9uU3R1Yiwgc3R1Yik7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TdHViLmluc3RhbnRpYXRlRmFrZSA9IHNpbm9uLnN0dWIuY3JlYXRlO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3R1Yi5kaXNwbGF5TmFtZSA9IFwic3R1YlwiO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3R1Yi50b1N0cmluZyA9IHNpbm9uLmZ1bmN0aW9uVG9TdHJpbmc7XG5cbiAgICAgICAgICAgICAgICBmdW5jdGlvblN0dWIuZGVmYXVsdEJlaGF2aW9yID0gbnVsbDtcbiAgICAgICAgICAgICAgICBmdW5jdGlvblN0dWIuYmVoYXZpb3JzID0gW107XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb25TdHViO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzZXRCZWhhdmlvcjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0QmVoYXZpb3IgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuYmVoYXZpb3JzID0gW107XG5cbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5yZXR1cm5WYWx1ZTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5yZXR1cm5BcmdBdDtcbiAgICAgICAgICAgICAgICB0aGlzLnJldHVyblRoaXMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZha2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmZha2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZha2VzW2ldLnJlc2V0QmVoYXZpb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uQ2FsbDogZnVuY3Rpb24gb25DYWxsKGluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmJlaGF2aW9yc1tpbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWhhdmlvcnNbaW5kZXhdID0gc2lub24uYmVoYXZpb3IuY3JlYXRlKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmJlaGF2aW9yc1tpbmRleF07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvbkZpcnN0Q2FsbDogZnVuY3Rpb24gb25GaXJzdENhbGwoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub25DYWxsKDApO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25TZWNvbmRDYWxsOiBmdW5jdGlvbiBvblNlY29uZENhbGwoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub25DYWxsKDEpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25UaGlyZENhbGw6IGZ1bmN0aW9uIG9uVGhpcmRDYWxsKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9uQ2FsbCgyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVCZWhhdmlvcihiZWhhdmlvck1ldGhvZCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRCZWhhdmlvciA9IHRoaXMuZGVmYXVsdEJlaGF2aW9yIHx8IHNpbm9uLmJlaGF2aW9yLmNyZWF0ZSh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRCZWhhdmlvcltiZWhhdmlvck1ldGhvZF0uYXBwbHkodGhpcy5kZWZhdWx0QmVoYXZpb3IsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgbWV0aG9kIGluIHNpbm9uLmJlaGF2aW9yKSB7XG4gICAgICAgICAgICBpZiAoc2lub24uYmVoYXZpb3IuaGFzT3duUHJvcGVydHkobWV0aG9kKSAmJlxuICAgICAgICAgICAgICAgICFwcm90by5oYXNPd25Qcm9wZXJ0eShtZXRob2QpICYmXG4gICAgICAgICAgICAgICAgbWV0aG9kICE9PSBcImNyZWF0ZVwiICYmXG4gICAgICAgICAgICAgICAgbWV0aG9kICE9PSBcIndpdGhBcmdzXCIgJiZcbiAgICAgICAgICAgICAgICBtZXRob2QgIT09IFwiaW52b2tlXCIpIHtcbiAgICAgICAgICAgICAgICBwcm90b1ttZXRob2RdID0gY3JlYXRlQmVoYXZpb3IobWV0aG9kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLmV4dGVuZChzdHViLCBwcm90byk7XG4gICAgICAgIHNpbm9uLnN0dWIgPSBzdHViO1xuXG4gICAgICAgIHJldHVybiBzdHViO1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgY29yZSA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vYmVoYXZpb3JcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3NweVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZXh0ZW5kXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoY29yZSk7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqIEBkZXBlbmQgc2FuZGJveC5qc1xuICovXG4vKipcbiAqIFRlc3QgZnVuY3Rpb24sIHNhbmRib3hlcyBmYWtlc1xuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG4gICAgICAgIGZ1bmN0aW9uIHRlc3QoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciB0eXBlID0gdHlwZW9mIGNhbGxiYWNrO1xuXG4gICAgICAgICAgICBpZiAodHlwZSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInNpbm9uLnRlc3QgbmVlZHMgdG8gd3JhcCBhIHRlc3QgZnVuY3Rpb24sIGdvdCBcIiArIHR5cGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBzaW5vblNhbmRib3hlZFRlc3QoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHNpbm9uLmdldENvbmZpZyhzaW5vbi5jb25maWcpO1xuICAgICAgICAgICAgICAgIGNvbmZpZy5pbmplY3RJbnRvID0gY29uZmlnLmluamVjdEludG9UaGlzICYmIHRoaXMgfHwgY29uZmlnLmluamVjdEludG87XG4gICAgICAgICAgICAgICAgdmFyIHNhbmRib3ggPSBzaW5vbi5zYW5kYm94LmNyZWF0ZShjb25maWcpO1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHZhciBvbGREb25lID0gYXJncy5sZW5ndGggJiYgYXJnc1thcmdzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgIHZhciBleGNlcHRpb24sIHJlc3VsdDtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2xkRG9uZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9IGZ1bmN0aW9uIHNpbm9uRG9uZShyZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2FuZGJveC52ZXJpZnlBbmRSZXN0b3JlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbGREb25lKHJlcyk7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2suYXBwbHkodGhpcywgYXJncy5jb25jYXQoc2FuZGJveC5hcmdzKSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBleGNlcHRpb24gPSBlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb2xkRG9uZSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhjZXB0aW9uICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzYW5kYm94LnJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNhbmRib3gudmVyaWZ5QW5kUmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBzaW5vbkFzeW5jU2FuZGJveGVkVGVzdChkb25lKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uU2FuZGJveGVkVGVzdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzaW5vblNhbmRib3hlZFRlc3Q7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXN0LmNvbmZpZyA9IHtcbiAgICAgICAgICAgIGluamVjdEludG9UaGlzOiB0cnVlLFxuICAgICAgICAgICAgaW5qZWN0SW50bzogbnVsbCxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IFtcInNweVwiLCBcInN0dWJcIiwgXCJtb2NrXCIsIFwiY2xvY2tcIiwgXCJzZXJ2ZXJcIiwgXCJyZXF1ZXN0c1wiXSxcbiAgICAgICAgICAgIHVzZUZha2VUaW1lcnM6IHRydWUsXG4gICAgICAgICAgICB1c2VGYWtlU2VydmVyOiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24udGVzdCA9IHRlc3Q7XG4gICAgICAgIHJldHVybiB0ZXN0O1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgY29yZSA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2FuZGJveFwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKGNvcmUpO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgfSBlbHNlIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICB9IGVsc2UgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0odHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIHx8IG51bGwpKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCB0ZXN0LmpzXG4gKi9cbi8qKlxuICogVGVzdCBjYXNlLCBzYW5kYm94ZXMgYWxsIHRlc3QgZnVuY3Rpb25zXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlVGVzdChwcm9wZXJ0eSwgc2V0VXAsIHRlYXJEb3duKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2V0VXApIHtcbiAgICAgICAgICAgICAgICBzZXRVcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZXhjZXB0aW9uLCByZXN1bHQ7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gcHJvcGVydHkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBleGNlcHRpb24gPSBlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGVhckRvd24pIHtcbiAgICAgICAgICAgICAgICB0ZWFyRG93bi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgZnVuY3Rpb24gdGVzdENhc2UodGVzdHMsIHByZWZpeCkge1xuICAgICAgICAgICAgaWYgKCF0ZXN0cyB8fCB0eXBlb2YgdGVzdHMgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2lub24udGVzdENhc2UgbmVlZHMgYW4gb2JqZWN0IHdpdGggdGVzdCBmdW5jdGlvbnNcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHByZWZpeCA9IHByZWZpeCB8fCBcInRlc3RcIjtcbiAgICAgICAgICAgIHZhciByUHJlZml4ID0gbmV3IFJlZ0V4cChcIl5cIiArIHByZWZpeCk7XG4gICAgICAgICAgICB2YXIgbWV0aG9kcyA9IHt9O1xuICAgICAgICAgICAgdmFyIHNldFVwID0gdGVzdHMuc2V0VXA7XG4gICAgICAgICAgICB2YXIgdGVhckRvd24gPSB0ZXN0cy50ZWFyRG93bjtcbiAgICAgICAgICAgIHZhciB0ZXN0TmFtZSxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICBtZXRob2Q7XG5cbiAgICAgICAgICAgIGZvciAodGVzdE5hbWUgaW4gdGVzdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGVzdHMuaGFzT3duUHJvcGVydHkodGVzdE5hbWUpICYmICEvXihzZXRVcHx0ZWFyRG93bikkLy50ZXN0KHRlc3ROYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSA9IHRlc3RzW3Rlc3ROYW1lXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5ID09PSBcImZ1bmN0aW9uXCIgJiYgclByZWZpeC50ZXN0KHRlc3ROYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kID0gcHJvcGVydHk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXRVcCB8fCB0ZWFyRG93bikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZCA9IGNyZWF0ZVRlc3QocHJvcGVydHksIHNldFVwLCB0ZWFyRG93bik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZHNbdGVzdE5hbWVdID0gc2lub24udGVzdChtZXRob2QpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kc1t0ZXN0TmFtZV0gPSB0ZXN0c1t0ZXN0TmFtZV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtZXRob2RzO1xuICAgICAgICB9XG5cbiAgICAgICAgc2lub24udGVzdENhc2UgPSB0ZXN0Q2FzZTtcbiAgICAgICAgcmV0dXJuIHRlc3RDYXNlO1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgY29yZSA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vdGVzdFwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKGNvcmUpO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcblxuICAgICAgICBmdW5jdGlvbiB0aW1lc0luV29yZHMoY291bnQpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoY291bnQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIm9uY2VcIjtcbiAgICAgICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcInR3aWNlXCI7XG4gICAgICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJ0aHJpY2VcIjtcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKGNvdW50IHx8IDApICsgXCIgdGltZXNcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLnRpbWVzSW5Xb3JkcyA9IHRpbWVzSW5Xb3JkcztcbiAgICAgICAgcmV0dXJuIHNpbm9uLnRpbWVzSW5Xb3JkcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgY29yZSA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKGNvcmUpO1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICovXG4vKipcbiAqIEZvcm1hdCBmdW5jdGlvbnNcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDE0IENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIHR5cGVPZih2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwibnVsbFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwidW5kZWZpbmVkXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgc3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmcuc3Vic3RyaW5nKDgsIHN0cmluZy5sZW5ndGggLSAxKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2lub24udHlwZU9mID0gdHlwZU9mO1xuICAgICAgICByZXR1cm4gc2lub24udHlwZU9mO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoY29yZSk7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgLi4vLi4vc2lub24uanNcbiAqL1xuLyoqXG4gKiBTaW5vbiBjb3JlIHV0aWxpdGllcy4gRm9yIGludGVybmFsIHVzZSBvbmx5LlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBkaXYgPSB0eXBlb2YgZG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIgJiYgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuICAgIGZ1bmN0aW9uIGlzRE9NTm9kZShvYmopIHtcbiAgICAgICAgdmFyIHN1Y2Nlc3MgPSBmYWxzZTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgb2JqLmFwcGVuZENoaWxkKGRpdik7XG4gICAgICAgICAgICBzdWNjZXNzID0gZGl2LnBhcmVudE5vZGUgPT09IG9iajtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBvYmoucmVtb3ZlQ2hpbGQoZGl2KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZmFpbGVkLCBub3QgbXVjaCB3ZSBjYW4gZG8gYWJvdXQgdGhhdFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3M7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNFbGVtZW50KG9iaikge1xuICAgICAgICByZXR1cm4gZGl2ICYmIG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEgJiYgaXNET01Ob2RlKG9iaik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNGdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIiB8fCAhIShvYmogJiYgb2JqLmNvbnN0cnVjdG9yICYmIG9iai5jYWxsICYmIG9iai5hcHBseSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNSZWFsbHlOYU4odmFsKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsID09PSBcIm51bWJlclwiICYmIGlzTmFOKHZhbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWlycm9yUHJvcGVydGllcyh0YXJnZXQsIHNvdXJjZSkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKCFoYXNPd24uY2FsbCh0YXJnZXQsIHByb3ApKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNSZXN0b3JhYmxlKG9iaikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBvYmoucmVzdG9yZSA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5yZXN0b3JlLnNpbm9uO1xuICAgIH1cblxuICAgIC8vIENoZWFwIHdheSB0byBkZXRlY3QgaWYgd2UgaGF2ZSBFUzUgc3VwcG9ydC5cbiAgICB2YXIgaGFzRVM1U3VwcG9ydCA9IFwia2V5c1wiIGluIE9iamVjdDtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgc2lub24ud3JhcE1ldGhvZCA9IGZ1bmN0aW9uIHdyYXBNZXRob2Qob2JqZWN0LCBwcm9wZXJ0eSwgbWV0aG9kKSB7XG4gICAgICAgICAgICBpZiAoIW9iamVjdCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTaG91bGQgd3JhcCBwcm9wZXJ0eSBvZiBvYmplY3RcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWV0aG9kICE9PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIG1ldGhvZCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJNZXRob2Qgd3JhcHBlciBzaG91bGQgYmUgYSBmdW5jdGlvbiBvciBhIHByb3BlcnR5IGRlc2NyaXB0b3JcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGNoZWNrV3JhcHBlZE1ldGhvZCh3cmFwcGVkTWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFpc0Z1bmN0aW9uKHdyYXBwZWRNZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gbmV3IFR5cGVFcnJvcihcIkF0dGVtcHRlZCB0byB3cmFwIFwiICsgKHR5cGVvZiB3cmFwcGVkTWV0aG9kKSArIFwiIHByb3BlcnR5IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSArIFwiIGFzIGZ1bmN0aW9uXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAod3JhcHBlZE1ldGhvZC5yZXN0b3JlICYmIHdyYXBwZWRNZXRob2QucmVzdG9yZS5zaW5vbikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvciA9IG5ldyBUeXBlRXJyb3IoXCJBdHRlbXB0ZWQgdG8gd3JhcCBcIiArIHByb3BlcnR5ICsgXCIgd2hpY2ggaXMgYWxyZWFkeSB3cmFwcGVkXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAod3JhcHBlZE1ldGhvZC5jYWxsZWRCZWZvcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZlcmIgPSB3cmFwcGVkTWV0aG9kLnJldHVybnMgPyBcInN0dWJiZWRcIiA6IFwic3BpZWQgb25cIjtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQXR0ZW1wdGVkIHRvIHdyYXAgXCIgKyBwcm9wZXJ0eSArIFwiIHdoaWNoIGlzIGFscmVhZHkgXCIgKyB2ZXJiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdyYXBwZWRNZXRob2QgJiYgd3JhcHBlZE1ldGhvZC5zdGFja1RyYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvci5zdGFjayArPSBcIlxcbi0tLS0tLS0tLS0tLS0tXFxuXCIgKyB3cmFwcGVkTWV0aG9kLnN0YWNrVHJhY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZXJyb3IsIHdyYXBwZWRNZXRob2QsIGk7XG5cbiAgICAgICAgICAgIC8vIElFIDggZG9lcyBub3Qgc3VwcG9ydCBoYXNPd25Qcm9wZXJ0eSBvbiB0aGUgd2luZG93IG9iamVjdCBhbmQgRmlyZWZveCBoYXMgYSBwcm9ibGVtXG4gICAgICAgICAgICAvLyB3aGVuIHVzaW5nIGhhc093bi5jYWxsIG9uIG9iamVjdHMgZnJvbSBvdGhlciBmcmFtZXMuXG4gICAgICAgICAgICB2YXIgb3duZWQgPSBvYmplY3QuaGFzT3duUHJvcGVydHkgPyBvYmplY3QuaGFzT3duUHJvcGVydHkocHJvcGVydHkpIDogaGFzT3duLmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7XG5cbiAgICAgICAgICAgIGlmIChoYXNFUzVTdXBwb3J0KSB7XG4gICAgICAgICAgICAgICAgdmFyIG1ldGhvZERlc2MgPSAodHlwZW9mIG1ldGhvZCA9PT0gXCJmdW5jdGlvblwiKSA/IHt2YWx1ZTogbWV0aG9kfSA6IG1ldGhvZDtcbiAgICAgICAgICAgICAgICB2YXIgd3JhcHBlZE1ldGhvZERlc2MgPSBzaW5vbi5nZXRQcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBwcm9wZXJ0eSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXdyYXBwZWRNZXRob2REZXNjKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gbmV3IFR5cGVFcnJvcihcIkF0dGVtcHRlZCB0byB3cmFwIFwiICsgKHR5cGVvZiB3cmFwcGVkTWV0aG9kKSArIFwiIHByb3BlcnR5IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSArIFwiIGFzIGZ1bmN0aW9uXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAod3JhcHBlZE1ldGhvZERlc2MucmVzdG9yZSAmJiB3cmFwcGVkTWV0aG9kRGVzYy5yZXN0b3JlLnNpbm9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gbmV3IFR5cGVFcnJvcihcIkF0dGVtcHRlZCB0byB3cmFwIFwiICsgcHJvcGVydHkgKyBcIiB3aGljaCBpcyBhbHJlYWR5IHdyYXBwZWRcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAod3JhcHBlZE1ldGhvZERlc2MgJiYgd3JhcHBlZE1ldGhvZERlc2Muc3RhY2tUcmFjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3Iuc3RhY2sgKz0gXCJcXG4tLS0tLS0tLS0tLS0tLVxcblwiICsgd3JhcHBlZE1ldGhvZERlc2Muc3RhY2tUcmFjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdHlwZXMgPSBzaW5vbi5vYmplY3RLZXlzKG1ldGhvZERlc2MpO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkTWV0aG9kID0gd3JhcHBlZE1ldGhvZERlc2NbdHlwZXNbaV1dO1xuICAgICAgICAgICAgICAgICAgICBjaGVja1dyYXBwZWRNZXRob2Qod3JhcHBlZE1ldGhvZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWlycm9yUHJvcGVydGllcyhtZXRob2REZXNjLCB3cmFwcGVkTWV0aG9kRGVzYyk7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pcnJvclByb3BlcnRpZXMobWV0aG9kRGVzY1t0eXBlc1tpXV0sIHdyYXBwZWRNZXRob2REZXNjW3R5cGVzW2ldXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3QsIHByb3BlcnR5LCBtZXRob2REZXNjKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd3JhcHBlZE1ldGhvZCA9IG9iamVjdFtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgY2hlY2tXcmFwcGVkTWV0aG9kKHdyYXBwZWRNZXRob2QpO1xuICAgICAgICAgICAgICAgIG9iamVjdFtwcm9wZXJ0eV0gPSBtZXRob2Q7XG4gICAgICAgICAgICAgICAgbWV0aG9kLmRpc3BsYXlOYW1lID0gcHJvcGVydHk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1ldGhvZC5kaXNwbGF5TmFtZSA9IHByb3BlcnR5O1xuXG4gICAgICAgICAgICAvLyBTZXQgdXAgYSBzdGFjayB0cmFjZSB3aGljaCBjYW4gYmUgdXNlZCBsYXRlciB0byBmaW5kIHdoYXQgbGluZSBvZlxuICAgICAgICAgICAgLy8gY29kZSB0aGUgb3JpZ2luYWwgbWV0aG9kIHdhcyBjcmVhdGVkIG9uLlxuICAgICAgICAgICAgbWV0aG9kLnN0YWNrVHJhY2UgPSAobmV3IEVycm9yKFwiU3RhY2sgVHJhY2UgZm9yIG9yaWdpbmFsXCIpKS5zdGFjaztcblxuICAgICAgICAgICAgbWV0aG9kLnJlc3RvcmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gRm9yIHByb3RvdHlwZSBwcm9wZXJ0aWVzIHRyeSB0byByZXNldCBieSBkZWxldGUgZmlyc3QuXG4gICAgICAgICAgICAgICAgLy8gSWYgdGhpcyBmYWlscyAoZXg6IGxvY2FsU3RvcmFnZSBvbiBtb2JpbGUgc2FmYXJpKSB0aGVuIGZvcmNlIGEgcmVzZXRcbiAgICAgICAgICAgICAgICAvLyB2aWEgZGlyZWN0IGFzc2lnbm1lbnQuXG4gICAgICAgICAgICAgICAgaWYgKCFvd25lZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBJbiBzb21lIGNhc2VzIGBkZWxldGVgIG1heSB0aHJvdyBhbiBlcnJvclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG9iamVjdFtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZW1wdHlcbiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIG5hdGl2ZSBjb2RlIGZ1bmN0aW9ucyBgZGVsZXRlYCBmYWlscyB3aXRob3V0IHRocm93aW5nIGFuIGVycm9yXG4gICAgICAgICAgICAgICAgICAgIC8vIG9uIENocm9tZSA8IDQzLCBQaGFudG9tSlMsIGV0Yy5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGhhc0VTNVN1cHBvcnQpIHtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIHdyYXBwZWRNZXRob2REZXNjKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBVc2Ugc3RyaWN0IGVxdWFsaXR5IGNvbXBhcmlzb24gdG8gY2hlY2sgZmFpbHVyZXMgdGhlbiBmb3JjZSBhIHJlc2V0XG4gICAgICAgICAgICAgICAgLy8gdmlhIGRpcmVjdCBhc3NpZ25tZW50LlxuICAgICAgICAgICAgICAgIGlmIChvYmplY3RbcHJvcGVydHldID09PSBtZXRob2QpIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0W3Byb3BlcnR5XSA9IHdyYXBwZWRNZXRob2Q7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgbWV0aG9kLnJlc3RvcmUuc2lub24gPSB0cnVlO1xuXG4gICAgICAgICAgICBpZiAoIWhhc0VTNVN1cHBvcnQpIHtcbiAgICAgICAgICAgICAgICBtaXJyb3JQcm9wZXJ0aWVzKG1ldGhvZCwgd3JhcHBlZE1ldGhvZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtZXRob2Q7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKHByb3RvKSB7XG4gICAgICAgICAgICB2YXIgRiA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgRi5wcm90b3R5cGUgPSBwcm90bztcbiAgICAgICAgICAgIHJldHVybiBuZXcgRigpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmRlZXBFcXVhbCA9IGZ1bmN0aW9uIGRlZXBFcXVhbChhLCBiKSB7XG4gICAgICAgICAgICBpZiAoc2lub24ubWF0Y2ggJiYgc2lub24ubWF0Y2guaXNNYXRjaGVyKGEpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEudGVzdChiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhICE9PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBiICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzUmVhbGx5TmFOKGEpICYmIGlzUmVhbGx5TmFOKGIpIHx8IGEgPT09IGI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc0VsZW1lbnQoYSkgfHwgaXNFbGVtZW50KGIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEgPT09IGI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgoYSA9PT0gbnVsbCAmJiBiICE9PSBudWxsKSB8fCAoYSAhPT0gbnVsbCAmJiBiID09PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGEgaW5zdGFuY2VvZiBSZWdFeHAgJiYgYiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAoYS5zb3VyY2UgPT09IGIuc291cmNlKSAmJiAoYS5nbG9iYWwgPT09IGIuZ2xvYmFsKSAmJlxuICAgICAgICAgICAgICAgICAgICAoYS5pZ25vcmVDYXNlID09PSBiLmlnbm9yZUNhc2UpICYmIChhLm11bHRpbGluZSA9PT0gYi5tdWx0aWxpbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgYVN0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhKTtcbiAgICAgICAgICAgIGlmIChhU3RyaW5nICE9PSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhU3RyaW5nID09PSBcIltvYmplY3QgRGF0ZV1cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLnZhbHVlT2YoKSA9PT0gYi52YWx1ZU9mKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwcm9wO1xuICAgICAgICAgICAgdmFyIGFMZW5ndGggPSAwO1xuICAgICAgICAgICAgdmFyIGJMZW5ndGggPSAwO1xuXG4gICAgICAgICAgICBpZiAoYVN0cmluZyA9PT0gXCJbb2JqZWN0IEFycmF5XVwiICYmIGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChwcm9wIGluIGEpIHtcbiAgICAgICAgICAgICAgICBpZiAoYS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBhTGVuZ3RoICs9IDE7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocHJvcCBpbiBiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkZWVwRXF1YWwoYVtwcm9wXSwgYltwcm9wXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChwcm9wIGluIGIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYi5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBiTGVuZ3RoICs9IDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYUxlbmd0aCA9PT0gYkxlbmd0aDtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5mdW5jdGlvbk5hbWUgPSBmdW5jdGlvbiBmdW5jdGlvbk5hbWUoZnVuYykge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBmdW5jLmRpc3BsYXlOYW1lIHx8IGZ1bmMubmFtZTtcblxuICAgICAgICAgICAgLy8gVXNlIGZ1bmN0aW9uIGRlY29tcG9zaXRpb24gYXMgYSBsYXN0IHJlc29ydCB0byBnZXQgZnVuY3Rpb25cbiAgICAgICAgICAgIC8vIG5hbWUuIERvZXMgbm90IHJlbHkgb24gZnVuY3Rpb24gZGVjb21wb3NpdGlvbiB0byB3b3JrIC0gaWYgaXRcbiAgICAgICAgICAgIC8vIGRvZXNuJ3QgZGVidWdnaW5nIHdpbGwgYmUgc2xpZ2h0bHkgbGVzcyBpbmZvcm1hdGl2ZVxuICAgICAgICAgICAgLy8gKGkuZS4gdG9TdHJpbmcgd2lsbCBzYXkgJ3NweScgcmF0aGVyIHRoYW4gJ215RnVuYycpLlxuICAgICAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBmdW5jLnRvU3RyaW5nKCkubWF0Y2goL2Z1bmN0aW9uIChbXlxcc1xcKF0rKS8pO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBtYXRjaGVzICYmIG1hdGNoZXNbMV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBuYW1lO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmZ1bmN0aW9uVG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZygpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmdldENhbGwgJiYgdGhpcy5jYWxsQ291bnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGhpc1ZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBwcm9wO1xuICAgICAgICAgICAgICAgIHZhciBpID0gdGhpcy5jYWxsQ291bnQ7XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNWYWx1ZSA9IHRoaXMuZ2V0Q2FsbChpKS50aGlzVmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXNWYWx1ZVtwcm9wXSA9PT0gdGhpcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaXNwbGF5TmFtZSB8fCBcInNpbm9uIGZha2VcIjtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5vYmplY3RLZXlzID0gZnVuY3Rpb24gb2JqZWN0S2V5cyhvYmopIHtcbiAgICAgICAgICAgIGlmIChvYmogIT09IE9iamVjdChvYmopKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInNpbm9uLm9iamVjdEtleXMgY2FsbGVkIG9uIGEgbm9uLW9iamVjdFwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGtleXMgPSBbXTtcbiAgICAgICAgICAgIHZhciBrZXk7XG4gICAgICAgICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZ2V0UHJvcGVydHlEZXNjcmlwdG9yID0gZnVuY3Rpb24gZ2V0UHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICAgICAgICAgIHZhciBwcm90byA9IG9iamVjdDtcbiAgICAgICAgICAgIHZhciBkZXNjcmlwdG9yO1xuXG4gICAgICAgICAgICB3aGlsZSAocHJvdG8gJiYgIShkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm90bywgcHJvcGVydHkpKSkge1xuICAgICAgICAgICAgICAgIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZXNjcmlwdG9yO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmdldENvbmZpZyA9IGZ1bmN0aW9uIChjdXN0b20pIHtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSB7fTtcbiAgICAgICAgICAgIGN1c3RvbSA9IGN1c3RvbSB8fCB7fTtcbiAgICAgICAgICAgIHZhciBkZWZhdWx0cyA9IHNpbm9uLmRlZmF1bHRDb25maWc7XG5cbiAgICAgICAgICAgIGZvciAodmFyIHByb3AgaW4gZGVmYXVsdHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGVmYXVsdHMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnW3Byb3BdID0gY3VzdG9tLmhhc093blByb3BlcnR5KHByb3ApID8gY3VzdG9tW3Byb3BdIDogZGVmYXVsdHNbcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29uZmlnO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmRlZmF1bHRDb25maWcgPSB7XG4gICAgICAgICAgICBpbmplY3RJbnRvVGhpczogdHJ1ZSxcbiAgICAgICAgICAgIGluamVjdEludG86IG51bGwsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiBbXCJzcHlcIiwgXCJzdHViXCIsIFwibW9ja1wiLCBcImNsb2NrXCIsIFwic2VydmVyXCIsIFwicmVxdWVzdHNcIl0sXG4gICAgICAgICAgICB1c2VGYWtlVGltZXJzOiB0cnVlLFxuICAgICAgICAgICAgdXNlRmFrZVNlcnZlcjogdHJ1ZVxuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLnRpbWVzSW5Xb3JkcyA9IGZ1bmN0aW9uIHRpbWVzSW5Xb3Jkcyhjb3VudCkge1xuICAgICAgICAgICAgcmV0dXJuIGNvdW50ID09PSAxICYmIFwib25jZVwiIHx8XG4gICAgICAgICAgICAgICAgY291bnQgPT09IDIgJiYgXCJ0d2ljZVwiIHx8XG4gICAgICAgICAgICAgICAgY291bnQgPT09IDMgJiYgXCJ0aHJpY2VcIiB8fFxuICAgICAgICAgICAgICAgIChjb3VudCB8fCAwKSArIFwiIHRpbWVzXCI7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uY2FsbGVkSW5PcmRlciA9IGZ1bmN0aW9uIChzcGllcykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDEsIGwgPSBzcGllcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNwaWVzW2kgLSAxXS5jYWxsZWRCZWZvcmUoc3BpZXNbaV0pIHx8ICFzcGllc1tpXS5jYWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24ub3JkZXJCeUZpcnN0Q2FsbCA9IGZ1bmN0aW9uIChzcGllcykge1xuICAgICAgICAgICAgcmV0dXJuIHNwaWVzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICAvLyB1dWlkLCB3b24ndCBldmVyIGJlIGVxdWFsXG4gICAgICAgICAgICAgICAgdmFyIGFDYWxsID0gYS5nZXRDYWxsKDApO1xuICAgICAgICAgICAgICAgIHZhciBiQ2FsbCA9IGIuZ2V0Q2FsbCgwKTtcbiAgICAgICAgICAgICAgICB2YXIgYUlkID0gYUNhbGwgJiYgYUNhbGwuY2FsbElkIHx8IC0xO1xuICAgICAgICAgICAgICAgIHZhciBiSWQgPSBiQ2FsbCAmJiBiQ2FsbC5jYWxsSWQgfHwgLTE7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gYUlkIDwgYklkID8gLTEgOiAxO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uY3JlYXRlU3R1Ykluc3RhbmNlID0gZnVuY3Rpb24gKGNvbnN0cnVjdG9yKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbnN0cnVjdG9yICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhlIGNvbnN0cnVjdG9yIHNob3VsZCBiZSBhIGZ1bmN0aW9uLlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzaW5vbi5zdHViKHNpbm9uLmNyZWF0ZShjb25zdHJ1Y3Rvci5wcm90b3R5cGUpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5yZXN0b3JlID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKG9iamVjdCAhPT0gbnVsbCAmJiB0eXBlb2Ygb2JqZWN0ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzUmVzdG9yYWJsZShvYmplY3RbcHJvcF0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RbcHJvcF0ucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc1Jlc3RvcmFibGUob2JqZWN0KSkge1xuICAgICAgICAgICAgICAgIG9iamVjdC5yZXN0b3JlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHNpbm9uO1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMpIHtcbiAgICAgICAgbWFrZUFwaShleHBvcnRzKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBNaW5pbWFsIEV2ZW50IGludGVyZmFjZSBpbXBsZW1lbnRhdGlvblxuICpcbiAqIE9yaWdpbmFsIGltcGxlbWVudGF0aW9uIGJ5IFN2ZW4gRnVjaHM6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tLzk5NTAyOFxuICogTW9kaWZpY2F0aW9ucyBhbmQgdGVzdHMgYnkgQ2hyaXN0aWFuIEpvaGFuc2VuLlxuICpcbiAqIEBhdXRob3IgU3ZlbiBGdWNocyAoc3ZlbmZ1Y2hzQGFydHdlYi1kZXNpZ24uZGUpXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMSBTdmVuIEZ1Y2hzLCBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuaWYgKHR5cGVvZiBzaW5vbiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHRoaXMuc2lub24gPSB7fTtcbn1cblxuKGZ1bmN0aW9uICgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBwdXNoID0gW10ucHVzaDtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgc2lub24uRXZlbnQgPSBmdW5jdGlvbiBFdmVudCh0eXBlLCBidWJibGVzLCBjYW5jZWxhYmxlLCB0YXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdEV2ZW50KHR5cGUsIGJ1YmJsZXMsIGNhbmNlbGFibGUsIHRhcmdldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uRXZlbnQucHJvdG90eXBlID0ge1xuICAgICAgICAgICAgaW5pdEV2ZW50OiBmdW5jdGlvbiAodHlwZSwgYnViYmxlcywgY2FuY2VsYWJsZSwgdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXMgPSBidWJibGVzO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FuY2VsYWJsZSA9IGNhbmNlbGFibGU7XG4gICAgICAgICAgICAgICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzdG9wUHJvcGFnYXRpb246IGZ1bmN0aW9uICgpIHt9LFxuXG4gICAgICAgICAgICBwcmV2ZW50RGVmYXVsdDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFByZXZlbnRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uUHJvZ3Jlc3NFdmVudCA9IGZ1bmN0aW9uIFByb2dyZXNzRXZlbnQodHlwZSwgcHJvZ3Jlc3NFdmVudFJhdywgdGFyZ2V0KSB7XG4gICAgICAgICAgICB0aGlzLmluaXRFdmVudCh0eXBlLCBmYWxzZSwgZmFsc2UsIHRhcmdldCk7XG4gICAgICAgICAgICB0aGlzLmxvYWRlZCA9IHByb2dyZXNzRXZlbnRSYXcubG9hZGVkIHx8IG51bGw7XG4gICAgICAgICAgICB0aGlzLnRvdGFsID0gcHJvZ3Jlc3NFdmVudFJhdy50b3RhbCB8fCBudWxsO1xuICAgICAgICAgICAgdGhpcy5sZW5ndGhDb21wdXRhYmxlID0gISFwcm9ncmVzc0V2ZW50UmF3LnRvdGFsO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLlByb2dyZXNzRXZlbnQucHJvdG90eXBlID0gbmV3IHNpbm9uLkV2ZW50KCk7XG5cbiAgICAgICAgc2lub24uUHJvZ3Jlc3NFdmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBzaW5vbi5Qcm9ncmVzc0V2ZW50O1xuXG4gICAgICAgIHNpbm9uLkN1c3RvbUV2ZW50ID0gZnVuY3Rpb24gQ3VzdG9tRXZlbnQodHlwZSwgY3VzdG9tRGF0YSwgdGFyZ2V0KSB7XG4gICAgICAgICAgICB0aGlzLmluaXRFdmVudCh0eXBlLCBmYWxzZSwgZmFsc2UsIHRhcmdldCk7XG4gICAgICAgICAgICB0aGlzLmRldGFpbCA9IGN1c3RvbURhdGEuZGV0YWlsIHx8IG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gbmV3IHNpbm9uLkV2ZW50KCk7XG5cbiAgICAgICAgc2lub24uQ3VzdG9tRXZlbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gc2lub24uQ3VzdG9tRXZlbnQ7XG5cbiAgICAgICAgc2lub24uRXZlbnRUYXJnZXQgPSB7XG4gICAgICAgICAgICBhZGRFdmVudExpc3RlbmVyOiBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMgPSB0aGlzLmV2ZW50TGlzdGVuZXJzIHx8IHt9O1xuICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnRdID0gdGhpcy5ldmVudExpc3RlbmVyc1tldmVudF0gfHwgW107XG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnRdLCBsaXN0ZW5lcik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZW1vdmVFdmVudExpc3RlbmVyOiBmdW5jdGlvbiByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmV2ZW50TGlzdGVuZXJzICYmIHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnRdIHx8IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaXN0ZW5lcnNbaV0gPT09IGxpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGRpc3BhdGNoRXZlbnQ6IGZ1bmN0aW9uIGRpc3BhdGNoRXZlbnQoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IGV2ZW50LnR5cGU7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMgJiYgdGhpcy5ldmVudExpc3RlbmVyc1t0eXBlXSB8fCBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXJzW2ldID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyc1tpXS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyc1tpXS5oYW5kbGVFdmVudChldmVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gISFldmVudC5kZWZhdWx0UHJldmVudGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vY29yZVwiKTtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2UgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ha2VBcGkoc2lub24pOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgfVxufSgpKTtcbiIsIi8qKlxuICogQGRlcGVuZCBmYWtlX3hkb21haW5fcmVxdWVzdC5qc1xuICogQGRlcGVuZCBmYWtlX3htbF9odHRwX3JlcXVlc3QuanNcbiAqIEBkZXBlbmQgLi4vZm9ybWF0LmpzXG4gKiBAZGVwZW5kIC4uL2xvZ19lcnJvci5qc1xuICovXG4vKipcbiAqIFRoZSBTaW5vbiBcInNlcnZlclwiIG1pbWljcyBhIHdlYiBzZXJ2ZXIgdGhhdCByZWNlaXZlcyByZXF1ZXN0cyBmcm9tXG4gKiBzaW5vbi5GYWtlWE1MSHR0cFJlcXVlc3QgYW5kIHByb3ZpZGVzIGFuIEFQSSB0byByZXNwb25kIHRvIHRob3NlIHJlcXVlc3RzLFxuICogYm90aCBzeW5jaHJvbm91c2x5IGFuZCBhc3luY2hyb25vdXNseS4gVG8gcmVzcG9uZCBzeW5jaHJvbnVvdXNseSwgY2FubmVkXG4gKiBhbnN3ZXJzIGhhdmUgdG8gYmUgcHJvdmlkZWQgdXBmcm9udC5cbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHB1c2ggPSBbXS5wdXNoO1xuXG4gICAgZnVuY3Rpb24gcmVzcG9uc2VBcnJheShoYW5kbGVyKSB7XG4gICAgICAgIHZhciByZXNwb25zZSA9IGhhbmRsZXI7XG5cbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChoYW5kbGVyKSAhPT0gXCJbb2JqZWN0IEFycmF5XVwiKSB7XG4gICAgICAgICAgICByZXNwb25zZSA9IFsyMDAsIHt9LCBoYW5kbGVyXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2VbMl0gIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWtlIHNlcnZlciByZXNwb25zZSBib2R5IHNob3VsZCBiZSBzdHJpbmcsIGJ1dCB3YXMgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgcmVzcG9uc2VbMl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgIH1cblxuICAgIHZhciB3bG9jID0gdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy5sb2NhdGlvbiA6IHt9O1xuICAgIHZhciByQ3VyckxvYyA9IG5ldyBSZWdFeHAoXCJeXCIgKyB3bG9jLnByb3RvY29sICsgXCIvL1wiICsgd2xvYy5ob3N0KTtcblxuICAgIGZ1bmN0aW9uIG1hdGNoT25lKHJlc3BvbnNlLCByZXFNZXRob2QsIHJlcVVybCkge1xuICAgICAgICB2YXIgcm1ldGggPSByZXNwb25zZS5tZXRob2Q7XG4gICAgICAgIHZhciBtYXRjaE1ldGhvZCA9ICFybWV0aCB8fCBybWV0aC50b0xvd2VyQ2FzZSgpID09PSByZXFNZXRob2QudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgdmFyIHVybCA9IHJlc3BvbnNlLnVybDtcbiAgICAgICAgdmFyIG1hdGNoVXJsID0gIXVybCB8fCB1cmwgPT09IHJlcVVybCB8fCAodHlwZW9mIHVybC50ZXN0ID09PSBcImZ1bmN0aW9uXCIgJiYgdXJsLnRlc3QocmVxVXJsKSk7XG5cbiAgICAgICAgcmV0dXJuIG1hdGNoTWV0aG9kICYmIG1hdGNoVXJsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hdGNoKHJlc3BvbnNlLCByZXF1ZXN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0VXJsID0gcmVxdWVzdC51cmw7XG5cbiAgICAgICAgaWYgKCEvXmh0dHBzPzpcXC9cXC8vLnRlc3QocmVxdWVzdFVybCkgfHwgckN1cnJMb2MudGVzdChyZXF1ZXN0VXJsKSkge1xuICAgICAgICAgICAgcmVxdWVzdFVybCA9IHJlcXVlc3RVcmwucmVwbGFjZShyQ3VyckxvYywgXCJcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2hPbmUocmVzcG9uc2UsIHRoaXMuZ2V0SFRUUE1ldGhvZChyZXF1ZXN0KSwgcmVxdWVzdFVybCkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzcG9uc2UucmVzcG9uc2UgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHZhciBydSA9IHJlc3BvbnNlLnVybDtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IFtyZXF1ZXN0XS5jb25jYXQocnUgJiYgdHlwZW9mIHJ1LmV4ZWMgPT09IFwiZnVuY3Rpb25cIiA/IHJ1LmV4ZWMocmVxdWVzdFVybCkuc2xpY2UoMSkgOiBbXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc3BvbnNlLmFwcGx5KHJlc3BvbnNlLCBhcmdzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBzaW5vbi5mYWtlU2VydmVyID0ge1xuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiAoY29uZmlnKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlcnZlciA9IHNpbm9uLmNyZWF0ZSh0aGlzKTtcbiAgICAgICAgICAgICAgICBzZXJ2ZXIuY29uZmlndXJlKGNvbmZpZyk7XG4gICAgICAgICAgICAgICAgaWYgKCFzaW5vbi54aHIuc3VwcG9ydHNDT1JTKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueGhyID0gc2lub24udXNlRmFrZVhEb21haW5SZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy54aHIgPSBzaW5vbi51c2VGYWtlWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2VydmVyLnJlcXVlc3RzID0gW107XG5cbiAgICAgICAgICAgICAgICB0aGlzLnhoci5vbkNyZWF0ZSA9IGZ1bmN0aW9uICh4aHJPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgc2VydmVyLmFkZFJlcXVlc3QoeGhyT2JqKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcnZlcjtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb25maWd1cmU6IGZ1bmN0aW9uIChjb25maWcpIHtcbiAgICAgICAgICAgICAgICB2YXIgd2hpdGVsaXN0ID0ge1xuICAgICAgICAgICAgICAgICAgICBcImF1dG9SZXNwb25kXCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwiYXV0b1Jlc3BvbmRBZnRlclwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcInJlc3BvbmRJbW1lZGlhdGVseVwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcImZha2VIVFRQTWV0aG9kc1wiOiB0cnVlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB2YXIgc2V0dGluZztcblxuICAgICAgICAgICAgICAgIGNvbmZpZyA9IGNvbmZpZyB8fCB7fTtcbiAgICAgICAgICAgICAgICBmb3IgKHNldHRpbmcgaW4gY29uZmlnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh3aGl0ZWxpc3QuaGFzT3duUHJvcGVydHkoc2V0dGluZykgJiYgY29uZmlnLmhhc093blByb3BlcnR5KHNldHRpbmcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW3NldHRpbmddID0gY29uZmlnW3NldHRpbmddO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZFJlcXVlc3Q6IGZ1bmN0aW9uIGFkZFJlcXVlc3QoeGhyT2JqKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlcnZlciA9IHRoaXM7XG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMucmVxdWVzdHMsIHhock9iaik7XG5cbiAgICAgICAgICAgICAgICB4aHJPYmoub25TZW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuaGFuZGxlUmVxdWVzdCh0aGlzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VydmVyLnJlc3BvbmRJbW1lZGlhdGVseSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLnJlc3BvbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZXJ2ZXIuYXV0b1Jlc3BvbmQgJiYgIXNlcnZlci5yZXNwb25kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIucmVzcG9uZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5yZXNwb25kKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBzZXJ2ZXIuYXV0b1Jlc3BvbmRBZnRlciB8fCAxMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5yZXNwb25kaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXRIVFRQTWV0aG9kOiBmdW5jdGlvbiBnZXRIVFRQTWV0aG9kKHJlcXVlc3QpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5mYWtlSFRUUE1ldGhvZHMgJiYgL3Bvc3QvaS50ZXN0KHJlcXVlc3QubWV0aG9kKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IChyZXF1ZXN0LnJlcXVlc3RCb2R5IHx8IFwiXCIpLm1hdGNoKC9fbWV0aG9kPShbXlxcYjtdKykvKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoZXMgPyBtYXRjaGVzWzFdIDogcmVxdWVzdC5tZXRob2Q7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QubWV0aG9kO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaGFuZGxlUmVxdWVzdDogZnVuY3Rpb24gaGFuZGxlUmVxdWVzdCh4aHIpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGhyLmFzeW5jKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5xdWV1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5xdWV1ZSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMucXVldWUsIHhocik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVxdWVzdCh4aHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGxvZzogZnVuY3Rpb24gbG9nKHJlc3BvbnNlLCByZXF1ZXN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0cjtcblxuICAgICAgICAgICAgICAgIHN0ciA9IFwiUmVxdWVzdDpcXG5cIiArIHNpbm9uLmZvcm1hdChyZXF1ZXN0KSArIFwiXFxuXFxuXCI7XG4gICAgICAgICAgICAgICAgc3RyICs9IFwiUmVzcG9uc2U6XFxuXCIgKyBzaW5vbi5mb3JtYXQocmVzcG9uc2UpICsgXCJcXG5cXG5cIjtcblxuICAgICAgICAgICAgICAgIHNpbm9uLmxvZyhzdHIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzcG9uZFdpdGg6IGZ1bmN0aW9uIHJlc3BvbmRXaXRoKG1ldGhvZCwgdXJsLCBib2R5KSB7XG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIG1ldGhvZCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2UgPSByZXNwb25zZUFycmF5KG1ldGhvZCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMucmVzcG9uc2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VzID0gW107XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgYm9keSA9IG1ldGhvZDtcbiAgICAgICAgICAgICAgICAgICAgdXJsID0gbWV0aG9kID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgICAgICAgICBib2R5ID0gdXJsO1xuICAgICAgICAgICAgICAgICAgICB1cmwgPSBtZXRob2Q7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMucmVzcG9uc2VzLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IHR5cGVvZiBib2R5ID09PSBcImZ1bmN0aW9uXCIgPyBib2R5IDogcmVzcG9uc2VBcnJheShib2R5KVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzcG9uZDogZnVuY3Rpb24gcmVzcG9uZCgpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNwb25kV2l0aC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBxdWV1ZSA9IHRoaXMucXVldWUgfHwgW107XG4gICAgICAgICAgICAgICAgdmFyIHJlcXVlc3RzID0gcXVldWUuc3BsaWNlKDAsIHF1ZXVlLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcXVlc3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1JlcXVlc3QocmVxdWVzdHNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHByb2Nlc3NSZXF1ZXN0OiBmdW5jdGlvbiBwcm9jZXNzUmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QuYWJvcnRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gdGhpcy5yZXNwb25zZSB8fCBbNDA0LCB7fSwgXCJcIl07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVzcG9uc2VzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBsID0gdGhpcy5yZXNwb25zZXMubGVuZ3RoLCBpID0gbCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoLmNhbGwodGhpcywgdGhpcy5yZXNwb25zZXNbaV0sIHJlcXVlc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gdGhpcy5yZXNwb25zZXNbaV0ucmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubG9nKHJlc3BvbnNlLCByZXF1ZXN0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5yZXNwb25kKHJlc3BvbnNlWzBdLCByZXNwb25zZVsxXSwgcmVzcG9uc2VbMl0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5sb2dFcnJvcihcIkZha2Ugc2VydmVyIHJlcXVlc3QgcHJvY2Vzc2luZ1wiLCBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiByZXN0b3JlKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhoci5yZXN0b3JlICYmIHRoaXMueGhyLnJlc3RvcmUuYXBwbHkodGhpcy54aHIsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL2NvcmVcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zha2VfeGRvbWFpbl9yZXF1ZXN0XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9mYWtlX3htbF9odHRwX3JlcXVlc3RcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuLi9mb3JtYXRcIik7XG4gICAgICAgIG1ha2VBcGkoc2lub24pO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHNpbm9uO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgfSBlbHNlIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuICAgIH1cbn0oKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgZmFrZV9zZXJ2ZXIuanNcbiAqIEBkZXBlbmQgZmFrZV90aW1lcnMuanNcbiAqL1xuLyoqXG4gKiBBZGQtb24gZm9yIHNpbm9uLmZha2VTZXJ2ZXIgdGhhdCBhdXRvbWF0aWNhbGx5IGhhbmRsZXMgYSBmYWtlIHRpbWVyIGFsb25nIHdpdGhcbiAqIHRoZSBGYWtlWE1MSHR0cFJlcXVlc3QuIFRoZSBkaXJlY3QgaW5zcGlyYXRpb24gZm9yIHRoaXMgYWRkLW9uIGlzIGpRdWVyeVxuICogMS4zLngsIHdoaWNoIGRvZXMgbm90IHVzZSB4aHIgb2JqZWN0J3Mgb25yZWFkeXN0YXRlaGFuZGxlciBhdCBhbGwgLSBpbnN0ZWFkLFxuICogaXQgcG9sbHMgdGhlIG9iamVjdCBmb3IgY29tcGxldGlvbiB3aXRoIHNldEludGVydmFsLiBEaXNwaXRlIHRoZSBkaXJlY3RcbiAqIG1vdGl2YXRpb24sIHRoZXJlIGlzIG5vdGhpbmcgalF1ZXJ5LXNwZWNpZmljIGluIHRoaXMgZmlsZSwgc28gaXQgY2FuIGJlIHVzZWRcbiAqIGluIGFueSBlbnZpcm9ubWVudCB3aGVyZSB0aGUgYWpheCBpbXBsZW1lbnRhdGlvbiBkZXBlbmRzIG9uIHNldEludGVydmFsIG9yXG4gKiBzZXRUaW1lb3V0LlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIFNlcnZlcigpIHt9XG4gICAgICAgIFNlcnZlci5wcm90b3R5cGUgPSBzaW5vbi5mYWtlU2VydmVyO1xuXG4gICAgICAgIHNpbm9uLmZha2VTZXJ2ZXJXaXRoQ2xvY2sgPSBuZXcgU2VydmVyKCk7XG5cbiAgICAgICAgc2lub24uZmFrZVNlcnZlcldpdGhDbG9jay5hZGRSZXF1ZXN0ID0gZnVuY3Rpb24gYWRkUmVxdWVzdCh4aHIpIHtcbiAgICAgICAgICAgIGlmICh4aHIuYXN5bmMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQuY2xvY2sgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9jayA9IHNldFRpbWVvdXQuY2xvY2s7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9jayA9IHNpbm9uLnVzZUZha2VUaW1lcnMoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNldENsb2NrID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubG9uZ2VzdFRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNsb2NrU2V0VGltZW91dCA9IHRoaXMuY2xvY2suc2V0VGltZW91dDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNsb2NrU2V0SW50ZXJ2YWwgPSB0aGlzLmNsb2NrLnNldEludGVydmFsO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VydmVyID0gdGhpcztcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2NrLnNldFRpbWVvdXQgPSBmdW5jdGlvbiAoZm4sIHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5sb25nZXN0VGltZW91dCA9IE1hdGgubWF4KHRpbWVvdXQsIHNlcnZlci5sb25nZXN0VGltZW91dCB8fCAwKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsb2NrU2V0VGltZW91dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvY2suc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbiAoZm4sIHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5sb25nZXN0VGltZW91dCA9IE1hdGgubWF4KHRpbWVvdXQsIHNlcnZlci5sb25nZXN0VGltZW91dCB8fCAwKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsb2NrU2V0SW50ZXJ2YWwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzaW5vbi5mYWtlU2VydmVyLmFkZFJlcXVlc3QuY2FsbCh0aGlzLCB4aHIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmZha2VTZXJ2ZXJXaXRoQ2xvY2sucmVzcG9uZCA9IGZ1bmN0aW9uIHJlc3BvbmQoKSB7XG4gICAgICAgICAgICB2YXIgcmV0dXJuVmFsID0gc2lub24uZmFrZVNlcnZlci5yZXNwb25kLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNsb2NrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbG9jay50aWNrKHRoaXMubG9uZ2VzdFRpbWVvdXQgfHwgMCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sb25nZXN0VGltZW91dCA9IDA7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZXNldENsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvY2sucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc2V0Q2xvY2sgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXR1cm5WYWw7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZmFrZVNlcnZlcldpdGhDbG9jay5yZXN0b3JlID0gZnVuY3Rpb24gcmVzdG9yZSgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNsb2NrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbG9jay5yZXN0b3JlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzaW5vbi5mYWtlU2VydmVyLnJlc3RvcmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL2NvcmVcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zha2Vfc2VydmVyXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9mYWtlX3RpbWVyc1wiKTtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2UgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ha2VBcGkoc2lub24pOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgfVxufSgpKTtcbiIsIi8qKlxuICogRmFrZSB0aW1lciBBUElcbiAqIHNldFRpbWVvdXRcbiAqIHNldEludGVydmFsXG4gKiBjbGVhclRpbWVvdXRcbiAqIGNsZWFySW50ZXJ2YWxcbiAqIHRpY2tcbiAqIHJlc2V0XG4gKiBEYXRlXG4gKlxuICogSW5zcGlyZWQgYnkganNVbml0TW9ja1RpbWVPdXQgZnJvbSBKc1VuaXRcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzLCBsb2wpIHtcbiAgICAgICAgLypnbG9iYWwgbG9sZXggKi9cbiAgICAgICAgdmFyIGxseCA9IHR5cGVvZiBsb2xleCAhPT0gXCJ1bmRlZmluZWRcIiA/IGxvbGV4IDogbG9sO1xuXG4gICAgICAgIHMudXNlRmFrZVRpbWVycyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBub3c7XG4gICAgICAgICAgICB2YXIgbWV0aG9kcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWV0aG9kc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIG5vdyA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vdyA9IG1ldGhvZHMuc2hpZnQoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNsb2NrID0gbGx4Lmluc3RhbGwobm93IHx8IDAsIG1ldGhvZHMpO1xuICAgICAgICAgICAgY2xvY2sucmVzdG9yZSA9IGNsb2NrLnVuaW5zdGFsbDtcbiAgICAgICAgICAgIHJldHVybiBjbG9jaztcbiAgICAgICAgfTtcblxuICAgICAgICBzLmNsb2NrID0ge1xuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiAobm93KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxseC5jcmVhdGVDbG9jayhub3cpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHMudGltZXJzID0ge1xuICAgICAgICAgICAgc2V0VGltZW91dDogc2V0VGltZW91dCxcbiAgICAgICAgICAgIGNsZWFyVGltZW91dDogY2xlYXJUaW1lb3V0LFxuICAgICAgICAgICAgc2V0SW1tZWRpYXRlOiAodHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IHNldEltbWVkaWF0ZSA6IHVuZGVmaW5lZCksXG4gICAgICAgICAgICBjbGVhckltbWVkaWF0ZTogKHR5cGVvZiBjbGVhckltbWVkaWF0ZSAhPT0gXCJ1bmRlZmluZWRcIiA/IGNsZWFySW1tZWRpYXRlIDogdW5kZWZpbmVkKSxcbiAgICAgICAgICAgIHNldEludGVydmFsOiBzZXRJbnRlcnZhbCxcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWw6IGNsZWFySW50ZXJ2YWwsXG4gICAgICAgICAgICBEYXRlOiBEYXRlXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXB4b3J0cywgbW9kdWxlLCBsb2xleCkge1xuICAgICAgICB2YXIgY29yZSA9IHJlcXVpcmUoXCIuL2NvcmVcIik7XG4gICAgICAgIG1ha2VBcGkoY29yZSwgbG9sZXgpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGNvcmU7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2UgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIHJlcXVpcmUoXCJsb2xleFwiKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICB9XG59KCkpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIGNvcmUuanNcbiAqIEBkZXBlbmQgLi4vZXh0ZW5kLmpzXG4gKiBAZGVwZW5kIGV2ZW50LmpzXG4gKiBAZGVwZW5kIC4uL2xvZ19lcnJvci5qc1xuICovXG4vKipcbiAqIEZha2UgWERvbWFpblJlcXVlc3Qgb2JqZWN0XG4gKi9cbmlmICh0eXBlb2Ygc2lub24gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICB0aGlzLnNpbm9uID0ge307XG59XG5cbi8vIHdyYXBwZXIgZm9yIGdsb2JhbFxuKGZ1bmN0aW9uIChnbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciB4ZHIgPSB7IFhEb21haW5SZXF1ZXN0OiBnbG9iYWwuWERvbWFpblJlcXVlc3QgfTtcbiAgICB4ZHIuR2xvYmFsWERvbWFpblJlcXVlc3QgPSBnbG9iYWwuWERvbWFpblJlcXVlc3Q7XG4gICAgeGRyLnN1cHBvcnRzWERSID0gdHlwZW9mIHhkci5HbG9iYWxYRG9tYWluUmVxdWVzdCAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgICB4ZHIud29ya2luZ1hEUiA9IHhkci5zdXBwb3J0c1hEUiA/IHhkci5HbG9iYWxYRG9tYWluUmVxdWVzdCA6IGZhbHNlO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBzaW5vbi54ZHIgPSB4ZHI7XG5cbiAgICAgICAgZnVuY3Rpb24gRmFrZVhEb21haW5SZXF1ZXN0KCkge1xuICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gRmFrZVhEb21haW5SZXF1ZXN0LlVOU0VOVDtcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEJvZHkgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGVhZGVycyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSAwO1xuICAgICAgICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBGYWtlWERvbWFpblJlcXVlc3Qub25DcmVhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIEZha2VYRG9tYWluUmVxdWVzdC5vbkNyZWF0ZSh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHZlcmlmeVN0YXRlKHgpIHtcbiAgICAgICAgICAgIGlmICh4LnJlYWR5U3RhdGUgIT09IEZha2VYRG9tYWluUmVxdWVzdC5PUEVORUQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJTlZBTElEX1NUQVRFX0VSUlwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHguc2VuZEZsYWcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJTlZBTElEX1NUQVRFX0VSUlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHZlcmlmeVJlcXVlc3RTZW50KHgpIHtcbiAgICAgICAgICAgIGlmICh4LnJlYWR5U3RhdGUgPT09IEZha2VYRG9tYWluUmVxdWVzdC5VTlNFTlQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZXF1ZXN0IG5vdCBzZW50XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHgucmVhZHlTdGF0ZSA9PT0gRmFrZVhEb21haW5SZXF1ZXN0LkRPTkUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZXF1ZXN0IGRvbmVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiB2ZXJpZnlSZXNwb25zZUJvZHlUeXBlKGJvZHkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYm9keSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byByZXNwb25kIHRvIGZha2UgWERvbWFpblJlcXVlc3Qgd2l0aCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2R5ICsgXCIsIHdoaWNoIGlzIG5vdCBhIHN0cmluZy5cIik7XG4gICAgICAgICAgICAgICAgZXJyb3IubmFtZSA9IFwiSW52YWxpZEJvZHlFeGNlcHRpb25cIjtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLmV4dGVuZChGYWtlWERvbWFpblJlcXVlc3QucHJvdG90eXBlLCBzaW5vbi5FdmVudFRhcmdldCwge1xuICAgICAgICAgICAgb3BlbjogZnVuY3Rpb24gb3BlbihtZXRob2QsIHVybCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWV0aG9kID0gbWV0aG9kO1xuICAgICAgICAgICAgICAgIHRoaXMudXJsID0gdXJsO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZVRleHQgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEZsYWcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZUNoYW5nZShGYWtlWERvbWFpblJlcXVlc3QuT1BFTkVEKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlYWR5U3RhdGVDaGFuZ2U6IGZ1bmN0aW9uIHJlYWR5U3RhdGVDaGFuZ2Uoc3RhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgICAgICAgICB2YXIgZXZlbnROYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgRmFrZVhEb21haW5SZXF1ZXN0LlVOU0VOVDpcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBGYWtlWERvbWFpblJlcXVlc3QuT1BFTkVEOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEZha2VYRG9tYWluUmVxdWVzdC5MT0FESU5HOlxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zZW5kRmxhZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9yYWlzZSB0aGUgcHJvZ3Jlc3MgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TmFtZSA9IFwib25wcm9ncmVzc1wiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgRmFrZVhEb21haW5SZXF1ZXN0LkRPTkU6XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnROYW1lID0gXCJvbnRpbWVvdXRcIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVycm9yRmxhZyB8fCAodGhpcy5zdGF0dXMgPCAyMDAgfHwgdGhpcy5zdGF0dXMgPiAyOTkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudE5hbWUgPSBcIm9uZXJyb3JcIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TmFtZSA9IFwib25sb2FkXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gcmFpc2luZyBldmVudCAoaWYgZGVmaW5lZClcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1tldmVudE5hbWVdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tldmVudE5hbWVdKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lub24ubG9nRXJyb3IoXCJGYWtlIFhIUiBcIiArIGV2ZW50TmFtZSArIFwiIGhhbmRsZXJcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzZW5kOiBmdW5jdGlvbiBzZW5kKGRhdGEpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlTdGF0ZSh0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICghL14oZ2V0fGhlYWQpJC9pLnRlc3QodGhpcy5tZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEJvZHkgPSBkYXRhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdID0gXCJ0ZXh0L3BsYWluO2NoYXJzZXQ9dXRmLThcIjtcblxuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JGbGFnID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRmxhZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYRG9tYWluUmVxdWVzdC5PUEVORUQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uU2VuZCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25TZW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGFib3J0OiBmdW5jdGlvbiBhYm9ydCgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VUZXh0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmVycm9yRmxhZyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID4gc2lub24uRmFrZVhEb21haW5SZXF1ZXN0LlVOU0VOVCAmJiB0aGlzLnNlbmRGbGFnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZUNoYW5nZShzaW5vbi5GYWtlWERvbWFpblJlcXVlc3QuRE9ORSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VuZEZsYWcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzZXRSZXNwb25zZUJvZHk6IGZ1bmN0aW9uIHNldFJlc3BvbnNlQm9keShib2R5KSB7XG4gICAgICAgICAgICAgICAgdmVyaWZ5UmVxdWVzdFNlbnQodGhpcyk7XG4gICAgICAgICAgICAgICAgdmVyaWZ5UmVzcG9uc2VCb2R5VHlwZShib2R5KTtcblxuICAgICAgICAgICAgICAgIHZhciBjaHVua1NpemUgPSB0aGlzLmNodW5rU2l6ZSB8fCAxMDtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VUZXh0ID0gXCJcIjtcblxuICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYRG9tYWluUmVxdWVzdC5MT0FESU5HKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZVRleHQgKz0gYm9keS5zdWJzdHJpbmcoaW5kZXgsIGluZGV4ICsgY2h1bmtTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gY2h1bmtTaXplO1xuICAgICAgICAgICAgICAgIH0gd2hpbGUgKGluZGV4IDwgYm9keS5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYRG9tYWluUmVxdWVzdC5ET05FKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlc3BvbmQ6IGZ1bmN0aW9uIHJlc3BvbmQoc3RhdHVzLCBjb250ZW50VHlwZSwgYm9keSkge1xuICAgICAgICAgICAgICAgIC8vIGNvbnRlbnQtdHlwZSBpZ25vcmVkLCBzaW5jZSBYRG9tYWluUmVxdWVzdCBkb2VzIG5vdCBjYXJyeSB0aGlzXG4gICAgICAgICAgICAgICAgLy8gd2Uga2VlcCB0aGUgc2FtZSBzeW50YXggZm9yIHJlc3BvbmQoLi4uKSBhcyBmb3IgRmFrZVhNTEh0dHBSZXF1ZXN0IHRvIGVhc2VcbiAgICAgICAgICAgICAgICAvLyB0ZXN0IGludGVncmF0aW9uIGFjcm9zcyBicm93c2Vyc1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gdHlwZW9mIHN0YXR1cyA9PT0gXCJudW1iZXJcIiA/IHN0YXR1cyA6IDIwMDtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFJlc3BvbnNlQm9keShib2R5IHx8IFwiXCIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc2ltdWxhdGV0aW1lb3V0OiBmdW5jdGlvbiBzaW11bGF0ZXRpbWVvdXQoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuaXNUaW1lb3V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBBY2Nlc3MgdG8gdGhpcyBzaG91bGQgYWN0dWFsbHkgdGhyb3cgYW4gZXJyb3JcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlVGV4dCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhEb21haW5SZXF1ZXN0LkRPTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBzaW5vbi5leHRlbmQoRmFrZVhEb21haW5SZXF1ZXN0LCB7XG4gICAgICAgICAgICBVTlNFTlQ6IDAsXG4gICAgICAgICAgICBPUEVORUQ6IDEsXG4gICAgICAgICAgICBMT0FESU5HOiAzLFxuICAgICAgICAgICAgRE9ORTogNFxuICAgICAgICB9KTtcblxuICAgICAgICBzaW5vbi51c2VGYWtlWERvbWFpblJlcXVlc3QgPSBmdW5jdGlvbiB1c2VGYWtlWERvbWFpblJlcXVlc3QoKSB7XG4gICAgICAgICAgICBzaW5vbi5GYWtlWERvbWFpblJlcXVlc3QucmVzdG9yZSA9IGZ1bmN0aW9uIHJlc3RvcmUoa2VlcE9uQ3JlYXRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHhkci5zdXBwb3J0c1hEUikge1xuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuWERvbWFpblJlcXVlc3QgPSB4ZHIuR2xvYmFsWERvbWFpblJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVsZXRlIHNpbm9uLkZha2VYRG9tYWluUmVxdWVzdC5yZXN0b3JlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGtlZXBPbkNyZWF0ZSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2lub24uRmFrZVhEb21haW5SZXF1ZXN0Lm9uQ3JlYXRlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoeGRyLnN1cHBvcnRzWERSKSB7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLlhEb21haW5SZXF1ZXN0ID0gc2lub24uRmFrZVhEb21haW5SZXF1ZXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uLkZha2VYRG9tYWluUmVxdWVzdDtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5GYWtlWERvbWFpblJlcXVlc3QgPSBGYWtlWERvbWFpblJlcXVlc3Q7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL2NvcmVcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuLi9leHRlbmRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2V2ZW50XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi4vbG9nX2Vycm9yXCIpO1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaW5vbjtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICB9XG59KSh0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogc2VsZik7XG4iLCIvKipcbiAqIEBkZXBlbmQgY29yZS5qc1xuICogQGRlcGVuZCAuLi9leHRlbmQuanNcbiAqIEBkZXBlbmQgZXZlbnQuanNcbiAqIEBkZXBlbmQgLi4vbG9nX2Vycm9yLmpzXG4gKi9cbi8qKlxuICogRmFrZSBYTUxIdHRwUmVxdWVzdCBvYmplY3RcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsLCBnbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIGdldFdvcmtpbmdYSFIoZ2xvYmFsU2NvcGUpIHtcbiAgICAgICAgdmFyIHN1cHBvcnRzWEhSID0gdHlwZW9mIGdsb2JhbFNjb3BlLlhNTEh0dHBSZXF1ZXN0ICE9PSBcInVuZGVmaW5lZFwiO1xuICAgICAgICBpZiAoc3VwcG9ydHNYSFIpIHtcbiAgICAgICAgICAgIHJldHVybiBnbG9iYWxTY29wZS5YTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdXBwb3J0c0FjdGl2ZVggPSB0eXBlb2YgZ2xvYmFsU2NvcGUuQWN0aXZlWE9iamVjdCAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgICAgICAgaWYgKHN1cHBvcnRzQWN0aXZlWCkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IGdsb2JhbFNjb3BlLkFjdGl2ZVhPYmplY3QoXCJNU1hNTDIuWE1MSFRUUC4zLjBcIik7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBzdXBwb3J0c1Byb2dyZXNzID0gdHlwZW9mIFByb2dyZXNzRXZlbnQgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgdmFyIHN1cHBvcnRzQ3VzdG9tRXZlbnQgPSB0eXBlb2YgQ3VzdG9tRXZlbnQgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgdmFyIHN1cHBvcnRzRm9ybURhdGEgPSB0eXBlb2YgRm9ybURhdGEgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgdmFyIHN1cHBvcnRzQXJyYXlCdWZmZXIgPSB0eXBlb2YgQXJyYXlCdWZmZXIgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgdmFyIHN1cHBvcnRzQmxvYiA9IHR5cGVvZiBCbG9iID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIHNpbm9uWGhyID0geyBYTUxIdHRwUmVxdWVzdDogZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0IH07XG4gICAgc2lub25YaHIuR2xvYmFsWE1MSHR0cFJlcXVlc3QgPSBnbG9iYWwuWE1MSHR0cFJlcXVlc3Q7XG4gICAgc2lub25YaHIuR2xvYmFsQWN0aXZlWE9iamVjdCA9IGdsb2JhbC5BY3RpdmVYT2JqZWN0O1xuICAgIHNpbm9uWGhyLnN1cHBvcnRzQWN0aXZlWCA9IHR5cGVvZiBzaW5vblhoci5HbG9iYWxBY3RpdmVYT2JqZWN0ICE9PSBcInVuZGVmaW5lZFwiO1xuICAgIHNpbm9uWGhyLnN1cHBvcnRzWEhSID0gdHlwZW9mIHNpbm9uWGhyLkdsb2JhbFhNTEh0dHBSZXF1ZXN0ICE9PSBcInVuZGVmaW5lZFwiO1xuICAgIHNpbm9uWGhyLndvcmtpbmdYSFIgPSBnZXRXb3JraW5nWEhSKGdsb2JhbCk7XG4gICAgc2lub25YaHIuc3VwcG9ydHNDT1JTID0gc2lub25YaHIuc3VwcG9ydHNYSFIgJiYgXCJ3aXRoQ3JlZGVudGlhbHNcIiBpbiAobmV3IHNpbm9uWGhyLkdsb2JhbFhNTEh0dHBSZXF1ZXN0KCkpO1xuXG4gICAgdmFyIHVuc2FmZUhlYWRlcnMgPSB7XG4gICAgICAgIFwiQWNjZXB0LUNoYXJzZXRcIjogdHJ1ZSxcbiAgICAgICAgXCJBY2NlcHQtRW5jb2RpbmdcIjogdHJ1ZSxcbiAgICAgICAgQ29ubmVjdGlvbjogdHJ1ZSxcbiAgICAgICAgXCJDb250ZW50LUxlbmd0aFwiOiB0cnVlLFxuICAgICAgICBDb29raWU6IHRydWUsXG4gICAgICAgIENvb2tpZTI6IHRydWUsXG4gICAgICAgIFwiQ29udGVudC1UcmFuc2Zlci1FbmNvZGluZ1wiOiB0cnVlLFxuICAgICAgICBEYXRlOiB0cnVlLFxuICAgICAgICBFeHBlY3Q6IHRydWUsXG4gICAgICAgIEhvc3Q6IHRydWUsXG4gICAgICAgIFwiS2VlcC1BbGl2ZVwiOiB0cnVlLFxuICAgICAgICBSZWZlcmVyOiB0cnVlLFxuICAgICAgICBURTogdHJ1ZSxcbiAgICAgICAgVHJhaWxlcjogdHJ1ZSxcbiAgICAgICAgXCJUcmFuc2Zlci1FbmNvZGluZ1wiOiB0cnVlLFxuICAgICAgICBVcGdyYWRlOiB0cnVlLFxuICAgICAgICBcIlVzZXItQWdlbnRcIjogdHJ1ZSxcbiAgICAgICAgVmlhOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIEFuIHVwbG9hZCBvYmplY3QgaXMgY3JlYXRlZCBmb3IgZWFjaFxuICAgIC8vIEZha2VYTUxIdHRwUmVxdWVzdCBhbmQgYWxsb3dzIHVwbG9hZFxuICAgIC8vIGV2ZW50cyB0byBiZSBzaW11bGF0ZWQgdXNpbmcgdXBsb2FkUHJvZ3Jlc3NcbiAgICAvLyBhbmQgdXBsb2FkRXJyb3IuXG4gICAgZnVuY3Rpb24gVXBsb2FkUHJvZ3Jlc3MoKSB7XG4gICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMgPSB7XG4gICAgICAgICAgICBwcm9ncmVzczogW10sXG4gICAgICAgICAgICBsb2FkOiBbXSxcbiAgICAgICAgICAgIGFib3J0OiBbXSxcbiAgICAgICAgICAgIGVycm9yOiBbXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIFVwbG9hZFByb2dyZXNzLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVyc1tldmVudF0ucHVzaChsaXN0ZW5lcik7XG4gICAgfTtcblxuICAgIFVwbG9hZFByb2dyZXNzLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIpIHtcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnRdIHx8IFtdO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgaWYgKGxpc3RlbmVyc1tpXSA9PT0gbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBVcGxvYWRQcm9ncmVzcy5wcm90b3R5cGUuZGlzcGF0Y2hFdmVudCA9IGZ1bmN0aW9uIGRpc3BhdGNoRXZlbnQoZXZlbnQpIHtcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuZXZlbnRMaXN0ZW5lcnNbZXZlbnQudHlwZV0gfHwgW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxpc3RlbmVyOyAobGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV0pICE9IG51bGw7IGkrKykge1xuICAgICAgICAgICAgbGlzdGVuZXIoZXZlbnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIE5vdGUgdGhhdCBmb3IgRmFrZVhNTEh0dHBSZXF1ZXN0IHRvIHdvcmsgcHJlIEVTNVxuICAgIC8vIHdlIGxvc2Ugc29tZSBvZiB0aGUgYWxpZ25tZW50IHdpdGggdGhlIHNwZWMuXG4gICAgLy8gVG8gZW5zdXJlIGFzIGNsb3NlIGEgbWF0Y2ggYXMgcG9zc2libGUsXG4gICAgLy8gc2V0IHJlc3BvbnNlVHlwZSBiZWZvcmUgY2FsbGluZyBvcGVuLCBzZW5kIG9yIHJlc3BvbmQ7XG4gICAgZnVuY3Rpb24gRmFrZVhNTEh0dHBSZXF1ZXN0KCkge1xuICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBGYWtlWE1MSHR0cFJlcXVlc3QuVU5TRU5UO1xuICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzID0ge307XG4gICAgICAgIHRoaXMucmVxdWVzdEJvZHkgPSBudWxsO1xuICAgICAgICB0aGlzLnN0YXR1cyA9IDA7XG4gICAgICAgIHRoaXMuc3RhdHVzVGV4dCA9IFwiXCI7XG4gICAgICAgIHRoaXMudXBsb2FkID0gbmV3IFVwbG9hZFByb2dyZXNzKCk7XG4gICAgICAgIHRoaXMucmVzcG9uc2VUeXBlID0gXCJcIjtcbiAgICAgICAgdGhpcy5yZXNwb25zZSA9IFwiXCI7XG4gICAgICAgIGlmIChzaW5vblhoci5zdXBwb3J0c0NPUlMpIHtcbiAgICAgICAgICAgIHRoaXMud2l0aENyZWRlbnRpYWxzID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgeGhyID0gdGhpcztcbiAgICAgICAgdmFyIGV2ZW50cyA9IFtcImxvYWRzdGFydFwiLCBcImxvYWRcIiwgXCJhYm9ydFwiLCBcImxvYWRlbmRcIl07XG5cbiAgICAgICAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUpIHtcbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0geGhyW1wib25cIiArIGV2ZW50TmFtZV07XG5cbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXIgJiYgdHlwZW9mIGxpc3RlbmVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXIuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gZXZlbnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBhZGRFdmVudExpc3RlbmVyKGV2ZW50c1tpXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIEZha2VYTUxIdHRwUmVxdWVzdC5vbkNyZWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBGYWtlWE1MSHR0cFJlcXVlc3Qub25DcmVhdGUodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2ZXJpZnlTdGF0ZSh4aHIpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlICE9PSBGYWtlWE1MSHR0cFJlcXVlc3QuT1BFTkVEKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJTlZBTElEX1NUQVRFX0VSUlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh4aHIuc2VuZEZsYWcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIklOVkFMSURfU1RBVEVfRVJSXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0SGVhZGVyKGhlYWRlcnMsIGhlYWRlcikge1xuICAgICAgICBoZWFkZXIgPSBoZWFkZXIudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICBmb3IgKHZhciBoIGluIGhlYWRlcnMpIHtcbiAgICAgICAgICAgIGlmIChoLnRvTG93ZXJDYXNlKCkgPT09IGhlYWRlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gZmlsdGVyaW5nIHRvIGVuYWJsZSBhIHdoaXRlLWxpc3QgdmVyc2lvbiBvZiBTaW5vbiBGYWtlWGhyLFxuICAgIC8vIHdoZXJlIHdoaXRlbGlzdGVkIHJlcXVlc3RzIGFyZSBwYXNzZWQgdGhyb3VnaCB0byByZWFsIFhIUlxuICAgIGZ1bmN0aW9uIGVhY2goY29sbGVjdGlvbiwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNvbGxlY3Rpb24ubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhjb2xsZWN0aW9uW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBzb21lKGNvbGxlY3Rpb24sIGNhbGxiYWNrKSB7XG4gICAgICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBjb2xsZWN0aW9uLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdKSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gbGFyZ2VzdCBhcml0eSBpbiBYSFIgaXMgNSAtIFhIUiNvcGVuXG4gICAgdmFyIGFwcGx5ID0gZnVuY3Rpb24gKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgICAgY2FzZSAwOiByZXR1cm4gb2JqW21ldGhvZF0oKTtcbiAgICAgICAgY2FzZSAxOiByZXR1cm4gb2JqW21ldGhvZF0oYXJnc1swXSk7XG4gICAgICAgIGNhc2UgMjogcmV0dXJuIG9ialttZXRob2RdKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBvYmpbbWV0aG9kXShhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcbiAgICAgICAgY2FzZSA0OiByZXR1cm4gb2JqW21ldGhvZF0oYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgYXJnc1szXSk7XG4gICAgICAgIGNhc2UgNTogcmV0dXJuIG9ialttZXRob2RdKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10sIGFyZ3NbNF0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIEZha2VYTUxIdHRwUmVxdWVzdC5maWx0ZXJzID0gW107XG4gICAgRmFrZVhNTEh0dHBSZXF1ZXN0LmFkZEZpbHRlciA9IGZ1bmN0aW9uIGFkZEZpbHRlcihmbikge1xuICAgICAgICB0aGlzLmZpbHRlcnMucHVzaChmbik7XG4gICAgfTtcbiAgICB2YXIgSUU2UmUgPSAvTVNJRSA2LztcbiAgICBGYWtlWE1MSHR0cFJlcXVlc3QuZGVmYWtlID0gZnVuY3Rpb24gZGVmYWtlKGZha2VYaHIsIHhockFyZ3MpIHtcbiAgICAgICAgdmFyIHhociA9IG5ldyBzaW5vblhoci53b3JraW5nWEhSKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbmV3LWNhcFxuXG4gICAgICAgIGVhY2goW1xuICAgICAgICAgICAgXCJvcGVuXCIsXG4gICAgICAgICAgICBcInNldFJlcXVlc3RIZWFkZXJcIixcbiAgICAgICAgICAgIFwic2VuZFwiLFxuICAgICAgICAgICAgXCJhYm9ydFwiLFxuICAgICAgICAgICAgXCJnZXRSZXNwb25zZUhlYWRlclwiLFxuICAgICAgICAgICAgXCJnZXRBbGxSZXNwb25zZUhlYWRlcnNcIixcbiAgICAgICAgICAgIFwiYWRkRXZlbnRMaXN0ZW5lclwiLFxuICAgICAgICAgICAgXCJvdmVycmlkZU1pbWVUeXBlXCIsXG4gICAgICAgICAgICBcInJlbW92ZUV2ZW50TGlzdGVuZXJcIlxuICAgICAgICBdLCBmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgICAgICAgICBmYWtlWGhyW21ldGhvZF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFwcGx5KHhociwgbWV0aG9kLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGNvcHlBdHRycyA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICAgICAgICBlYWNoKGFyZ3MsIGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZmFrZVhoclthdHRyXSA9IHhoclthdHRyXTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghSUU2UmUudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBzdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uIHN0YXRlQ2hhbmdlKCkge1xuICAgICAgICAgICAgZmFrZVhoci5yZWFkeVN0YXRlID0geGhyLnJlYWR5U3RhdGU7XG4gICAgICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPj0gRmFrZVhNTEh0dHBSZXF1ZXN0LkhFQURFUlNfUkVDRUlWRUQpIHtcbiAgICAgICAgICAgICAgICBjb3B5QXR0cnMoW1wic3RhdHVzXCIsIFwic3RhdHVzVGV4dFwiXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPj0gRmFrZVhNTEh0dHBSZXF1ZXN0LkxPQURJTkcpIHtcbiAgICAgICAgICAgICAgICBjb3B5QXR0cnMoW1wicmVzcG9uc2VUZXh0XCIsIFwicmVzcG9uc2VcIl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSBGYWtlWE1MSHR0cFJlcXVlc3QuRE9ORSkge1xuICAgICAgICAgICAgICAgIGNvcHlBdHRycyhbXCJyZXNwb25zZVhNTFwiXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZmFrZVhoci5vbnJlYWR5c3RhdGVjaGFuZ2UpIHtcbiAgICAgICAgICAgICAgICBmYWtlWGhyLm9ucmVhZHlzdGF0ZWNoYW5nZS5jYWxsKGZha2VYaHIsIHsgdGFyZ2V0OiBmYWtlWGhyIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICh4aHIuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgZm9yICh2YXIgZXZlbnQgaW4gZmFrZVhoci5ldmVudExpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIGlmIChmYWtlWGhyLmV2ZW50TGlzdGVuZXJzLmhhc093blByb3BlcnR5KGV2ZW50KSkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8qZXNsaW50LWRpc2FibGUgbm8tbG9vcC1mdW5jKi9cbiAgICAgICAgICAgICAgICAgICAgZWFjaChmYWtlWGhyLmV2ZW50TGlzdGVuZXJzW2V2ZW50XSwgZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIC8qZXNsaW50LWVuYWJsZSBuby1sb29wLWZ1bmMqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhoci5hZGRFdmVudExpc3RlbmVyKFwicmVhZHlzdGF0ZWNoYW5nZVwiLCBzdGF0ZUNoYW5nZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gc3RhdGVDaGFuZ2U7XG4gICAgICAgIH1cbiAgICAgICAgYXBwbHkoeGhyLCBcIm9wZW5cIiwgeGhyQXJncyk7XG4gICAgfTtcbiAgICBGYWtlWE1MSHR0cFJlcXVlc3QudXNlRmlsdGVycyA9IGZhbHNlO1xuXG4gICAgZnVuY3Rpb24gdmVyaWZ5UmVxdWVzdE9wZW5lZCh4aHIpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlICE9PSBGYWtlWE1MSHR0cFJlcXVlc3QuT1BFTkVEKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJTlZBTElEX1NUQVRFX0VSUiAtIFwiICsgeGhyLnJlYWR5U3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmVyaWZ5UmVxdWVzdFNlbnQoeGhyKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gRmFrZVhNTEh0dHBSZXF1ZXN0LkRPTkUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlcXVlc3QgZG9uZVwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZlcmlmeUhlYWRlcnNSZWNlaXZlZCh4aHIpIHtcbiAgICAgICAgaWYgKHhoci5hc3luYyAmJiB4aHIucmVhZHlTdGF0ZSAhPT0gRmFrZVhNTEh0dHBSZXF1ZXN0LkhFQURFUlNfUkVDRUlWRUQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGhlYWRlcnMgcmVjZWl2ZWRcIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2ZXJpZnlSZXNwb25zZUJvZHlUeXBlKGJvZHkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVzcG9uZCB0byBmYWtlIFhNTEh0dHBSZXF1ZXN0IHdpdGggXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keSArIFwiLCB3aGljaCBpcyBub3QgYSBzdHJpbmcuXCIpO1xuICAgICAgICAgICAgZXJyb3IubmFtZSA9IFwiSW52YWxpZEJvZHlFeGNlcHRpb25cIjtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29udmVydFRvQXJyYXlCdWZmZXIoYm9keSkge1xuICAgICAgICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJvZHkubGVuZ3RoKTtcbiAgICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJvZHkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjaGFyQ29kZSA9IGJvZHkuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIGlmIChjaGFyQ29kZSA+PSAyNTYpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJyYXlidWZmZXIgb3IgYmxvYiByZXNwb25zZVR5cGVzIHJlcXVpcmUgYmluYXJ5IHN0cmluZywgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpbnZhbGlkIGNoYXJhY3RlciBcIiArIGJvZHlbaV0gKyBcIiBmb3VuZC5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2aWV3W2ldID0gY2hhckNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1htbENvbnRlbnRUeXBlKGNvbnRlbnRUeXBlKSB7XG4gICAgICAgIHJldHVybiAhY29udGVudFR5cGUgfHwgLyh0ZXh0XFwveG1sKXwoYXBwbGljYXRpb25cXC94bWwpfChcXCt4bWwpLy50ZXN0KGNvbnRlbnRUeXBlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb252ZXJ0UmVzcG9uc2VCb2R5KHJlc3BvbnNlVHlwZSwgY29udGVudFR5cGUsIGJvZHkpIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlVHlwZSA9PT0gXCJcIiB8fCByZXNwb25zZVR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgfSBlbHNlIGlmIChzdXBwb3J0c0FycmF5QnVmZmVyICYmIHJlc3BvbnNlVHlwZSA9PT0gXCJhcnJheWJ1ZmZlclwiKSB7XG4gICAgICAgICAgICByZXR1cm4gY29udmVydFRvQXJyYXlCdWZmZXIoYm9keSk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVzcG9uc2VUeXBlID09PSBcImpzb25cIikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBSZXR1cm4gcGFyc2luZyBmYWlsdXJlIGFzIG51bGxcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzdXBwb3J0c0Jsb2IgJiYgcmVzcG9uc2VUeXBlID09PSBcImJsb2JcIikge1xuICAgICAgICAgICAgdmFyIGJsb2JPcHRpb25zID0ge307XG4gICAgICAgICAgICBpZiAoY29udGVudFR5cGUpIHtcbiAgICAgICAgICAgICAgICBibG9iT3B0aW9ucy50eXBlID0gY29udGVudFR5cGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IEJsb2IoW2NvbnZlcnRUb0FycmF5QnVmZmVyKGJvZHkpXSwgYmxvYk9wdGlvbnMpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlc3BvbnNlVHlwZSA9PT0gXCJkb2N1bWVudFwiKSB7XG4gICAgICAgICAgICBpZiAoaXNYbWxDb250ZW50VHlwZShjb250ZW50VHlwZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gRmFrZVhNTEh0dHBSZXF1ZXN0LnBhcnNlWE1MKGJvZHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCByZXNwb25zZVR5cGUgXCIgKyByZXNwb25zZVR5cGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsZWFyUmVzcG9uc2UoeGhyKSB7XG4gICAgICAgIGlmICh4aHIucmVzcG9uc2VUeXBlID09PSBcIlwiIHx8IHhoci5yZXNwb25zZVR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICAgICAgICB4aHIucmVzcG9uc2UgPSB4aHIucmVzcG9uc2VUZXh0ID0gXCJcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHhoci5yZXNwb25zZSA9IHhoci5yZXNwb25zZVRleHQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHhoci5yZXNwb25zZVhNTCA9IG51bGw7XG4gICAgfVxuXG4gICAgRmFrZVhNTEh0dHBSZXF1ZXN0LnBhcnNlWE1MID0gZnVuY3Rpb24gcGFyc2VYTUwodGV4dCkge1xuICAgICAgICAvLyBUcmVhdCBlbXB0eSBzdHJpbmcgYXMgcGFyc2luZyBmYWlsdXJlXG4gICAgICAgIGlmICh0ZXh0ICE9PSBcIlwiKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgRE9NUGFyc2VyICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwYXJzZXIgPSBuZXcgRE9NUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKHRleHQsIFwidGV4dC94bWxcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciB4bWxEb2MgPSBuZXcgd2luZG93LkFjdGl2ZVhPYmplY3QoXCJNaWNyb3NvZnQuWE1MRE9NXCIpO1xuICAgICAgICAgICAgICAgIHhtbERvYy5hc3luYyA9IFwiZmFsc2VcIjtcbiAgICAgICAgICAgICAgICB4bWxEb2MubG9hZFhNTCh0ZXh0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4geG1sRG9jO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFVuYWJsZSB0byBwYXJzZSBYTUwgLSBubyBiaWdnaWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBGYWtlWE1MSHR0cFJlcXVlc3Quc3RhdHVzQ29kZXMgPSB7XG4gICAgICAgIDEwMDogXCJDb250aW51ZVwiLFxuICAgICAgICAxMDE6IFwiU3dpdGNoaW5nIFByb3RvY29sc1wiLFxuICAgICAgICAyMDA6IFwiT0tcIixcbiAgICAgICAgMjAxOiBcIkNyZWF0ZWRcIixcbiAgICAgICAgMjAyOiBcIkFjY2VwdGVkXCIsXG4gICAgICAgIDIwMzogXCJOb24tQXV0aG9yaXRhdGl2ZSBJbmZvcm1hdGlvblwiLFxuICAgICAgICAyMDQ6IFwiTm8gQ29udGVudFwiLFxuICAgICAgICAyMDU6IFwiUmVzZXQgQ29udGVudFwiLFxuICAgICAgICAyMDY6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gICAgICAgIDIwNzogXCJNdWx0aS1TdGF0dXNcIixcbiAgICAgICAgMzAwOiBcIk11bHRpcGxlIENob2ljZVwiLFxuICAgICAgICAzMDE6IFwiTW92ZWQgUGVybWFuZW50bHlcIixcbiAgICAgICAgMzAyOiBcIkZvdW5kXCIsXG4gICAgICAgIDMwMzogXCJTZWUgT3RoZXJcIixcbiAgICAgICAgMzA0OiBcIk5vdCBNb2RpZmllZFwiLFxuICAgICAgICAzMDU6IFwiVXNlIFByb3h5XCIsXG4gICAgICAgIDMwNzogXCJUZW1wb3JhcnkgUmVkaXJlY3RcIixcbiAgICAgICAgNDAwOiBcIkJhZCBSZXF1ZXN0XCIsXG4gICAgICAgIDQwMTogXCJVbmF1dGhvcml6ZWRcIixcbiAgICAgICAgNDAyOiBcIlBheW1lbnQgUmVxdWlyZWRcIixcbiAgICAgICAgNDAzOiBcIkZvcmJpZGRlblwiLFxuICAgICAgICA0MDQ6IFwiTm90IEZvdW5kXCIsXG4gICAgICAgIDQwNTogXCJNZXRob2QgTm90IEFsbG93ZWRcIixcbiAgICAgICAgNDA2OiBcIk5vdCBBY2NlcHRhYmxlXCIsXG4gICAgICAgIDQwNzogXCJQcm94eSBBdXRoZW50aWNhdGlvbiBSZXF1aXJlZFwiLFxuICAgICAgICA0MDg6IFwiUmVxdWVzdCBUaW1lb3V0XCIsXG4gICAgICAgIDQwOTogXCJDb25mbGljdFwiLFxuICAgICAgICA0MTA6IFwiR29uZVwiLFxuICAgICAgICA0MTE6IFwiTGVuZ3RoIFJlcXVpcmVkXCIsXG4gICAgICAgIDQxMjogXCJQcmVjb25kaXRpb24gRmFpbGVkXCIsXG4gICAgICAgIDQxMzogXCJSZXF1ZXN0IEVudGl0eSBUb28gTGFyZ2VcIixcbiAgICAgICAgNDE0OiBcIlJlcXVlc3QtVVJJIFRvbyBMb25nXCIsXG4gICAgICAgIDQxNTogXCJVbnN1cHBvcnRlZCBNZWRpYSBUeXBlXCIsXG4gICAgICAgIDQxNjogXCJSZXF1ZXN0ZWQgUmFuZ2UgTm90IFNhdGlzZmlhYmxlXCIsXG4gICAgICAgIDQxNzogXCJFeHBlY3RhdGlvbiBGYWlsZWRcIixcbiAgICAgICAgNDIyOiBcIlVucHJvY2Vzc2FibGUgRW50aXR5XCIsXG4gICAgICAgIDUwMDogXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIixcbiAgICAgICAgNTAxOiBcIk5vdCBJbXBsZW1lbnRlZFwiLFxuICAgICAgICA1MDI6IFwiQmFkIEdhdGV3YXlcIixcbiAgICAgICAgNTAzOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgICAgNTA0OiBcIkdhdGV3YXkgVGltZW91dFwiLFxuICAgICAgICA1MDU6IFwiSFRUUCBWZXJzaW9uIE5vdCBTdXBwb3J0ZWRcIlxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHNpbm9uLnhociA9IHNpbm9uWGhyO1xuXG4gICAgICAgIHNpbm9uLmV4dGVuZChGYWtlWE1MSHR0cFJlcXVlc3QucHJvdG90eXBlLCBzaW5vbi5FdmVudFRhcmdldCwge1xuICAgICAgICAgICAgYXN5bmM6IHRydWUsXG5cbiAgICAgICAgICAgIG9wZW46IGZ1bmN0aW9uIG9wZW4obWV0aG9kLCB1cmwsIGFzeW5jLCB1c2VybmFtZSwgcGFzc3dvcmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1ldGhvZCA9IG1ldGhvZDtcbiAgICAgICAgICAgICAgICB0aGlzLnVybCA9IHVybDtcbiAgICAgICAgICAgICAgICB0aGlzLmFzeW5jID0gdHlwZW9mIGFzeW5jID09PSBcImJvb2xlYW5cIiA/IGFzeW5jIDogdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnVzZXJuYW1lID0gdXNlcm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXNzd29yZCA9IHBhc3N3b3JkO1xuICAgICAgICAgICAgICAgIGNsZWFyUmVzcG9uc2UodGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGVhZGVycyA9IHt9O1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEZsYWcgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGlmIChGYWtlWE1MSHR0cFJlcXVlc3QudXNlRmlsdGVycyA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgeGhyQXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRlZmFrZSA9IHNvbWUoRmFrZVhNTEh0dHBSZXF1ZXN0LmZpbHRlcnMsIGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuYXBwbHkodGhpcywgeGhyQXJncyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGVmYWtlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gRmFrZVhNTEh0dHBSZXF1ZXN0LmRlZmFrZSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZUNoYW5nZShGYWtlWE1MSHR0cFJlcXVlc3QuT1BFTkVEKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlYWR5U3RhdGVDaGFuZ2U6IGZ1bmN0aW9uIHJlYWR5U3RhdGVDaGFuZ2Uoc3RhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBzdGF0ZTtcblxuICAgICAgICAgICAgICAgIHZhciByZWFkeVN0YXRlQ2hhbmdlRXZlbnQgPSBuZXcgc2lub24uRXZlbnQoXCJyZWFkeXN0YXRlY2hhbmdlXCIsIGZhbHNlLCBmYWxzZSwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMub25yZWFkeXN0YXRlY2hhbmdlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25yZWFkeXN0YXRlY2hhbmdlKHJlYWR5U3RhdGVDaGFuZ2VFdmVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbm9uLmxvZ0Vycm9yKFwiRmFrZSBYSFIgb25yZWFkeXN0YXRlY2hhbmdlIGhhbmRsZXJcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEZha2VYTUxIdHRwUmVxdWVzdC5ET05FOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRzUHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZC5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5Qcm9ncmVzc0V2ZW50KFwicHJvZ3Jlc3NcIiwge2xvYWRlZDogMTAwLCB0b3RhbDogMTAwfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uUHJvZ3Jlc3NFdmVudChcInByb2dyZXNzXCIsIHtsb2FkZWQ6IDEwMCwgdG90YWw6IDEwMH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkLmRpc3BhdGNoRXZlbnQobmV3IHNpbm9uLkV2ZW50KFwibG9hZFwiLCBmYWxzZSwgZmFsc2UsIHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uRXZlbnQoXCJsb2FkXCIsIGZhbHNlLCBmYWxzZSwgdGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5FdmVudChcImxvYWRlbmRcIiwgZmFsc2UsIGZhbHNlLCB0aGlzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQocmVhZHlTdGF0ZUNoYW5nZUV2ZW50KTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHNldFJlcXVlc3RIZWFkZXI6IGZ1bmN0aW9uIHNldFJlcXVlc3RIZWFkZXIoaGVhZGVyLCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHZlcmlmeVN0YXRlKHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHVuc2FmZUhlYWRlcnNbaGVhZGVyXSB8fCAvXihTZWMtfFByb3h5LSkvLnRlc3QoaGVhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZWZ1c2VkIHRvIHNldCB1bnNhZmUgaGVhZGVyIFxcXCJcIiArIGhlYWRlciArIFwiXFxcIlwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZXF1ZXN0SGVhZGVyc1toZWFkZXJdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEhlYWRlcnNbaGVhZGVyXSArPSBcIixcIiArIHZhbHVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEhlYWRlcnNbaGVhZGVyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8vIEhlbHBzIHRlc3RpbmdcbiAgICAgICAgICAgIHNldFJlc3BvbnNlSGVhZGVyczogZnVuY3Rpb24gc2V0UmVzcG9uc2VIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlSZXF1ZXN0T3BlbmVkKHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VIZWFkZXJzID0ge307XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBoZWFkZXIgaW4gaGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGVhZGVycy5oYXNPd25Qcm9wZXJ0eShoZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlSGVhZGVyc1toZWFkZXJdID0gaGVhZGVyc1toZWFkZXJdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXN5bmMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYTUxIdHRwUmVxdWVzdC5IRUFERVJTX1JFQ0VJVkVEKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBGYWtlWE1MSHR0cFJlcXVlc3QuSEVBREVSU19SRUNFSVZFRDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvLyBDdXJyZW50bHkgdHJlYXRzIEFMTCBkYXRhIGFzIGEgRE9NU3RyaW5nIChpLmUuIG5vIERvY3VtZW50KVxuICAgICAgICAgICAgc2VuZDogZnVuY3Rpb24gc2VuZChkYXRhKSB7XG4gICAgICAgICAgICAgICAgdmVyaWZ5U3RhdGUodGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIS9eKGdldHxoZWFkKSQvaS50ZXN0KHRoaXMubWV0aG9kKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY29udGVudFR5cGUgPSBnZXRIZWFkZXIodGhpcy5yZXF1ZXN0SGVhZGVycywgXCJDb250ZW50LVR5cGVcIik7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlcXVlc3RIZWFkZXJzW2NvbnRlbnRUeXBlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gdGhpcy5yZXF1ZXN0SGVhZGVyc1tjb250ZW50VHlwZV0uc3BsaXQoXCI7XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGVhZGVyc1tjb250ZW50VHlwZV0gPSB2YWx1ZVswXSArIFwiO2NoYXJzZXQ9dXRmLThcIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdXBwb3J0c0Zvcm1EYXRhICYmICEoZGF0YSBpbnN0YW5jZW9mIEZvcm1EYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSA9IFwidGV4dC9wbGFpbjtjaGFyc2V0PXV0Zi04XCI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RCb2R5ID0gZGF0YTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmVycm9yRmxhZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEZsYWcgPSB0aGlzLmFzeW5jO1xuICAgICAgICAgICAgICAgIGNsZWFyUmVzcG9uc2UodGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYTUxIdHRwUmVxdWVzdC5PUEVORUQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uU2VuZCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25TZW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uRXZlbnQoXCJsb2Fkc3RhcnRcIiwgZmFsc2UsIGZhbHNlLCB0aGlzKSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBhYm9ydDogZnVuY3Rpb24gYWJvcnQoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjbGVhclJlc3BvbnNlKHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JGbGFnID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzID0ge307XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZUhlYWRlcnMgPSB7fTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPiBGYWtlWE1MSHR0cFJlcXVlc3QuVU5TRU5UICYmIHRoaXMuc2VuZEZsYWcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYTUxIdHRwUmVxdWVzdC5ET05FKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kRmxhZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IEZha2VYTUxIdHRwUmVxdWVzdC5VTlNFTlQ7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IHNpbm9uLkV2ZW50KFwiYWJvcnRcIiwgZmFsc2UsIGZhbHNlLCB0aGlzKSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZC5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5FdmVudChcImFib3J0XCIsIGZhbHNlLCBmYWxzZSwgdGhpcykpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uZXJyb3IgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uZXJyb3IoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXRSZXNwb25zZUhlYWRlcjogZnVuY3Rpb24gZ2V0UmVzcG9uc2VIZWFkZXIoaGVhZGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA8IEZha2VYTUxIdHRwUmVxdWVzdC5IRUFERVJTX1JFQ0VJVkVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICgvXlNldC1Db29raWUyPyQvaS50ZXN0KGhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaGVhZGVyID0gZ2V0SGVhZGVyKHRoaXMucmVzcG9uc2VIZWFkZXJzLCBoZWFkZXIpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzcG9uc2VIZWFkZXJzW2hlYWRlcl0gfHwgbnVsbDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGdldEFsbFJlc3BvbnNlSGVhZGVyczogZnVuY3Rpb24gZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPCBGYWtlWE1MSHR0cFJlcXVlc3QuSEVBREVSU19SRUNFSVZFRCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IFwiXCI7XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBoZWFkZXIgaW4gdGhpcy5yZXNwb25zZUhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVzcG9uc2VIZWFkZXJzLmhhc093blByb3BlcnR5KGhlYWRlcikgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICEvXlNldC1Db29raWUyPyQvaS50ZXN0KGhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnMgKz0gaGVhZGVyICsgXCI6IFwiICsgdGhpcy5yZXNwb25zZUhlYWRlcnNbaGVhZGVyXSArIFwiXFxyXFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVycztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHNldFJlc3BvbnNlQm9keTogZnVuY3Rpb24gc2V0UmVzcG9uc2VCb2R5KGJvZHkpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlSZXF1ZXN0U2VudCh0aGlzKTtcbiAgICAgICAgICAgICAgICB2ZXJpZnlIZWFkZXJzUmVjZWl2ZWQodGhpcyk7XG4gICAgICAgICAgICAgICAgdmVyaWZ5UmVzcG9uc2VCb2R5VHlwZShib2R5KTtcbiAgICAgICAgICAgICAgICB2YXIgY29udGVudFR5cGUgPSB0aGlzLmdldFJlc3BvbnNlSGVhZGVyKFwiQ29udGVudC1UeXBlXCIpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGlzVGV4dFJlc3BvbnNlID0gdGhpcy5yZXNwb25zZVR5cGUgPT09IFwiXCIgfHwgdGhpcy5yZXNwb25zZVR5cGUgPT09IFwidGV4dFwiO1xuICAgICAgICAgICAgICAgIGNsZWFyUmVzcG9uc2UodGhpcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXN5bmMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNodW5rU2l6ZSA9IHRoaXMuY2h1bmtTaXplIHx8IDEwO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZUNoYW5nZShGYWtlWE1MSHR0cFJlcXVlc3QuTE9BRElORyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1RleHRSZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VUZXh0ID0gdGhpcy5yZXNwb25zZSArPSBib2R5LnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyBjaHVua1NpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gY2h1bmtTaXplO1xuICAgICAgICAgICAgICAgICAgICB9IHdoaWxlIChpbmRleCA8IGJvZHkubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlID0gY29udmVydFJlc3BvbnNlQm9keSh0aGlzLnJlc3BvbnNlVHlwZSwgY29udGVudFR5cGUsIGJvZHkpO1xuICAgICAgICAgICAgICAgIGlmIChpc1RleHRSZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlVGV4dCA9IHRoaXMucmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVzcG9uc2VUeXBlID09PSBcImRvY3VtZW50XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZVhNTCA9IHRoaXMucmVzcG9uc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJlc3BvbnNlVHlwZSA9PT0gXCJcIiAmJiBpc1htbENvbnRlbnRUeXBlKGNvbnRlbnRUeXBlKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlWE1MID0gRmFrZVhNTEh0dHBSZXF1ZXN0LnBhcnNlWE1MKHRoaXMucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYTUxIdHRwUmVxdWVzdC5ET05FKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlc3BvbmQ6IGZ1bmN0aW9uIHJlc3BvbmQoc3RhdHVzLCBoZWFkZXJzLCBib2R5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSB0eXBlb2Ygc3RhdHVzID09PSBcIm51bWJlclwiID8gc3RhdHVzIDogMjAwO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHVzVGV4dCA9IEZha2VYTUxIdHRwUmVxdWVzdC5zdGF0dXNDb2Rlc1t0aGlzLnN0YXR1c107XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRSZXNwb25zZUhlYWRlcnMoaGVhZGVycyB8fCB7fSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRSZXNwb25zZUJvZHkoYm9keSB8fCBcIlwiKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHVwbG9hZFByb2dyZXNzOiBmdW5jdGlvbiB1cGxvYWRQcm9ncmVzcyhwcm9ncmVzc0V2ZW50UmF3KSB7XG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRzUHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGxvYWQuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uUHJvZ3Jlc3NFdmVudChcInByb2dyZXNzXCIsIHByb2dyZXNzRXZlbnRSYXcpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBkb3dubG9hZFByb2dyZXNzOiBmdW5jdGlvbiBkb3dubG9hZFByb2dyZXNzKHByb2dyZXNzRXZlbnRSYXcpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3VwcG9ydHNQcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IHNpbm9uLlByb2dyZXNzRXZlbnQoXCJwcm9ncmVzc1wiLCBwcm9ncmVzc0V2ZW50UmF3KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdXBsb2FkRXJyb3I6IGZ1bmN0aW9uIHVwbG9hZEVycm9yKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRzQ3VzdG9tRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGxvYWQuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uQ3VzdG9tRXZlbnQoXCJlcnJvclwiLCB7ZGV0YWlsOiBlcnJvcn0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNpbm9uLmV4dGVuZChGYWtlWE1MSHR0cFJlcXVlc3QsIHtcbiAgICAgICAgICAgIFVOU0VOVDogMCxcbiAgICAgICAgICAgIE9QRU5FRDogMSxcbiAgICAgICAgICAgIEhFQURFUlNfUkVDRUlWRUQ6IDIsXG4gICAgICAgICAgICBMT0FESU5HOiAzLFxuICAgICAgICAgICAgRE9ORTogNFxuICAgICAgICB9KTtcblxuICAgICAgICBzaW5vbi51c2VGYWtlWE1MSHR0cFJlcXVlc3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBGYWtlWE1MSHR0cFJlcXVlc3QucmVzdG9yZSA9IGZ1bmN0aW9uIHJlc3RvcmUoa2VlcE9uQ3JlYXRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpbm9uWGhyLnN1cHBvcnRzWEhSKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5YTUxIdHRwUmVxdWVzdCA9IHNpbm9uWGhyLkdsb2JhbFhNTEh0dHBSZXF1ZXN0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzaW5vblhoci5zdXBwb3J0c0FjdGl2ZVgpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLkFjdGl2ZVhPYmplY3QgPSBzaW5vblhoci5HbG9iYWxBY3RpdmVYT2JqZWN0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlbGV0ZSBGYWtlWE1MSHR0cFJlcXVlc3QucmVzdG9yZTtcblxuICAgICAgICAgICAgICAgIGlmIChrZWVwT25DcmVhdGUgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIEZha2VYTUxIdHRwUmVxdWVzdC5vbkNyZWF0ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHNpbm9uWGhyLnN1cHBvcnRzWEhSKSB7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0ID0gRmFrZVhNTEh0dHBSZXF1ZXN0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2lub25YaHIuc3VwcG9ydHNBY3RpdmVYKSB7XG4gICAgICAgICAgICAgICAgZ2xvYmFsLkFjdGl2ZVhPYmplY3QgPSBmdW5jdGlvbiBBY3RpdmVYT2JqZWN0KG9iaklkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvYmpJZCA9PT0gXCJNaWNyb3NvZnQuWE1MSFRUUFwiIHx8IC9eTXN4bWwyXFwuWE1MSFRUUC9pLnRlc3Qob2JqSWQpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRmFrZVhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHNpbm9uWGhyLkdsb2JhbEFjdGl2ZVhPYmplY3Qob2JqSWQpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBGYWtlWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uRmFrZVhNTEh0dHBSZXF1ZXN0ID0gRmFrZVhNTEh0dHBSZXF1ZXN0O1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi4vZXh0ZW5kXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9ldmVudFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4uL2xvZ19lcnJvclwiKTtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gc2lub247XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiwgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuICAgIHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiBzZWxmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBmdW5jdGlvbiB3YWxrSW50ZXJuYWwob2JqLCBpdGVyYXRvciwgY29udGV4dCwgb3JpZ2luYWxPYmopIHtcbiAgICAgICAgICAgIHZhciBwcm90bywgcHJvcDtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgZXhwbGljaXRseSB3YW50IHRvIGVudW1lcmF0ZSB0aHJvdWdoIGFsbCBvZiB0aGUgcHJvdG90eXBlJ3MgcHJvcGVydGllc1xuICAgICAgICAgICAgICAgIC8vIGluIHRoaXMgY2FzZSwgdGhlcmVmb3JlIHdlIGRlbGliZXJhdGVseSBsZWF2ZSBvdXQgYW4gb3duIHByb3BlcnR5IGNoZWNrLlxuICAgICAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIGd1YXJkLWZvci1pbiAqL1xuICAgICAgICAgICAgICAgIGZvciAocHJvcCBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbcHJvcF0sIHByb3AsIG9iaik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8qIGVzbGludC1lbmFibGUgZ3VhcmQtZm9yLWluICovXG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaikuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIGspLmdldCA9PT0gXCJmdW5jdGlvblwiID9cbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxPYmogOiBvYmo7XG4gICAgICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCB0YXJnZXRba10sIGssIHRhcmdldCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKTtcbiAgICAgICAgICAgIGlmIChwcm90bykge1xuICAgICAgICAgICAgICAgIHdhbGtJbnRlcm5hbChwcm90bywgaXRlcmF0b3IsIGNvbnRleHQsIG9yaWdpbmFsT2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFB1YmxpYzogd2Fsa3MgdGhlIHByb3RvdHlwZSBjaGFpbiBvZiBhbiBvYmplY3QgYW5kIGl0ZXJhdGVzIG92ZXIgZXZlcnkgb3duIHByb3BlcnR5XG4gICAgICAgICAqIG5hbWUgZW5jb3VudGVyZWQuIFRoZSBpdGVyYXRvciBpcyBjYWxsZWQgaW4gdGhlIHNhbWUgZmFzaGlvbiB0aGF0IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoXG4gICAgICAgICAqIHdvcmtzLCB3aGVyZSBpdCBpcyBwYXNzZWQgdGhlIHZhbHVlLCBrZXksIGFuZCBvd24gb2JqZWN0IGFzIHRoZSAxc3QsIDJuZCwgYW5kIDNyZCBwb3NpdGlvbmFsXG4gICAgICAgICAqIGFyZ3VtZW50LCByZXNwZWN0aXZlbHkuIEluIGNhc2VzIHdoZXJlIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIGlzIG5vdCBhdmFpbGFibGUsIHdhbGsgd2lsbFxuICAgICAgICAgKiBkZWZhdWx0IHRvIHVzaW5nIGEgc2ltcGxlIGZvci4uaW4gbG9vcC5cbiAgICAgICAgICpcbiAgICAgICAgICogb2JqIC0gVGhlIG9iamVjdCB0byB3YWxrIHRoZSBwcm90b3R5cGUgY2hhaW4gZm9yLlxuICAgICAgICAgKiBpdGVyYXRvciAtIFRoZSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb24gZWFjaCBwYXNzIG9mIHRoZSB3YWxrLlxuICAgICAgICAgKiBjb250ZXh0IC0gKE9wdGlvbmFsKSBXaGVuIGdpdmVuLCB0aGUgaXRlcmF0b3Igd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGlzIG9iamVjdCBhcyB0aGUgcmVjZWl2ZXIuXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiB3YWxrKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB3YWxrSW50ZXJuYWwob2JqLCBpdGVyYXRvciwgY29udGV4dCwgb2JqKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLndhbGsgPSB3YWxrO1xuICAgICAgICByZXR1cm4gc2lub24ud2FsaztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi91dGlsL2NvcmVcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIoKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kICYmIGZ1bmN0aW9uIChtKSB7XG4gICAgZGVmaW5lKFwiZm9ybWF0aW9cIiwgW1wic2Ftc2FtXCJdLCBtKTtcbn0pIHx8ICh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiICYmIGZ1bmN0aW9uIChtKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBtKHJlcXVpcmUoXCJzYW1zYW1cIikpO1xufSkgfHwgZnVuY3Rpb24gKG0pIHsgdGhpcy5mb3JtYXRpbyA9IG0odGhpcy5zYW1zYW0pOyB9XG4pKGZ1bmN0aW9uIChzYW1zYW0pIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBmb3JtYXRpbyA9IHtcbiAgICAgICAgZXhjbHVkZUNvbnN0cnVjdG9yczogW1wiT2JqZWN0XCIsIC9eLiQvXSxcbiAgICAgICAgcXVvdGVTdHJpbmdzOiB0cnVlLFxuICAgICAgICBsaW1pdENoaWxkcmVuQ291bnQ6IDBcbiAgICB9O1xuXG4gICAgdmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbiAgICB2YXIgc3BlY2lhbE9iamVjdHMgPSBbXTtcbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICBzcGVjaWFsT2JqZWN0cy5wdXNoKHsgb2JqZWN0OiBnbG9iYWwsIHZhbHVlOiBcIltvYmplY3QgZ2xvYmFsXVwiIH0pO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHNwZWNpYWxPYmplY3RzLnB1c2goe1xuICAgICAgICAgICAgb2JqZWN0OiBkb2N1bWVudCxcbiAgICAgICAgICAgIHZhbHVlOiBcIltvYmplY3QgSFRNTERvY3VtZW50XVwiXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICBzcGVjaWFsT2JqZWN0cy5wdXNoKHsgb2JqZWN0OiB3aW5kb3csIHZhbHVlOiBcIltvYmplY3QgV2luZG93XVwiIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZ1bmN0aW9uTmFtZShmdW5jKSB7XG4gICAgICAgIGlmICghZnVuYykgeyByZXR1cm4gXCJcIjsgfVxuICAgICAgICBpZiAoZnVuYy5kaXNwbGF5TmFtZSkgeyByZXR1cm4gZnVuYy5kaXNwbGF5TmFtZTsgfVxuICAgICAgICBpZiAoZnVuYy5uYW1lKSB7IHJldHVybiBmdW5jLm5hbWU7IH1cbiAgICAgICAgdmFyIG1hdGNoZXMgPSBmdW5jLnRvU3RyaW5nKCkubWF0Y2goL2Z1bmN0aW9uXFxzKyhbXlxcKF0rKS9tKTtcbiAgICAgICAgcmV0dXJuIChtYXRjaGVzICYmIG1hdGNoZXNbMV0pIHx8IFwiXCI7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29uc3RydWN0b3JOYW1lKGYsIG9iamVjdCkge1xuICAgICAgICB2YXIgbmFtZSA9IGZ1bmN0aW9uTmFtZShvYmplY3QgJiYgb2JqZWN0LmNvbnN0cnVjdG9yKTtcbiAgICAgICAgdmFyIGV4Y2x1ZGVzID0gZi5leGNsdWRlQ29uc3RydWN0b3JzIHx8XG4gICAgICAgICAgICAgICAgZm9ybWF0aW8uZXhjbHVkZUNvbnN0cnVjdG9ycyB8fCBbXTtcblxuICAgICAgICB2YXIgaSwgbDtcbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGV4Y2x1ZGVzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleGNsdWRlc1tpXSA9PT0gXCJzdHJpbmdcIiAmJiBleGNsdWRlc1tpXSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChleGNsdWRlc1tpXS50ZXN0ICYmIGV4Y2x1ZGVzW2ldLnRlc3QobmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuYW1lO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzQ2lyY3VsYXIob2JqZWN0LCBvYmplY3RzKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiKSB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICB2YXIgaSwgbDtcbiAgICAgICAgZm9yIChpID0gMCwgbCA9IG9iamVjdHMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0c1tpXSA9PT0gb2JqZWN0KSB7IHJldHVybiB0cnVlOyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFzY2lpKGYsIG9iamVjdCwgcHJvY2Vzc2VkLCBpbmRlbnQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHZhciBxcyA9IGYucXVvdGVTdHJpbmdzO1xuICAgICAgICAgICAgdmFyIHF1b3RlID0gdHlwZW9mIHFzICE9PSBcImJvb2xlYW5cIiB8fCBxcztcbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzZWQgfHwgcXVvdGUgPyAnXCInICsgb2JqZWN0ICsgJ1wiJyA6IG9iamVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ID09PSBcImZ1bmN0aW9uXCIgJiYgIShvYmplY3QgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICAgICAgICByZXR1cm4gYXNjaWkuZnVuYyhvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc2VkID0gcHJvY2Vzc2VkIHx8IFtdO1xuXG4gICAgICAgIGlmIChpc0NpcmN1bGFyKG9iamVjdCwgcHJvY2Vzc2VkKSkgeyByZXR1cm4gXCJbQ2lyY3VsYXJdXCI7IH1cblxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT09IFwiW29iamVjdCBBcnJheV1cIikge1xuICAgICAgICAgICAgcmV0dXJuIGFzY2lpLmFycmF5LmNhbGwoZiwgb2JqZWN0LCBwcm9jZXNzZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvYmplY3QpIHsgcmV0dXJuIFN0cmluZygoMS9vYmplY3QpID09PSAtSW5maW5pdHkgPyBcIi0wXCIgOiBvYmplY3QpOyB9XG4gICAgICAgIGlmIChzYW1zYW0uaXNFbGVtZW50KG9iamVjdCkpIHsgcmV0dXJuIGFzY2lpLmVsZW1lbnQob2JqZWN0KTsgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0LnRvU3RyaW5nID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICAgICAgICAgICBvYmplY3QudG9TdHJpbmcgIT09IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmplY3QudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpLCBsO1xuICAgICAgICBmb3IgKGkgPSAwLCBsID0gc3BlY2lhbE9iamVjdHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0ID09PSBzcGVjaWFsT2JqZWN0c1tpXS5vYmplY3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3BlY2lhbE9iamVjdHNbaV0udmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXNjaWkub2JqZWN0LmNhbGwoZiwgb2JqZWN0LCBwcm9jZXNzZWQsIGluZGVudCk7XG4gICAgfVxuXG4gICAgYXNjaWkuZnVuYyA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gICAgICAgIHJldHVybiBcImZ1bmN0aW9uIFwiICsgZnVuY3Rpb25OYW1lKGZ1bmMpICsgXCIoKSB7fVwiO1xuICAgIH07XG5cbiAgICBhc2NpaS5hcnJheSA9IGZ1bmN0aW9uIChhcnJheSwgcHJvY2Vzc2VkKSB7XG4gICAgICAgIHByb2Nlc3NlZCA9IHByb2Nlc3NlZCB8fCBbXTtcbiAgICAgICAgcHJvY2Vzc2VkLnB1c2goYXJyYXkpO1xuICAgICAgICB2YXIgcGllY2VzID0gW107XG4gICAgICAgIHZhciBpLCBsO1xuICAgICAgICBsID0gKHRoaXMubGltaXRDaGlsZHJlbkNvdW50ID4gMCkgPyBcbiAgICAgICAgICAgIE1hdGgubWluKHRoaXMubGltaXRDaGlsZHJlbkNvdW50LCBhcnJheS5sZW5ndGgpIDogYXJyYXkubGVuZ3RoO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgIHBpZWNlcy5wdXNoKGFzY2lpKHRoaXMsIGFycmF5W2ldLCBwcm9jZXNzZWQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGwgPCBhcnJheS5sZW5ndGgpXG4gICAgICAgICAgICBwaWVjZXMucHVzaChcIlsuLi4gXCIgKyAoYXJyYXkubGVuZ3RoIC0gbCkgKyBcIiBtb3JlIGVsZW1lbnRzXVwiKTtcblxuICAgICAgICByZXR1cm4gXCJbXCIgKyBwaWVjZXMuam9pbihcIiwgXCIpICsgXCJdXCI7XG4gICAgfTtcblxuICAgIGFzY2lpLm9iamVjdCA9IGZ1bmN0aW9uIChvYmplY3QsIHByb2Nlc3NlZCwgaW5kZW50KSB7XG4gICAgICAgIHByb2Nlc3NlZCA9IHByb2Nlc3NlZCB8fCBbXTtcbiAgICAgICAgcHJvY2Vzc2VkLnB1c2gob2JqZWN0KTtcbiAgICAgICAgaW5kZW50ID0gaW5kZW50IHx8IDA7XG4gICAgICAgIHZhciBwaWVjZXMgPSBbXSwgcHJvcGVydGllcyA9IHNhbXNhbS5rZXlzKG9iamVjdCkuc29ydCgpO1xuICAgICAgICB2YXIgbGVuZ3RoID0gMztcbiAgICAgICAgdmFyIHByb3AsIHN0ciwgb2JqLCBpLCBrLCBsO1xuICAgICAgICBsID0gKHRoaXMubGltaXRDaGlsZHJlbkNvdW50ID4gMCkgPyBcbiAgICAgICAgICAgIE1hdGgubWluKHRoaXMubGltaXRDaGlsZHJlbkNvdW50LCBwcm9wZXJ0aWVzLmxlbmd0aCkgOiBwcm9wZXJ0aWVzLmxlbmd0aDtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICBwcm9wID0gcHJvcGVydGllc1tpXTtcbiAgICAgICAgICAgIG9iaiA9IG9iamVjdFtwcm9wXTtcblxuICAgICAgICAgICAgaWYgKGlzQ2lyY3VsYXIob2JqLCBwcm9jZXNzZWQpKSB7XG4gICAgICAgICAgICAgICAgc3RyID0gXCJbQ2lyY3VsYXJdXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0ciA9IGFzY2lpKHRoaXMsIG9iaiwgcHJvY2Vzc2VkLCBpbmRlbnQgKyAyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3RyID0gKC9cXHMvLnRlc3QocHJvcCkgPyAnXCInICsgcHJvcCArICdcIicgOiBwcm9wKSArIFwiOiBcIiArIHN0cjtcbiAgICAgICAgICAgIGxlbmd0aCArPSBzdHIubGVuZ3RoO1xuICAgICAgICAgICAgcGllY2VzLnB1c2goc3RyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb25zID0gY29uc3RydWN0b3JOYW1lKHRoaXMsIG9iamVjdCk7XG4gICAgICAgIHZhciBwcmVmaXggPSBjb25zID8gXCJbXCIgKyBjb25zICsgXCJdIFwiIDogXCJcIjtcbiAgICAgICAgdmFyIGlzID0gXCJcIjtcbiAgICAgICAgZm9yIChpID0gMCwgayA9IGluZGVudDsgaSA8IGs7ICsraSkgeyBpcyArPSBcIiBcIjsgfVxuXG4gICAgICAgIGlmKGwgPCBwcm9wZXJ0aWVzLmxlbmd0aClcbiAgICAgICAgICAgIHBpZWNlcy5wdXNoKFwiWy4uLiBcIiArIChwcm9wZXJ0aWVzLmxlbmd0aCAtIGwpICsgXCIgbW9yZSBlbGVtZW50c11cIik7XG5cbiAgICAgICAgaWYgKGxlbmd0aCArIGluZGVudCA+IDgwKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgXCJ7XFxuICBcIiArIGlzICsgcGllY2VzLmpvaW4oXCIsXFxuICBcIiArIGlzKSArIFwiXFxuXCIgK1xuICAgICAgICAgICAgICAgIGlzICsgXCJ9XCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByZWZpeCArIFwieyBcIiArIHBpZWNlcy5qb2luKFwiLCBcIikgKyBcIiB9XCI7XG4gICAgfTtcblxuICAgIGFzY2lpLmVsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICB2YXIgdGFnTmFtZSA9IGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgYXR0cnMgPSBlbGVtZW50LmF0dHJpYnV0ZXMsIGF0dHIsIHBhaXJzID0gW10sIGF0dHJOYW1lLCBpLCBsLCB2YWw7XG5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGF0dHJzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgYXR0ciA9IGF0dHJzLml0ZW0oaSk7XG4gICAgICAgICAgICBhdHRyTmFtZSA9IGF0dHIubm9kZU5hbWUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKFwiaHRtbDpcIiwgXCJcIik7XG4gICAgICAgICAgICB2YWwgPSBhdHRyLm5vZGVWYWx1ZTtcbiAgICAgICAgICAgIGlmIChhdHRyTmFtZSAhPT0gXCJjb250ZW50ZWRpdGFibGVcIiB8fCB2YWwgIT09IFwiaW5oZXJpdFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEhdmFsKSB7IHBhaXJzLnB1c2goYXR0ck5hbWUgKyBcIj1cXFwiXCIgKyB2YWwgKyBcIlxcXCJcIik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBmb3JtYXR0ZWQgPSBcIjxcIiArIHRhZ05hbWUgKyAocGFpcnMubGVuZ3RoID4gMCA/IFwiIFwiIDogXCJcIik7XG4gICAgICAgIHZhciBjb250ZW50ID0gZWxlbWVudC5pbm5lckhUTUw7XG5cbiAgICAgICAgaWYgKGNvbnRlbnQubGVuZ3RoID4gMjApIHtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnN1YnN0cigwLCAyMCkgKyBcIlsuLi5dXCI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVzID0gZm9ybWF0dGVkICsgcGFpcnMuam9pbihcIiBcIikgKyBcIj5cIiArIGNvbnRlbnQgK1xuICAgICAgICAgICAgICAgIFwiPC9cIiArIHRhZ05hbWUgKyBcIj5cIjtcblxuICAgICAgICByZXR1cm4gcmVzLnJlcGxhY2UoLyBjb250ZW50RWRpdGFibGU9XCJpbmhlcml0XCIvLCBcIlwiKTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gRm9ybWF0aW8ob3B0aW9ucykge1xuICAgICAgICBmb3IgKHZhciBvcHQgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgdGhpc1tvcHRdID0gb3B0aW9uc1tvcHRdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgRm9ybWF0aW8ucHJvdG90eXBlID0ge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IGZ1bmN0aW9uTmFtZSxcblxuICAgICAgICBjb25maWd1cmU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEZvcm1hdGlvKG9wdGlvbnMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGNvbnN0cnVjdG9yTmFtZTogZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbnN0cnVjdG9yTmFtZSh0aGlzLCBvYmplY3QpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFzY2lpOiBmdW5jdGlvbiAob2JqZWN0LCBwcm9jZXNzZWQsIGluZGVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGFzY2lpKHRoaXMsIG9iamVjdCwgcHJvY2Vzc2VkLCBpbmRlbnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBGb3JtYXRpby5wcm90b3R5cGU7XG59KTtcbiIsIi8qZ2xvYmFsIGdsb2JhbCwgd2luZG93Ki9cbi8qKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pIGFuZCBjb250cmlidXRvcnNcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDE0IENocmlzdGlhbiBKb2hhbnNlblxuICovXG5cbihmdW5jdGlvbiAoZ2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvLyBNYWtlIHByb3BlcnRpZXMgd3JpdGFibGUgaW4gSUUsIGFzIHBlclxuICAgIC8vIGh0dHA6Ly93d3cuYWRlcXVhdGVseWdvb2QuY29tL1JlcGxhY2luZy1zZXRUaW1lb3V0LUdsb2JhbGx5Lmh0bWxcbiAgICAvLyBKU0xpbnQgYmVpbmcgYW5hbFxuICAgIHZhciBnbGJsID0gZ2xvYmFsO1xuXG4gICAgZ2xvYmFsLnNldFRpbWVvdXQgPSBnbGJsLnNldFRpbWVvdXQ7XG4gICAgZ2xvYmFsLmNsZWFyVGltZW91dCA9IGdsYmwuY2xlYXJUaW1lb3V0O1xuICAgIGdsb2JhbC5zZXRJbnRlcnZhbCA9IGdsYmwuc2V0SW50ZXJ2YWw7XG4gICAgZ2xvYmFsLmNsZWFySW50ZXJ2YWwgPSBnbGJsLmNsZWFySW50ZXJ2YWw7XG4gICAgZ2xvYmFsLkRhdGUgPSBnbGJsLkRhdGU7XG5cbiAgICAvLyBzZXRJbW1lZGlhdGUgaXMgbm90IGEgc3RhbmRhcmQgZnVuY3Rpb25cbiAgICAvLyBhdm9pZCBhZGRpbmcgdGhlIHByb3AgdG8gdGhlIHdpbmRvdyBvYmplY3QgaWYgbm90IHByZXNlbnRcbiAgICBpZignc2V0SW1tZWRpYXRlJyBpbiBnbG9iYWwpIHtcbiAgICAgICAgZ2xvYmFsLnNldEltbWVkaWF0ZSA9IGdsYmwuc2V0SW1tZWRpYXRlO1xuICAgICAgICBnbG9iYWwuY2xlYXJJbW1lZGlhdGUgPSBnbGJsLmNsZWFySW1tZWRpYXRlO1xuICAgIH1cblxuICAgIC8vIG5vZGUgZXhwZWN0cyBzZXRUaW1lb3V0L3NldEludGVydmFsIHRvIHJldHVybiBhIGZuIG9iamVjdCB3LyAucmVmKCkvLnVucmVmKClcbiAgICAvLyBicm93c2VycywgYSBudW1iZXIuXG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jam9oYW5zZW4vU2lub24uSlMvcHVsbC80MzZcblxuICAgIHZhciBOT09QID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9O1xuICAgIHZhciB0aW1lb3V0UmVzdWx0ID0gc2V0VGltZW91dChOT09QLCAwKTtcbiAgICB2YXIgYWRkVGltZXJSZXR1cm5zT2JqZWN0ID0gdHlwZW9mIHRpbWVvdXRSZXN1bHQgPT09IFwib2JqZWN0XCI7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRSZXN1bHQpO1xuXG4gICAgdmFyIE5hdGl2ZURhdGUgPSBEYXRlO1xuICAgIHZhciB1bmlxdWVUaW1lcklkID0gMTtcblxuICAgIC8qKlxuICAgICAqIFBhcnNlIHN0cmluZ3MgbGlrZSBcIjAxOjEwOjAwXCIgKG1lYW5pbmcgMSBob3VyLCAxMCBtaW51dGVzLCAwIHNlY29uZHMpIGludG9cbiAgICAgKiBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLiBUaGlzIGlzIHVzZWQgdG8gc3VwcG9ydCBodW1hbi1yZWFkYWJsZSBzdHJpbmdzIHBhc3NlZFxuICAgICAqIHRvIGNsb2NrLnRpY2soKVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHBhcnNlVGltZShzdHIpIHtcbiAgICAgICAgaWYgKCFzdHIpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0cmluZ3MgPSBzdHIuc3BsaXQoXCI6XCIpO1xuICAgICAgICB2YXIgbCA9IHN0cmluZ3MubGVuZ3RoLCBpID0gbDtcbiAgICAgICAgdmFyIG1zID0gMCwgcGFyc2VkO1xuXG4gICAgICAgIGlmIChsID4gMyB8fCAhL14oXFxkXFxkOil7MCwyfVxcZFxcZD8kLy50ZXN0KHN0cikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInRpY2sgb25seSB1bmRlcnN0YW5kcyBudW1iZXJzIGFuZCAnaDptOnMnXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nc1tpXSwgMTApO1xuXG4gICAgICAgICAgICBpZiAocGFyc2VkID49IDYwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB0aW1lIFwiICsgc3RyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbXMgKz0gcGFyc2VkICogTWF0aC5wb3coNjAsIChsIC0gaSAtIDEpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtcyAqIDEwMDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBncm9rIHRoZSBgbm93YCBwYXJhbWV0ZXIgdG8gY3JlYXRlQ2xvY2suXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0RXBvY2goZXBvY2gpIHtcbiAgICAgICAgaWYgKCFlcG9jaCkgeyByZXR1cm4gMDsgfVxuICAgICAgICBpZiAodHlwZW9mIGVwb2NoLmdldFRpbWUgPT09IFwiZnVuY3Rpb25cIikgeyByZXR1cm4gZXBvY2guZ2V0VGltZSgpOyB9XG4gICAgICAgIGlmICh0eXBlb2YgZXBvY2ggPT09IFwibnVtYmVyXCIpIHsgcmV0dXJuIGVwb2NoOyB9XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJub3cgc2hvdWxkIGJlIG1pbGxpc2Vjb25kcyBzaW5jZSBVTklYIGVwb2NoXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluUmFuZ2UoZnJvbSwgdG8sIHRpbWVyKSB7XG4gICAgICAgIHJldHVybiB0aW1lciAmJiB0aW1lci5jYWxsQXQgPj0gZnJvbSAmJiB0aW1lci5jYWxsQXQgPD0gdG87XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWlycm9yRGF0ZVByb3BlcnRpZXModGFyZ2V0LCBzb3VyY2UpIHtcbiAgICAgICAgdmFyIHByb3A7XG4gICAgICAgIGZvciAocHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgc3BlY2lhbCBub3cgaW1wbGVtZW50YXRpb25cbiAgICAgICAgaWYgKHNvdXJjZS5ub3cpIHtcbiAgICAgICAgICAgIHRhcmdldC5ub3cgPSBmdW5jdGlvbiBub3coKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC5jbG9jay5ub3c7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRhcmdldC5ub3c7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgc3BlY2lhbCB0b1NvdXJjZSBpbXBsZW1lbnRhdGlvblxuICAgICAgICBpZiAoc291cmNlLnRvU291cmNlKSB7XG4gICAgICAgICAgICB0YXJnZXQudG9Tb3VyY2UgPSBmdW5jdGlvbiB0b1NvdXJjZSgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc291cmNlLnRvU291cmNlKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRhcmdldC50b1NvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBzcGVjaWFsIHRvU3RyaW5nIGltcGxlbWVudGF0aW9uXG4gICAgICAgIHRhcmdldC50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgICAgICAgICAgcmV0dXJuIHNvdXJjZS50b1N0cmluZygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRhcmdldC5wcm90b3R5cGUgPSBzb3VyY2UucHJvdG90eXBlO1xuICAgICAgICB0YXJnZXQucGFyc2UgPSBzb3VyY2UucGFyc2U7XG4gICAgICAgIHRhcmdldC5VVEMgPSBzb3VyY2UuVVRDO1xuICAgICAgICB0YXJnZXQucHJvdG90eXBlLnRvVVRDU3RyaW5nID0gc291cmNlLnByb3RvdHlwZS50b1VUQ1N0cmluZztcblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZURhdGUoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENsb2NrRGF0ZSh5ZWFyLCBtb250aCwgZGF0ZSwgaG91ciwgbWludXRlLCBzZWNvbmQsIG1zKSB7XG4gICAgICAgICAgICAvLyBEZWZlbnNpdmUgYW5kIHZlcmJvc2UgdG8gYXZvaWQgcG90ZW50aWFsIGhhcm0gaW4gcGFzc2luZ1xuICAgICAgICAgICAgLy8gZXhwbGljaXQgdW5kZWZpbmVkIHdoZW4gdXNlciBkb2VzIG5vdCBwYXNzIGFyZ3VtZW50XG4gICAgICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5hdGl2ZURhdGUoQ2xvY2tEYXRlLmNsb2NrLm5vdyk7XG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBOYXRpdmVEYXRlKHllYXIpO1xuICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTmF0aXZlRGF0ZSh5ZWFyLCBtb250aCk7XG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBOYXRpdmVEYXRlKHllYXIsIG1vbnRoLCBkYXRlKTtcbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5hdGl2ZURhdGUoeWVhciwgbW9udGgsIGRhdGUsIGhvdXIpO1xuICAgICAgICAgICAgY2FzZSA1OlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTmF0aXZlRGF0ZSh5ZWFyLCBtb250aCwgZGF0ZSwgaG91ciwgbWludXRlKTtcbiAgICAgICAgICAgIGNhc2UgNjpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5hdGl2ZURhdGUoeWVhciwgbW9udGgsIGRhdGUsIGhvdXIsIG1pbnV0ZSwgc2Vjb25kKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBOYXRpdmVEYXRlKHllYXIsIG1vbnRoLCBkYXRlLCBob3VyLCBtaW51dGUsIHNlY29uZCwgbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1pcnJvckRhdGVQcm9wZXJ0aWVzKENsb2NrRGF0ZSwgTmF0aXZlRGF0ZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVGltZXIoY2xvY2ssIHRpbWVyKSB7XG4gICAgICAgIGlmICh0aW1lci5mdW5jID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG11c3QgYmUgcHJvdmlkZWQgdG8gdGltZXIgY2FsbHNcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNsb2NrLnRpbWVycykge1xuICAgICAgICAgICAgY2xvY2sudGltZXJzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICB0aW1lci5pZCA9IHVuaXF1ZVRpbWVySWQrKztcbiAgICAgICAgdGltZXIuY3JlYXRlZEF0ID0gY2xvY2subm93O1xuICAgICAgICB0aW1lci5jYWxsQXQgPSBjbG9jay5ub3cgKyAodGltZXIuZGVsYXkgfHwgKGNsb2NrLmR1cmluZ1RpY2sgPyAxIDogMCkpO1xuXG4gICAgICAgIGNsb2NrLnRpbWVyc1t0aW1lci5pZF0gPSB0aW1lcjtcblxuICAgICAgICBpZiAoYWRkVGltZXJSZXR1cm5zT2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGlkOiB0aW1lci5pZCxcbiAgICAgICAgICAgICAgICByZWY6IE5PT1AsXG4gICAgICAgICAgICAgICAgdW5yZWY6IE5PT1BcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGltZXIuaWQ7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBjb21wYXJlVGltZXJzKGEsIGIpIHtcbiAgICAgICAgLy8gU29ydCBmaXJzdCBieSBhYnNvbHV0ZSB0aW1pbmdcbiAgICAgICAgaWYgKGEuY2FsbEF0IDwgYi5jYWxsQXQpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYS5jYWxsQXQgPiBiLmNhbGxBdCkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb3J0IG5leHQgYnkgaW1tZWRpYXRlLCBpbW1lZGlhdGUgdGltZXJzIHRha2UgcHJlY2VkZW5jZVxuICAgICAgICBpZiAoYS5pbW1lZGlhdGUgJiYgIWIuaW1tZWRpYXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFhLmltbWVkaWF0ZSAmJiBiLmltbWVkaWF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb3J0IG5leHQgYnkgY3JlYXRpb24gdGltZSwgZWFybGllci1jcmVhdGVkIHRpbWVycyB0YWtlIHByZWNlZGVuY2VcbiAgICAgICAgaWYgKGEuY3JlYXRlZEF0IDwgYi5jcmVhdGVkQXQpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYS5jcmVhdGVkQXQgPiBiLmNyZWF0ZWRBdCkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTb3J0IG5leHQgYnkgaWQsIGxvd2VyLWlkIHRpbWVycyB0YWtlIHByZWNlZGVuY2VcbiAgICAgICAgaWYgKGEuaWQgPCBiLmlkKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGEuaWQgPiBiLmlkKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzIHRpbWVyIGlkcyBhcmUgdW5pcXVlLCBubyBmYWxsYmFjayBgMGAgaXMgbmVjZXNzYXJ5XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlyc3RUaW1lckluUmFuZ2UoY2xvY2ssIGZyb20sIHRvKSB7XG4gICAgICAgIHZhciB0aW1lcnMgPSBjbG9jay50aW1lcnMsXG4gICAgICAgICAgICB0aW1lciA9IG51bGwsXG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICAgIGlzSW5SYW5nZTtcblxuICAgICAgICBmb3IgKGlkIGluIHRpbWVycykge1xuICAgICAgICAgICAgaWYgKHRpbWVycy5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICBpc0luUmFuZ2UgPSBpblJhbmdlKGZyb20sIHRvLCB0aW1lcnNbaWRdKTtcblxuICAgICAgICAgICAgICAgIGlmIChpc0luUmFuZ2UgJiYgKCF0aW1lciB8fCBjb21wYXJlVGltZXJzKHRpbWVyLCB0aW1lcnNbaWRdKSA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXIgPSB0aW1lcnNbaWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aW1lcjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxsVGltZXIoY2xvY2ssIHRpbWVyKSB7XG4gICAgICAgIHZhciBleGNlcHRpb247XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aW1lci5pbnRlcnZhbCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgY2xvY2sudGltZXJzW3RpbWVyLmlkXS5jYWxsQXQgKz0gdGltZXIuaW50ZXJ2YWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgY2xvY2sudGltZXJzW3RpbWVyLmlkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRpbWVyLmZ1bmMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHRpbWVyLmZ1bmMuYXBwbHkobnVsbCwgdGltZXIuYXJncyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV2YWwodGltZXIuZnVuYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGV4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNsb2NrLnRpbWVyc1t0aW1lci5pZF0pIHtcbiAgICAgICAgICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0aW1lclR5cGUodGltZXIpIHtcbiAgICAgICAgaWYgKHRpbWVyLmltbWVkaWF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIFwiSW1tZWRpYXRlXCI7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHRpbWVyLmludGVydmFsICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJJbnRlcnZhbFwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFwiVGltZW91dFwiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xlYXJUaW1lcihjbG9jaywgdGltZXJJZCwgdHR5cGUpIHtcbiAgICAgICAgaWYgKCF0aW1lcklkKSB7XG4gICAgICAgICAgICAvLyBudWxsIGFwcGVhcnMgdG8gYmUgYWxsb3dlZCBpbiBtb3N0IGJyb3dzZXJzLCBhbmQgYXBwZWFycyB0byBiZVxuICAgICAgICAgICAgLy8gcmVsaWVkIHVwb24gYnkgc29tZSBsaWJyYXJpZXMsIGxpa2UgQm9vdHN0cmFwIGNhcm91c2VsXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNsb2NrLnRpbWVycykge1xuICAgICAgICAgICAgY2xvY2sudGltZXJzID0gW107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbiBOb2RlLCB0aW1lcklkIGlzIGFuIG9iamVjdCB3aXRoIC5yZWYoKS8udW5yZWYoKSwgYW5kXG4gICAgICAgIC8vIGl0cyAuaWQgZmllbGQgaXMgdGhlIGFjdHVhbCB0aW1lciBpZC5cbiAgICAgICAgaWYgKHR5cGVvZiB0aW1lcklkID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICB0aW1lcklkID0gdGltZXJJZC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjbG9jay50aW1lcnMuaGFzT3duUHJvcGVydHkodGltZXJJZCkpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgdGhlIElEIG1hdGNoZXMgYSB0aW1lciBvZiB0aGUgY29ycmVjdCB0eXBlXG4gICAgICAgICAgICB2YXIgdGltZXIgPSBjbG9jay50aW1lcnNbdGltZXJJZF07XG4gICAgICAgICAgICBpZiAodGltZXJUeXBlKHRpbWVyKSA9PT0gdHR5cGUpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgY2xvY2sudGltZXJzW3RpbWVySWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGNsZWFyIHRpbWVyOiB0aW1lciBjcmVhdGVkIHdpdGggc2V0XCIgKyB0dHlwZSArIFwiKCkgYnV0IGNsZWFyZWQgd2l0aCBjbGVhclwiICsgdGltZXJUeXBlKHRpbWVyKSArIFwiKClcIik7XG5cdFx0XHR9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1bmluc3RhbGwoY2xvY2ssIHRhcmdldCkge1xuICAgICAgICB2YXIgbWV0aG9kLFxuICAgICAgICAgICAgaSxcbiAgICAgICAgICAgIGw7XG5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGNsb2NrLm1ldGhvZHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBtZXRob2QgPSBjbG9jay5tZXRob2RzW2ldO1xuXG4gICAgICAgICAgICBpZiAodGFyZ2V0W21ldGhvZF0uaGFkT3duUHJvcGVydHkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbbWV0aG9kXSA9IGNsb2NrW1wiX1wiICsgbWV0aG9kXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRhcmdldFttZXRob2RdO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFByZXZlbnQgbXVsdGlwbGUgZXhlY3V0aW9ucyB3aGljaCB3aWxsIGNvbXBsZXRlbHkgcmVtb3ZlIHRoZXNlIHByb3BzXG4gICAgICAgIGNsb2NrLm1ldGhvZHMgPSBbXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoaWphY2tNZXRob2QodGFyZ2V0LCBtZXRob2QsIGNsb2NrKSB7XG4gICAgICAgIHZhciBwcm9wO1xuXG4gICAgICAgIGNsb2NrW21ldGhvZF0uaGFkT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGFyZ2V0LCBtZXRob2QpO1xuICAgICAgICBjbG9ja1tcIl9cIiArIG1ldGhvZF0gPSB0YXJnZXRbbWV0aG9kXTtcblxuICAgICAgICBpZiAobWV0aG9kID09PSBcIkRhdGVcIikge1xuICAgICAgICAgICAgdmFyIGRhdGUgPSBtaXJyb3JEYXRlUHJvcGVydGllcyhjbG9ja1ttZXRob2RdLCB0YXJnZXRbbWV0aG9kXSk7XG4gICAgICAgICAgICB0YXJnZXRbbWV0aG9kXSA9IGRhdGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXRbbWV0aG9kXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2xvY2tbbWV0aG9kXS5hcHBseShjbG9jaywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciAocHJvcCBpbiBjbG9ja1ttZXRob2RdKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNsb2NrW21ldGhvZF0uaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W21ldGhvZF1bcHJvcF0gPSBjbG9ja1ttZXRob2RdW3Byb3BdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRhcmdldFttZXRob2RdLmNsb2NrID0gY2xvY2s7XG4gICAgfVxuXG4gICAgdmFyIHRpbWVycyA9IHtcbiAgICAgICAgc2V0VGltZW91dDogc2V0VGltZW91dCxcbiAgICAgICAgY2xlYXJUaW1lb3V0OiBjbGVhclRpbWVvdXQsXG4gICAgICAgIHNldEltbWVkaWF0ZTogZ2xvYmFsLnNldEltbWVkaWF0ZSxcbiAgICAgICAgY2xlYXJJbW1lZGlhdGU6IGdsb2JhbC5jbGVhckltbWVkaWF0ZSxcbiAgICAgICAgc2V0SW50ZXJ2YWw6IHNldEludGVydmFsLFxuICAgICAgICBjbGVhckludGVydmFsOiBjbGVhckludGVydmFsLFxuICAgICAgICBEYXRlOiBEYXRlXG4gICAgfTtcblxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIga3MgPSBbXSxcbiAgICAgICAgICAgIGtleTtcblxuICAgICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGtzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBrcztcbiAgICB9O1xuXG4gICAgZXhwb3J0cy50aW1lcnMgPSB0aW1lcnM7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVDbG9jayhub3cpIHtcbiAgICAgICAgdmFyIGNsb2NrID0ge1xuICAgICAgICAgICAgbm93OiBnZXRFcG9jaChub3cpLFxuICAgICAgICAgICAgdGltZW91dHM6IHt9LFxuICAgICAgICAgICAgRGF0ZTogY3JlYXRlRGF0ZSgpXG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2suRGF0ZS5jbG9jayA9IGNsb2NrO1xuXG4gICAgICAgIGNsb2NrLnNldFRpbWVvdXQgPSBmdW5jdGlvbiBzZXRUaW1lb3V0KGZ1bmMsIHRpbWVvdXQpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUaW1lcihjbG9jaywge1xuICAgICAgICAgICAgICAgIGZ1bmM6IGZ1bmMsXG4gICAgICAgICAgICAgICAgYXJnczogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSxcbiAgICAgICAgICAgICAgICBkZWxheTogdGltZW91dFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2suY2xlYXJUaW1lb3V0ID0gZnVuY3Rpb24gY2xlYXJUaW1lb3V0KHRpbWVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBjbGVhclRpbWVyKGNsb2NrLCB0aW1lcklkLCBcIlRpbWVvdXRcIik7XG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2suc2V0SW50ZXJ2YWwgPSBmdW5jdGlvbiBzZXRJbnRlcnZhbChmdW5jLCB0aW1lb3V0KSB7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGltZXIoY2xvY2ssIHtcbiAgICAgICAgICAgICAgICBmdW5jOiBmdW5jLFxuICAgICAgICAgICAgICAgIGFyZ3M6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMiksXG4gICAgICAgICAgICAgICAgZGVsYXk6IHRpbWVvdXQsXG4gICAgICAgICAgICAgICAgaW50ZXJ2YWw6IHRpbWVvdXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsb2NrLmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbiBjbGVhckludGVydmFsKHRpbWVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBjbGVhclRpbWVyKGNsb2NrLCB0aW1lcklkLCBcIkludGVydmFsXCIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsb2NrLnNldEltbWVkaWF0ZSA9IGZ1bmN0aW9uIHNldEltbWVkaWF0ZShmdW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGltZXIoY2xvY2ssIHtcbiAgICAgICAgICAgICAgICBmdW5jOiBmdW5jLFxuICAgICAgICAgICAgICAgIGFyZ3M6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgICAgICAgICAgICAgaW1tZWRpYXRlOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay5jbGVhckltbWVkaWF0ZSA9IGZ1bmN0aW9uIGNsZWFySW1tZWRpYXRlKHRpbWVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBjbGVhclRpbWVyKGNsb2NrLCB0aW1lcklkLCBcIkltbWVkaWF0ZVwiKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay50aWNrID0gZnVuY3Rpb24gdGljayhtcykge1xuICAgICAgICAgICAgbXMgPSB0eXBlb2YgbXMgPT09IFwibnVtYmVyXCIgPyBtcyA6IHBhcnNlVGltZShtcyk7XG4gICAgICAgICAgICB2YXIgdGlja0Zyb20gPSBjbG9jay5ub3csIHRpY2tUbyA9IGNsb2NrLm5vdyArIG1zLCBwcmV2aW91cyA9IGNsb2NrLm5vdztcbiAgICAgICAgICAgIHZhciB0aW1lciA9IGZpcnN0VGltZXJJblJhbmdlKGNsb2NrLCB0aWNrRnJvbSwgdGlja1RvKTtcbiAgICAgICAgICAgIHZhciBvbGROb3c7XG5cbiAgICAgICAgICAgIGNsb2NrLmR1cmluZ1RpY2sgPSB0cnVlO1xuXG4gICAgICAgICAgICB2YXIgZmlyc3RFeGNlcHRpb247XG4gICAgICAgICAgICB3aGlsZSAodGltZXIgJiYgdGlja0Zyb20gPD0gdGlja1RvKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNsb2NrLnRpbWVyc1t0aW1lci5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGlja0Zyb20gPSBjbG9jay5ub3cgPSB0aW1lci5jYWxsQXQ7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvbGROb3cgPSBjbG9jay5ub3c7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsVGltZXIoY2xvY2ssIHRpbWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbXBlbnNhdGUgZm9yIGFueSBzZXRTeXN0ZW1UaW1lKCkgY2FsbCBkdXJpbmcgdGltZXIgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvbGROb3cgIT09IGNsb2NrLm5vdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tGcm9tICs9IGNsb2NrLm5vdyAtIG9sZE5vdztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrVG8gKz0gY2xvY2subm93IC0gb2xkTm93O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzICs9IGNsb2NrLm5vdyAtIG9sZE5vdztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3RFeGNlcHRpb24gPSBmaXJzdEV4Y2VwdGlvbiB8fCBlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGltZXIgPSBmaXJzdFRpbWVySW5SYW5nZShjbG9jaywgcHJldmlvdXMsIHRpY2tUbyk7XG4gICAgICAgICAgICAgICAgcHJldmlvdXMgPSB0aWNrRnJvbTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2xvY2suZHVyaW5nVGljayA9IGZhbHNlO1xuICAgICAgICAgICAgY2xvY2subm93ID0gdGlja1RvO1xuXG4gICAgICAgICAgICBpZiAoZmlyc3RFeGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBmaXJzdEV4Y2VwdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNsb2NrLm5vdztcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay5yZXNldCA9IGZ1bmN0aW9uIHJlc2V0KCkge1xuICAgICAgICAgICAgY2xvY2sudGltZXJzID0ge307XG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2suc2V0U3lzdGVtVGltZSA9IGZ1bmN0aW9uIHNldFN5c3RlbVRpbWUobm93KSB7XG4gICAgICAgICAgICAvLyBkZXRlcm1pbmUgdGltZSBkaWZmZXJlbmNlXG4gICAgICAgICAgICB2YXIgbmV3Tm93ID0gZ2V0RXBvY2gobm93KTtcbiAgICAgICAgICAgIHZhciBkaWZmZXJlbmNlID0gbmV3Tm93IC0gY2xvY2subm93O1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgJ3N5c3RlbSBjbG9jaydcbiAgICAgICAgICAgIGNsb2NrLm5vdyA9IG5ld05vdztcblxuICAgICAgICAgICAgLy8gdXBkYXRlIHRpbWVycyBhbmQgaW50ZXJ2YWxzIHRvIGtlZXAgdGhlbSBzdGFibGVcbiAgICAgICAgICAgIGZvciAodmFyIGlkIGluIGNsb2NrLnRpbWVycykge1xuICAgICAgICAgICAgICAgIGlmIChjbG9jay50aW1lcnMuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0aW1lciA9IGNsb2NrLnRpbWVyc1tpZF07XG4gICAgICAgICAgICAgICAgICAgIHRpbWVyLmNyZWF0ZWRBdCArPSBkaWZmZXJlbmNlO1xuICAgICAgICAgICAgICAgICAgICB0aW1lci5jYWxsQXQgKz0gZGlmZmVyZW5jZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIGNsb2NrO1xuICAgIH1cbiAgICBleHBvcnRzLmNyZWF0ZUNsb2NrID0gY3JlYXRlQ2xvY2s7XG5cbiAgICBleHBvcnRzLmluc3RhbGwgPSBmdW5jdGlvbiBpbnN0YWxsKHRhcmdldCwgbm93LCB0b0Zha2UpIHtcbiAgICAgICAgdmFyIGksXG4gICAgICAgICAgICBsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0b0Zha2UgPSBub3c7XG4gICAgICAgICAgICBub3cgPSB0YXJnZXQ7XG4gICAgICAgICAgICB0YXJnZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IGdsb2JhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjbG9jayA9IGNyZWF0ZUNsb2NrKG5vdyk7XG5cbiAgICAgICAgY2xvY2sudW5pbnN0YWxsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdW5pbnN0YWxsKGNsb2NrLCB0YXJnZXQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsb2NrLm1ldGhvZHMgPSB0b0Zha2UgfHwgW107XG5cbiAgICAgICAgaWYgKGNsb2NrLm1ldGhvZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjbG9jay5tZXRob2RzID0ga2V5cyh0aW1lcnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGNsb2NrLm1ldGhvZHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBoaWphY2tNZXRob2QodGFyZ2V0LCBjbG9jay5tZXRob2RzW2ldLCBjbG9jayk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xvY2s7XG4gICAgfTtcblxufShnbG9iYWwgfHwgdGhpcykpO1xuIiwiKCh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCAmJiBmdW5jdGlvbiAobSkgeyBkZWZpbmUoXCJzYW1zYW1cIiwgbSk7IH0pIHx8XG4gKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGZ1bmN0aW9uIChtKSB7IG1vZHVsZS5leHBvcnRzID0gbSgpOyB9KSB8fCAvLyBOb2RlXG4gZnVuY3Rpb24gKG0pIHsgdGhpcy5zYW1zYW0gPSBtKCk7IH0gLy8gQnJvd3NlciBnbG9iYWxzXG4pKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbyA9IE9iamVjdC5wcm90b3R5cGU7XG4gICAgdmFyIGRpdiA9IHR5cGVvZiBkb2N1bWVudCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXG4gICAgZnVuY3Rpb24gaXNOYU4odmFsdWUpIHtcbiAgICAgICAgLy8gVW5saWtlIGdsb2JhbCBpc05hTiwgdGhpcyBhdm9pZHMgdHlwZSBjb2VyY2lvblxuICAgICAgICAvLyB0eXBlb2YgY2hlY2sgYXZvaWRzIElFIGhvc3Qgb2JqZWN0IGlzc3VlcywgaGF0IHRpcCB0b1xuICAgICAgICAvLyBsb2Rhc2hcbiAgICAgICAgdmFyIHZhbCA9IHZhbHVlOyAvLyBKc0xpbnQgdGhpbmtzIHZhbHVlICE9PSB2YWx1ZSBpcyBcIndlaXJkXCJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiAmJiB2YWx1ZSAhPT0gdmFsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldENsYXNzKHZhbHVlKSB7XG4gICAgICAgIC8vIFJldHVybnMgdGhlIGludGVybmFsIFtbQ2xhc3NdXSBieSBjYWxsaW5nIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcbiAgICAgICAgLy8gd2l0aCB0aGUgcHJvdmlkZWQgdmFsdWUgYXMgdGhpcy4gUmV0dXJuIHZhbHVlIGlzIGEgc3RyaW5nLCBuYW1pbmcgdGhlXG4gICAgICAgIC8vIGludGVybmFsIGNsYXNzLCBlLmcuIFwiQXJyYXlcIlxuICAgICAgICByZXR1cm4gby50b1N0cmluZy5jYWxsKHZhbHVlKS5zcGxpdCgvWyBcXF1dLylbMV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgc2Ftc2FtLmlzQXJndW1lbnRzXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmplY3RcbiAgICAgKlxuICAgICAqIFJldHVybnMgYGB0cnVlYGAgaWYgYGBvYmplY3RgYCBpcyBhbiBgYGFyZ3VtZW50c2BgIG9iamVjdCxcbiAgICAgKiBgYGZhbHNlYGAgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlzQXJndW1lbnRzKG9iamVjdCkge1xuICAgICAgICBpZiAoZ2V0Q2xhc3Mob2JqZWN0KSA9PT0gJ0FyZ3VtZW50cycpIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgIT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIG9iamVjdC5sZW5ndGggIT09IFwibnVtYmVyXCIgfHxcbiAgICAgICAgICAgICAgICBnZXRDbGFzcyhvYmplY3QpID09PSBcIkFycmF5XCIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIG9iamVjdC5jYWxsZWUgPT0gXCJmdW5jdGlvblwiKSB7IHJldHVybiB0cnVlOyB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBvYmplY3Rbb2JqZWN0Lmxlbmd0aF0gPSA2O1xuICAgICAgICAgICAgZGVsZXRlIG9iamVjdFtvYmplY3QubGVuZ3RoXTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHNhbXNhbS5pc0VsZW1lbnRcbiAgICAgKiBAcGFyYW0gT2JqZWN0IG9iamVjdFxuICAgICAqXG4gICAgICogUmV0dXJucyBgYHRydWVgYCBpZiBgYG9iamVjdGBgIGlzIGEgRE9NIGVsZW1lbnQgbm9kZS4gVW5saWtlXG4gICAgICogVW5kZXJzY29yZS5qcy9sb2Rhc2gsIHRoaXMgZnVuY3Rpb24gd2lsbCByZXR1cm4gYGBmYWxzZWBgIGlmIGBgb2JqZWN0YGBcbiAgICAgKiBpcyBhbiAqZWxlbWVudC1saWtlKiBvYmplY3QsIGkuZS4gYSByZWd1bGFyIG9iamVjdCB3aXRoIGEgYGBub2RlVHlwZWBgXG4gICAgICogcHJvcGVydHkgdGhhdCBob2xkcyB0aGUgdmFsdWUgYGAxYGAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNFbGVtZW50KG9iamVjdCkge1xuICAgICAgICBpZiAoIW9iamVjdCB8fCBvYmplY3Qubm9kZVR5cGUgIT09IDEgfHwgIWRpdikgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG9iamVjdC5hcHBlbmRDaGlsZChkaXYpO1xuICAgICAgICAgICAgb2JqZWN0LnJlbW92ZUNoaWxkKGRpdik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBzYW1zYW0ua2V5c1xuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqZWN0XG4gICAgICpcbiAgICAgKiBSZXR1cm4gYW4gYXJyYXkgb2Ygb3duIHByb3BlcnR5IG5hbWVzLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGtleXMob2JqZWN0KSB7XG4gICAgICAgIHZhciBrcyA9IFtdLCBwcm9wO1xuICAgICAgICBmb3IgKHByb3AgaW4gb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAoby5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcCkpIHsga3MucHVzaChwcm9wKTsgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBzYW1zYW0uaXNEYXRlXG4gICAgICogQHBhcmFtIE9iamVjdCB2YWx1ZVxuICAgICAqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBvYmplY3QgaXMgYSBgYERhdGVgYCwgb3IgKmRhdGUtbGlrZSouIER1Y2sgdHlwaW5nXG4gICAgICogb2YgZGF0ZSBvYmplY3RzIHdvcmsgYnkgY2hlY2tpbmcgdGhhdCB0aGUgb2JqZWN0IGhhcyBhIGBgZ2V0VGltZWBgXG4gICAgICogZnVuY3Rpb24gd2hvc2UgcmV0dXJuIHZhbHVlIGVxdWFscyB0aGUgcmV0dXJuIHZhbHVlIGZyb20gdGhlIG9iamVjdCdzXG4gICAgICogYGB2YWx1ZU9mYGAuXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNEYXRlKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUuZ2V0VGltZSA9PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICAgICAgIHZhbHVlLmdldFRpbWUoKSA9PSB2YWx1ZS52YWx1ZU9mKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgc2Ftc2FtLmlzTmVnWmVyb1xuICAgICAqIEBwYXJhbSBPYmplY3QgdmFsdWVcbiAgICAgKlxuICAgICAqIFJldHVybnMgYGB0cnVlYGAgaWYgYGB2YWx1ZWBgIGlzIGBgLTBgYC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc05lZ1plcm8odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA9PT0gLUluZmluaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHNhbXNhbS5lcXVhbFxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqMVxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqMlxuICAgICAqXG4gICAgICogUmV0dXJucyBgYHRydWVgYCBpZiB0d28gb2JqZWN0cyBhcmUgc3RyaWN0bHkgZXF1YWwuIENvbXBhcmVkIHRvXG4gICAgICogYGA9PT1gYCB0aGVyZSBhcmUgdHdvIGV4Y2VwdGlvbnM6XG4gICAgICpcbiAgICAgKiAgIC0gTmFOIGlzIGNvbnNpZGVyZWQgZXF1YWwgdG8gTmFOXG4gICAgICogICAtIC0wIGFuZCArMCBhcmUgbm90IGNvbnNpZGVyZWQgZXF1YWxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpZGVudGljYWwob2JqMSwgb2JqMikge1xuICAgICAgICBpZiAob2JqMSA9PT0gb2JqMiB8fCAoaXNOYU4ob2JqMSkgJiYgaXNOYU4ob2JqMikpKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JqMSAhPT0gMCB8fCBpc05lZ1plcm8ob2JqMSkgPT09IGlzTmVnWmVybyhvYmoyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgc2Ftc2FtLmRlZXBFcXVhbFxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqMVxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqMlxuICAgICAqXG4gICAgICogRGVlcCBlcXVhbCBjb21wYXJpc29uLiBUd28gdmFsdWVzIGFyZSBcImRlZXAgZXF1YWxcIiBpZjpcbiAgICAgKlxuICAgICAqICAgLSBUaGV5IGFyZSBlcXVhbCwgYWNjb3JkaW5nIHRvIHNhbXNhbS5pZGVudGljYWxcbiAgICAgKiAgIC0gVGhleSBhcmUgYm90aCBkYXRlIG9iamVjdHMgcmVwcmVzZW50aW5nIHRoZSBzYW1lIHRpbWVcbiAgICAgKiAgIC0gVGhleSBhcmUgYm90aCBhcnJheXMgY29udGFpbmluZyBlbGVtZW50cyB0aGF0IGFyZSBhbGwgZGVlcEVxdWFsXG4gICAgICogICAtIFRoZXkgYXJlIG9iamVjdHMgd2l0aCB0aGUgc2FtZSBzZXQgb2YgcHJvcGVydGllcywgYW5kIGVhY2ggcHJvcGVydHlcbiAgICAgKiAgICAgaW4gYGBvYmoxYGAgaXMgZGVlcEVxdWFsIHRvIHRoZSBjb3JyZXNwb25kaW5nIHByb3BlcnR5IGluIGBgb2JqMmBgXG4gICAgICpcbiAgICAgKiBTdXBwb3J0cyBjeWNsaWMgb2JqZWN0cy5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkZWVwRXF1YWxDeWNsaWMob2JqMSwgb2JqMikge1xuXG4gICAgICAgIC8vIHVzZWQgZm9yIGN5Y2xpYyBjb21wYXJpc29uXG4gICAgICAgIC8vIGNvbnRhaW4gYWxyZWFkeSB2aXNpdGVkIG9iamVjdHNcbiAgICAgICAgdmFyIG9iamVjdHMxID0gW10sXG4gICAgICAgICAgICBvYmplY3RzMiA9IFtdLFxuICAgICAgICAvLyBjb250YWluIHBhdGhlcyAocG9zaXRpb24gaW4gdGhlIG9iamVjdCBzdHJ1Y3R1cmUpXG4gICAgICAgIC8vIG9mIHRoZSBhbHJlYWR5IHZpc2l0ZWQgb2JqZWN0c1xuICAgICAgICAvLyBpbmRleGVzIHNhbWUgYXMgaW4gb2JqZWN0cyBhcnJheXNcbiAgICAgICAgICAgIHBhdGhzMSA9IFtdLFxuICAgICAgICAgICAgcGF0aHMyID0gW10sXG4gICAgICAgIC8vIGNvbnRhaW5zIGNvbWJpbmF0aW9ucyBvZiBhbHJlYWR5IGNvbXBhcmVkIG9iamVjdHNcbiAgICAgICAgLy8gaW4gdGhlIG1hbm5lcjogeyBcIiQxWydyZWYnXSQyWydyZWYnXVwiOiB0cnVlIH1cbiAgICAgICAgICAgIGNvbXBhcmVkID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHVzZWQgdG8gY2hlY2ssIGlmIHRoZSB2YWx1ZSBvZiBhIHByb3BlcnR5IGlzIGFuIG9iamVjdFxuICAgICAgICAgKiAoY3ljbGljIGxvZ2ljIGlzIG9ubHkgbmVlZGVkIGZvciBvYmplY3RzKVxuICAgICAgICAgKiBvbmx5IG5lZWRlZCBmb3IgY3ljbGljIGxvZ2ljXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgICAgICAhKHZhbHVlIGluc3RhbmNlb2YgQm9vbGVhbikgJiZcbiAgICAgICAgICAgICAgICAgICAgISh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpICAgICYmXG4gICAgICAgICAgICAgICAgICAgICEodmFsdWUgaW5zdGFuY2VvZiBOdW1iZXIpICAmJlxuICAgICAgICAgICAgICAgICAgICAhKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSAgJiZcbiAgICAgICAgICAgICAgICAgICAgISh2YWx1ZSBpbnN0YW5jZW9mIFN0cmluZykpIHtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogcmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIGdpdmVuIG9iamVjdCBpbiB0aGVcbiAgICAgICAgICogZ2l2ZW4gb2JqZWN0cyBhcnJheSwgLTEgaWYgbm90IGNvbnRhaW5lZFxuICAgICAgICAgKiBvbmx5IG5lZWRlZCBmb3IgY3ljbGljIGxvZ2ljXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBnZXRJbmRleChvYmplY3RzLCBvYmopIHtcblxuICAgICAgICAgICAgdmFyIGk7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2JqZWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChvYmplY3RzW2ldID09PSBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkb2VzIHRoZSByZWN1cnNpb24gZm9yIHRoZSBkZWVwIGVxdWFsIGNoZWNrXG4gICAgICAgIHJldHVybiAoZnVuY3Rpb24gZGVlcEVxdWFsKG9iajEsIG9iajIsIHBhdGgxLCBwYXRoMikge1xuICAgICAgICAgICAgdmFyIHR5cGUxID0gdHlwZW9mIG9iajE7XG4gICAgICAgICAgICB2YXIgdHlwZTIgPSB0eXBlb2Ygb2JqMjtcblxuICAgICAgICAgICAgLy8gPT0gbnVsbCBhbHNvIG1hdGNoZXMgdW5kZWZpbmVkXG4gICAgICAgICAgICBpZiAob2JqMSA9PT0gb2JqMiB8fFxuICAgICAgICAgICAgICAgICAgICBpc05hTihvYmoxKSB8fCBpc05hTihvYmoyKSB8fFxuICAgICAgICAgICAgICAgICAgICBvYmoxID09IG51bGwgfHwgb2JqMiA9PSBudWxsIHx8XG4gICAgICAgICAgICAgICAgICAgIHR5cGUxICE9PSBcIm9iamVjdFwiIHx8IHR5cGUyICE9PSBcIm9iamVjdFwiKSB7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gaWRlbnRpY2FsKG9iajEsIG9iajIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBFbGVtZW50cyBhcmUgb25seSBlcXVhbCBpZiBpZGVudGljYWwoZXhwZWN0ZWQsIGFjdHVhbClcbiAgICAgICAgICAgIGlmIChpc0VsZW1lbnQob2JqMSkgfHwgaXNFbGVtZW50KG9iajIpKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgICAgICAgICB2YXIgaXNEYXRlMSA9IGlzRGF0ZShvYmoxKSwgaXNEYXRlMiA9IGlzRGF0ZShvYmoyKTtcbiAgICAgICAgICAgIGlmIChpc0RhdGUxIHx8IGlzRGF0ZTIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWlzRGF0ZTEgfHwgIWlzRGF0ZTIgfHwgb2JqMS5nZXRUaW1lKCkgIT09IG9iajIuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvYmoxIGluc3RhbmNlb2YgUmVnRXhwICYmIG9iajIgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICAgICAgICBpZiAob2JqMS50b1N0cmluZygpICE9PSBvYmoyLnRvU3RyaW5nKCkpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjbGFzczEgPSBnZXRDbGFzcyhvYmoxKTtcbiAgICAgICAgICAgIHZhciBjbGFzczIgPSBnZXRDbGFzcyhvYmoyKTtcbiAgICAgICAgICAgIHZhciBrZXlzMSA9IGtleXMob2JqMSk7XG4gICAgICAgICAgICB2YXIga2V5czIgPSBrZXlzKG9iajIpO1xuXG4gICAgICAgICAgICBpZiAoaXNBcmd1bWVudHMob2JqMSkgfHwgaXNBcmd1bWVudHMob2JqMikpIHtcbiAgICAgICAgICAgICAgICBpZiAob2JqMS5sZW5ndGggIT09IG9iajIubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZTEgIT09IHR5cGUyIHx8IGNsYXNzMSAhPT0gY2xhc3MyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXlzMS5sZW5ndGggIT09IGtleXMyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIga2V5LCBpLCBsLFxuICAgICAgICAgICAgICAgIC8vIGZvbGxvd2luZyB2YXJzIGFyZSB1c2VkIGZvciB0aGUgY3ljbGljIGxvZ2ljXG4gICAgICAgICAgICAgICAgdmFsdWUxLCB2YWx1ZTIsXG4gICAgICAgICAgICAgICAgaXNPYmplY3QxLCBpc09iamVjdDIsXG4gICAgICAgICAgICAgICAgaW5kZXgxLCBpbmRleDIsXG4gICAgICAgICAgICAgICAgbmV3UGF0aDEsIG5ld1BhdGgyO1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsID0ga2V5czEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAga2V5ID0ga2V5czFbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFvLmhhc093blByb3BlcnR5LmNhbGwob2JqMiwga2V5KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU3RhcnQgb2YgdGhlIGN5Y2xpYyBsb2dpY1xuXG4gICAgICAgICAgICAgICAgdmFsdWUxID0gb2JqMVtrZXldO1xuICAgICAgICAgICAgICAgIHZhbHVlMiA9IG9iajJba2V5XTtcblxuICAgICAgICAgICAgICAgIGlzT2JqZWN0MSA9IGlzT2JqZWN0KHZhbHVlMSk7XG4gICAgICAgICAgICAgICAgaXNPYmplY3QyID0gaXNPYmplY3QodmFsdWUyKTtcblxuICAgICAgICAgICAgICAgIC8vIGRldGVybWluZSwgaWYgdGhlIG9iamVjdHMgd2VyZSBhbHJlYWR5IHZpc2l0ZWRcbiAgICAgICAgICAgICAgICAvLyAoaXQncyBmYXN0ZXIgdG8gY2hlY2sgZm9yIGlzT2JqZWN0IGZpcnN0LCB0aGFuIHRvXG4gICAgICAgICAgICAgICAgLy8gZ2V0IC0xIGZyb20gZ2V0SW5kZXggZm9yIG5vbiBvYmplY3RzKVxuICAgICAgICAgICAgICAgIGluZGV4MSA9IGlzT2JqZWN0MSA/IGdldEluZGV4KG9iamVjdHMxLCB2YWx1ZTEpIDogLTE7XG4gICAgICAgICAgICAgICAgaW5kZXgyID0gaXNPYmplY3QyID8gZ2V0SW5kZXgob2JqZWN0czIsIHZhbHVlMikgOiAtMTtcblxuICAgICAgICAgICAgICAgIC8vIGRldGVybWluZSB0aGUgbmV3IHBhdGhlcyBvZiB0aGUgb2JqZWN0c1xuICAgICAgICAgICAgICAgIC8vIC0gZm9yIG5vbiBjeWNsaWMgb2JqZWN0cyB0aGUgY3VycmVudCBwYXRoIHdpbGwgYmUgZXh0ZW5kZWRcbiAgICAgICAgICAgICAgICAvLyAgIGJ5IGN1cnJlbnQgcHJvcGVydHkgbmFtZVxuICAgICAgICAgICAgICAgIC8vIC0gZm9yIGN5Y2xpYyBvYmplY3RzIHRoZSBzdG9yZWQgcGF0aCBpcyB0YWtlblxuICAgICAgICAgICAgICAgIG5ld1BhdGgxID0gaW5kZXgxICE9PSAtMVxuICAgICAgICAgICAgICAgICAgICA/IHBhdGhzMVtpbmRleDFdXG4gICAgICAgICAgICAgICAgICAgIDogcGF0aDEgKyAnWycgKyBKU09OLnN0cmluZ2lmeShrZXkpICsgJ10nO1xuICAgICAgICAgICAgICAgIG5ld1BhdGgyID0gaW5kZXgyICE9PSAtMVxuICAgICAgICAgICAgICAgICAgICA/IHBhdGhzMltpbmRleDJdXG4gICAgICAgICAgICAgICAgICAgIDogcGF0aDIgKyAnWycgKyBKU09OLnN0cmluZ2lmeShrZXkpICsgJ10nO1xuXG4gICAgICAgICAgICAgICAgLy8gc3RvcCByZWN1cnNpb24gaWYgY3VycmVudCBvYmplY3RzIGFyZSBhbHJlYWR5IGNvbXBhcmVkXG4gICAgICAgICAgICAgICAgaWYgKGNvbXBhcmVkW25ld1BhdGgxICsgbmV3UGF0aDJdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHJlbWVtYmVyIHRoZSBjdXJyZW50IG9iamVjdHMgYW5kIHRoZWlyIHBhdGhlc1xuICAgICAgICAgICAgICAgIGlmIChpbmRleDEgPT09IC0xICYmIGlzT2JqZWN0MSkge1xuICAgICAgICAgICAgICAgICAgICBvYmplY3RzMS5wdXNoKHZhbHVlMSk7XG4gICAgICAgICAgICAgICAgICAgIHBhdGhzMS5wdXNoKG5ld1BhdGgxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4MiA9PT0gLTEgJiYgaXNPYmplY3QyKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdHMyLnB1c2godmFsdWUyKTtcbiAgICAgICAgICAgICAgICAgICAgcGF0aHMyLnB1c2gobmV3UGF0aDIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHJlbWVtYmVyIHRoYXQgdGhlIGN1cnJlbnQgb2JqZWN0cyBhcmUgYWxyZWFkeSBjb21wYXJlZFxuICAgICAgICAgICAgICAgIGlmIChpc09iamVjdDEgJiYgaXNPYmplY3QyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBhcmVkW25ld1BhdGgxICsgbmV3UGF0aDJdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBFbmQgb2YgY3ljbGljIGxvZ2ljXG5cbiAgICAgICAgICAgICAgICAvLyBuZWl0aGVyIHZhbHVlMSBub3IgdmFsdWUyIGlzIGEgY3ljbGVcbiAgICAgICAgICAgICAgICAvLyBjb250aW51ZSB3aXRoIG5leHQgbGV2ZWxcbiAgICAgICAgICAgICAgICBpZiAoIWRlZXBFcXVhbCh2YWx1ZTEsIHZhbHVlMiwgbmV3UGF0aDEsIG5ld1BhdGgyKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICB9KG9iajEsIG9iajIsICckMScsICckMicpKTtcbiAgICB9XG5cbiAgICB2YXIgbWF0Y2g7XG5cbiAgICBmdW5jdGlvbiBhcnJheUNvbnRhaW5zKGFycmF5LCBzdWJzZXQpIHtcbiAgICAgICAgaWYgKHN1YnNldC5sZW5ndGggPT09IDApIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgdmFyIGksIGwsIGosIGs7XG4gICAgICAgIGZvciAoaSA9IDAsIGwgPSBhcnJheS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaChhcnJheVtpXSwgc3Vic2V0WzBdKSkge1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDAsIGsgPSBzdWJzZXQubGVuZ3RoOyBqIDwgazsgKytqKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2goYXJyYXlbaSArIGpdLCBzdWJzZXRbal0pKSB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgc2Ftc2FtLm1hdGNoXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmplY3RcbiAgICAgKiBAcGFyYW0gT2JqZWN0IG1hdGNoZXJcbiAgICAgKlxuICAgICAqIENvbXBhcmUgYXJiaXRyYXJ5IHZhbHVlIGBgb2JqZWN0YGAgd2l0aCBtYXRjaGVyLlxuICAgICAqL1xuICAgIG1hdGNoID0gZnVuY3Rpb24gbWF0Y2gob2JqZWN0LCBtYXRjaGVyKSB7XG4gICAgICAgIGlmIChtYXRjaGVyICYmIHR5cGVvZiBtYXRjaGVyLnRlc3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoZXIudGVzdChvYmplY3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBtYXRjaGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaGVyKG9iamVjdCkgPT09IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIG1hdGNoZXIgPSBtYXRjaGVyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB2YXIgbm90TnVsbCA9IHR5cGVvZiBvYmplY3QgPT09IFwic3RyaW5nXCIgfHwgISFvYmplY3Q7XG4gICAgICAgICAgICByZXR1cm4gbm90TnVsbCAmJlxuICAgICAgICAgICAgICAgIChTdHJpbmcob2JqZWN0KSkudG9Mb3dlckNhc2UoKS5pbmRleE9mKG1hdGNoZXIpID49IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaGVyID09PSBvYmplY3Q7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hlciA9PT0gb2JqZWN0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZihtYXRjaGVyKSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZihvYmplY3QpID09PSBcInVuZGVmaW5lZFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1hdGNoZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmplY3QgPT09IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZ2V0Q2xhc3Mob2JqZWN0KSA9PT0gXCJBcnJheVwiICYmIGdldENsYXNzKG1hdGNoZXIpID09PSBcIkFycmF5XCIpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnJheUNvbnRhaW5zKG9iamVjdCwgbWF0Y2hlcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2hlciAmJiB0eXBlb2YgbWF0Y2hlciA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgaWYgKG1hdGNoZXIgPT09IG9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHByb3A7XG4gICAgICAgICAgICBmb3IgKHByb3AgaW4gbWF0Y2hlcikge1xuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9iamVjdFtwcm9wXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2Ygb2JqZWN0LmdldEF0dHJpYnV0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0LmdldEF0dHJpYnV0ZShwcm9wKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXJbcHJvcF0gPT09IG51bGwgfHwgdHlwZW9mIG1hdGNoZXJbcHJvcF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gbWF0Y2hlcltwcm9wXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgIHZhbHVlID09PSBcInVuZGVmaW5lZFwiIHx8ICFtYXRjaCh2YWx1ZSwgbWF0Y2hlcltwcm9wXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWF0Y2hlciB3YXMgbm90IGEgc3RyaW5nLCBhIG51bWJlciwgYSBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICBcImZ1bmN0aW9uLCBhIGJvb2xlYW4gb3IgYW4gb2JqZWN0XCIpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBpc0FyZ3VtZW50czogaXNBcmd1bWVudHMsXG4gICAgICAgIGlzRWxlbWVudDogaXNFbGVtZW50LFxuICAgICAgICBpc0RhdGU6IGlzRGF0ZSxcbiAgICAgICAgaXNOZWdaZXJvOiBpc05lZ1plcm8sXG4gICAgICAgIGlkZW50aWNhbDogaWRlbnRpY2FsLFxuICAgICAgICBkZWVwRXF1YWw6IGRlZXBFcXVhbEN5Y2xpYyxcbiAgICAgICAgbWF0Y2g6IG1hdGNoLFxuICAgICAgICBrZXlzOiBrZXlzXG4gICAgfTtcbn0pO1xuIiwidmFyIHNvbm5lID0gcmVxdWlyZSgnLi4vbGliL21haW4nKVxyXG52YXIgc2lub24gPSByZXF1aXJlKCdzaW5vbicpXHJcblxyXG52YXIgbWF5YmVJRCA9IHNvbm5lLm1ha2Uoc29ubmUuZGF0YS5tYXliZSwgc29ubmUuZGF0YS5pZClcclxuY29uc3QgSURNYXliZSA9IHNvbm5lLm1ha2Uoc29ubmUuZGF0YS5pZCwgc29ubmUuZGF0YS5tYXliZSlcclxudmFyIG1heWJlU3RhY2tzID0gW0lETWF5YmUsIG1heWJlSURdXHJcblxyXG52YXIgbWF5YmVMaXN0ID0gc29ubmUubWFrZShzb25uZS5kYXRhLm1heWJlLCBzb25uZS5kYXRhLmxpc3QpXHJcbnZhciBsaXN0TWF5YmUgPSBzb25uZS5tYWtlKHNvbm5lLmRhdGEubGlzdCwgc29ubmUuZGF0YS5tYXliZSlcclxudmFyIGxpc3RTdGFja3MgPSBbbWF5YmVMaXN0LCBsaXN0TWF5YmVdXHJcblxyXG52YXIgbW9uYWRzID0gbWF5YmVTdGFja3NcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgTWF5YmUgKHRlc3QpIHtcclxuICAgICAgbWF5YmVTdGFja3MuZm9yRWFjaCgobWF5YmUpID0+e1xyXG5cclxuICAgICAgICB2YXIgc3B5ID0gc2lub24uc3B5KChhKSA9PiBhKVxyXG4gICAgICAgIG1heWJlLm9mKDQpXHJcbiAgICAgICAgICAubWFwKGZ1bmN0aW9uICh2YWwpIHtyZXR1cm4gdmFsICsgMX0pXHJcbiAgICAgICAgICAuY2hhaW5NYXliZSgodmFsKT0+IHtcclxuICAgICAgICAgICAgdGVzdC5lcXVhbHModmFsLCA1LCAnQSBjYWxsIHRvIFwibWFwXCIgbW9kaWZpZXMgdGhlIHZhbHVlLCBhbmQgcGFja3MgaXQgYWdhaW4nKVxyXG4gICAgICAgICAgICByZXR1cm4ge21heWJlVmFsOnVuZGVmaW5lZH0gXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIC5tYXAoc3B5KVxyXG4gICAgICAgIHRlc3QuZXF1YWxzKHNweS5jYWxsZWQsIGZhbHNlLCBcIkFmdGVyIGEgdmFsIGlzIHNldCB0byB1bmRlZmluZWQsIGZ1bmN0aW9ucyBhcmUgbm8gbG9uZ2VyIGNhbGxlZFwiKVxyXG5cclxuICAgICAgICBzcHkgPSBzaW5vbi5zcHkoKGEpID0+IGEpXHJcbiAgICAgICAgbWF5YmUub2Yoe2Zvbzp7YmF6OlwiYmFyXCJ9fSlcclxuICAgICAgICAgIC5nZXQoXCJmb29cIilcclxuICAgICAgICAgIC5nZXQoXCJiYXpcIilcclxuICAgICAgICAgIC5tYXAoc3B5KVxyXG4gICAgICAgIHRlc3QuZXF1YWxzKHNweS5sYXN0Q2FsbC5yZXR1cm5WYWx1ZSwgJ2JhcicpXHJcblxyXG4gICAgICAgIHNweSA9IHNpbm9uLnNweSgoYSkgPT4gYSlcclxuICAgICAgICBtYXliZS5vZih7Zm9vOlwiYmFyXCJ9KVxyXG4gICAgICAgICAgLmdldChcImJhclwiKVxyXG4gICAgICAgICAgLm1hcChzcHkpXHJcbiAgICAgICAgdGVzdC5lcXVhbHMoc3B5LmNhbGxlZCwgZmFsc2UsICdXaGVuIHlvdSBnZXQgYW4gdW5kZWZpbmVkIHZhbHVlLCBtYXliZSBpcyBub3QgY2FsbGVkICcpXHJcbiAgICAgIH0pXHJcbiAgICAgIHRlc3QuZG9uZSgpXHJcbiAgICB9LFxyXG4gICAgY2hhaW4gKHRlc3Qpe1xyXG4gICAgICBjb25zdCB2YWwgPSA1XHJcbiAgICAgIG1vbmFkcy5mb3JFYWNoKG1vbmFkID0+IHtcclxuICAgICAgICB2YXIgc3B5ID0gc2lub24uc3B5KChhKSA9PiBhKVxyXG4gICAgICAgIG1vbmFkLm9mKHZhbClcclxuICAgICAgICAgIC5jaGFpbigodmFsKT0+IG1vbmFkLm9mKHZhbCkpXHJcbiAgICAgICAgICAubWFwKHNweSlcdCAgICBcclxuICAgICAgICB0ZXN0LmVxdWFscyhzcHkuZmlyc3RDYWxsLnJldHVyblZhbHVlLCB2YWwsIFwiVW5wYWNraW5nIGEgbW9uYWQgYW5kIHBhY2tpbmcgaXQgYWdhaW4geWVpbGRzIHRoZSBzYW1lIHN0cnVjdHVyZVwiKVxyXG4gICAgICAgIHRlc3QudGhyb3dzKCgpPT4obW9uYWQub2YoNCkuY2hhaW4oKHZhbCk9Pm1vbmFkLm9mKHZhbCkuX3ZhbHVlICkpLCBcIlRoZSBjaGFpbiBtZXRob2QgZXhwZWN0cyBhIHdyYXBwZWQgdmFsdWVcIilcclxuICAgICAgfSkgXHJcbiAgICAgIHRlc3QuZG9uZSgpXHJcbiAgICB9LFxyXG4gICAgLypMaXN0ICh0ZXN0KXtcclxuICAgICAgbWF5YmVJRFxyXG4gICAgICBsaXN0TWF5YmVcclxuICAgICAgdGVzdC5kZWVwRXF1YWwobWF5YmVMaXN0Lm9mKFsxLDIsM10pLm1hcCgoYSk9PihhKzEpKSwgbWF5YmVMaXN0Lm9mKFsyLDMsNF0pLCBcImZvb1wiKVxyXG4gICAgICBkZWJ1Z2dlclxyXG4gICAgICBsaXN0U3RhY2tzLmZvckVhY2goKGxpc3QpID0+e1xyXG4gICAgICAgIGxpc3Qub2YoWzEsMiwzXSlcclxuICAgICAgfSlcclxuICAgICAgdGVzdC5kb25lKClcclxuICAgIH0sKi9cclxuICAgIHRlc3QgKHRlc3Qpe1xyXG4gICAgICBkZWJ1Z2dlclxyXG4gICAgICB0ZXN0LmRvbmUoKVxyXG4gICAgfVxyXG5cclxuICB9XHJcbiIsImV4cG9ydHMuYmFzaWMgPSByZXF1aXJlKFwiLi9iYXNpY1wiKVxyXG5pZiAoZ2xvYmFsLnY4ZGVidWcpIHtcclxuICBnbG9iYWwudjhkZWJ1Zy5EZWJ1Zy5zZXRCcmVha09uRXhjZXB0aW9uKClcclxufVxyXG5nbG9iYWwudGVzdHMgPSBtb2R1bGUuZXhwb3J0c1xyXG4iXX0=
