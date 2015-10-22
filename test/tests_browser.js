(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports.state = {
  name: 'State',
  of: function of(val) {
    return function (prevState) {
      return [val, prevState];
    };
  },
  chain: function chain(funk, val) {
    return function (prevState) {
      return val(prevState).chain(function (params) {
        var val = params[0],
            newState = params[1];
        return [funk(val), newState];
      });
    };
  },
  lift: function lift(val) {
    return function (prevState) {
      return val.chain(function (innerValue) {
        return [innerValue, prevState];
      });
    };
  },
  load: function load(val) {
    return function (prevState) {
      return [prevState, prevState];
    };
  },
  save: function save(val) {
    return function (prevState) {
      return [val, val];
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
  chain: function chain(funk, val, proto) {
    return proto.chain(function (innerId) {
      return funk(innerId.idVal);
    }, val);
  },
  lift: function lift(val, proto) {
    return proto.chain(function (innerValue) {
      return val.of({ idVal: innerValue });
    }, val);
  }
};

exports.maybe = {
  name: 'Maybe',
  of: function of(val) {
    return { maybeVal: val };
  },
  chain: function chain(funk, val, proto) {
    debugger;
    return proto.chain(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
    }, val);
  },
  lift: function lift(val, proto) {
    return proto.chain(function (innerValue) {
      return val.of({ maybeVal: innerValue });
    }, val);
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
      return innerList.reduce(function (list, val) {
        return list.concat(funk(val));
      }, []);
    });
  },
  lift: function lift(val) {
    return val.chain(function (innerValue) {
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
  chain: function chain(funk, val) {
    return funk(val);
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
    // When we stack monad transformers, we must have a real monad at the bottom.
    // That is why we wrap our value in an ID monad
    chain: function chain(funk, val) {
      return outer.chain(funk, val, idProto);
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
      return create(inner.chain(funkAndUnwrap, this._value, outerProto));
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
    return create(inner.lift(val, outerProto));
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

var maybeState = sonne.make(sonne.data.maybe, sonne.comp.state);
var stateMaybe = sonne.make(sonne.comp.state, sonne.data.maybe);
var stateStacks = [maybeState, stateMaybe];

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
  state: function state(test) {
    maybeState;
    stateMaybe;

    maybeState(function (prevState) {
      return { maybeVal: [4, undefined] };
    });
    stateMaybe(function (prevState) {
      return [{ maybeVal: 4 }, undefined];
    }).save()._value();

    /*  stateStacks.forEach(state => {
        state.of(4)
          .save()
          .load()
          .map(()=>6)
          .load()
          debugger
      })*/
    test.done();
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2NvbXAuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2RhdGEuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24uanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2Fzc2VydC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vYmVoYXZpb3IuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2NhbGwuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2NvbGxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL2V4dGVuZC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vZm9ybWF0LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9sb2dfZXJyb3IuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL21hdGNoLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9tb2NrLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9zYW5kYm94LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi9zcHkuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3N0dWIuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3Rlc3QuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3Rlc3RfY2FzZS5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vdGltZXNfaW5fd29yZHMuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3R5cGVPZi5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9saWIvc2lub24vdXRpbC9jb3JlLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi91dGlsL2V2ZW50LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi91dGlsL2Zha2Vfc2VydmVyLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi91dGlsL2Zha2Vfc2VydmVyX3dpdGhfY2xvY2suanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3V0aWwvZmFrZV90aW1lcnMuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3V0aWwvZmFrZV94ZG9tYWluX3JlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvc2lub24vbGliL3Npbm9uL3V0aWwvZmFrZV94bWxfaHR0cF9yZXF1ZXN0LmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL2xpYi9zaW5vbi93YWxrLmpzIiwibm9kZV9tb2R1bGVzL3Npbm9uL25vZGVfbW9kdWxlcy9mb3JtYXRpby9saWIvZm9ybWF0aW8uanMiLCJub2RlX21vZHVsZXMvc2lub24vbm9kZV9tb2R1bGVzL2xvbGV4L3NyYy9sb2xleC5qcyIsIm5vZGVfbW9kdWxlcy9zaW5vbi9ub2RlX21vZHVsZXMvc2Ftc2FtL2xpYi9zYW1zYW0uanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvdGVzdC9iYXNpYy5qcyIsImM6L2dpdC1wcm9qZWN0cy9zb25uZS90ZXN0L3Rlc3RzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLENBQUMsS0FBSyxHQUFHO0FBQ2QsTUFBSSxFQUFFLE9BQU87QUFDYixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7QUFDUCxXQUFPLFVBQUMsU0FBUzthQUFLLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQztLQUFBLENBQUE7R0FDdkM7QUFDRCxPQUFLLEVBQUMsZUFBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQ2hCLFdBQU8sVUFBQyxTQUFTO2FBQ2YsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFDLE1BQU0sRUFBSztBQUMvQixZQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQUUsUUFBUSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMzQyxlQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFBO09BQzdCLENBQUM7S0FBQSxDQUFBO0dBQ0w7QUFDRCxNQUFJLEVBQUMsY0FBQyxHQUFHLEVBQUU7QUFDVCxXQUFPLFVBQUMsU0FBUzthQUNmLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBQyxVQUFVO2VBQUssQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDO09BQUEsQ0FBQztLQUFBLENBQUE7R0FDckQ7QUFDRCxNQUFJLEVBQUMsY0FBQyxHQUFHLEVBQUU7QUFDVCxXQUFPLFVBQUMsU0FBUzthQUFLLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQztLQUFBLENBQUE7R0FDN0M7QUFDRCxNQUFJLEVBQUMsY0FBQyxHQUFHLEVBQUU7QUFDVCxXQUFPLFVBQUMsU0FBUzthQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztLQUFBLENBQUE7R0FDakM7Q0FDRixDQUFBOzs7OztBQ3RCRCxPQUFPLENBQUMsRUFBRSxHQUFHO0FBQ1gsTUFBSSxFQUFFLElBQUk7QUFDVixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7QUFBRSxXQUFPLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFBO0dBQUU7QUFDakMsT0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDdkIsV0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQUMsT0FBTzthQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0tBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtHQUMxRDtBQUNELE1BQUksRUFBQyxjQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDaEIsV0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQUMsVUFBVTthQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBQyxLQUFLLEVBQUUsVUFBVSxFQUFDLENBQUM7S0FBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0dBQ3JFO0NBQ0YsQ0FBQTs7QUFFRCxPQUFPLENBQUMsS0FBSyxHQUFHO0FBQ2QsTUFBSSxFQUFFLE9BQU87QUFDYixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7QUFDUCxXQUFPLEVBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxDQUFBO0dBQ3hCO0FBQ0QsT0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDdkIsYUFBUTtBQUNSLFdBQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFDLFVBQVU7YUFDNUIsVUFBVSxDQUFDLFFBQVEsS0FBSyxTQUFTLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDO0tBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQTtHQUNuRjtBQUNELE1BQUksRUFBQyxjQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDaEIsV0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQUMsVUFBVTthQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBQyxRQUFRLEVBQUUsVUFBVSxFQUFDLENBQUM7S0FBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0dBQ3hFO0FBQ0QsS0FBRyxFQUFDLGFBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUNiLFdBQU8sRUFBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUE7R0FDNUI7Q0FDRixDQUFBO0FBQ0QsT0FBTyxDQUFDLElBQUksR0FBRztBQUNiLE1BQUksRUFBRSxNQUFNO0FBQ1osSUFBRSxFQUFDLFlBQUMsR0FBRyxFQUFFO0FBQ1AsV0FBTyxHQUFHLENBQUMsV0FBVyxLQUFLLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtHQUMvQztBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBRSxHQUFHLEVBQUU7QUFDaEIsV0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQUMsU0FBUzthQUN6QixTQUFTLENBQUMsTUFBTSxDQUFDLFVBQUMsSUFBSSxFQUFFLEdBQUc7ZUFBSyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztPQUFBLEVBQUUsRUFBRSxDQUFDO0tBQUEsQ0FBQyxDQUFBO0dBQy9EO0FBQ0QsTUFBSSxFQUFDLGNBQUMsR0FBRyxFQUFFO0FBQ1QsV0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQUMsVUFBVTthQUMxQixHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7S0FBQSxDQUFDLENBQUE7R0FDeEI7Q0FDRixDQUFBOzs7OztBQ3pDRCxPQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNoQyxPQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNoQyxPQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTs7QUFFaEMsSUFBTSxPQUFPLEdBQUc7Ozs7QUFJZCxJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7QUFDUCxXQUFPLEdBQUcsQ0FBQTtHQUNYOzs7O0FBSUQsT0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUNoQixXQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtHQUNqQjtDQUNGLENBQUE7OztBQUdELElBQU0sTUFBTSxHQUFHLFNBQVQsTUFBTSxDQUFJLEdBQUcsRUFBSztBQUN0QixNQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUFDLFVBQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyx5QkFBeUIsQ0FBQTtHQUFDO0FBQzFGLFNBQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQTtDQUNsQixDQUFBOzs7QUFHRCxJQUFNLE1BQU0sR0FBRyxTQUFULE1BQU0sQ0FBSSxLQUFLLEVBQUUsR0FBRyxFQUFLO0FBQzdCLE1BQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDOUIsS0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUE7QUFDaEIsU0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0NBQzFCLENBQUE7O0FBRUQsT0FBTyxDQUFDLElBQUksR0FBRyxTQUFTLFVBQVUsQ0FBRSxLQUFLLEVBQUUsS0FBSyxFQUFFOztBQUVoRCxXQUFTLE1BQU0sQ0FBRSxHQUFHLEVBQUU7QUFDcEIsV0FBTyxNQUFNLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0dBQy9COzs7QUFHRCxNQUFNLFVBQVUsR0FBRztBQUNqQixNQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUU7Ozs7O0FBS1osU0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUNoQixhQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQTtLQUN2QztHQUNGLENBQUE7OztBQUdELE1BQU0sVUFBVSxHQUFHO0FBQ2pCLGFBQVMsRUFBRSxVQUFVOzs7QUFHckIsU0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFO0FBQ1gsVUFBTSxhQUFhLEdBQUcsU0FBaEIsYUFBYSxDQUFJLEdBQUc7ZUFBSyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO09BQUEsQ0FBQTtBQUNoRCxhQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUE7S0FDbkU7OztBQUdELE1BQUUsRUFBQyxZQUFDLEtBQUssRUFBRTtBQUNULGFBQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7S0FDekM7QUFDRCxPQUFHLEVBQUMsYUFBQyxJQUFJLEVBQUU7OztBQUNULGFBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUc7ZUFBSyxNQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7T0FBQSxDQUFDLENBQUE7S0FDL0M7R0FDRixDQUFBOzs7QUFHRCxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFDLEdBQUc7V0FBSyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7R0FBQSxDQUFBO0FBQ25HLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQUMsR0FBRztXQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0dBQUEsQ0FBQTs7O0FBR3JGLFlBQVUsQ0FBRyxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQVUsSUFBSSxFQUFFO0FBQ3BELFdBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUc7YUFBSyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQUEsQ0FBQyxDQUFBO0dBQ2pELENBQUE7QUFDRCxZQUFVLENBQUcsT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLElBQUksRUFBRTtBQUNwRCxXQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBQyxHQUFHO2FBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUFBLENBQUMsQ0FBQTtHQUNqRCxDQUFBOzs7QUFHRCxNQUFNLE1BQU0sR0FBRyxTQUFULE1BQU0sQ0FBSSxLQUFLLEVBQUs7QUFDeEIsVUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FDZixNQUFNLENBQUMsVUFBQyxHQUFHO2FBQU0sR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEtBQUssT0FBTyxJQUFJLEdBQUcsS0FBSyxNQUFNO0tBQUMsQ0FBQyxDQUNwRSxPQUFPLENBQUMsVUFBQyxHQUFHLEVBQUs7QUFDaEIsZ0JBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxZQUFZO0FBQzVCLFlBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQTs7QUFFbEQsZUFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsR0FBRyxFQUFLO0FBQ3pCLGNBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDZCxpQkFBTyxVQUFVLENBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFBO1NBQ3ZFLENBQUMsQ0FBQTtPQUNILENBQUE7S0FDRixDQUFDLENBQUE7R0FDTCxDQUFBO0FBQ0QsUUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQ2IsUUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBOztBQUViLFlBQVUsQ0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsS0FBSyxDQUFBO0FBQ2pDLFlBQVUsQ0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsS0FBSyxDQUFBOzs7QUFHakMsUUFBTSxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFBO0FBQ3pCLFFBQU0sQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQVUsQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxDQUFBO0FBQ25FLFFBQU0sQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLFVBQVUsQ0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxDQUFBOzs7QUFHbkUsU0FBTyxNQUFNLENBQUE7Q0FDZCxDQUFBOzs7QUM3R0Q7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQy9OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1c0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDL1lBLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQTtBQUNsQyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7O0FBRTVCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUN6RCxJQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDM0QsSUFBSSxXQUFXLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUE7O0FBRXBDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUMvRCxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDL0QsSUFBSSxXQUFXLEdBQUcsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUE7O0FBRTFDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM3RCxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDN0QsSUFBSSxVQUFVLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUE7O0FBRXZDLElBQUksTUFBTSxHQUFHLFdBQVcsQ0FBQTs7QUFFeEIsTUFBTSxDQUFDLE9BQU8sR0FBRztBQUNiLE9BQUssRUFBQyxlQUFDLElBQUksRUFBRTtBQUNYLGVBQVcsQ0FBQyxPQUFPLENBQUMsVUFBQyxLQUFLLEVBQUk7O0FBRTVCLFVBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFDO2VBQUssQ0FBQztPQUFBLENBQUMsQ0FBQTtBQUM3QixXQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUNSLEdBQUcsQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUFDLGVBQU8sR0FBRyxHQUFHLENBQUMsQ0FBQTtPQUFDLENBQUMsQ0FDcEMsVUFBVSxDQUFDLFVBQUMsR0FBRyxFQUFJO0FBQ2xCLFlBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSx3REFBd0QsQ0FBQyxDQUFBO0FBQzdFLGVBQU8sRUFBQyxRQUFRLEVBQUMsU0FBUyxFQUFDLENBQUE7T0FDNUIsQ0FBQyxDQUNILEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNULFVBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsaUVBQWlFLENBQUMsQ0FBQTs7QUFFakcsU0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQyxDQUFDO2VBQUssQ0FBQztPQUFBLENBQUMsQ0FBQTtBQUN6QixXQUFLLENBQUMsRUFBRSxDQUFDLEVBQUMsR0FBRyxFQUFDLEVBQUMsR0FBRyxFQUFDLEtBQUssRUFBQyxFQUFDLENBQUMsQ0FDeEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUNWLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FDVixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDWCxVQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFBOztBQUU1QyxTQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQUM7ZUFBSyxDQUFDO09BQUEsQ0FBQyxDQUFBO0FBQ3pCLFdBQUssQ0FBQyxFQUFFLENBQUMsRUFBQyxHQUFHLEVBQUMsS0FBSyxFQUFDLENBQUMsQ0FDbEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUNWLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNYLFVBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsdURBQXVELENBQUMsQ0FBQTtLQUN4RixDQUFDLENBQUE7QUFDRixRQUFJLENBQUMsSUFBSSxFQUFFLENBQUE7R0FDWjtBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBQztBQUNWLFFBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUNiLFVBQU0sQ0FBQyxPQUFPLENBQUMsVUFBQSxLQUFLLEVBQUk7QUFDdEIsVUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLENBQUM7ZUFBSyxDQUFDO09BQUEsQ0FBQyxDQUFBO0FBQzdCLFdBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQ1YsS0FBSyxDQUFDLFVBQUMsR0FBRztlQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDO09BQUEsQ0FBQyxDQUM1QixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDWCxVQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxrRUFBa0UsQ0FBQyxDQUFBO0FBQy9HLFVBQUksQ0FBQyxNQUFNLENBQUM7ZUFBSyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFDLEdBQUc7aUJBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNO1NBQUEsQ0FBRTtPQUFDLEVBQUUsMENBQTBDLENBQUMsQ0FBQTtLQUMvRyxDQUFDLENBQUE7QUFDRixRQUFJLENBQUMsSUFBSSxFQUFFLENBQUE7R0FDWjs7Ozs7Ozs7Ozs7QUFXRCxPQUFLLEVBQUEsZUFBQyxJQUFJLEVBQUM7QUFDVCxjQUFVLENBQUE7QUFDVixjQUFVLENBQUE7O0FBRVYsY0FBVSxDQUFFLFVBQUMsU0FBUzthQUFNLEVBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBRSxFQUFFO0tBQUMsQ0FBRSxDQUFBO0FBQzFELGNBQVUsQ0FBRSxVQUFDLFNBQVM7YUFBTSxDQUFDLEVBQUMsUUFBUSxFQUFDLENBQUMsRUFBQyxFQUFFLFNBQVMsQ0FBRTtLQUFFLENBQUUsQ0FDdkQsSUFBSSxFQUFFLENBQ04sTUFBTSxFQUFFLENBQUE7Ozs7Ozs7Ozs7QUFVWCxRQUFJLENBQUMsSUFBSSxFQUFFLENBQUE7R0FDWjs7Q0FFRixDQUFBOzs7Ozs7QUN4RkgsT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUE7QUFDbEMsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO0FBQ2xCLFFBQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUE7Q0FDM0M7QUFDRCxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiBbdmFsLCBwcmV2U3RhdGVdXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdmFsKHByZXZTdGF0ZSkuY2hhaW4oKHBhcmFtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IHBhcmFtc1swXSwgbmV3U3RhdGUgPSBwYXJhbXNbMV1cclxuICAgICAgICByZXR1cm4gW2Z1bmsodmFsKSwgbmV3U3RhdGVdXHJcbiAgICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB2YWwuY2hhaW4oKGlubmVyVmFsdWUpID0+IFtpbm5lclZhbHVlLCBwcmV2U3RhdGVdKVxyXG4gIH0sXHJcbiAgbG9hZCAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gW3ByZXZTdGF0ZSwgcHJldlN0YXRlXVxyXG4gIH0sXHJcbiAgc2F2ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gW3ZhbCwgdmFsXVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJRCcsXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4ge2lkVmFsOiB2YWwgfSB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwsIHByb3RvKSB7XHJcbiAgICByZXR1cm4gcHJvdG8uY2hhaW4oKGlubmVySWQpID0+IGZ1bmsoaW5uZXJJZC5pZFZhbCksIHZhbClcclxuICB9LFxyXG4gIGxpZnQgKHZhbCwgcHJvdG8pIHtcclxuICAgIHJldHVybiBwcm90by5jaGFpbigoaW5uZXJWYWx1ZSkgPT4gdmFsLm9mKHtpZFZhbDogaW5uZXJWYWx1ZX0pLCB2YWwpXHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnRzLm1heWJlID0ge1xyXG4gIG5hbWU6ICdNYXliZScsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHttYXliZVZhbDogdmFsIH1cclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwsIHByb3RvKSB7XHJcbiAgICBkZWJ1Z2dlclxyXG4gICAgcmV0dXJuIHByb3RvLmNoYWluKChpbm5lck1heWJlKSA9PlxyXG4gICAgICBpbm5lck1heWJlLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBpbm5lck1heWJlIDogZnVuayhpbm5lck1heWJlLm1heWJlVmFsKSwgdmFsKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsLCBwcm90bykge1xyXG4gICAgcmV0dXJuIHByb3RvLmNoYWluKChpbm5lclZhbHVlKSA9PiB2YWwub2Yoe21heWJlVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICB9LFxyXG4gIGdldCAoa2V5LCB2YWwpIHtcclxuICAgIHJldHVybiB7bWF5YmVWYWw6IHZhbFtrZXldfVxyXG4gIH1cclxufVxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ0xpc3QnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY29uc3RydWN0b3IgPT09IEFycmF5ID8gdmFsIDogW3ZhbF1cclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oKGlubmVyTGlzdCkgPT5cclxuICAgICAgaW5uZXJMaXN0LnJlZHVjZSgobGlzdCwgdmFsKSA9PiBsaXN0LmNvbmNhdChmdW5rKHZhbCkpLCBbXSkpXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oKGlubmVyVmFsdWUpID0+XHJcbiAgICAgIHZhbC5vZihbaW5uZXJWYWx1ZV0pKVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLnByaW0gPSByZXF1aXJlKCcuL3ByaW0nKVxyXG5leHBvcnRzLmRhdGEgPSByZXF1aXJlKCcuL2RhdGEnKVxyXG5leHBvcnRzLmNvbXAgPSByZXF1aXJlKCcuL2NvbXAnKVxyXG5cclxuY29uc3QgaWRQcm90byA9IHtcclxuICAvLyBUaGUgJ29mJyBmdW5jdGlvbiB3cmFwcyBhIHZhbHVlIGluIGEgbW9uYWQuXHJcbiAgLy8gSW4gdGhlIGNhc2Ugb2YgdGhlIGlkZW50aXR5IG1vbmFkLCB3ZSBkb24ndCBkbyBhbnl0aGluZywgc28gd2UgZG9uJ3QgcmVhbGx5XHJcbiAgLy8gbmVlZCB0byB3cmFwIGl0LlxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWxcclxuICB9LFxyXG4gIC8vIGlkZW50aXR5IG1vbmFkJ3MgY2hhaW4gaW1wbGVtZW50YXRpb24uXHJcbiAgLy8gU2luY2Ugbm8gcGFja2luZyBhbmQgdW5wYWNraW5nIHRha2VzIHBsYWNlLFxyXG4gIC8vIGFsbCB3ZSBoYXZlIHRvIGRvIGlzIHRvIGFwcGx5IHRoZSBmdW5jdGlvblxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9XHJcbn1cclxuXHJcbi8vIFVud3JhcHMgYSB3cmFwcGVkIHZhbHVlXHJcbmNvbnN0IHVud3JhcCA9ICh2YWwpID0+IHtcclxuICBpZiAoIXZhbC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJykpIHt0aHJvdyBKU09OLnN0cmluZ2lmeSh2YWwpICsgJyBpcyBub3QgYSB3cmFwcGVkIHZhbHVlJ31cclxuICByZXR1cm4gdmFsLl92YWx1ZVxyXG59XHJcblxyXG4vLyBXcmFwcyBhIHZhbHVlIGluIGEgc3BlY2lmaWVkIHByb3RvdHlwZVxyXG5jb25zdCB3cmFwSW4gPSAocHJvdG8sIHZhbCkgPT4ge1xyXG4gIHZhciBvYmogPSBPYmplY3QuY3JlYXRlKHByb3RvKVxyXG4gIG9iai5fdmFsdWUgPSB2YWxcclxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShvYmopXHJcbn1cclxuXHJcbmV4cG9ydHMubWFrZSA9IGZ1bmN0aW9uIG1ha2VfbW9uYWQgKG91dGVyLCBpbm5lcikge1xyXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IG9iamVjdCBhbmQgd3JhcHMgaXQgaW4gdGhlIHN0YWNrIHByb3RvdHlwZVxyXG4gIGZ1bmN0aW9uIGNyZWF0ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gd3JhcEluKHN0YWNrUHJvdG8sIHZhbClcclxuICB9XHJcblxyXG4gIC8vIERlZmluZSB0aGUgcHJvdG90eXBlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICBjb25zdCBvdXRlclByb3RvID0ge1xyXG4gICAgb2Y6IG91dGVyLm9mLFxyXG4gICAgLy8gSGVyZSB3ZSBqdXN0IHRha2UgdGhlICdjaGFpbicgZnVuY3Rpb24gZnJvbSB0aGUgbW9uYWQncyBkZWZpbml0aW9uLFxyXG4gICAgLy8gYW5kIGFwcGx5IGl0IHRvIHRoZSB2YWx1ZSwgcGxhY2VkIGluIHRoZSBvYmplY3QncyAnX3ZhbHVlJyBwcm9wZXJ0eVxyXG4gICAgLy8gV2hlbiB3ZSBzdGFjayBtb25hZCB0cmFuc2Zvcm1lcnMsIHdlIG11c3QgaGF2ZSBhIHJlYWwgbW9uYWQgYXQgdGhlIGJvdHRvbS5cclxuICAgIC8vIFRoYXQgaXMgd2h5IHdlIHdyYXAgb3VyIHZhbHVlIGluIGFuIElEIG1vbmFkXHJcbiAgICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICAgIHJldHVybiBvdXRlci5jaGFpbihmdW5rLCB2YWwsIGlkUHJvdG8pXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IHtcclxuICAgIHByb3RvdHlwZTogc3RhY2tQcm90byxcclxuXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICByZXR1cm4gY3JlYXRlKGlubmVyLmNoYWluKGZ1bmtBbmRVbndyYXAsIHRoaXMuX3ZhbHVlLCBvdXRlclByb3RvKSlcclxuICAgIH0sXHJcblxyXG4gICAgLy8gQWRkICdtYXAnIGFuZCAnb2YnIGZ1bmN0aW9uc1xyXG4gICAgb2YgKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUob3V0ZXIub2YoaW5uZXIub2YodmFsdWUpKSlcclxuICAgIH0sXHJcbiAgICBtYXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gTGlmdHMgYSB2YWx1ZSBmcm9tIHRoZSBvdXRlciB0eXBlIHRvIGEgZnVsbCBzdGFja1xyXG4gIGNvbnN0IGxpZnRPdXRlciA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0gPSAodmFsKSA9PiBjcmVhdGUoaW5uZXIubGlmdCh2YWwsIG91dGVyUHJvdG8pKVxyXG4gIGNvbnN0IGxpZnRJbm5lciA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBpbm5lci5uYW1lIF0gPSAodmFsKSA9PiBjcmVhdGUob3V0ZXIub2YodmFsKSlcclxuXHJcbiAgLy8gQWRkIHZhcmlhbnRzIG9mICdjaGFpbicgY29tcG9zZWQgd2l0aCBsaWZ0LCB3aGljaCB3b3JrIGluIGlubmVyIGFuZCBvdXRlciB2YWx1ZXNcclxuICBzdGFja1Byb3RvIFsgJ2NoYWluJyArIGlubmVyLm5hbWUgXSA9IGZ1bmN0aW9uIChmdW5rKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiBsaWZ0SW5uZXIoZnVuayh2YWwpKSlcclxuICB9XHJcbiAgc3RhY2tQcm90byBbICdjaGFpbicgKyBvdXRlci5uYW1lIF0gPSBmdW5jdGlvbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gbGlmdE91dGVyKGZ1bmsodmFsKSkpXHJcbiAgfVxyXG5cclxuICAvLyBVc2luZyB0aGUgbGlmdCBvcGVyYXRpb25zLCBsaWZ0IGFsbCBtb25hZCBoZWxwZXJzIGFuZCBhc3NpZ24gdGhlbSB0byB0aGUgc3RhY2sgb2JqZWN0OlxyXG4gIGNvbnN0IGV4dGVuZCA9IChvdXRlcikgPT4ge1xyXG4gICAgT2JqZWN0LmtleXMob3V0ZXIpXHJcbiAgICAgIC5maWx0ZXIoKGtleSkgPT4gKGtleSAhPT0gJ29mJyAmJiBrZXkgIT09ICdjaGFpbicgJiYga2V5ICE9PSAnbGlmdCcpKVxyXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB7XHJcbiAgICAgICAgc3RhY2tQcm90b1trZXldID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcclxuXHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB7XHJcbiAgICAgICAgICAgIGFyZ3MucHVzaCh2YWwpXHJcbiAgICAgICAgICAgIHJldHVybiBzdGFja1Byb3RvWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0ob3V0ZXJba2V5XS5hcHBseShudWxsLCBhcmdzKSlcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gIH1cclxuICBleHRlbmQob3V0ZXIpXHJcbiAgZXh0ZW5kKGlubmVyKVxyXG4gIC8vIEFkZCBhbGlhc2VzIHRvIHRoZSBtb25hZHMgdGhlbXNlbHZlc1xyXG4gIHN0YWNrUHJvdG8gWyBpbm5lci5uYW1lIF0gPSBpbm5lclxyXG4gIHN0YWNrUHJvdG8gWyBvdXRlci5uYW1lIF0gPSBvdXRlclxyXG5cclxuICAvLyBBZGQgcmVsZXZhbnQgcHJvdG90eXBlIHByb3BlcnRpZXMgdG8gdGhlIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZSBbICdsaWZ0JyArIG91dGVyLm5hbWUgXSA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBvdXRlci5uYW1lIF1cclxuICBjcmVhdGUgWyAnbGlmdCcgKyBpbm5lci5uYW1lIF0gPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdXHJcblxyXG4gIC8vIFN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgcmV0dXJuIGNyZWF0ZVxyXG59XHJcbiIsIlwidXNlIHN0cmljdFwiO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYlhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWlJc0ltWnBiR1VpT2lKak9pOW5hWFF0Y0hKdmFtVmpkSE12YzI5dWJtVXZiR2xpTDNCeWFXMHVhbk1pTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2VzExOSIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQnVmZmVyKGFyZykge1xuICByZXR1cm4gYXJnICYmIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnXG4gICAgJiYgdHlwZW9mIGFyZy5jb3B5ID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5maWxsID09PSAnZnVuY3Rpb24nXG4gICAgJiYgdHlwZW9mIGFyZy5yZWFkVUludDggPT09ICdmdW5jdGlvbic7XG59IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICghaXNTdHJpbmcoZikpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goaW5zcGVjdChhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdHMuam9pbignICcpO1xuICB9XG5cbiAgdmFyIGkgPSAxO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIGxlbiA9IGFyZ3MubGVuZ3RoO1xuICB2YXIgc3RyID0gU3RyaW5nKGYpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHggPT09ICclJScpIHJldHVybiAnJSc7XG4gICAgaWYgKGkgPj0gbGVuKSByZXR1cm4geDtcbiAgICBzd2l0Y2ggKHgpIHtcbiAgICAgIGNhc2UgJyVzJzogcmV0dXJuIFN0cmluZyhhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWQnOiByZXR1cm4gTnVtYmVyKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclaic6XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gJ1tDaXJjdWxhcl0nO1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IgKHZhciB4ID0gYXJnc1tpXTsgaSA8IGxlbjsgeCA9IGFyZ3NbKytpXSkge1xuICAgIGlmIChpc051bGwoeCkgfHwgIWlzT2JqZWN0KHgpKSB7XG4gICAgICBzdHIgKz0gJyAnICsgeDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGluc3BlY3QoeCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG5cbi8vIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4vLyBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuLy8gSWYgLS1uby1kZXByZWNhdGlvbiBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbmV4cG9ydHMuZGVwcmVjYXRlID0gZnVuY3Rpb24oZm4sIG1zZykge1xuICAvLyBBbGxvdyBmb3IgZGVwcmVjYXRpbmcgdGhpbmdzIGluIHRoZSBwcm9jZXNzIG9mIHN0YXJ0aW5nIHVwLlxuICBpZiAoaXNVbmRlZmluZWQoZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGV4cG9ydHMuZGVwcmVjYXRlKGZuLCBtc2cpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuXG4gIGlmIChwcm9jZXNzLm5vRGVwcmVjYXRpb24gPT09IHRydWUpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChwcm9jZXNzLnRocm93RGVwcmVjYXRpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKHByb2Nlc3MudHJhY2VEZXByZWNhdGlvbikge1xuICAgICAgICBjb25zb2xlLnRyYWNlKG1zZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufTtcblxuXG52YXIgZGVidWdzID0ge307XG52YXIgZGVidWdFbnZpcm9uO1xuZXhwb3J0cy5kZWJ1Z2xvZyA9IGZ1bmN0aW9uKHNldCkge1xuICBpZiAoaXNVbmRlZmluZWQoZGVidWdFbnZpcm9uKSlcbiAgICBkZWJ1Z0Vudmlyb24gPSBwcm9jZXNzLmVudi5OT0RFX0RFQlVHIHx8ICcnO1xuICBzZXQgPSBzZXQudG9VcHBlckNhc2UoKTtcbiAgaWYgKCFkZWJ1Z3Nbc2V0XSkge1xuICAgIGlmIChuZXcgUmVnRXhwKCdcXFxcYicgKyBzZXQgKyAnXFxcXGInLCAnaScpLnRlc3QoZGVidWdFbnZpcm9uKSkge1xuICAgICAgdmFyIHBpZCA9IHByb2Nlc3MucGlkO1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG1zZyA9IGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJyVzICVkOiAlcycsIHNldCwgcGlkLCBtc2cpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVidWdzW3NldF0gPSBmdW5jdGlvbigpIHt9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVidWdzW3NldF07XG59O1xuXG5cbi8qKlxuICogRWNob3MgdGhlIHZhbHVlIG9mIGEgdmFsdWUuIFRyeXMgdG8gcHJpbnQgdGhlIHZhbHVlIG91dFxuICogaW4gdGhlIGJlc3Qgd2F5IHBvc3NpYmxlIGdpdmVuIHRoZSBkaWZmZXJlbnQgdHlwZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHRvIHByaW50IG91dC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgYWx0ZXJzIHRoZSBvdXRwdXQuXG4gKi9cbi8qIGxlZ2FjeTogb2JqLCBzaG93SGlkZGVuLCBkZXB0aCwgY29sb3JzKi9cbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBvcHRzKSB7XG4gIC8vIGRlZmF1bHQgb3B0aW9uc1xuICB2YXIgY3R4ID0ge1xuICAgIHNlZW46IFtdLFxuICAgIHN0eWxpemU6IHN0eWxpemVOb0NvbG9yXG4gIH07XG4gIC8vIGxlZ2FjeS4uLlxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSBjdHguZGVwdGggPSBhcmd1bWVudHNbMl07XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDQpIGN0eC5jb2xvcnMgPSBhcmd1bWVudHNbM107XG4gIGlmIChpc0Jvb2xlYW4ob3B0cykpIHtcbiAgICAvLyBsZWdhY3kuLi5cbiAgICBjdHguc2hvd0hpZGRlbiA9IG9wdHM7XG4gIH0gZWxzZSBpZiAob3B0cykge1xuICAgIC8vIGdvdCBhbiBcIm9wdGlvbnNcIiBvYmplY3RcbiAgICBleHBvcnRzLl9leHRlbmQoY3R4LCBvcHRzKTtcbiAgfVxuICAvLyBzZXQgZGVmYXVsdCBvcHRpb25zXG4gIGlmIChpc1VuZGVmaW5lZChjdHguc2hvd0hpZGRlbikpIGN0eC5zaG93SGlkZGVuID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguZGVwdGgpKSBjdHguZGVwdGggPSAyO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmNvbG9ycykpIGN0eC5jb2xvcnMgPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jdXN0b21JbnNwZWN0KSkgY3R4LmN1c3RvbUluc3BlY3QgPSB0cnVlO1xuICBpZiAoY3R4LmNvbG9ycykgY3R4LnN0eWxpemUgPSBzdHlsaXplV2l0aENvbG9yO1xuICByZXR1cm4gZm9ybWF0VmFsdWUoY3R4LCBvYmosIGN0eC5kZXB0aCk7XG59XG5leHBvcnRzLmluc3BlY3QgPSBpbnNwZWN0O1xuXG5cbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQU5TSV9lc2NhcGVfY29kZSNncmFwaGljc1xuaW5zcGVjdC5jb2xvcnMgPSB7XG4gICdib2xkJyA6IFsxLCAyMl0sXG4gICdpdGFsaWMnIDogWzMsIDIzXSxcbiAgJ3VuZGVybGluZScgOiBbNCwgMjRdLFxuICAnaW52ZXJzZScgOiBbNywgMjddLFxuICAnd2hpdGUnIDogWzM3LCAzOV0sXG4gICdncmV5JyA6IFs5MCwgMzldLFxuICAnYmxhY2snIDogWzMwLCAzOV0sXG4gICdibHVlJyA6IFszNCwgMzldLFxuICAnY3lhbicgOiBbMzYsIDM5XSxcbiAgJ2dyZWVuJyA6IFszMiwgMzldLFxuICAnbWFnZW50YScgOiBbMzUsIDM5XSxcbiAgJ3JlZCcgOiBbMzEsIDM5XSxcbiAgJ3llbGxvdycgOiBbMzMsIDM5XVxufTtcblxuLy8gRG9uJ3QgdXNlICdibHVlJyBub3QgdmlzaWJsZSBvbiBjbWQuZXhlXG5pbnNwZWN0LnN0eWxlcyA9IHtcbiAgJ3NwZWNpYWwnOiAnY3lhbicsXG4gICdudW1iZXInOiAneWVsbG93JyxcbiAgJ2Jvb2xlYW4nOiAneWVsbG93JyxcbiAgJ3VuZGVmaW5lZCc6ICdncmV5JyxcbiAgJ251bGwnOiAnYm9sZCcsXG4gICdzdHJpbmcnOiAnZ3JlZW4nLFxuICAnZGF0ZSc6ICdtYWdlbnRhJyxcbiAgLy8gXCJuYW1lXCI6IGludGVudGlvbmFsbHkgbm90IHN0eWxpbmdcbiAgJ3JlZ2V4cCc6ICdyZWQnXG59O1xuXG5cbmZ1bmN0aW9uIHN0eWxpemVXaXRoQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgdmFyIHN0eWxlID0gaW5zcGVjdC5zdHlsZXNbc3R5bGVUeXBlXTtcblxuICBpZiAoc3R5bGUpIHtcbiAgICByZXR1cm4gJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVswXSArICdtJyArIHN0ciArXG4gICAgICAgICAgICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMV0gKyAnbSc7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIHN0eWxpemVOb0NvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gYXJyYXlUb0hhc2goYXJyYXkpIHtcbiAgdmFyIGhhc2ggPSB7fTtcblxuICBhcnJheS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaWR4KSB7XG4gICAgaGFzaFt2YWxdID0gdHJ1ZTtcbiAgfSk7XG5cbiAgcmV0dXJuIGhhc2g7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gIGlmIChjdHguY3VzdG9tSW5zcGVjdCAmJlxuICAgICAgdmFsdWUgJiZcbiAgICAgIGlzRnVuY3Rpb24odmFsdWUuaW5zcGVjdCkgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMsIGN0eCk7XG4gICAgaWYgKCFpc1N0cmluZyhyZXQpKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgdmFyIHZpc2libGVLZXlzID0gYXJyYXlUb0hhc2goa2V5cyk7XG5cbiAgaWYgKGN0eC5zaG93SGlkZGVuKSB7XG4gICAga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgfVxuXG4gIC8vIElFIGRvZXNuJ3QgbWFrZSBlcnJvciBmaWVsZHMgbm9uLWVudW1lcmFibGVcbiAgLy8gaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2llL2R3dzUyc2J0KHY9dnMuOTQpLmFzcHhcbiAgaWYgKGlzRXJyb3IodmFsdWUpXG4gICAgICAmJiAoa2V5cy5pbmRleE9mKCdtZXNzYWdlJykgPj0gMCB8fCBrZXlzLmluZGV4T2YoJ2Rlc2NyaXB0aW9uJykgPj0gMCkpIHtcbiAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgLy8gU29tZSB0eXBlIG9mIG9iamVjdCB3aXRob3V0IHByb3BlcnRpZXMgY2FuIGJlIHNob3J0Y3V0dGVkLlxuICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHZhciBuYW1lID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG4gIGlmIChpc1N0cmluZyh2YWx1ZSkpIHtcbiAgICB2YXIgc2ltcGxlID0gJ1xcJycgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkucmVwbGFjZSgvXlwifFwiJC9nLCAnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG4gIH1cbiAgaWYgKGlzTnVtYmVyKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuICBpZiAoaXNCb29sZWFuKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgLy8gRm9yIHNvbWUgcmVhc29uIHR5cGVvZiBudWxsIGlzIFwib2JqZWN0XCIsIHNvIHNwZWNpYWwgY2FzZSBoZXJlLlxuICBpZiAoaXNOdWxsKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiAnWycgKyBFcnJvci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsID0gdmFsdWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5KHZhbHVlLCBTdHJpbmcoaSkpKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIFN0cmluZyhpKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnJyk7XG4gICAgfVxuICB9XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoIWtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAga2V5LCB0cnVlKSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KSB7XG4gIHZhciBuYW1lLCBzdHIsIGRlc2M7XG4gIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHZhbHVlLCBrZXkpIHx8IHsgdmFsdWU6IHZhbHVlW2tleV0gfTtcbiAgaWYgKGRlc2MuZ2V0KSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlci9TZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRlc2Muc2V0KSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoIWhhc093blByb3BlcnR5KHZpc2libGVLZXlzLCBrZXkpKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChjdHguc2Vlbi5pbmRleE9mKGRlc2MudmFsdWUpIDwgMCkge1xuICAgICAgaWYgKGlzTnVsbChyZWN1cnNlVGltZXMpKSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgfVxuICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgIGlmIChhcnJheSkge1xuICAgICAgICAgIHN0ciA9IHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gJ1xcbicgKyBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzVW5kZWZpbmVkKG5hbWUpKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLnJlcGxhY2UoL1xcdTAwMWJcXFtcXGRcXGQ/bS9nLCAnJykubGVuZ3RoICsgMTtcbiAgfSwgMCk7XG5cbiAgaWYgKGxlbmd0aCA+IDYwKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArXG4gICAgICAgICAgIChiYXNlID09PSAnJyA/ICcnIDogYmFzZSArICdcXG4gJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBvdXRwdXQuam9pbignLFxcbiAgJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBicmFjZXNbMV07XG4gIH1cblxuICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xufVxuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKTtcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHJlKSAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGQpICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiBpc09iamVjdChlKSAmJlxuICAgICAgKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gcmVxdWlyZSgnLi9zdXBwb3J0L2lzQnVmZmVyJyk7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cblxuXG5mdW5jdGlvbiBwYWQobikge1xuICByZXR1cm4gbiA8IDEwID8gJzAnICsgbi50b1N0cmluZygxMCkgOiBuLnRvU3RyaW5nKDEwKTtcbn1cblxuXG52YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsXG4gICAgICAgICAgICAgICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4vLyAyNiBGZWIgMTY6MTk6MzRcbmZ1bmN0aW9uIHRpbWVzdGFtcCgpIHtcbiAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuICB2YXIgdGltZSA9IFtwYWQoZC5nZXRIb3VycygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0TWludXRlcygpKSxcbiAgICAgICAgICAgICAgcGFkKGQuZ2V0U2Vjb25kcygpKV0uam9pbignOicpO1xuICByZXR1cm4gW2QuZ2V0RGF0ZSgpLCBtb250aHNbZC5nZXRNb250aCgpXSwgdGltZV0uam9pbignICcpO1xufVxuXG5cbi8vIGxvZyBpcyBqdXN0IGEgdGhpbiB3cmFwcGVyIHRvIGNvbnNvbGUubG9nIHRoYXQgcHJlcGVuZHMgYSB0aW1lc3RhbXBcbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKCclcyAtICVzJywgdGltZXN0YW1wKCksIGV4cG9ydHMuZm9ybWF0LmFwcGx5KGV4cG9ydHMsIGFyZ3VtZW50cykpO1xufTtcblxuXG4vKipcbiAqIEluaGVyaXQgdGhlIHByb3RvdHlwZSBtZXRob2RzIGZyb20gb25lIGNvbnN0cnVjdG9yIGludG8gYW5vdGhlci5cbiAqXG4gKiBUaGUgRnVuY3Rpb24ucHJvdG90eXBlLmluaGVyaXRzIGZyb20gbGFuZy5qcyByZXdyaXR0ZW4gYXMgYSBzdGFuZGFsb25lXG4gKiBmdW5jdGlvbiAobm90IG9uIEZ1bmN0aW9uLnByb3RvdHlwZSkuIE5PVEU6IElmIHRoaXMgZmlsZSBpcyB0byBiZSBsb2FkZWRcbiAqIGR1cmluZyBib290c3RyYXBwaW5nIHRoaXMgZnVuY3Rpb24gbmVlZHMgdG8gYmUgcmV3cml0dGVuIHVzaW5nIHNvbWUgbmF0aXZlXG4gKiBmdW5jdGlvbnMgYXMgcHJvdG90eXBlIHNldHVwIHVzaW5nIG5vcm1hbCBKYXZhU2NyaXB0IGRvZXMgbm90IHdvcmsgYXNcbiAqIGV4cGVjdGVkIGR1cmluZyBib290c3RyYXBwaW5nIChzZWUgbWlycm9yLmpzIGluIHIxMTQ5MDMpLlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gd2hpY2ggbmVlZHMgdG8gaW5oZXJpdCB0aGVcbiAqICAgICBwcm90b3R5cGUuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBzdXBlckN0b3IgQ29uc3RydWN0b3IgZnVuY3Rpb24gdG8gaW5oZXJpdCBwcm90b3R5cGUgZnJvbS5cbiAqL1xuZXhwb3J0cy5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmV4cG9ydHMuX2V4dGVuZCA9IGZ1bmN0aW9uKG9yaWdpbiwgYWRkKSB7XG4gIC8vIERvbid0IGRvIGFueXRoaW5nIGlmIGFkZCBpc24ndCBhbiBvYmplY3RcbiAgaWYgKCFhZGQgfHwgIWlzT2JqZWN0KGFkZCkpIHJldHVybiBvcmlnaW47XG5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhhZGQpO1xuICB2YXIgaSA9IGtleXMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgb3JpZ2luW2tleXNbaV1dID0gYWRkW2tleXNbaV1dO1xuICB9XG4gIHJldHVybiBvcmlnaW47XG59O1xuXG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuIiwiLyoqXG4gKiBTaW5vbiBjb3JlIHV0aWxpdGllcy4gRm9yIGludGVybmFsIHVzZSBvbmx5LlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbnZhciBzaW5vbiA9IChmdW5jdGlvbiAoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBzaW5vbk1vZHVsZTtcbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgc2lub25Nb2R1bGUgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL3Npbm9uL3V0aWwvY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vZXh0ZW5kXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi93YWxrXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi90eXBlT2ZcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL3RpbWVzX2luX3dvcmRzXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9zcHlcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL2NhbGxcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL2JlaGF2aW9yXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9zdHViXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9tb2NrXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9jb2xsZWN0aW9uXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zaW5vbi9hc3NlcnRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL3NhbmRib3hcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL3Rlc3RcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL3Rlc3RfY2FzZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vbWF0Y2hcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3Npbm9uL2Zvcm1hdFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc2lub24vbG9nX2Vycm9yXCIpO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgfSBlbHNlIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgc2lub25Nb2R1bGUgPSBtb2R1bGUuZXhwb3J0cztcbiAgICB9IGVsc2Uge1xuICAgICAgICBzaW5vbk1vZHVsZSA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiBzaW5vbk1vZHVsZTtcbn0oKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdGltZXNfaW5fd29yZHMuanNcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIG1hdGNoLmpzXG4gKiBAZGVwZW5kIGZvcm1hdC5qc1xuICovXG4vKipcbiAqIEFzc2VydGlvbnMgbWF0Y2hpbmcgdGhlIHRlc3Qgc3B5IHJldHJpZXZhbCBpbnRlcmZhY2UuXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCwgZ2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHZhciBhc3NlcnQ7XG5cbiAgICAgICAgZnVuY3Rpb24gdmVyaWZ5SXNTdHViKCkge1xuICAgICAgICAgICAgdmFyIG1ldGhvZDtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kID0gYXJndW1lbnRzW2ldO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFtZXRob2QpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0LmZhaWwoXCJmYWtlIGlzIG5vdCBhIHNweVwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWV0aG9kLnByb3h5ICYmIG1ldGhvZC5wcm94eS5pc1Npbm9uUHJveHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZ5SXNTdHViKG1ldGhvZC5wcm94eSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXRob2QgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXJ0LmZhaWwobWV0aG9kICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1ldGhvZC5nZXRDYWxsICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2VydC5mYWlsKG1ldGhvZCArIFwiIGlzIG5vdCBzdHViYmVkXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBmYWlsQXNzZXJ0aW9uKG9iamVjdCwgbXNnKSB7XG4gICAgICAgICAgICBvYmplY3QgPSBvYmplY3QgfHwgZ2xvYmFsO1xuICAgICAgICAgICAgdmFyIGZhaWxNZXRob2QgPSBvYmplY3QuZmFpbCB8fCBhc3NlcnQuZmFpbDtcbiAgICAgICAgICAgIGZhaWxNZXRob2QuY2FsbChvYmplY3QsIG1zZyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBtaXJyb3JQcm9wQXNBc3NlcnRpb24obmFtZSwgbWV0aG9kLCBtZXNzYWdlKSB7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXRob2Q7XG4gICAgICAgICAgICAgICAgbWV0aG9kID0gbmFtZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXNzZXJ0W25hbWVdID0gZnVuY3Rpb24gKGZha2UpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlJc1N0dWIoZmFrZSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgICAgICAgICB2YXIgZmFpbGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1ldGhvZCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGZhaWxlZCA9ICFtZXRob2QoZmFrZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZmFpbGVkID0gdHlwZW9mIGZha2VbbWV0aG9kXSA9PT0gXCJmdW5jdGlvblwiID9cbiAgICAgICAgICAgICAgICAgICAgICAgICFmYWtlW21ldGhvZF0uYXBwbHkoZmFrZSwgYXJncykgOiAhZmFrZVttZXRob2RdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChmYWlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZmFpbEFzc2VydGlvbih0aGlzLCAoZmFrZS5wcmludGYgfHwgZmFrZS5wcm94eS5wcmludGYpLmFwcGx5KGZha2UsIFttZXNzYWdlXS5jb25jYXQoYXJncykpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhc3NlcnQucGFzcyhuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZXhwb3NlZE5hbWUocHJlZml4LCBwcm9wKSB7XG4gICAgICAgICAgICByZXR1cm4gIXByZWZpeCB8fCAvXmZhaWwvLnRlc3QocHJvcCkgPyBwcm9wIDpcbiAgICAgICAgICAgICAgICBwcmVmaXggKyBwcm9wLnNsaWNlKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBwcm9wLnNsaWNlKDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXJ0ID0ge1xuICAgICAgICAgICAgZmFpbEV4Y2VwdGlvbjogXCJBc3NlcnRFcnJvclwiLFxuXG4gICAgICAgICAgICBmYWlsOiBmdW5jdGlvbiBmYWlsKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgZXJyb3IubmFtZSA9IHRoaXMuZmFpbEV4Y2VwdGlvbiB8fCBhc3NlcnQuZmFpbEV4Y2VwdGlvbjtcblxuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcGFzczogZnVuY3Rpb24gcGFzcygpIHt9LFxuXG4gICAgICAgICAgICBjYWxsT3JkZXI6IGZ1bmN0aW9uIGFzc2VydENhbGxPcmRlcigpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlJc1N0dWIuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB2YXIgZXhwZWN0ZWQgPSBcIlwiO1xuICAgICAgICAgICAgICAgIHZhciBhY3R1YWwgPSBcIlwiO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFzaW5vbi5jYWxsZWRJbk9yZGVyKGFyZ3VtZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkID0gW10uam9pbi5jYWxsKGFyZ3VtZW50cywgXCIsIFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYWxscyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBpID0gY2FsbHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNhbGxzWy0taV0uY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBhY3R1YWwgPSBzaW5vbi5vcmRlckJ5Rmlyc3RDYWxsKGNhbGxzKS5qb2luKFwiLCBcIik7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoaXMgZmFpbHMsIHdlJ2xsIGp1c3QgZmFsbCBiYWNrIHRvIHRoZSBibGFuayBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGZhaWxBc3NlcnRpb24odGhpcywgXCJleHBlY3RlZCBcIiArIGV4cGVjdGVkICsgXCIgdG8gYmUgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImNhbGxlZCBpbiBvcmRlciBidXQgd2VyZSBjYWxsZWQgYXMgXCIgKyBhY3R1YWwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydC5wYXNzKFwiY2FsbE9yZGVyXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxDb3VudDogZnVuY3Rpb24gYXNzZXJ0Q2FsbENvdW50KG1ldGhvZCwgY291bnQpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlJc1N0dWIobWV0aG9kKTtcblxuICAgICAgICAgICAgICAgIGlmIChtZXRob2QuY2FsbENvdW50ICE9PSBjb3VudCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbXNnID0gXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgXCIgKyBzaW5vbi50aW1lc0luV29yZHMoY291bnQpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiIGJ1dCB3YXMgY2FsbGVkICVjJUNcIjtcbiAgICAgICAgICAgICAgICAgICAgZmFpbEFzc2VydGlvbih0aGlzLCBtZXRob2QucHJpbnRmKG1zZykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydC5wYXNzKFwiY2FsbENvdW50XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGV4cG9zZTogZnVuY3Rpb24gZXhwb3NlKHRhcmdldCwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJ0YXJnZXQgaXMgbnVsbCBvciB1bmRlZmluZWRcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICAgICAgICAgIHZhciBwcmVmaXggPSB0eXBlb2Ygby5wcmVmaXggPT09IFwidW5kZWZpbmVkXCIgJiYgXCJhc3NlcnRcIiB8fCBvLnByZWZpeDtcbiAgICAgICAgICAgICAgICB2YXIgaW5jbHVkZUZhaWwgPSB0eXBlb2Ygby5pbmNsdWRlRmFpbCA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhIW8uaW5jbHVkZUZhaWw7XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBtZXRob2QgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWV0aG9kICE9PSBcImV4cG9zZVwiICYmIChpbmNsdWRlRmFpbCB8fCAhL14oZmFpbCkvLnRlc3QobWV0aG9kKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtleHBvc2VkTmFtZShwcmVmaXgsIG1ldGhvZCldID0gdGhpc1ttZXRob2RdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG1hdGNoOiBmdW5jdGlvbiBtYXRjaChhY3R1YWwsIGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoZXIgPSBzaW5vbi5tYXRjaChleHBlY3RhdGlvbik7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXIudGVzdChhY3R1YWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2VydC5wYXNzKFwibWF0Y2hcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZvcm1hdHRlZCA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZXhwZWN0ZWQgdmFsdWUgdG8gbWF0Y2hcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiICAgIGV4cGVjdGVkID0gXCIgKyBzaW5vbi5mb3JtYXQoZXhwZWN0YXRpb24pLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCIgICAgYWN0dWFsID0gXCIgKyBzaW5vbi5mb3JtYXQoYWN0dWFsKVxuICAgICAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZhaWxBc3NlcnRpb24odGhpcywgZm9ybWF0dGVkLmpvaW4oXCJcXG5cIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRcIiwgXCJleHBlY3RlZCAlbiB0byBoYXZlIGJlZW4gY2FsbGVkIGF0IGxlYXN0IG9uY2UgYnV0IHdhcyBuZXZlciBjYWxsZWRcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcIm5vdENhbGxlZFwiLCBmdW5jdGlvbiAoc3B5KSB7XG4gICAgICAgICAgICByZXR1cm4gIXNweS5jYWxsZWQ7XG4gICAgICAgIH0sIFwiZXhwZWN0ZWQgJW4gdG8gbm90IGhhdmUgYmVlbiBjYWxsZWQgYnV0IHdhcyBjYWxsZWQgJWMlQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiY2FsbGVkT25jZVwiLCBcImV4cGVjdGVkICVuIHRvIGJlIGNhbGxlZCBvbmNlIGJ1dCB3YXMgY2FsbGVkICVjJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImNhbGxlZFR3aWNlXCIsIFwiZXhwZWN0ZWQgJW4gdG8gYmUgY2FsbGVkIHR3aWNlIGJ1dCB3YXMgY2FsbGVkICVjJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImNhbGxlZFRocmljZVwiLCBcImV4cGVjdGVkICVuIHRvIGJlIGNhbGxlZCB0aHJpY2UgYnV0IHdhcyBjYWxsZWQgJWMlQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwiY2FsbGVkT25cIiwgXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgd2l0aCAlMSBhcyB0aGlzIGJ1dCB3YXMgY2FsbGVkIHdpdGggJXRcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcbiAgICAgICAgICAgIFwiYWx3YXlzQ2FsbGVkT25cIixcbiAgICAgICAgICAgIFwiZXhwZWN0ZWQgJW4gdG8gYWx3YXlzIGJlIGNhbGxlZCB3aXRoICUxIGFzIHRoaXMgYnV0IHdhcyBjYWxsZWQgd2l0aCAldFwiXG4gICAgICAgICk7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImNhbGxlZFdpdGhOZXdcIiwgXCJleHBlY3RlZCAlbiB0byBiZSBjYWxsZWQgd2l0aCBuZXdcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImFsd2F5c0NhbGxlZFdpdGhOZXdcIiwgXCJleHBlY3RlZCAlbiB0byBhbHdheXMgYmUgY2FsbGVkIHdpdGggbmV3XCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRXaXRoXCIsIFwiZXhwZWN0ZWQgJW4gdG8gYmUgY2FsbGVkIHdpdGggYXJndW1lbnRzICUqJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImNhbGxlZFdpdGhNYXRjaFwiLCBcImV4cGVjdGVkICVuIHRvIGJlIGNhbGxlZCB3aXRoIG1hdGNoICUqJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImFsd2F5c0NhbGxlZFdpdGhcIiwgXCJleHBlY3RlZCAlbiB0byBhbHdheXMgYmUgY2FsbGVkIHdpdGggYXJndW1lbnRzICUqJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcImFsd2F5c0NhbGxlZFdpdGhNYXRjaFwiLCBcImV4cGVjdGVkICVuIHRvIGFsd2F5cyBiZSBjYWxsZWQgd2l0aCBtYXRjaCAlKiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJjYWxsZWRXaXRoRXhhY3RseVwiLCBcImV4cGVjdGVkICVuIHRvIGJlIGNhbGxlZCB3aXRoIGV4YWN0IGFyZ3VtZW50cyAlKiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJhbHdheXNDYWxsZWRXaXRoRXhhY3RseVwiLCBcImV4cGVjdGVkICVuIHRvIGFsd2F5cyBiZSBjYWxsZWQgd2l0aCBleGFjdCBhcmd1bWVudHMgJSolQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwibmV2ZXJDYWxsZWRXaXRoXCIsIFwiZXhwZWN0ZWQgJW4gdG8gbmV2ZXIgYmUgY2FsbGVkIHdpdGggYXJndW1lbnRzICUqJUNcIik7XG4gICAgICAgIG1pcnJvclByb3BBc0Fzc2VydGlvbihcIm5ldmVyQ2FsbGVkV2l0aE1hdGNoXCIsIFwiZXhwZWN0ZWQgJW4gdG8gbmV2ZXIgYmUgY2FsbGVkIHdpdGggbWF0Y2ggJSolQ1wiKTtcbiAgICAgICAgbWlycm9yUHJvcEFzQXNzZXJ0aW9uKFwidGhyZXdcIiwgXCIlbiBkaWQgbm90IHRocm93IGV4Y2VwdGlvbiVDXCIpO1xuICAgICAgICBtaXJyb3JQcm9wQXNBc3NlcnRpb24oXCJhbHdheXNUaHJld1wiLCBcIiVuIGRpZCBub3QgYWx3YXlzIHRocm93IGV4Y2VwdGlvbiVDXCIpO1xuXG4gICAgICAgIHNpbm9uLmFzc2VydCA9IGFzc2VydDtcbiAgICAgICAgcmV0dXJuIGFzc2VydDtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9tYXRjaFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZm9ybWF0XCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24sIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogc2VsZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIGV4dGVuZC5qc1xuICovXG4vKipcbiAqIFN0dWIgYmVoYXZpb3JcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBhdXRob3IgVGltIEZpc2NoYmFjaCAobWFpbEB0aW1maXNjaGJhY2guZGUpXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuICAgIHZhciBqb2luID0gQXJyYXkucHJvdG90eXBlLmpvaW47XG4gICAgdmFyIHVzZUxlZnRNb3N0Q2FsbGJhY2sgPSAtMTtcbiAgICB2YXIgdXNlUmlnaHRNb3N0Q2FsbGJhY2sgPSAtMjtcblxuICAgIHZhciBuZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgcHJvY2Vzcy5uZXh0VGljayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBzZXRJbW1lZGlhdGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcbiAgICAgICAgfTtcbiAgICB9KSgpO1xuXG4gICAgZnVuY3Rpb24gdGhyb3dzRXhjZXB0aW9uKGVycm9yLCBtZXNzYWdlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZXJyb3IgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHRoaXMuZXhjZXB0aW9uID0gbmV3IEVycm9yKG1lc3NhZ2UgfHwgXCJcIik7XG4gICAgICAgICAgICB0aGlzLmV4Y2VwdGlvbi5uYW1lID0gZXJyb3I7XG4gICAgICAgIH0gZWxzZSBpZiAoIWVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLmV4Y2VwdGlvbiA9IG5ldyBFcnJvcihcIkVycm9yXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5leGNlcHRpb24gPSBlcnJvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldENhbGxiYWNrKGJlaGF2aW9yLCBhcmdzKSB7XG4gICAgICAgIHZhciBjYWxsQXJnQXQgPSBiZWhhdmlvci5jYWxsQXJnQXQ7XG5cbiAgICAgICAgaWYgKGNhbGxBcmdBdCA+PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gYXJnc1tjYWxsQXJnQXRdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFyZ3VtZW50TGlzdDtcblxuICAgICAgICBpZiAoY2FsbEFyZ0F0ID09PSB1c2VMZWZ0TW9zdENhbGxiYWNrKSB7XG4gICAgICAgICAgICBhcmd1bWVudExpc3QgPSBhcmdzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbGxBcmdBdCA9PT0gdXNlUmlnaHRNb3N0Q2FsbGJhY2spIHtcbiAgICAgICAgICAgIGFyZ3VtZW50TGlzdCA9IHNsaWNlLmNhbGwoYXJncykucmV2ZXJzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNhbGxBcmdQcm9wID0gYmVoYXZpb3IuY2FsbEFyZ1Byb3A7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmd1bWVudExpc3QubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICBpZiAoIWNhbGxBcmdQcm9wICYmIHR5cGVvZiBhcmd1bWVudExpc3RbaV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcmd1bWVudExpc3RbaV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjYWxsQXJnUHJvcCAmJiBhcmd1bWVudExpc3RbaV0gJiZcbiAgICAgICAgICAgICAgICB0eXBlb2YgYXJndW1lbnRMaXN0W2ldW2NhbGxBcmdQcm9wXSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyZ3VtZW50TGlzdFtpXVtjYWxsQXJnUHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIGdldENhbGxiYWNrRXJyb3IoYmVoYXZpb3IsIGZ1bmMsIGFyZ3MpIHtcbiAgICAgICAgICAgIGlmIChiZWhhdmlvci5jYWxsQXJnQXQgPCAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1zZztcblxuICAgICAgICAgICAgICAgIGlmIChiZWhhdmlvci5jYWxsQXJnUHJvcCkge1xuICAgICAgICAgICAgICAgICAgICBtc2cgPSBzaW5vbi5mdW5jdGlvbk5hbWUoYmVoYXZpb3Iuc3R1YikgK1xuICAgICAgICAgICAgICAgICAgICAgICAgXCIgZXhwZWN0ZWQgdG8geWllbGQgdG8gJ1wiICsgYmVoYXZpb3IuY2FsbEFyZ1Byb3AgK1xuICAgICAgICAgICAgICAgICAgICAgICAgXCInLCBidXQgbm8gb2JqZWN0IHdpdGggc3VjaCBhIHByb3BlcnR5IHdhcyBwYXNzZWQuXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbXNnID0gc2lub24uZnVuY3Rpb25OYW1lKGJlaGF2aW9yLnN0dWIpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiIGV4cGVjdGVkIHRvIHlpZWxkLCBidXQgbm8gY2FsbGJhY2sgd2FzIHBhc3NlZC5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1zZyArPSBcIiBSZWNlaXZlZCBbXCIgKyBqb2luLmNhbGwoYXJncywgXCIsIFwiKSArIFwiXVwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBtc2c7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBcImFyZ3VtZW50IGF0IGluZGV4IFwiICsgYmVoYXZpb3IuY2FsbEFyZ0F0ICsgXCIgaXMgbm90IGEgZnVuY3Rpb246IFwiICsgZnVuYztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNhbGxDYWxsYmFjayhiZWhhdmlvciwgYXJncykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBiZWhhdmlvci5jYWxsQXJnQXQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICB2YXIgZnVuYyA9IGdldENhbGxiYWNrKGJlaGF2aW9yLCBhcmdzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoZ2V0Q2FsbGJhY2tFcnJvcihiZWhhdmlvciwgZnVuYywgYXJncykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChiZWhhdmlvci5jYWxsYmFja0FzeW5jKSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwbHkoYmVoYXZpb3IuY2FsbGJhY2tDb250ZXh0LCBiZWhhdmlvci5jYWxsYmFja0FyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwbHkoYmVoYXZpb3IuY2FsbGJhY2tDb250ZXh0LCBiZWhhdmlvci5jYWxsYmFja0FyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByb3RvID0ge1xuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiBjcmVhdGUoc3R1Yikge1xuICAgICAgICAgICAgICAgIHZhciBiZWhhdmlvciA9IHNpbm9uLmV4dGVuZCh7fSwgc2lub24uYmVoYXZpb3IpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBiZWhhdmlvci5jcmVhdGU7XG4gICAgICAgICAgICAgICAgYmVoYXZpb3Iuc3R1YiA9IHN0dWI7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gYmVoYXZpb3I7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBpc1ByZXNlbnQ6IGZ1bmN0aW9uIGlzUHJlc2VudCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKHR5cGVvZiB0aGlzLmNhbGxBcmdBdCA9PT0gXCJudW1iZXJcIiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5leGNlcHRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiB0aGlzLnJldHVybkFyZ0F0ID09PSBcIm51bWJlclwiIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJldHVyblRoaXMgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmV0dXJuVmFsdWVEZWZpbmVkKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGludm9rZTogZnVuY3Rpb24gaW52b2tlKGNvbnRleHQsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICBjYWxsQ2FsbGJhY2sodGhpcywgYXJncyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5leGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgdGhpcy5leGNlcHRpb247XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy5yZXR1cm5BcmdBdCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXJnc1t0aGlzLnJldHVybkFyZ0F0XTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucmV0dXJuVGhpcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uQ2FsbDogZnVuY3Rpb24gb25DYWxsKGluZGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3R1Yi5vbkNhbGwoaW5kZXgpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25GaXJzdENhbGw6IGZ1bmN0aW9uIG9uRmlyc3RDYWxsKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnN0dWIub25GaXJzdENhbGwoKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uU2Vjb25kQ2FsbDogZnVuY3Rpb24gb25TZWNvbmRDYWxsKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnN0dWIub25TZWNvbmRDYWxsKCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvblRoaXJkQ2FsbDogZnVuY3Rpb24gb25UaGlyZENhbGwoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3R1Yi5vblRoaXJkQ2FsbCgpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgd2l0aEFyZ3M6IGZ1bmN0aW9uIHdpdGhBcmdzKC8qIGFyZ3VtZW50cyAqLykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgXCJEZWZpbmluZyBhIHN0dWIgYnkgaW52b2tpbmcgXFxcInN0dWIub25DYWxsKC4uLikud2l0aEFyZ3MoLi4uKVxcXCIgXCIgK1xuICAgICAgICAgICAgICAgICAgICBcImlzIG5vdCBzdXBwb3J0ZWQuIFVzZSBcXFwic3R1Yi53aXRoQXJncyguLi4pLm9uQ2FsbCguLi4pXFxcIiBcIiArXG4gICAgICAgICAgICAgICAgICAgIFwidG8gZGVmaW5lIHNlcXVlbnRpYWwgYmVoYXZpb3IgZm9yIGNhbGxzIHdpdGggY2VydGFpbiBhcmd1bWVudHMuXCJcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbHNBcmc6IGZ1bmN0aW9uIGNhbGxzQXJnKHBvcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcG9zICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpbmRleCBpcyBub3QgbnVtYmVyXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gcG9zO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBcmd1bWVudHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQ29udGV4dCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdQcm9wID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBc3luYyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsc0FyZ09uOiBmdW5jdGlvbiBjYWxsc0FyZ09uKHBvcywgY29udGV4dCkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcG9zICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpbmRleCBpcyBub3QgbnVtYmVyXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImFyZ3VtZW50IGNvbnRleHQgaXMgbm90IGFuIG9iamVjdFwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdBdCA9IHBvcztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxzQXJnV2l0aDogZnVuY3Rpb24gY2FsbHNBcmdXaXRoKHBvcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcG9zICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBpbmRleCBpcyBub3QgbnVtYmVyXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gcG9zO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBcmd1bWVudHMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnUHJvcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbHNBcmdPbldpdGg6IGZ1bmN0aW9uIGNhbGxzQXJnV2l0aChwb3MsIGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHBvcyAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgaW5kZXggaXMgbm90IG51bWJlclwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBjb250ZXh0IGlzIG5vdCBhbiBvYmplY3RcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnQXQgPSBwb3M7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FyZ3VtZW50cyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQ29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnUHJvcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnQXQgPSB1c2VMZWZ0TW9zdENhbGxiYWNrO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBcmd1bWVudHMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnUHJvcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRzUmlnaHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdBdCA9IHVzZVJpZ2h0TW9zdENhbGxiYWNrO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBcmd1bWVudHMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnUHJvcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRzT246IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcmd1bWVudCBjb250ZXh0IGlzIG5vdCBhbiBvYmplY3RcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQXJnQXQgPSB1c2VMZWZ0TW9zdENhbGxiYWNrO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBcmd1bWVudHMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0NvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsYmFja0FzeW5jID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHlpZWxkc1RvOiBmdW5jdGlvbiAocHJvcCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gdXNlTGVmdE1vc3RDYWxsYmFjaztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ1Byb3AgPSBwcm9wO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBc3luYyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB5aWVsZHNUb09uOiBmdW5jdGlvbiAocHJvcCwgY29udGV4dCkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXJndW1lbnQgY29udGV4dCBpcyBub3QgYW4gb2JqZWN0XCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbEFyZ0F0ID0gdXNlTGVmdE1vc3RDYWxsYmFjaztcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tDb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdQcm9wID0gcHJvcDtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxiYWNrQXN5bmMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdGhyb3dzOiB0aHJvd3NFeGNlcHRpb24sXG4gICAgICAgICAgICB0aHJvd3NFeGNlcHRpb246IHRocm93c0V4Y2VwdGlvbixcblxuICAgICAgICAgICAgcmV0dXJuczogZnVuY3Rpb24gcmV0dXJucyh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmV0dXJuVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJldHVyblZhbHVlRGVmaW5lZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5leGNlcHRpb24gPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJldHVybnNBcmc6IGZ1bmN0aW9uIHJldHVybnNBcmcocG9zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwb3MgIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImFyZ3VtZW50IGluZGV4IGlzIG5vdCBudW1iZXJcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5yZXR1cm5BcmdBdCA9IHBvcztcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmV0dXJuc1RoaXM6IGZ1bmN0aW9uIHJldHVybnNUaGlzKCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmV0dXJuVGhpcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVBc3luY1ZlcnNpb24oc3luY0ZuTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gdGhpc1tzeW5jRm5OYW1lXS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tBc3luYyA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYXN5bmNocm9ub3VzIHZlcnNpb25zIG9mIGNhbGxzQXJnKiBhbmQgeWllbGRzKiBtZXRob2RzXG4gICAgICAgIGZvciAodmFyIG1ldGhvZCBpbiBwcm90bykge1xuICAgICAgICAgICAgLy8gbmVlZCB0byBhdm9pZCBjcmVhdGluZyBhbm90aGVyYXN5bmMgdmVyc2lvbnMgb2YgdGhlIG5ld2x5IGFkZGVkIGFzeW5jIG1ldGhvZHNcbiAgICAgICAgICAgIGlmIChwcm90by5oYXNPd25Qcm9wZXJ0eShtZXRob2QpICYmIG1ldGhvZC5tYXRjaCgvXihjYWxsc0FyZ3x5aWVsZHMpLykgJiYgIW1ldGhvZC5tYXRjaCgvQXN5bmMvKSkge1xuICAgICAgICAgICAgICAgIHByb3RvW21ldGhvZCArIFwiQXN5bmNcIl0gPSBjcmVhdGVBc3luY1ZlcnNpb24obWV0aG9kKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLmJlaGF2aW9yID0gcHJvdG87XG4gICAgICAgIHJldHVybiBwcm90bztcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9leHRlbmRcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gICogQGRlcGVuZCBtYXRjaC5qc1xuICAqIEBkZXBlbmQgZm9ybWF0LmpzXG4gICovXG4vKipcbiAgKiBTcHkgY2FsbHNcbiAgKlxuICAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICAqIEBhdXRob3IgTWF4aW1pbGlhbiBBbnRvbmkgKG1haWxAbWF4YW50b25pLmRlKVxuICAqIEBsaWNlbnNlIEJTRFxuICAqXG4gICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gICogQ29weXJpZ2h0IChjKSAyMDEzIE1heGltaWxpYW4gQW50b25pXG4gICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIHRocm93WWllbGRFcnJvcihwcm94eSwgdGV4dCwgYXJncykge1xuICAgICAgICAgICAgdmFyIG1zZyA9IHNpbm9uLmZ1bmN0aW9uTmFtZShwcm94eSkgKyB0ZXh0O1xuICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgbXNnICs9IFwiIFJlY2VpdmVkIFtcIiArIHNsaWNlLmNhbGwoYXJncykuam9pbihcIiwgXCIpICsgXCJdXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYWxsUHJvdG8gPSB7XG4gICAgICAgICAgICBjYWxsZWRPbjogZnVuY3Rpb24gY2FsbGVkT24odGhpc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpbm9uLm1hdGNoICYmIHNpbm9uLm1hdGNoLmlzTWF0Y2hlcih0aGlzVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzVmFsdWUudGVzdCh0aGlzLnRoaXNWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnRoaXNWYWx1ZSA9PT0gdGhpc1ZhbHVlO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbGVkV2l0aDogZnVuY3Rpb24gY2FsbGVkV2l0aCgpIHtcbiAgICAgICAgICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgaWYgKGwgPiB0aGlzLmFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzaW5vbi5kZWVwRXF1YWwoYXJndW1lbnRzW2ldLCB0aGlzLmFyZ3NbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxlZFdpdGhNYXRjaDogZnVuY3Rpb24gY2FsbGVkV2l0aE1hdGNoKCkge1xuICAgICAgICAgICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZiAobCA+IHRoaXMuYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYWN0dWFsID0gdGhpcy5hcmdzW2ldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXhwZWN0YXRpb24gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2lub24ubWF0Y2ggfHwgIXNpbm9uLm1hdGNoKGV4cGVjdGF0aW9uKS50ZXN0KGFjdHVhbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxlZFdpdGhFeGFjdGx5OiBmdW5jdGlvbiBjYWxsZWRXaXRoRXhhY3RseSgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJndW1lbnRzLmxlbmd0aCA9PT0gdGhpcy5hcmdzLmxlbmd0aCAmJlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxlZFdpdGguYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG5vdENhbGxlZFdpdGg6IGZ1bmN0aW9uIG5vdENhbGxlZFdpdGgoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICF0aGlzLmNhbGxlZFdpdGguYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG5vdENhbGxlZFdpdGhNYXRjaDogZnVuY3Rpb24gbm90Q2FsbGVkV2l0aE1hdGNoKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhdGhpcy5jYWxsZWRXaXRoTWF0Y2guYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJldHVybmVkOiBmdW5jdGlvbiByZXR1cm5lZCh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzaW5vbi5kZWVwRXF1YWwodmFsdWUsIHRoaXMucmV0dXJuVmFsdWUpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdGhyZXc6IGZ1bmN0aW9uIHRocmV3KGVycm9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhdGhpcy5leGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEhdGhpcy5leGNlcHRpb247XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhjZXB0aW9uID09PSBlcnJvciB8fCB0aGlzLmV4Y2VwdGlvbi5uYW1lID09PSBlcnJvcjtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxlZFdpdGhOZXc6IGZ1bmN0aW9uIGNhbGxlZFdpdGhOZXcoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJveHkucHJvdG90eXBlICYmIHRoaXMudGhpc1ZhbHVlIGluc3RhbmNlb2YgdGhpcy5wcm94eTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxlZEJlZm9yZTogZnVuY3Rpb24gKG90aGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FsbElkIDwgb3RoZXIuY2FsbElkO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbGVkQWZ0ZXI6IGZ1bmN0aW9uIChvdGhlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhbGxJZCA+IG90aGVyLmNhbGxJZDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNhbGxBcmc6IGZ1bmN0aW9uIChwb3MpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFyZ3NbcG9zXSgpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbEFyZ09uOiBmdW5jdGlvbiAocG9zLCB0aGlzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFyZ3NbcG9zXS5hcHBseSh0aGlzVmFsdWUpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbEFyZ1dpdGg6IGZ1bmN0aW9uIChwb3MpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxBcmdPbldpdGguYXBwbHkodGhpcywgW3BvcywgbnVsbF0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2FsbEFyZ09uV2l0aDogZnVuY3Rpb24gKHBvcywgdGhpc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICAgICAgICAgICAgdGhpcy5hcmdzW3Bvc10uYXBwbHkodGhpc1ZhbHVlLCBhcmdzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIFwieWllbGRcIjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMueWllbGRPbi5hcHBseSh0aGlzLCBbbnVsbF0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSkpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgeWllbGRPbjogZnVuY3Rpb24gKHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gdGhpcy5hcmdzO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJncy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhcmdzW2ldID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3NbaV0uYXBwbHkodGhpc1ZhbHVlLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93WWllbGRFcnJvcih0aGlzLnByb3h5LCBcIiBjYW5ub3QgeWllbGQgc2luY2Ugbm8gY2FsbGJhY2sgd2FzIHBhc3NlZC5cIiwgYXJncyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB5aWVsZFRvOiBmdW5jdGlvbiAocHJvcCkge1xuICAgICAgICAgICAgICAgIHRoaXMueWllbGRUb09uLmFwcGx5KHRoaXMsIFtwcm9wLCBudWxsXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB5aWVsZFRvT246IGZ1bmN0aW9uIChwcm9wLCB0aGlzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IHRoaXMuYXJncztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGFyZ3MubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcmdzW2ldICYmIHR5cGVvZiBhcmdzW2ldW3Byb3BdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3NbaV1bcHJvcF0uYXBwbHkodGhpc1ZhbHVlLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93WWllbGRFcnJvcih0aGlzLnByb3h5LCBcIiBjYW5ub3QgeWllbGQgdG8gJ1wiICsgcHJvcCArXG4gICAgICAgICAgICAgICAgICAgIFwiJyBzaW5jZSBubyBjYWxsYmFjayB3YXMgcGFzc2VkLlwiLCBhcmdzKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGdldFN0YWNrRnJhbWVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gT21pdCB0aGUgZXJyb3IgbWVzc2FnZSBhbmQgdGhlIHR3byB0b3Agc3RhY2sgZnJhbWVzIGluIHNpbm9uIGl0c2VsZjpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zdGFjayAmJiB0aGlzLnN0YWNrLnNwbGl0KFwiXFxuXCIpLnNsaWNlKDMpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdG9TdHJpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FsbFN0ciA9IHRoaXMucHJveHkudG9TdHJpbmcoKSArIFwiKFwiO1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuYXJncy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5wdXNoKHNpbm9uLmZvcm1hdCh0aGlzLmFyZ3NbaV0pKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjYWxsU3RyID0gY2FsbFN0ciArIGFyZ3Muam9pbihcIiwgXCIpICsgXCIpXCI7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMucmV0dXJuVmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbFN0ciArPSBcIiA9PiBcIiArIHNpbm9uLmZvcm1hdCh0aGlzLnJldHVyblZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5leGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbFN0ciArPSBcIiAhXCIgKyB0aGlzLmV4Y2VwdGlvbi5uYW1lO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmV4Y2VwdGlvbi5tZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsU3RyICs9IFwiKFwiICsgdGhpcy5leGNlcHRpb24ubWVzc2FnZSArIFwiKVwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0YWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxTdHIgKz0gdGhpcy5nZXRTdGFja0ZyYW1lcygpWzBdLnJlcGxhY2UoL15cXHMqKD86YXRcXHMrfEApPy8sIFwiIGF0IFwiKTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsU3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNhbGxQcm90by5pbnZva2VDYWxsYmFjayA9IGNhbGxQcm90by55aWVsZDtcblxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVTcHlDYWxsKHNweSwgdGhpc1ZhbHVlLCBhcmdzLCByZXR1cm5WYWx1ZSwgZXhjZXB0aW9uLCBpZCwgc3RhY2spIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaWQgIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2FsbCBpZCBpcyBub3QgYSBudW1iZXJcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcHJveHlDYWxsID0gc2lub24uY3JlYXRlKGNhbGxQcm90byk7XG4gICAgICAgICAgICBwcm94eUNhbGwucHJveHkgPSBzcHk7XG4gICAgICAgICAgICBwcm94eUNhbGwudGhpc1ZhbHVlID0gdGhpc1ZhbHVlO1xuICAgICAgICAgICAgcHJveHlDYWxsLmFyZ3MgPSBhcmdzO1xuICAgICAgICAgICAgcHJveHlDYWxsLnJldHVyblZhbHVlID0gcmV0dXJuVmFsdWU7XG4gICAgICAgICAgICBwcm94eUNhbGwuZXhjZXB0aW9uID0gZXhjZXB0aW9uO1xuICAgICAgICAgICAgcHJveHlDYWxsLmNhbGxJZCA9IGlkO1xuICAgICAgICAgICAgcHJveHlDYWxsLnN0YWNrID0gc3RhY2s7XG5cbiAgICAgICAgICAgIHJldHVybiBwcm94eUNhbGw7XG4gICAgICAgIH1cbiAgICAgICAgY3JlYXRlU3B5Q2FsbC50b1N0cmluZyA9IGNhbGxQcm90by50b1N0cmluZzsgLy8gdXNlZCBieSBtb2Nrc1xuXG4gICAgICAgIHNpbm9uLnNweUNhbGwgPSBjcmVhdGVTcHlDYWxsO1xuICAgICAgICByZXR1cm4gY3JlYXRlU3B5Q2FsbDtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9tYXRjaFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZm9ybWF0XCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIHNweS5qc1xuICogQGRlcGVuZCBzdHViLmpzXG4gKiBAZGVwZW5kIG1vY2suanNcbiAqL1xuLyoqXG4gKiBDb2xsZWN0aW9ucyBvZiBzdHVicywgc3BpZXMgYW5kIG1vY2tzLlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBwdXNoID0gW10ucHVzaDtcbiAgICB2YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4gICAgZnVuY3Rpb24gZ2V0RmFrZXMoZmFrZUNvbGxlY3Rpb24pIHtcbiAgICAgICAgaWYgKCFmYWtlQ29sbGVjdGlvbi5mYWtlcykge1xuICAgICAgICAgICAgZmFrZUNvbGxlY3Rpb24uZmFrZXMgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWtlQ29sbGVjdGlvbi5mYWtlcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlYWNoKGZha2VDb2xsZWN0aW9uLCBtZXRob2QpIHtcbiAgICAgICAgdmFyIGZha2VzID0gZ2V0RmFrZXMoZmFrZUNvbGxlY3Rpb24pO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZmFrZXMubGVuZ3RoOyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZha2VzW2ldW21ldGhvZF0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGZha2VzW2ldW21ldGhvZF0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbXBhY3QoZmFrZUNvbGxlY3Rpb24pIHtcbiAgICAgICAgdmFyIGZha2VzID0gZ2V0RmFrZXMoZmFrZUNvbGxlY3Rpb24pO1xuICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgIHdoaWxlIChpIDwgZmFrZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBmYWtlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0ge1xuICAgICAgICAgICAgdmVyaWZ5OiBmdW5jdGlvbiByZXNvbHZlKCkge1xuICAgICAgICAgICAgICAgIGVhY2godGhpcywgXCJ2ZXJpZnlcIik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiByZXN0b3JlKCkge1xuICAgICAgICAgICAgICAgIGVhY2godGhpcywgXCJyZXN0b3JlXCIpO1xuICAgICAgICAgICAgICAgIGNvbXBhY3QodGhpcyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXNldDogZnVuY3Rpb24gcmVzdG9yZSgpIHtcbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMsIFwicmVzZXRcIik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB2ZXJpZnlBbmRSZXN0b3JlOiBmdW5jdGlvbiB2ZXJpZnlBbmRSZXN0b3JlKCkge1xuICAgICAgICAgICAgICAgIHZhciBleGNlcHRpb247XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnZlcmlmeSgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhjZXB0aW9uID0gZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlc3RvcmUoKTtcblxuICAgICAgICAgICAgICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGFkZDogZnVuY3Rpb24gYWRkKGZha2UpIHtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwoZ2V0RmFrZXModGhpcyksIGZha2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWtlO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc3B5OiBmdW5jdGlvbiBzcHkoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHNpbm9uLnNweS5hcHBseShzaW5vbiwgYXJndW1lbnRzKSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzdHViOiBmdW5jdGlvbiBzdHViKG9iamVjdCwgcHJvcGVydHksIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvcmlnaW5hbCA9IG9iamVjdFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvcmlnaW5hbCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHN0dWIgbm9uLWV4aXN0ZW50IG93biBwcm9wZXJ0eSBcIiArIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W3Byb3BlcnR5XSA9IHZhbHVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3RvcmU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0W3Byb3BlcnR5XSA9IG9yaWdpbmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcHJvcGVydHkgJiYgISFvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3R1YmJlZE9iaiA9IHNpbm9uLnN0dWIuYXBwbHkoc2lub24sIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBzdHViYmVkT2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHN0dWJiZWRPYmpbcHJvcF0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkKHN0dWJiZWRPYmpbcHJvcF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0dWJiZWRPYmo7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHNpbm9uLnN0dWIuYXBwbHkoc2lub24sIGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbW9jazogZnVuY3Rpb24gbW9jaygpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGQoc2lub24ubW9jay5hcHBseShzaW5vbiwgYXJndW1lbnRzKSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBpbmplY3Q6IGZ1bmN0aW9uIGluamVjdChvYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgY29sID0gdGhpcztcblxuICAgICAgICAgICAgICAgIG9iai5zcHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb2wuc3B5LmFwcGx5KGNvbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgb2JqLnN0dWIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb2wuc3R1Yi5hcHBseShjb2wsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIG9iai5tb2NrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29sLm1vY2suYXBwbHkoY29sLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICAgICAgICByZXR1cm4gY29sbGVjdGlvbjtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9tb2NrXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zcHlcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3N0dWJcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuXG4gICAgICAgIC8vIEFkYXB0ZWQgZnJvbSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9kb2NzL0VDTUFTY3JpcHRfRG9udEVudW1fYXR0cmlidXRlI0pTY3JpcHRfRG9udEVudW1fQnVnXG4gICAgICAgIHZhciBoYXNEb250RW51bUJ1ZyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgb2JqID0ge1xuICAgICAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjBcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjFcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHZhbHVlT2Y6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMlwiO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdG9Mb2NhbGVTdHJpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiM1wiO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcHJvdG90eXBlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjRcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGlzUHJvdG90eXBlT2Y6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiNVwiO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcHJvcGVydHlJc0VudW1lcmFibGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiNlwiO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgaGFzT3duUHJvcGVydHk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiN1wiO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIjhcIjtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHVuaXF1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCI5XCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKG9ialtwcm9wXSgpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LmpvaW4oXCJcIikgIT09IFwiMDEyMzQ1Njc4OVwiO1xuICAgICAgICB9KSgpO1xuXG4gICAgICAgIC8qIFB1YmxpYzogRXh0ZW5kIHRhcmdldCBpbiBwbGFjZSB3aXRoIGFsbCAob3duKSBwcm9wZXJ0aWVzIGZyb20gc291cmNlcyBpbi1vcmRlci4gVGh1cywgbGFzdCBzb3VyY2Ugd2lsbFxuICAgICAgICAgKiAgICAgICAgIG92ZXJyaWRlIHByb3BlcnRpZXMgaW4gcHJldmlvdXMgc291cmNlcy5cbiAgICAgICAgICpcbiAgICAgICAgICogdGFyZ2V0IC0gVGhlIE9iamVjdCB0byBleHRlbmRcbiAgICAgICAgICogc291cmNlcyAtIE9iamVjdHMgdG8gY29weSBwcm9wZXJ0aWVzIGZyb20uXG4gICAgICAgICAqXG4gICAgICAgICAqIFJldHVybnMgdGhlIGV4dGVuZGVkIHRhcmdldFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCAvKiwgc291cmNlcyAqLykge1xuICAgICAgICAgICAgdmFyIHNvdXJjZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgdmFyIHNvdXJjZSwgaSwgcHJvcDtcblxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBzb3VyY2UgPSBzb3VyY2VzW2ldO1xuXG4gICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBNYWtlIHN1cmUgd2UgY29weSAob3duKSB0b1N0cmluZyBtZXRob2QgZXZlbiB3aGVuIGluIEpTY3JpcHQgd2l0aCBEb250RW51bSBidWdcbiAgICAgICAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vZG9jcy9FQ01BU2NyaXB0X0RvbnRFbnVtX2F0dHJpYnV0ZSNKU2NyaXB0X0RvbnRFbnVtX0J1Z1xuICAgICAgICAgICAgICAgIGlmIChoYXNEb250RW51bUJ1ZyAmJiBzb3VyY2UuaGFzT3duUHJvcGVydHkoXCJ0b1N0cmluZ1wiKSAmJiBzb3VyY2UudG9TdHJpbmcgIT09IHRhcmdldC50b1N0cmluZykge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQudG9TdHJpbmcgPSBzb3VyY2UudG9TdHJpbmc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgc2lub24uZXh0ZW5kID0gZXh0ZW5kO1xuICAgICAgICByZXR1cm4gc2lub24uZXh0ZW5kO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqL1xuLyoqXG4gKiBGb3JtYXQgZnVuY3Rpb25zXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxNCBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCwgZm9ybWF0aW8pIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgZnVuY3Rpb24gdmFsdWVGb3JtYXR0ZXIodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBcIlwiICsgdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRGb3JtYXRpb0Zvcm1hdHRlcigpIHtcbiAgICAgICAgICAgIHZhciBmb3JtYXR0ZXIgPSBmb3JtYXRpby5jb25maWd1cmUoe1xuICAgICAgICAgICAgICAgICAgICBxdW90ZVN0cmluZ3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBsaW1pdENoaWxkcmVuQ291bnQ6IDI1MFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBmb3JtYXQoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcm1hdHRlci5hc2NpaS5hcHBseShmb3JtYXR0ZXIsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmb3JtYXQ7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXROb2RlRm9ybWF0dGVyKCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB2YXIgdXRpbCA9IHJlcXVpcmUoXCJ1dGlsXCIpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8qIE5vZGUsIGJ1dCBubyB1dGlsIG1vZHVsZSAtIHdvdWxkIGJlIHZlcnkgb2xkLCBidXQgYmV0dGVyIHNhZmUgdGhhbiBzb3JyeSAqL1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBmb3JtYXQodikge1xuICAgICAgICAgICAgICAgIHZhciBpc09iamVjdFdpdGhOYXRpdmVUb1N0cmluZyA9IHR5cGVvZiB2ID09PSBcIm9iamVjdFwiICYmIHYudG9TdHJpbmcgPT09IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzT2JqZWN0V2l0aE5hdGl2ZVRvU3RyaW5nID8gdXRpbC5pbnNwZWN0KHYpIDogdjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHV0aWwgPyBmb3JtYXQgOiB2YWx1ZUZvcm1hdHRlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgICAgIHZhciBmb3JtYXR0ZXI7XG5cbiAgICAgICAgaWYgKGlzTm9kZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3JtYXRpbyA9IHJlcXVpcmUoXCJmb3JtYXRpb1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWVtcHR5XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm9ybWF0aW8pIHtcbiAgICAgICAgICAgIGZvcm1hdHRlciA9IGdldEZvcm1hdGlvRm9ybWF0dGVyKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNOb2RlKSB7XG4gICAgICAgICAgICBmb3JtYXR0ZXIgPSBnZXROb2RlRm9ybWF0dGVyKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3JtYXR0ZXIgPSB2YWx1ZUZvcm1hdHRlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLmZvcm1hdCA9IGZvcm1hdHRlcjtcbiAgICAgICAgcmV0dXJuIHNpbm9uLmZvcm1hdDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi91dGlsL2NvcmVcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24sIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICB0eXBlb2YgZm9ybWF0aW8gPT09IFwib2JqZWN0XCIgJiYgZm9ybWF0aW8gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKi9cbi8qKlxuICogTG9ncyBlcnJvcnNcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDE0IENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvLyBjYWNoZSBhIHJlZmVyZW5jZSB0byBzZXRUaW1lb3V0LCBzbyB0aGF0IG91ciByZWZlcmVuY2Ugd29uJ3QgYmUgc3R1YmJlZCBvdXRcbiAgICAvLyB3aGVuIHVzaW5nIGZha2UgdGltZXJzIGFuZCBlcnJvcnMgd2lsbCBzdGlsbCBnZXQgbG9nZ2VkXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2Nqb2hhbnNlbi9TaW5vbi5KUy9pc3N1ZXMvMzgxXG4gICAgdmFyIHJlYWxTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcblxuICAgICAgICBmdW5jdGlvbiBsb2coKSB7fVxuXG4gICAgICAgIGZ1bmN0aW9uIGxvZ0Vycm9yKGxhYmVsLCBlcnIpIHtcbiAgICAgICAgICAgIHZhciBtc2cgPSBsYWJlbCArIFwiIHRocmV3IGV4Y2VwdGlvbjogXCI7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHRocm93TG9nZ2VkRXJyb3IoKSB7XG4gICAgICAgICAgICAgICAgZXJyLm1lc3NhZ2UgPSBtc2cgKyBlcnIubWVzc2FnZTtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNpbm9uLmxvZyhtc2cgKyBcIltcIiArIGVyci5uYW1lICsgXCJdIFwiICsgZXJyLm1lc3NhZ2UpO1xuXG4gICAgICAgICAgICBpZiAoZXJyLnN0YWNrKSB7XG4gICAgICAgICAgICAgICAgc2lub24ubG9nKGVyci5zdGFjayk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsb2dFcnJvci51c2VJbW1lZGlhdGVFeGNlcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdGhyb3dMb2dnZWRFcnJvcigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvci5zZXRUaW1lb3V0KHRocm93TG9nZ2VkRXJyb3IsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2hlbiBzZXQgdG8gdHJ1ZSwgYW55IGVycm9ycyBsb2dnZWQgd2lsbCBiZSB0aHJvd24gaW1tZWRpYXRlbHk7XG4gICAgICAgIC8vIElmIHNldCB0byBmYWxzZSwgdGhlIGVycm9ycyB3aWxsIGJlIHRocm93biBpbiBzZXBhcmF0ZSBleGVjdXRpb24gZnJhbWUuXG4gICAgICAgIGxvZ0Vycm9yLnVzZUltbWVkaWF0ZUV4Y2VwdGlvbnMgPSBmYWxzZTtcblxuICAgICAgICAvLyB3cmFwIHJlYWxTZXRUaW1lb3V0IHdpdGggc29tZXRoaW5nIHdlIGNhbiBzdHViIGluIHRlc3RzXG4gICAgICAgIGxvZ0Vycm9yLnNldFRpbWVvdXQgPSBmdW5jdGlvbiAoZnVuYywgdGltZW91dCkge1xuICAgICAgICAgICAgcmVhbFNldFRpbWVvdXQoZnVuYywgdGltZW91dCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGV4cG9ydHMgPSB7fTtcbiAgICAgICAgZXhwb3J0cy5sb2cgPSBzaW5vbi5sb2cgPSBsb2c7XG4gICAgICAgIGV4cG9ydHMubG9nRXJyb3IgPSBzaW5vbi5sb2dFcnJvciA9IGxvZ0Vycm9yO1xuXG4gICAgICAgIHJldHVybiBleHBvcnRzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqIEBkZXBlbmQgdHlwZU9mLmpzXG4gKi9cbi8qanNsaW50IGVxZXFlcTogZmFsc2UsIG9uZXZhcjogZmFsc2UsIHBsdXNwbHVzOiBmYWxzZSovXG4vKmdsb2JhbCBtb2R1bGUsIHJlcXVpcmUsIHNpbm9uKi9cbi8qKlxuICogTWF0Y2ggZnVuY3Rpb25zXG4gKlxuICogQGF1dGhvciBNYXhpbWlsaWFuIEFudG9uaSAobWFpbEBtYXhhbnRvbmkuZGUpXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTIgTWF4aW1pbGlhbiBBbnRvbmlcbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBmdW5jdGlvbiBhc3NlcnRUeXBlKHZhbHVlLCB0eXBlLCBuYW1lKSB7XG4gICAgICAgICAgICB2YXIgYWN0dWFsID0gc2lub24udHlwZU9mKHZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhY3R1YWwgIT09IHR5cGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRXhwZWN0ZWQgdHlwZSBvZiBcIiArIG5hbWUgKyBcIiB0byBiZSBcIiArXG4gICAgICAgICAgICAgICAgICAgIHR5cGUgKyBcIiwgYnV0IHdhcyBcIiArIGFjdHVhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbWF0Y2hlciA9IHtcbiAgICAgICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBpc01hdGNoZXIob2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hlci5pc1Byb3RvdHlwZU9mKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBtYXRjaE9iamVjdChleHBlY3RhdGlvbiwgYWN0dWFsKSB7XG4gICAgICAgICAgICBpZiAoYWN0dWFsID09PSBudWxsIHx8IGFjdHVhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV4cGVjdGF0aW9uLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGV4cCA9IGV4cGVjdGF0aW9uW2tleV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBhY3QgPSBhY3R1YWxba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTWF0Y2hlcihleHApKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWV4cC50ZXN0KGFjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2lub24udHlwZU9mKGV4cCkgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWF0Y2hPYmplY3QoZXhwLCBhY3QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFzaW5vbi5kZWVwRXF1YWwoZXhwLCBhY3QpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIG1hdGNoKGV4cGVjdGF0aW9uLCBtZXNzYWdlKSB7XG4gICAgICAgICAgICB2YXIgbSA9IHNpbm9uLmNyZWF0ZShtYXRjaGVyKTtcbiAgICAgICAgICAgIHZhciB0eXBlID0gc2lub24udHlwZU9mKGV4cGVjdGF0aW9uKTtcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0YXRpb24udGVzdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIG0udGVzdCA9IGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3RhdGlvbi50ZXN0KGFjdHVhbCkgPT09IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIG0ubWVzc2FnZSA9IFwibWF0Y2goXCIgKyBzaW5vbi5mdW5jdGlvbk5hbWUoZXhwZWN0YXRpb24udGVzdCkgKyBcIilcIjtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBzdHIgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gZXhwZWN0YXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4cGVjdGF0aW9uLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0ci5wdXNoKGtleSArIFwiOiBcIiArIGV4cGVjdGF0aW9uW2tleV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG0udGVzdCA9IGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoT2JqZWN0KGV4cGVjdGF0aW9uLCBhY3R1YWwpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgbS5tZXNzYWdlID0gXCJtYXRjaChcIiArIHN0ci5qb2luKFwiLCBcIikgKyBcIilcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgICAgICAgICBtLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIG5lZWQgdHlwZSBjb2VyY2lvbiBoZXJlXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3RhdGlvbiA9PSBhY3R1YWw7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgICAgICAgICBtLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYWN0dWFsICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjdHVhbC5pbmRleE9mKGV4cGVjdGF0aW9uKSAhPT0gLTE7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBtLm1lc3NhZ2UgPSBcIm1hdGNoKFxcXCJcIiArIGV4cGVjdGF0aW9uICsgXCJcXFwiKVwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcInJlZ2V4cFwiOlxuICAgICAgICAgICAgICAgIG0udGVzdCA9IGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhY3R1YWwgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0YXRpb24udGVzdChhY3R1YWwpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgICAgICBtLnRlc3QgPSBleHBlY3RhdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAobWVzc2FnZSkge1xuICAgICAgICAgICAgICAgICAgICBtLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG0ubWVzc2FnZSA9IFwibWF0Y2goXCIgKyBzaW5vbi5mdW5jdGlvbk5hbWUoZXhwZWN0YXRpb24pICsgXCIpXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBtLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzaW5vbi5kZWVwRXF1YWwoZXhwZWN0YXRpb24sIGFjdHVhbCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbS5tZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgbS5tZXNzYWdlID0gXCJtYXRjaChcIiArIGV4cGVjdGF0aW9uICsgXCIpXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdGNoZXIub3IgPSBmdW5jdGlvbiAobTIpIHtcbiAgICAgICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJNYXRjaGVyIGV4cGVjdGVkXCIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghaXNNYXRjaGVyKG0yKSkge1xuICAgICAgICAgICAgICAgIG0yID0gbWF0Y2gobTIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG0xID0gdGhpcztcbiAgICAgICAgICAgIHZhciBvciA9IHNpbm9uLmNyZWF0ZShtYXRjaGVyKTtcbiAgICAgICAgICAgIG9yLnRlc3QgPSBmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG0xLnRlc3QoYWN0dWFsKSB8fCBtMi50ZXN0KGFjdHVhbCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgb3IubWVzc2FnZSA9IG0xLm1lc3NhZ2UgKyBcIi5vcihcIiArIG0yLm1lc3NhZ2UgKyBcIilcIjtcbiAgICAgICAgICAgIHJldHVybiBvcjtcbiAgICAgICAgfTtcblxuICAgICAgICBtYXRjaGVyLmFuZCA9IGZ1bmN0aW9uIChtMikge1xuICAgICAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk1hdGNoZXIgZXhwZWN0ZWRcIik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFpc01hdGNoZXIobTIpKSB7XG4gICAgICAgICAgICAgICAgbTIgPSBtYXRjaChtMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbTEgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIGFuZCA9IHNpbm9uLmNyZWF0ZShtYXRjaGVyKTtcbiAgICAgICAgICAgIGFuZC50ZXN0ID0gZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtMS50ZXN0KGFjdHVhbCkgJiYgbTIudGVzdChhY3R1YWwpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGFuZC5tZXNzYWdlID0gbTEubWVzc2FnZSArIFwiLmFuZChcIiArIG0yLm1lc3NhZ2UgKyBcIilcIjtcbiAgICAgICAgICAgIHJldHVybiBhbmQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgbWF0Y2guaXNNYXRjaGVyID0gaXNNYXRjaGVyO1xuXG4gICAgICAgIG1hdGNoLmFueSA9IG1hdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LCBcImFueVwiKTtcblxuICAgICAgICBtYXRjaC5kZWZpbmVkID0gbWF0Y2goZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgcmV0dXJuIGFjdHVhbCAhPT0gbnVsbCAmJiBhY3R1YWwgIT09IHVuZGVmaW5lZDtcbiAgICAgICAgfSwgXCJkZWZpbmVkXCIpO1xuXG4gICAgICAgIG1hdGNoLnRydXRoeSA9IG1hdGNoKGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgIHJldHVybiAhIWFjdHVhbDtcbiAgICAgICAgfSwgXCJ0cnV0aHlcIik7XG5cbiAgICAgICAgbWF0Y2guZmFsc3kgPSBtYXRjaChmdW5jdGlvbiAoYWN0dWFsKSB7XG4gICAgICAgICAgICByZXR1cm4gIWFjdHVhbDtcbiAgICAgICAgfSwgXCJmYWxzeVwiKTtcblxuICAgICAgICBtYXRjaC5zYW1lID0gZnVuY3Rpb24gKGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2goZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3RhdGlvbiA9PT0gYWN0dWFsO1xuICAgICAgICAgICAgfSwgXCJzYW1lKFwiICsgZXhwZWN0YXRpb24gKyBcIilcIik7XG4gICAgICAgIH07XG5cbiAgICAgICAgbWF0Y2gudHlwZU9mID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIGFzc2VydFR5cGUodHlwZSwgXCJzdHJpbmdcIiwgXCJ0eXBlXCIpO1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoKGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2lub24udHlwZU9mKGFjdHVhbCkgPT09IHR5cGU7XG4gICAgICAgICAgICB9LCBcInR5cGVPZihcXFwiXCIgKyB0eXBlICsgXCJcXFwiKVwiKTtcbiAgICAgICAgfTtcblxuICAgICAgICBtYXRjaC5pbnN0YW5jZU9mID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIGFzc2VydFR5cGUodHlwZSwgXCJmdW5jdGlvblwiLCBcInR5cGVcIik7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2goZnVuY3Rpb24gKGFjdHVhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhY3R1YWwgaW5zdGFuY2VvZiB0eXBlO1xuICAgICAgICAgICAgfSwgXCJpbnN0YW5jZU9mKFwiICsgc2lub24uZnVuY3Rpb25OYW1lKHR5cGUpICsgXCIpXCIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNyZWF0ZVByb3BlcnR5TWF0Y2hlcihwcm9wZXJ0eVRlc3QsIG1lc3NhZ2VQcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAocHJvcGVydHksIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgYXNzZXJ0VHlwZShwcm9wZXJ0eSwgXCJzdHJpbmdcIiwgXCJwcm9wZXJ0eVwiKTtcbiAgICAgICAgICAgICAgICB2YXIgb25seVByb3BlcnR5ID0gYXJndW1lbnRzLmxlbmd0aCA9PT0gMTtcbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9IG1lc3NhZ2VQcmVmaXggKyBcIihcXFwiXCIgKyBwcm9wZXJ0eSArIFwiXFxcIlwiO1xuICAgICAgICAgICAgICAgIGlmICghb25seVByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgKz0gXCIsIFwiICsgdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1lc3NhZ2UgKz0gXCIpXCI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoKGZ1bmN0aW9uIChhY3R1YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjdHVhbCA9PT0gdW5kZWZpbmVkIHx8IGFjdHVhbCA9PT0gbnVsbCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFwcm9wZXJ0eVRlc3QoYWN0dWFsLCBwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb25seVByb3BlcnR5IHx8IHNpbm9uLmRlZXBFcXVhbCh2YWx1ZSwgYWN0dWFsW3Byb3BlcnR5XSk7XG4gICAgICAgICAgICAgICAgfSwgbWVzc2FnZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0Y2guaGFzID0gY3JlYXRlUHJvcGVydHlNYXRjaGVyKGZ1bmN0aW9uIChhY3R1YWwsIHByb3BlcnR5KSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFjdHVhbCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0eSBpbiBhY3R1YWw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYWN0dWFsW3Byb3BlcnR5XSAhPT0gdW5kZWZpbmVkO1xuICAgICAgICB9LCBcImhhc1wiKTtcblxuICAgICAgICBtYXRjaC5oYXNPd24gPSBjcmVhdGVQcm9wZXJ0eU1hdGNoZXIoZnVuY3Rpb24gKGFjdHVhbCwgcHJvcGVydHkpIHtcbiAgICAgICAgICAgIHJldHVybiBhY3R1YWwuaGFzT3duUHJvcGVydHkocHJvcGVydHkpO1xuICAgICAgICB9LCBcImhhc093blwiKTtcblxuICAgICAgICBtYXRjaC5ib29sID0gbWF0Y2gudHlwZU9mKFwiYm9vbGVhblwiKTtcbiAgICAgICAgbWF0Y2gubnVtYmVyID0gbWF0Y2gudHlwZU9mKFwibnVtYmVyXCIpO1xuICAgICAgICBtYXRjaC5zdHJpbmcgPSBtYXRjaC50eXBlT2YoXCJzdHJpbmdcIik7XG4gICAgICAgIG1hdGNoLm9iamVjdCA9IG1hdGNoLnR5cGVPZihcIm9iamVjdFwiKTtcbiAgICAgICAgbWF0Y2guZnVuYyA9IG1hdGNoLnR5cGVPZihcImZ1bmN0aW9uXCIpO1xuICAgICAgICBtYXRjaC5hcnJheSA9IG1hdGNoLnR5cGVPZihcImFycmF5XCIpO1xuICAgICAgICBtYXRjaC5yZWdleHAgPSBtYXRjaC50eXBlT2YoXCJyZWdleHBcIik7XG4gICAgICAgIG1hdGNoLmRhdGUgPSBtYXRjaC50eXBlT2YoXCJkYXRlXCIpO1xuXG4gICAgICAgIHNpbm9uLm1hdGNoID0gbWF0Y2g7XG4gICAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi90eXBlT2ZcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShzaW5vbik7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB0aW1lc19pbl93b3Jkcy5qc1xuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqIEBkZXBlbmQgY2FsbC5qc1xuICogQGRlcGVuZCBleHRlbmQuanNcbiAqIEBkZXBlbmQgbWF0Y2guanNcbiAqIEBkZXBlbmQgc3B5LmpzXG4gKiBAZGVwZW5kIHN0dWIuanNcbiAqIEBkZXBlbmQgZm9ybWF0LmpzXG4gKi9cbi8qKlxuICogTW9jayBmdW5jdGlvbnMuXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICB2YXIgcHVzaCA9IFtdLnB1c2g7XG4gICAgICAgIHZhciBtYXRjaCA9IHNpbm9uLm1hdGNoO1xuXG4gICAgICAgIGZ1bmN0aW9uIG1vY2sob2JqZWN0KSB7XG4gICAgICAgICAgICAvLyBpZiAodHlwZW9mIGNvbnNvbGUgIT09IHVuZGVmaW5lZCAmJiBjb25zb2xlLndhcm4pIHtcbiAgICAgICAgICAgIC8vICAgICBjb25zb2xlLndhcm4oXCJtb2NrIHdpbGwgYmUgcmVtb3ZlZCBmcm9tIFNpbm9uLkpTIHYyLjBcIik7XG4gICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgIGlmICghb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLmV4cGVjdGF0aW9uLmNyZWF0ZShcIkFub255bW91cyBtb2NrXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9jay5jcmVhdGUob2JqZWN0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGVhY2goY29sbGVjdGlvbiwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjb2xsZWN0aW9uLmxlbmd0aDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGNvbGxlY3Rpb25baV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYXJyYXlFcXVhbHMoYXJyMSwgYXJyMiwgY29tcGFyZUxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGNvbXBhcmVMZW5ndGggJiYgKGFycjEubGVuZ3RoICE9PSBhcnIyLmxlbmd0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJyMS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNpbm9uLmRlZXBFcXVhbChhcnIxW2ldLCBhcnIyW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBzaW5vbi5leHRlbmQobW9jaywge1xuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiBjcmVhdGUob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFvYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm9iamVjdCBpcyBudWxsXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBtb2NrT2JqZWN0ID0gc2lub24uZXh0ZW5kKHt9LCBtb2NrKTtcbiAgICAgICAgICAgICAgICBtb2NrT2JqZWN0Lm9iamVjdCA9IG9iamVjdDtcbiAgICAgICAgICAgICAgICBkZWxldGUgbW9ja09iamVjdC5jcmVhdGU7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbW9ja09iamVjdDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGV4cGVjdHM6IGZ1bmN0aW9uIGV4cGVjdHMobWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXRob2QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm1ldGhvZCBpcyBmYWxzeVwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZXhwZWN0YXRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZXhwZWN0YXRpb25zID0ge307XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJveGllcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5leHBlY3RhdGlvbnNbbWV0aG9kXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4cGVjdGF0aW9uc1ttZXRob2RdID0gW107XG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2NrT2JqZWN0ID0gdGhpcztcblxuICAgICAgICAgICAgICAgICAgICBzaW5vbi53cmFwTWV0aG9kKHRoaXMub2JqZWN0LCBtZXRob2QsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtb2NrT2JqZWN0Lmludm9rZU1ldGhvZChtZXRob2QsIHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLnByb3hpZXMsIG1ldGhvZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGF0aW9uID0gc2lub24uZXhwZWN0YXRpb24uY3JlYXRlKG1ldGhvZCk7XG4gICAgICAgICAgICAgICAgcHVzaC5jYWxsKHRoaXMuZXhwZWN0YXRpb25zW21ldGhvZF0sIGV4cGVjdGF0aW9uKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBleHBlY3RhdGlvbjtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlc3RvcmU6IGZ1bmN0aW9uIHJlc3RvcmUoKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMub2JqZWN0O1xuXG4gICAgICAgICAgICAgICAgZWFjaCh0aGlzLnByb3hpZXMsIGZ1bmN0aW9uIChwcm94eSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9iamVjdFtwcm94eV0ucmVzdG9yZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RbcHJveHldLnJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmVyaWZ5OiBmdW5jdGlvbiB2ZXJpZnkoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGF0aW9ucyA9IHRoaXMuZXhwZWN0YXRpb25zIHx8IHt9O1xuICAgICAgICAgICAgICAgIHZhciBtZXNzYWdlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBtZXQgPSBbXTtcblxuICAgICAgICAgICAgICAgIGVhY2godGhpcy5wcm94aWVzLCBmdW5jdGlvbiAocHJveHkpIHtcbiAgICAgICAgICAgICAgICAgICAgZWFjaChleHBlY3RhdGlvbnNbcHJveHldLCBmdW5jdGlvbiAoZXhwZWN0YXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXhwZWN0YXRpb24ubWV0KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwobWVzc2FnZXMsIGV4cGVjdGF0aW9uLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwobWV0LCBleHBlY3RhdGlvbi50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlc3RvcmUoKTtcblxuICAgICAgICAgICAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLmZhaWwobWVzc2FnZXMuY29uY2F0KG1ldCkuam9pbihcIlxcblwiKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtZXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5wYXNzKG1lc3NhZ2VzLmNvbmNhdChtZXQpLmpvaW4oXCJcXG5cIikpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaW52b2tlTWV0aG9kOiBmdW5jdGlvbiBpbnZva2VNZXRob2QobWV0aG9kLCB0aGlzVmFsdWUsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXhwZWN0YXRpb25zID0gdGhpcy5leHBlY3RhdGlvbnMgJiYgdGhpcy5leHBlY3RhdGlvbnNbbWV0aG9kXSA/IHRoaXMuZXhwZWN0YXRpb25zW21ldGhvZF0gOiBbXTtcbiAgICAgICAgICAgICAgICB2YXIgZXhwZWN0YXRpb25zV2l0aE1hdGNoaW5nQXJncyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyZW50QXJncyA9IGFyZ3MgfHwgW107XG4gICAgICAgICAgICAgICAgdmFyIGksIGF2YWlsYWJsZTtcblxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBleHBlY3RhdGlvbnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGV4cGVjdGVkQXJncyA9IGV4cGVjdGF0aW9uc1tpXS5leHBlY3RlZEFyZ3VtZW50cyB8fCBbXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFycmF5RXF1YWxzKGV4cGVjdGVkQXJncywgY3VycmVudEFyZ3MsIGV4cGVjdGF0aW9uc1tpXS5leHBlY3RzRXhhY3RBcmdDb3VudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3MucHVzaChleHBlY3RhdGlvbnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3MubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzW2ldLm1ldCgpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RhdGlvbnNXaXRoTWF0Y2hpbmdBcmdzW2ldLmFsbG93c0NhbGwodGhpc1ZhbHVlLCBhcmdzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3NbaV0uYXBwbHkodGhpc1ZhbHVlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBtZXNzYWdlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBleGhhdXN0ZWQgPSAwO1xuXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3MubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4cGVjdGF0aW9uc1dpdGhNYXRjaGluZ0FyZ3NbaV0uYWxsb3dzQ2FsbCh0aGlzVmFsdWUsIGFyZ3MpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGUgPSBhdmFpbGFibGUgfHwgZXhwZWN0YXRpb25zV2l0aE1hdGNoaW5nQXJnc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aGF1c3RlZCArPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGF2YWlsYWJsZSAmJiBleGhhdXN0ZWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGF2YWlsYWJsZS5hcHBseSh0aGlzVmFsdWUsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBleHBlY3RhdGlvbnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKG1lc3NhZ2VzLCBcIiAgICBcIiArIGV4cGVjdGF0aW9uc1tpXS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtZXNzYWdlcy51bnNoaWZ0KFwiVW5leHBlY3RlZCBjYWxsOiBcIiArIHNpbm9uLnNweUNhbGwudG9TdHJpbmcuY2FsbCh7XG4gICAgICAgICAgICAgICAgICAgIHByb3h5OiBtZXRob2QsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IGFyZ3NcbiAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKG1lc3NhZ2VzLmpvaW4oXCJcXG5cIikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgdGltZXMgPSBzaW5vbi50aW1lc0luV29yZHM7XG4gICAgICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuICAgICAgICBmdW5jdGlvbiBjYWxsQ291bnRJbldvcmRzKGNhbGxDb3VudCkge1xuICAgICAgICAgICAgaWYgKGNhbGxDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBcIm5ldmVyIGNhbGxlZFwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gXCJjYWxsZWQgXCIgKyB0aW1lcyhjYWxsQ291bnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZXhwZWN0ZWRDYWxsQ291bnRJbldvcmRzKGV4cGVjdGF0aW9uKSB7XG4gICAgICAgICAgICB2YXIgbWluID0gZXhwZWN0YXRpb24ubWluQ2FsbHM7XG4gICAgICAgICAgICB2YXIgbWF4ID0gZXhwZWN0YXRpb24ubWF4Q2FsbHM7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWluID09PSBcIm51bWJlclwiICYmIHR5cGVvZiBtYXggPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RyID0gdGltZXMobWluKTtcblxuICAgICAgICAgICAgICAgIGlmIChtaW4gIT09IG1heCkge1xuICAgICAgICAgICAgICAgICAgICBzdHIgPSBcImF0IGxlYXN0IFwiICsgc3RyICsgXCIgYW5kIGF0IG1vc3QgXCIgKyB0aW1lcyhtYXgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWluID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiYXQgbGVhc3QgXCIgKyB0aW1lcyhtaW4pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gXCJhdCBtb3N0IFwiICsgdGltZXMobWF4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVkTWluQ2FsbHMoZXhwZWN0YXRpb24pIHtcbiAgICAgICAgICAgIHZhciBoYXNNaW5MaW1pdCA9IHR5cGVvZiBleHBlY3RhdGlvbi5taW5DYWxscyA9PT0gXCJudW1iZXJcIjtcbiAgICAgICAgICAgIHJldHVybiAhaGFzTWluTGltaXQgfHwgZXhwZWN0YXRpb24uY2FsbENvdW50ID49IGV4cGVjdGF0aW9uLm1pbkNhbGxzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcmVjZWl2ZWRNYXhDYWxscyhleHBlY3RhdGlvbikge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBlY3RhdGlvbi5tYXhDYWxscyAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGV4cGVjdGF0aW9uLmNhbGxDb3VudCA9PT0gZXhwZWN0YXRpb24ubWF4Q2FsbHM7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiB2ZXJpZnlNYXRjaGVyKHBvc3NpYmxlTWF0Y2hlciwgYXJnKSB7XG4gICAgICAgICAgICB2YXIgaXNNYXRjaGVyID0gbWF0Y2ggJiYgbWF0Y2guaXNNYXRjaGVyKHBvc3NpYmxlTWF0Y2hlcik7XG5cbiAgICAgICAgICAgIHJldHVybiBpc01hdGNoZXIgJiYgcG9zc2libGVNYXRjaGVyLnRlc3QoYXJnKSB8fCB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgc2lub24uZXhwZWN0YXRpb24gPSB7XG4gICAgICAgICAgICBtaW5DYWxsczogMSxcbiAgICAgICAgICAgIG1heENhbGxzOiAxLFxuXG4gICAgICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uIGNyZWF0ZShtZXRob2ROYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV4cGVjdGF0aW9uID0gc2lub24uZXh0ZW5kKHNpbm9uLnN0dWIuY3JlYXRlKCksIHNpbm9uLmV4cGVjdGF0aW9uKTtcbiAgICAgICAgICAgICAgICBkZWxldGUgZXhwZWN0YXRpb24uY3JlYXRlO1xuICAgICAgICAgICAgICAgIGV4cGVjdGF0aW9uLm1ldGhvZCA9IG1ldGhvZE5hbWU7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwZWN0YXRpb247XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBpbnZva2U6IGZ1bmN0aW9uIGludm9rZShmdW5jLCB0aGlzVmFsdWUsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZlcmlmeUNhbGxBbGxvd2VkKHRoaXNWYWx1ZSwgYXJncyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2lub24uc3B5Lmludm9rZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgYXRMZWFzdDogZnVuY3Rpb24gYXRMZWFzdChudW0pIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG51bSAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiJ1wiICsgbnVtICsgXCInIGlzIG5vdCBudW1iZXJcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmxpbWl0c1NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1heENhbGxzID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saW1pdHNTZXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMubWluQ2FsbHMgPSBudW07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGF0TW9zdDogZnVuY3Rpb24gYXRNb3N0KG51bSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbnVtICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCInXCIgKyBudW0gKyBcIicgaXMgbm90IG51bWJlclwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubGltaXRzU2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWluQ2FsbHMgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpbWl0c1NldCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5tYXhDYWxscyA9IG51bTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbmV2ZXI6IGZ1bmN0aW9uIG5ldmVyKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4YWN0bHkoMCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvbmNlOiBmdW5jdGlvbiBvbmNlKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4YWN0bHkoMSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB0d2ljZTogZnVuY3Rpb24gdHdpY2UoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhhY3RseSgyKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHRocmljZTogZnVuY3Rpb24gdGhyaWNlKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4YWN0bHkoMyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBleGFjdGx5OiBmdW5jdGlvbiBleGFjdGx5KG51bSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbnVtICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCInXCIgKyBudW0gKyBcIicgaXMgbm90IGEgbnVtYmVyXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuYXRMZWFzdChudW0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmF0TW9zdChudW0pO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbWV0OiBmdW5jdGlvbiBtZXQoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICF0aGlzLmZhaWxlZCAmJiByZWNlaXZlZE1pbkNhbGxzKHRoaXMpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmVyaWZ5Q2FsbEFsbG93ZWQ6IGZ1bmN0aW9uIHZlcmlmeUNhbGxBbGxvd2VkKHRoaXNWYWx1ZSwgYXJncykge1xuICAgICAgICAgICAgICAgIGlmIChyZWNlaXZlZE1heENhbGxzKHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24uZmFpbCh0aGlzLm1ldGhvZCArIFwiIGFscmVhZHkgY2FsbGVkIFwiICsgdGltZXModGhpcy5tYXhDYWxscykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChcImV4cGVjdGVkVGhpc1wiIGluIHRoaXMgJiYgdGhpcy5leHBlY3RlZFRoaXMgIT09IHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMubWV0aG9kICsgXCIgY2FsbGVkIHdpdGggXCIgKyB0aGlzVmFsdWUgKyBcIiBhcyB0aGlzVmFsdWUsIGV4cGVjdGVkIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXhwZWN0ZWRUaGlzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIShcImV4cGVjdGVkQXJndW1lbnRzXCIgaW4gdGhpcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghYXJncykge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMubWV0aG9kICsgXCIgcmVjZWl2ZWQgbm8gYXJndW1lbnRzLCBleHBlY3RlZCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICBzaW5vbi5mb3JtYXQodGhpcy5leHBlY3RlZEFyZ3VtZW50cykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA8IHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLmZhaWwodGhpcy5tZXRob2QgKyBcIiByZWNlaXZlZCB0b28gZmV3IGFyZ3VtZW50cyAoXCIgKyBzaW5vbi5mb3JtYXQoYXJncykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgXCIpLCBleHBlY3RlZCBcIiArIHNpbm9uLmZvcm1hdCh0aGlzLmV4cGVjdGVkQXJndW1lbnRzKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZXhwZWN0c0V4YWN0QXJnQ291bnQgJiZcbiAgICAgICAgICAgICAgICAgICAgYXJncy5sZW5ndGggIT09IHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLmZhaWwodGhpcy5tZXRob2QgKyBcIiByZWNlaXZlZCB0b28gbWFueSBhcmd1bWVudHMgKFwiICsgc2lub24uZm9ybWF0KGFyZ3MpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiKSwgZXhwZWN0ZWQgXCIgKyBzaW5vbi5mb3JtYXQodGhpcy5leHBlY3RlZEFyZ3VtZW50cykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5leHBlY3RlZEFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpICs9IDEpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXZlcmlmeU1hdGNoZXIodGhpcy5leHBlY3RlZEFyZ3VtZW50c1tpXSwgYXJnc1tpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLmZhaWwodGhpcy5tZXRob2QgKyBcIiByZWNlaXZlZCB3cm9uZyBhcmd1bWVudHMgXCIgKyBzaW5vbi5mb3JtYXQoYXJncykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiLCBkaWRuJ3QgbWF0Y2ggXCIgKyB0aGlzLmV4cGVjdGVkQXJndW1lbnRzLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzaW5vbi5kZWVwRXF1YWwodGhpcy5leHBlY3RlZEFyZ3VtZW50c1tpXSwgYXJnc1tpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbm9uLmV4cGVjdGF0aW9uLmZhaWwodGhpcy5tZXRob2QgKyBcIiByZWNlaXZlZCB3cm9uZyBhcmd1bWVudHMgXCIgKyBzaW5vbi5mb3JtYXQoYXJncykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiLCBleHBlY3RlZCBcIiArIHNpbm9uLmZvcm1hdCh0aGlzLmV4cGVjdGVkQXJndW1lbnRzKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBhbGxvd3NDYWxsOiBmdW5jdGlvbiBhbGxvd3NDYWxsKHRoaXNWYWx1ZSwgYXJncykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1ldCgpICYmIHJlY2VpdmVkTWF4Q2FsbHModGhpcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChcImV4cGVjdGVkVGhpc1wiIGluIHRoaXMgJiYgdGhpcy5leHBlY3RlZFRoaXMgIT09IHRoaXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCEoXCJleHBlY3RlZEFyZ3VtZW50c1wiIGluIHRoaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGFyZ3MgPSBhcmdzIHx8IFtdO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoIDwgdGhpcy5leHBlY3RlZEFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmV4cGVjdHNFeGFjdEFyZ0NvdW50ICYmXG4gICAgICAgICAgICAgICAgICAgIGFyZ3MubGVuZ3RoICE9PSB0aGlzLmV4cGVjdGVkQXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmV4cGVjdGVkQXJndW1lbnRzLmxlbmd0aDsgaSA8IGw7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXZlcmlmeU1hdGNoZXIodGhpcy5leHBlY3RlZEFyZ3VtZW50c1tpXSwgYXJnc1tpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghc2lub24uZGVlcEVxdWFsKHRoaXMuZXhwZWN0ZWRBcmd1bWVudHNbaV0sIGFyZ3NbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHdpdGhBcmdzOiBmdW5jdGlvbiB3aXRoQXJncygpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV4cGVjdGVkQXJndW1lbnRzID0gc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgd2l0aEV4YWN0QXJnczogZnVuY3Rpb24gd2l0aEV4YWN0QXJncygpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndpdGhBcmdzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgdGhpcy5leHBlY3RzRXhhY3RBcmdDb3VudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvbjogZnVuY3Rpb24gb24odGhpc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5leHBlY3RlZFRoaXMgPSB0aGlzVmFsdWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gKHRoaXMuZXhwZWN0ZWRBcmd1bWVudHMgfHwgW10pLnNsaWNlKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZXhwZWN0c0V4YWN0QXJnQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGFyZ3MsIFwiWy4uLl1cIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGNhbGxTdHIgPSBzaW5vbi5zcHlDYWxsLnRvU3RyaW5nLmNhbGwoe1xuICAgICAgICAgICAgICAgICAgICBwcm94eTogdGhpcy5tZXRob2QgfHwgXCJhbm9ueW1vdXMgbW9jayBleHBlY3RhdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBhcmdzXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbWVzc2FnZSA9IGNhbGxTdHIucmVwbGFjZShcIiwgWy4uLlwiLCBcIlssIC4uLlwiKSArIFwiIFwiICtcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRDYWxsQ291bnRJbldvcmRzKHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWV0KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiRXhwZWN0YXRpb24gbWV0OiBcIiArIG1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiRXhwZWN0ZWQgXCIgKyBtZXNzYWdlICsgXCIgKFwiICtcbiAgICAgICAgICAgICAgICAgICAgY2FsbENvdW50SW5Xb3Jkcyh0aGlzLmNhbGxDb3VudCkgKyBcIilcIjtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHZlcmlmeTogZnVuY3Rpb24gdmVyaWZ5KCkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5tZXQoKSkge1xuICAgICAgICAgICAgICAgICAgICBzaW5vbi5leHBlY3RhdGlvbi5mYWlsKHRoaXMudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2lub24uZXhwZWN0YXRpb24ucGFzcyh0aGlzLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcGFzczogZnVuY3Rpb24gcGFzcyhtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgc2lub24uYXNzZXJ0LnBhc3MobWVzc2FnZSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBmYWlsOiBmdW5jdGlvbiBmYWlsKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXhjZXB0aW9uID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIGV4Y2VwdGlvbi5uYW1lID0gXCJFeHBlY3RhdGlvbkVycm9yXCI7XG5cbiAgICAgICAgICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24ubW9jayA9IG1vY2s7XG4gICAgICAgIHJldHVybiBtb2NrO1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi91dGlsL2NvcmVcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3RpbWVzX2luX3dvcmRzXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9jYWxsXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9leHRlbmRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL21hdGNoXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zcHlcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3N0dWJcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zvcm1hdFwiKTtcblxuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoc2lub24pO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIGV4dGVuZC5qc1xuICogQGRlcGVuZCBjb2xsZWN0aW9uLmpzXG4gKiBAZGVwZW5kIHV0aWwvZmFrZV90aW1lcnMuanNcbiAqIEBkZXBlbmQgdXRpbC9mYWtlX3NlcnZlcl93aXRoX2Nsb2NrLmpzXG4gKi9cbi8qKlxuICogTWFuYWdlcyBmYWtlIGNvbGxlY3Rpb25zIGFzIHdlbGwgYXMgZmFrZSB1dGlsaXRpZXMgc3VjaCBhcyBTaW5vbidzXG4gKiB0aW1lcnMgYW5kIGZha2UgWEhSIGltcGxlbWVudGF0aW9uIGluIG9uZSBjb252ZW5pZW50IG9iamVjdC5cbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHZhciBwdXNoID0gW10ucHVzaDtcblxuICAgICAgICBmdW5jdGlvbiBleHBvc2VWYWx1ZShzYW5kYm94LCBjb25maWcsIGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjb25maWcuaW5qZWN0SW50byAmJiAhKGtleSBpbiBjb25maWcuaW5qZWN0SW50bykpIHtcbiAgICAgICAgICAgICAgICBjb25maWcuaW5qZWN0SW50b1trZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgc2FuZGJveC5pbmplY3RlZEtleXMucHVzaChrZXkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwoc2FuZGJveC5hcmdzLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwcmVwYXJlU2FuZGJveEZyb21Db25maWcoY29uZmlnKSB7XG4gICAgICAgICAgICB2YXIgc2FuZGJveCA9IHNpbm9uLmNyZWF0ZShzaW5vbi5zYW5kYm94KTtcblxuICAgICAgICAgICAgaWYgKGNvbmZpZy51c2VGYWtlU2VydmVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb25maWcudXNlRmFrZVNlcnZlciA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICBzYW5kYm94LnNlcnZlclByb3RvdHlwZSA9IGNvbmZpZy51c2VGYWtlU2VydmVyO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNhbmRib3gudXNlRmFrZVNlcnZlcigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY29uZmlnLnVzZUZha2VUaW1lcnMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbmZpZy51c2VGYWtlVGltZXJzID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHNhbmRib3gudXNlRmFrZVRpbWVycy5hcHBseShzYW5kYm94LCBjb25maWcudXNlRmFrZVRpbWVycyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2FuZGJveC51c2VGYWtlVGltZXJzKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc2FuZGJveDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNpbm9uLnNhbmRib3ggPSBzaW5vbi5leHRlbmQoc2lub24uY3JlYXRlKHNpbm9uLmNvbGxlY3Rpb24pLCB7XG4gICAgICAgICAgICB1c2VGYWtlVGltZXJzOiBmdW5jdGlvbiB1c2VGYWtlVGltZXJzKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2xvY2sgPSBzaW5vbi51c2VGYWtlVGltZXJzLmFwcGx5KHNpbm9uLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHRoaXMuY2xvY2spO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc2VydmVyUHJvdG90eXBlOiBzaW5vbi5mYWtlU2VydmVyLFxuXG4gICAgICAgICAgICB1c2VGYWtlU2VydmVyOiBmdW5jdGlvbiB1c2VGYWtlU2VydmVyKCkge1xuICAgICAgICAgICAgICAgIHZhciBwcm90byA9IHRoaXMuc2VydmVyUHJvdG90eXBlIHx8IHNpbm9uLmZha2VTZXJ2ZXI7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXByb3RvIHx8ICFwcm90by5jcmVhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXJ2ZXIgPSBwcm90by5jcmVhdGUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGQodGhpcy5zZXJ2ZXIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgaW5qZWN0OiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICAgICAgc2lub24uY29sbGVjdGlvbi5pbmplY3QuY2FsbCh0aGlzLCBvYmopO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY2xvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqLmNsb2NrID0gdGhpcy5jbG9jaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZXJ2ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqLnNlcnZlciA9IHRoaXMuc2VydmVyO1xuICAgICAgICAgICAgICAgICAgICBvYmoucmVxdWVzdHMgPSB0aGlzLnNlcnZlci5yZXF1ZXN0cztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvYmoubWF0Y2ggPSBzaW5vbi5tYXRjaDtcblxuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXN0b3JlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2lub24uY29sbGVjdGlvbi5yZXN0b3JlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN0b3JlQ29udGV4dCgpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzdG9yZUNvbnRleHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pbmplY3RlZEtleXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSB0aGlzLmluamVjdGVkS2V5cy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmluamVjdEludG9bdGhpcy5pbmplY3RlZEtleXNbaV1dO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5qZWN0ZWRLZXlzID0gW107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiAoY29uZmlnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb25maWcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLmNyZWF0ZShzaW5vbi5zYW5kYm94KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgc2FuZGJveCA9IHByZXBhcmVTYW5kYm94RnJvbUNvbmZpZyhjb25maWcpO1xuICAgICAgICAgICAgICAgIHNhbmRib3guYXJncyA9IHNhbmRib3guYXJncyB8fCBbXTtcbiAgICAgICAgICAgICAgICBzYW5kYm94LmluamVjdGVkS2V5cyA9IFtdO1xuICAgICAgICAgICAgICAgIHNhbmRib3guaW5qZWN0SW50byA9IGNvbmZpZy5pbmplY3RJbnRvO1xuICAgICAgICAgICAgICAgIHZhciBwcm9wLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTtcbiAgICAgICAgICAgICAgICB2YXIgZXhwb3NlZCA9IHNhbmRib3guaW5qZWN0KHt9KTtcblxuICAgICAgICAgICAgICAgIGlmIChjb25maWcucHJvcGVydGllcykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNvbmZpZy5wcm9wZXJ0aWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCA9IGNvbmZpZy5wcm9wZXJ0aWVzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBleHBvc2VkW3Byb3BdIHx8IHByb3AgPT09IFwic2FuZGJveFwiICYmIHNhbmRib3g7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBvc2VWYWx1ZShzYW5kYm94LCBjb25maWcsIHByb3AsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cG9zZVZhbHVlKHNhbmRib3gsIGNvbmZpZywgXCJzYW5kYm94XCIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2FuZGJveDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG1hdGNoOiBzaW5vbi5tYXRjaFxuICAgICAgICB9KTtcblxuICAgICAgICBzaW5vbi5zYW5kYm94LnVzZUZha2VYTUxIdHRwUmVxdWVzdCA9IHNpbm9uLnNhbmRib3gudXNlRmFrZVNlcnZlcjtcblxuICAgICAgICByZXR1cm4gc2lub24uc2FuZGJveDtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9leHRlbmRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3V0aWwvZmFrZV9zZXJ2ZXJfd2l0aF9jbG9ja1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vdXRpbC9mYWtlX3RpbWVyc1wiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vY29sbGVjdGlvblwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gICogQGRlcGVuZCB0aW1lc19pbl93b3Jkcy5qc1xuICAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gICogQGRlcGVuZCBleHRlbmQuanNcbiAgKiBAZGVwZW5kIGNhbGwuanNcbiAgKiBAZGVwZW5kIGZvcm1hdC5qc1xuICAqL1xuLyoqXG4gICogU3B5IGZ1bmN0aW9uc1xuICAqXG4gICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gICogQGxpY2Vuc2UgQlNEXG4gICpcbiAgKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAgKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgdmFyIHB1c2ggPSBBcnJheS5wcm90b3R5cGUucHVzaDtcbiAgICAgICAgdmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuICAgICAgICB2YXIgY2FsbElkID0gMDtcblxuICAgICAgICBmdW5jdGlvbiBzcHkob2JqZWN0LCBwcm9wZXJ0eSwgdHlwZXMpIHtcbiAgICAgICAgICAgIGlmICghcHJvcGVydHkgJiYgdHlwZW9mIG9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNweS5jcmVhdGUob2JqZWN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFvYmplY3QgJiYgIXByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNweS5jcmVhdGUoZnVuY3Rpb24gKCkgeyB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVzKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1ldGhvZERlc2MgPSBzaW5vbi5nZXRQcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2REZXNjW3R5cGVzW2ldXSA9IHNweS5jcmVhdGUobWV0aG9kRGVzY1t0eXBlc1tpXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gc2lub24ud3JhcE1ldGhvZChvYmplY3QsIHByb3BlcnR5LCBtZXRob2REZXNjKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uLndyYXBNZXRob2Qob2JqZWN0LCBwcm9wZXJ0eSwgc3B5LmNyZWF0ZShvYmplY3RbcHJvcGVydHldKSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBtYXRjaGluZ0Zha2UoZmFrZXMsIGFyZ3MsIHN0cmljdCkge1xuICAgICAgICAgICAgaWYgKCFmYWtlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZmFrZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZha2VzW2ldLm1hdGNoZXMoYXJncywgc3RyaWN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFrZXNbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5jcmVtZW50Q2FsbENvdW50KCkge1xuICAgICAgICAgICAgdGhpcy5jYWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5jYWxsQ291bnQgKz0gMTtcbiAgICAgICAgICAgIHRoaXMubm90Q2FsbGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmNhbGxlZE9uY2UgPSB0aGlzLmNhbGxDb3VudCA9PT0gMTtcbiAgICAgICAgICAgIHRoaXMuY2FsbGVkVHdpY2UgPSB0aGlzLmNhbGxDb3VudCA9PT0gMjtcbiAgICAgICAgICAgIHRoaXMuY2FsbGVkVGhyaWNlID0gdGhpcy5jYWxsQ291bnQgPT09IDM7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVDYWxsUHJvcGVydGllcygpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyc3RDYWxsID0gdGhpcy5nZXRDYWxsKDApO1xuICAgICAgICAgICAgdGhpcy5zZWNvbmRDYWxsID0gdGhpcy5nZXRDYWxsKDEpO1xuICAgICAgICAgICAgdGhpcy50aGlyZENhbGwgPSB0aGlzLmdldENhbGwoMik7XG4gICAgICAgICAgICB0aGlzLmxhc3RDYWxsID0gdGhpcy5nZXRDYWxsKHRoaXMuY2FsbENvdW50IC0gMSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdmFycyA9IFwiYSxiLGMsZCxlLGYsZyxoLGksaixrLGxcIjtcbiAgICAgICAgZnVuY3Rpb24gY3JlYXRlUHJveHkoZnVuYywgcHJveHlMZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIFJldGFpbiB0aGUgZnVuY3Rpb24gbGVuZ3RoOlxuICAgICAgICAgICAgdmFyIHA7XG4gICAgICAgICAgICBpZiAocHJveHlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBldmFsKFwicCA9IChmdW5jdGlvbiBwcm94eShcIiArIHZhcnMuc3Vic3RyaW5nKDAsIHByb3h5TGVuZ3RoICogMiAtIDEpICsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1ldmFsXG4gICAgICAgICAgICAgICAgICAgIFwiKSB7IHJldHVybiBwLmludm9rZShmdW5jLCB0aGlzLCBzbGljZS5jYWxsKGFyZ3VtZW50cykpOyB9KTtcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHAgPSBmdW5jdGlvbiBwcm94eSgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHAuaW52b2tlKGZ1bmMsIHRoaXMsIHNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHAuaXNTaW5vblByb3h5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiBwO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHV1aWQgPSAwO1xuXG4gICAgICAgIC8vIFB1YmxpYyBBUElcbiAgICAgICAgdmFyIHNweUFwaSA9IHtcbiAgICAgICAgICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaW52b2tpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcihcIkNhbm5vdCByZXNldCBTaW5vbiBmdW5jdGlvbiB3aGlsZSBpbnZva2luZyBpdC4gXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTW92ZSB0aGUgY2FsbCB0byAucmVzZXQgb3V0c2lkZSBvZiB0aGUgY2FsbGJhY2suXCIpO1xuICAgICAgICAgICAgICAgICAgICBlcnIubmFtZSA9IFwiSW52YWxpZFJlc2V0RXhjZXB0aW9uXCI7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMubm90Q2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxlZE9uY2UgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxlZFR3aWNlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsZWRUaHJpY2UgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDb3VudCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJzdENhbGwgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuc2Vjb25kQ2FsbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy50aGlyZENhbGwgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubGFzdENhbGwgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuYXJncyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMucmV0dXJuVmFsdWVzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy50aGlzVmFsdWVzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5leGNlcHRpb25zID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsSWRzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5zdGFja3MgPSBbXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5mYWtlcykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZmFrZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmFrZXNbaV0ucmVzZXQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiBjcmVhdGUoZnVuYywgc3B5TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5hbWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBmdW5jID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWUgPSBzaW5vbi5mdW5jdGlvbk5hbWUoZnVuYyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFzcHlMZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc3B5TGVuZ3RoID0gZnVuYy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHByb3h5ID0gY3JlYXRlUHJveHkoZnVuYywgc3B5TGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgIHNpbm9uLmV4dGVuZChwcm94eSwgc3B5KTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcHJveHkuY3JlYXRlO1xuICAgICAgICAgICAgICAgIHNpbm9uLmV4dGVuZChwcm94eSwgZnVuYyk7XG5cbiAgICAgICAgICAgICAgICBwcm94eS5yZXNldCgpO1xuICAgICAgICAgICAgICAgIHByb3h5LnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgICAgICAgICAgIHByb3h5LmRpc3BsYXlOYW1lID0gbmFtZSB8fCBcInNweVwiO1xuICAgICAgICAgICAgICAgIHByb3h5LnRvU3RyaW5nID0gc2lub24uZnVuY3Rpb25Ub1N0cmluZztcbiAgICAgICAgICAgICAgICBwcm94eS5pbnN0YW50aWF0ZUZha2UgPSBzaW5vbi5zcHkuY3JlYXRlO1xuICAgICAgICAgICAgICAgIHByb3h5LmlkID0gXCJzcHkjXCIgKyB1dWlkKys7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBpbnZva2U6IGZ1bmN0aW9uIGludm9rZShmdW5jLCB0aGlzVmFsdWUsIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hpbmcgPSBtYXRjaGluZ0Zha2UodGhpcy5mYWtlcywgYXJncyk7XG4gICAgICAgICAgICAgICAgdmFyIGV4Y2VwdGlvbiwgcmV0dXJuVmFsdWU7XG5cbiAgICAgICAgICAgICAgICBpbmNyZW1lbnRDYWxsQ291bnQuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy50aGlzVmFsdWVzLCB0aGlzVmFsdWUpO1xuICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLmFyZ3MsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLmNhbGxJZHMsIGNhbGxJZCsrKTtcblxuICAgICAgICAgICAgICAgIC8vIE1ha2UgY2FsbCBwcm9wZXJ0aWVzIGF2YWlsYWJsZSBmcm9tIHdpdGhpbiB0aGUgc3BpZWQgZnVuY3Rpb246XG4gICAgICAgICAgICAgICAgY3JlYXRlQ2FsbFByb3BlcnRpZXMuY2FsbCh0aGlzKTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW52b2tpbmcgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUgPSBtYXRjaGluZy5pbnZva2UoZnVuYywgdGhpc1ZhbHVlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVyblZhbHVlID0gKHRoaXMuZnVuYyB8fCBmdW5jKS5hcHBseSh0aGlzVmFsdWUsIGFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHRoaXNDYWxsID0gdGhpcy5nZXRDYWxsKHRoaXMuY2FsbENvdW50IC0gMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzQ2FsbC5jYWxsZWRXaXRoTmV3KCkgJiYgdHlwZW9mIHJldHVyblZhbHVlICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5WYWx1ZSA9IHRoaXNWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhjZXB0aW9uID0gZTtcbiAgICAgICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5pbnZva2luZztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5leGNlcHRpb25zLCBleGNlcHRpb24pO1xuICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLnJldHVyblZhbHVlcywgcmV0dXJuVmFsdWUpO1xuICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLnN0YWNrcywgbmV3IEVycm9yKCkuc3RhY2spO1xuXG4gICAgICAgICAgICAgICAgLy8gTWFrZSByZXR1cm4gdmFsdWUgYW5kIGV4Y2VwdGlvbiBhdmFpbGFibGUgaW4gdGhlIGNhbGxzOlxuICAgICAgICAgICAgICAgIGNyZWF0ZUNhbGxQcm9wZXJ0aWVzLmNhbGwodGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXhjZXB0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG5hbWVkOiBmdW5jdGlvbiBuYW1lZChuYW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5TmFtZSA9IG5hbWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXRDYWxsOiBmdW5jdGlvbiBnZXRDYWxsKGkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaSA8IDAgfHwgaSA+PSB0aGlzLmNhbGxDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2lub24uc3B5Q2FsbCh0aGlzLCB0aGlzLnRoaXNWYWx1ZXNbaV0sIHRoaXMuYXJnc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJldHVyblZhbHVlc1tpXSwgdGhpcy5leGNlcHRpb25zW2ldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2FsbElkc1tpXSwgdGhpcy5zdGFja3NbaV0pO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZ2V0Q2FsbHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FsbHMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgaTtcblxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNhbGxDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxzLnB1c2godGhpcy5nZXRDYWxsKGkpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbHM7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsZWRCZWZvcmU6IGZ1bmN0aW9uIGNhbGxlZEJlZm9yZShzcHlGbikge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5jYWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghc3B5Rm4uY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhbGxJZHNbMF0gPCBzcHlGbi5jYWxsSWRzW3NweUZuLmNhbGxJZHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjYWxsZWRBZnRlcjogZnVuY3Rpb24gY2FsbGVkQWZ0ZXIoc3B5Rm4pIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuY2FsbGVkIHx8ICFzcHlGbi5jYWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhbGxJZHNbdGhpcy5jYWxsQ291bnQgLSAxXSA+IHNweUZuLmNhbGxJZHNbc3B5Rm4uY2FsbENvdW50IC0gMV07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB3aXRoQXJnczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZmFrZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1hdGNoID0gbWF0Y2hpbmdGYWtlKHRoaXMuZmFrZXMsIGFyZ3MsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mYWtlcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBvcmlnaW5hbCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIGZha2UgPSB0aGlzLmluc3RhbnRpYXRlRmFrZSgpO1xuICAgICAgICAgICAgICAgIGZha2UubWF0Y2hpbmdBZ3VtZW50cyA9IGFyZ3M7XG4gICAgICAgICAgICAgICAgZmFrZS5wYXJlbnQgPSB0aGlzO1xuICAgICAgICAgICAgICAgIHB1c2guY2FsbCh0aGlzLmZha2VzLCBmYWtlKTtcblxuICAgICAgICAgICAgICAgIGZha2Uud2l0aEFyZ3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvcmlnaW5hbC53aXRoQXJncy5hcHBseShvcmlnaW5hbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZha2UubWF0Y2hlcyh0aGlzLmFyZ3NbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNyZW1lbnRDYWxsQ291bnQuY2FsbChmYWtlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHB1c2guY2FsbChmYWtlLnRoaXNWYWx1ZXMsIHRoaXMudGhpc1ZhbHVlc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwoZmFrZS5hcmdzLCB0aGlzLmFyZ3NbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGZha2UucmV0dXJuVmFsdWVzLCB0aGlzLnJldHVyblZhbHVlc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwoZmFrZS5leGNlcHRpb25zLCB0aGlzLmV4Y2VwdGlvbnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGZha2UuY2FsbElkcywgdGhpcy5jYWxsSWRzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjcmVhdGVDYWxsUHJvcGVydGllcy5jYWxsKGZha2UpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZha2U7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBtYXRjaGVzOiBmdW5jdGlvbiAoYXJncywgc3RyaWN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcmdzID0gdGhpcy5tYXRjaGluZ0FndW1lbnRzO1xuXG4gICAgICAgICAgICAgICAgaWYgKG1hcmdzLmxlbmd0aCA8PSBhcmdzLmxlbmd0aCAmJlxuICAgICAgICAgICAgICAgICAgICBzaW5vbi5kZWVwRXF1YWwobWFyZ3MsIGFyZ3Muc2xpY2UoMCwgbWFyZ3MubGVuZ3RoKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICFzdHJpY3QgfHwgbWFyZ3MubGVuZ3RoID09PSBhcmdzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBwcmludGY6IGZ1bmN0aW9uIChmb3JtYXQpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3B5SW5zdGFuY2UgPSB0aGlzO1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICAgICAgICAgIHZhciBmb3JtYXR0ZXI7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gKGZvcm1hdCB8fCBcIlwiKS5yZXBsYWNlKC8lKC4pL2csIGZ1bmN0aW9uIChtYXRjaCwgc3BlY2lmeWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdHRlciA9IHNweUFwaS5mb3JtYXR0ZXJzW3NwZWNpZnllcl07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmb3JtYXR0ZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZvcm1hdHRlci5jYWxsKG51bGwsIHNweUluc3RhbmNlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghaXNOYU4ocGFyc2VJbnQoc3BlY2lmeWVyLCAxMCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2lub24uZm9ybWF0KGFyZ3Nbc3BlY2lmeWVyIC0gMV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiJVwiICsgc3BlY2lmeWVyO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGRlbGVnYXRlVG9DYWxscyhtZXRob2QsIG1hdGNoQW55LCBhY3R1YWwsIG5vdENhbGxlZCkge1xuICAgICAgICAgICAgc3B5QXBpW21ldGhvZF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmNhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm90Q2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm90Q2FsbGVkLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBjdXJyZW50Q2FsbDtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IDA7XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuY2FsbENvdW50OyBpIDwgbDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRDYWxsID0gdGhpcy5nZXRDYWxsKGkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Q2FsbFthY3R1YWwgfHwgbWV0aG9kXS5hcHBseShjdXJyZW50Q2FsbCwgYXJndW1lbnRzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcyArPSAxO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hBbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaGVzID09PSB0aGlzLmNhbGxDb3VudDtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJjYWxsZWRPblwiLCB0cnVlKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiYWx3YXlzQ2FsbGVkT25cIiwgZmFsc2UsIFwiY2FsbGVkT25cIik7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImNhbGxlZFdpdGhcIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImNhbGxlZFdpdGhNYXRjaFwiLCB0cnVlKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiYWx3YXlzQ2FsbGVkV2l0aFwiLCBmYWxzZSwgXCJjYWxsZWRXaXRoXCIpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJhbHdheXNDYWxsZWRXaXRoTWF0Y2hcIiwgZmFsc2UsIFwiY2FsbGVkV2l0aE1hdGNoXCIpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJjYWxsZWRXaXRoRXhhY3RseVwiLCB0cnVlKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiYWx3YXlzQ2FsbGVkV2l0aEV4YWN0bHlcIiwgZmFsc2UsIFwiY2FsbGVkV2l0aEV4YWN0bHlcIik7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcIm5ldmVyQ2FsbGVkV2l0aFwiLCBmYWxzZSwgXCJub3RDYWxsZWRXaXRoXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwibmV2ZXJDYWxsZWRXaXRoTWF0Y2hcIiwgZmFsc2UsIFwibm90Q2FsbGVkV2l0aE1hdGNoXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwidGhyZXdcIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImFsd2F5c1RocmV3XCIsIGZhbHNlLCBcInRocmV3XCIpO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJyZXR1cm5lZFwiLCB0cnVlKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiYWx3YXlzUmV0dXJuZWRcIiwgZmFsc2UsIFwicmV0dXJuZWRcIik7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImNhbGxlZFdpdGhOZXdcIiwgdHJ1ZSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImFsd2F5c0NhbGxlZFdpdGhOZXdcIiwgZmFsc2UsIFwiY2FsbGVkV2l0aE5ld1wiKTtcbiAgICAgICAgZGVsZWdhdGVUb0NhbGxzKFwiY2FsbEFyZ1wiLCBmYWxzZSwgXCJjYWxsQXJnV2l0aFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGhpcy50b1N0cmluZygpICsgXCIgY2Fubm90IGNhbGwgYXJnIHNpbmNlIGl0IHdhcyBub3QgeWV0IGludm9rZWQuXCIpO1xuICAgICAgICB9KTtcbiAgICAgICAgc3B5QXBpLmNhbGxBcmdXaXRoID0gc3B5QXBpLmNhbGxBcmc7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcImNhbGxBcmdPblwiLCBmYWxzZSwgXCJjYWxsQXJnT25XaXRoXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcih0aGlzLnRvU3RyaW5nKCkgKyBcIiBjYW5ub3QgY2FsbCBhcmcgc2luY2UgaXQgd2FzIG5vdCB5ZXQgaW52b2tlZC5cIik7XG4gICAgICAgIH0pO1xuICAgICAgICBzcHlBcGkuY2FsbEFyZ09uV2l0aCA9IHNweUFwaS5jYWxsQXJnT247XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcInlpZWxkXCIsIGZhbHNlLCBcInlpZWxkXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcih0aGlzLnRvU3RyaW5nKCkgKyBcIiBjYW5ub3QgeWllbGQgc2luY2UgaXQgd2FzIG5vdCB5ZXQgaW52b2tlZC5cIik7XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBcImludm9rZUNhbGxiYWNrXCIgaXMgYW4gYWxpYXMgZm9yIFwieWllbGRcIiBzaW5jZSBcInlpZWxkXCIgaXMgaW52YWxpZCBpbiBzdHJpY3QgbW9kZS5cbiAgICAgICAgc3B5QXBpLmludm9rZUNhbGxiYWNrID0gc3B5QXBpLnlpZWxkO1xuICAgICAgICBkZWxlZ2F0ZVRvQ2FsbHMoXCJ5aWVsZE9uXCIsIGZhbHNlLCBcInlpZWxkT25cIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHRoaXMudG9TdHJpbmcoKSArIFwiIGNhbm5vdCB5aWVsZCBzaW5jZSBpdCB3YXMgbm90IHlldCBpbnZva2VkLlwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcInlpZWxkVG9cIiwgZmFsc2UsIFwieWllbGRUb1wiLCBmdW5jdGlvbiAocHJvcGVydHkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcih0aGlzLnRvU3RyaW5nKCkgKyBcIiBjYW5ub3QgeWllbGQgdG8gJ1wiICsgcHJvcGVydHkgK1xuICAgICAgICAgICAgICAgIFwiJyBzaW5jZSBpdCB3YXMgbm90IHlldCBpbnZva2VkLlwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRlbGVnYXRlVG9DYWxscyhcInlpZWxkVG9PblwiLCBmYWxzZSwgXCJ5aWVsZFRvT25cIiwgZnVuY3Rpb24gKHByb3BlcnR5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGhpcy50b1N0cmluZygpICsgXCIgY2Fubm90IHlpZWxkIHRvICdcIiArIHByb3BlcnR5ICtcbiAgICAgICAgICAgICAgICBcIicgc2luY2UgaXQgd2FzIG5vdCB5ZXQgaW52b2tlZC5cIik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNweUFwaS5mb3JtYXR0ZXJzID0ge1xuICAgICAgICAgICAgYzogZnVuY3Rpb24gKHNweUluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNpbm9uLnRpbWVzSW5Xb3JkcyhzcHlJbnN0YW5jZS5jYWxsQ291bnQpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbjogZnVuY3Rpb24gKHNweUluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNweUluc3RhbmNlLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBDOiBmdW5jdGlvbiAoc3B5SW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FsbHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gc3B5SW5zdGFuY2UuY2FsbENvdW50OyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzdHJpbmdpZmllZENhbGwgPSBcIiAgICBcIiArIHNweUluc3RhbmNlLmdldENhbGwoaSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKC9cXG4vLnRlc3QoY2FsbHNbaSAtIDFdKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyaW5naWZpZWRDYWxsID0gXCJcXG5cIiArIHN0cmluZ2lmaWVkQ2FsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwoY2FsbHMsIHN0cmluZ2lmaWVkQ2FsbCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxzLmxlbmd0aCA+IDAgPyBcIlxcblwiICsgY2FsbHMuam9pbihcIlxcblwiKSA6IFwiXCI7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB0OiBmdW5jdGlvbiAoc3B5SW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqZWN0cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBzcHlJbnN0YW5jZS5jYWxsQ291bnQ7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKG9iamVjdHMsIHNpbm9uLmZvcm1hdChzcHlJbnN0YW5jZS50aGlzVmFsdWVzW2ldKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iamVjdHMuam9pbihcIiwgXCIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgXCIqXCI6IGZ1bmN0aW9uIChzcHlJbnN0YW5jZSwgYXJncykge1xuICAgICAgICAgICAgICAgIHZhciBmb3JtYXR0ZWQgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJncy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgcHVzaC5jYWxsKGZvcm1hdHRlZCwgc2lub24uZm9ybWF0KGFyZ3NbaV0pKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZm9ybWF0dGVkLmpvaW4oXCIsIFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5leHRlbmQoc3B5LCBzcHlBcGkpO1xuXG4gICAgICAgIHNweS5zcHlDYWxsID0gc2lub24uc3B5Q2FsbDtcbiAgICAgICAgc2lub24uc3B5ID0gc3B5O1xuXG4gICAgICAgIHJldHVybiBzcHk7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9jYWxsXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9leHRlbmRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL3RpbWVzX2luX3dvcmRzXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9mb3JtYXRcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShjb3JlKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCBleHRlbmQuanNcbiAqIEBkZXBlbmQgc3B5LmpzXG4gKiBAZGVwZW5kIGJlaGF2aW9yLmpzXG4gKiBAZGVwZW5kIHdhbGsuanNcbiAqL1xuLyoqXG4gKiBTdHViIGZ1bmN0aW9uc1xuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgZnVuY3Rpb24gc3R1YihvYmplY3QsIHByb3BlcnR5LCBmdW5jKSB7XG4gICAgICAgICAgICBpZiAoISFmdW5jICYmIHR5cGVvZiBmdW5jICE9PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGZ1bmMgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ3VzdG9tIHN0dWIgc2hvdWxkIGJlIGEgZnVuY3Rpb24gb3IgYSBwcm9wZXJ0eSBkZXNjcmlwdG9yXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd3JhcHBlcjtcblxuICAgICAgICAgICAgaWYgKGZ1bmMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZ1bmMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyID0gc2lub24uc3B5ICYmIHNpbm9uLnNweS5jcmVhdGUgPyBzaW5vbi5zcHkuY3JlYXRlKGZ1bmMpIDogZnVuYztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVyID0gZnVuYztcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpbm9uLnNweSAmJiBzaW5vbi5zcHkuY3JlYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdHlwZXMgPSBzaW5vbi5vYmplY3RLZXlzKHdyYXBwZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdyYXBwZXJbdHlwZXNbaV1dID0gc2lub24uc3B5LmNyZWF0ZSh3cmFwcGVyW3R5cGVzW2ldXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBzdHViTGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9iamVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqZWN0W3Byb3BlcnR5XSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0dWJMZW5ndGggPSBvYmplY3RbcHJvcGVydHldLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd3JhcHBlciA9IHN0dWIuY3JlYXRlKHN0dWJMZW5ndGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW9iamVjdCAmJiB0eXBlb2YgcHJvcGVydHkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2lub24uc3R1Yi5jcmVhdGUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eSA9PT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2Ygb2JqZWN0ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgc2lub24ud2FsayhvYmplY3QgfHwge30sIGZ1bmN0aW9uICh2YWx1ZSwgcHJvcCwgcHJvcE93bmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IHdhbnQgdG8gc3R1YiB0aGluZ3MgbGlrZSB0b1N0cmluZygpLCB2YWx1ZU9mKCksIGV0Yy4gc28gd2Ugb25seSBzdHViIGlmIHRoZSBvYmplY3RcbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgbm90IE9iamVjdC5wcm90b3R5cGVcbiAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcE93bmVyICE9PSBPYmplY3QucHJvdG90eXBlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wICE9PSBcImNvbnN0cnVjdG9yXCIgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBzaW5vbi5nZXRQcm9wZXJ0eURlc2NyaXB0b3IocHJvcE93bmVyLCBwcm9wKS52YWx1ZSA9PT0gXCJmdW5jdGlvblwiXG4gICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3R1YihvYmplY3QsIHByb3ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqZWN0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc2lub24ud3JhcE1ldGhvZChvYmplY3QsIHByb3BlcnR5LCB3cmFwcGVyKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLyplc2xpbnQtZGlzYWJsZSBuby11c2UtYmVmb3JlLWRlZmluZSovXG4gICAgICAgIGZ1bmN0aW9uIGdldFBhcmVudEJlaGF2aW91cihzdHViSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiAoc3R1Ykluc3RhbmNlLnBhcmVudCAmJiBnZXRDdXJyZW50QmVoYXZpb3Ioc3R1Ykluc3RhbmNlLnBhcmVudCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0RGVmYXVsdEJlaGF2aW9yKHN0dWJJbnN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0dWJJbnN0YW5jZS5kZWZhdWx0QmVoYXZpb3IgfHxcbiAgICAgICAgICAgICAgICAgICAgZ2V0UGFyZW50QmVoYXZpb3VyKHN0dWJJbnN0YW5jZSkgfHxcbiAgICAgICAgICAgICAgICAgICAgc2lub24uYmVoYXZpb3IuY3JlYXRlKHN0dWJJbnN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRDdXJyZW50QmVoYXZpb3Ioc3R1Ykluc3RhbmNlKSB7XG4gICAgICAgICAgICB2YXIgYmVoYXZpb3IgPSBzdHViSW5zdGFuY2UuYmVoYXZpb3JzW3N0dWJJbnN0YW5jZS5jYWxsQ291bnQgLSAxXTtcbiAgICAgICAgICAgIHJldHVybiBiZWhhdmlvciAmJiBiZWhhdmlvci5pc1ByZXNlbnQoKSA/IGJlaGF2aW9yIDogZ2V0RGVmYXVsdEJlaGF2aW9yKHN0dWJJbnN0YW5jZSk7XG4gICAgICAgIH1cbiAgICAgICAgLyplc2xpbnQtZW5hYmxlIG5vLXVzZS1iZWZvcmUtZGVmaW5lKi9cblxuICAgICAgICB2YXIgdXVpZCA9IDA7XG5cbiAgICAgICAgdmFyIHByb3RvID0ge1xuICAgICAgICAgICAgY3JlYXRlOiBmdW5jdGlvbiBjcmVhdGUoc3R1Ykxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBmdW5jdGlvblN0dWIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRDdXJyZW50QmVoYXZpb3IoZnVuY3Rpb25TdHViKS5pbnZva2UodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TdHViLmlkID0gXCJzdHViI1wiICsgdXVpZCsrO1xuICAgICAgICAgICAgICAgIHZhciBvcmlnID0gZnVuY3Rpb25TdHViO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3R1YiA9IHNpbm9uLnNweS5jcmVhdGUoZnVuY3Rpb25TdHViLCBzdHViTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvblN0dWIuZnVuYyA9IG9yaWc7XG5cbiAgICAgICAgICAgICAgICBzaW5vbi5leHRlbmQoZnVuY3Rpb25TdHViLCBzdHViKTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvblN0dWIuaW5zdGFudGlhdGVGYWtlID0gc2lub24uc3R1Yi5jcmVhdGU7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TdHViLmRpc3BsYXlOYW1lID0gXCJzdHViXCI7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25TdHViLnRvU3RyaW5nID0gc2lub24uZnVuY3Rpb25Ub1N0cmluZztcblxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3R1Yi5kZWZhdWx0QmVoYXZpb3IgPSBudWxsO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uU3R1Yi5iZWhhdmlvcnMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvblN0dWI7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXNldEJlaGF2aW9yOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRCZWhhdmlvciA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5iZWhhdmlvcnMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJldHVyblZhbHVlO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJldHVybkFyZ0F0O1xuICAgICAgICAgICAgICAgIHRoaXMucmV0dXJuVGhpcyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZmFrZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuZmFrZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmFrZXNbaV0ucmVzZXRCZWhhdmlvcigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25DYWxsOiBmdW5jdGlvbiBvbkNhbGwoaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuYmVoYXZpb3JzW2luZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJlaGF2aW9yc1tpbmRleF0gPSBzaW5vbi5iZWhhdmlvci5jcmVhdGUodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYmVoYXZpb3JzW2luZGV4XTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uRmlyc3RDYWxsOiBmdW5jdGlvbiBvbkZpcnN0Q2FsbCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vbkNhbGwoMCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvblNlY29uZENhbGw6IGZ1bmN0aW9uIG9uU2Vjb25kQ2FsbCgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vbkNhbGwoMSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvblRoaXJkQ2FsbDogZnVuY3Rpb24gb25UaGlyZENhbGwoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub25DYWxsKDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGNyZWF0ZUJlaGF2aW9yKGJlaGF2aW9yTWV0aG9kKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEJlaGF2aW9yID0gdGhpcy5kZWZhdWx0QmVoYXZpb3IgfHwgc2lub24uYmVoYXZpb3IuY3JlYXRlKHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEJlaGF2aW9yW2JlaGF2aW9yTWV0aG9kXS5hcHBseSh0aGlzLmRlZmF1bHRCZWhhdmlvciwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBtZXRob2QgaW4gc2lub24uYmVoYXZpb3IpIHtcbiAgICAgICAgICAgIGlmIChzaW5vbi5iZWhhdmlvci5oYXNPd25Qcm9wZXJ0eShtZXRob2QpICYmXG4gICAgICAgICAgICAgICAgIXByb3RvLmhhc093blByb3BlcnR5KG1ldGhvZCkgJiZcbiAgICAgICAgICAgICAgICBtZXRob2QgIT09IFwiY3JlYXRlXCIgJiZcbiAgICAgICAgICAgICAgICBtZXRob2QgIT09IFwid2l0aEFyZ3NcIiAmJlxuICAgICAgICAgICAgICAgIG1ldGhvZCAhPT0gXCJpbnZva2VcIikge1xuICAgICAgICAgICAgICAgIHByb3RvW21ldGhvZF0gPSBjcmVhdGVCZWhhdmlvcihtZXRob2QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2lub24uZXh0ZW5kKHN0dWIsIHByb3RvKTtcbiAgICAgICAgc2lub24uc3R1YiA9IHN0dWI7XG5cbiAgICAgICAgcmV0dXJuIHN0dWI7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9iZWhhdmlvclwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vc3B5XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9leHRlbmRcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShjb3JlKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICogQGRlcGVuZCBzYW5kYm94LmpzXG4gKi9cbi8qKlxuICogVGVzdCBmdW5jdGlvbiwgc2FuZGJveGVzIGZha2VzXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICB2YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbiAgICAgICAgZnVuY3Rpb24gdGVzdChjYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgY2FsbGJhY2s7XG5cbiAgICAgICAgICAgIGlmICh0eXBlICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2lub24udGVzdCBuZWVkcyB0byB3cmFwIGEgdGVzdCBmdW5jdGlvbiwgZ290IFwiICsgdHlwZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIHNpbm9uU2FuZGJveGVkVGVzdCgpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29uZmlnID0gc2lub24uZ2V0Q29uZmlnKHNpbm9uLmNvbmZpZyk7XG4gICAgICAgICAgICAgICAgY29uZmlnLmluamVjdEludG8gPSBjb25maWcuaW5qZWN0SW50b1RoaXMgJiYgdGhpcyB8fCBjb25maWcuaW5qZWN0SW50bztcbiAgICAgICAgICAgICAgICB2YXIgc2FuZGJveCA9IHNpbm9uLnNhbmRib3guY3JlYXRlKGNvbmZpZyk7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgdmFyIG9sZERvbmUgPSBhcmdzLmxlbmd0aCAmJiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgdmFyIGV4Y2VwdGlvbiwgcmVzdWx0O1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvbGREb25lID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJnc1thcmdzLmxlbmd0aCAtIDFdID0gZnVuY3Rpb24gc2lub25Eb25lKHJlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzYW5kYm94LnZlcmlmeUFuZFJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZERvbmUocmVzKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzLmNvbmNhdChzYW5kYm94LmFyZ3MpKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VwdGlvbiA9IGU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvbGREb25lICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBleGNlcHRpb24gIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNhbmRib3gucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2FuZGJveC52ZXJpZnlBbmRSZXN0b3JlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2subGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIHNpbm9uQXN5bmNTYW5kYm94ZWRUZXN0KGRvbmUpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2lub25TYW5kYm94ZWRUZXN0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uU2FuZGJveGVkVGVzdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlc3QuY29uZmlnID0ge1xuICAgICAgICAgICAgaW5qZWN0SW50b1RoaXM6IHRydWUsXG4gICAgICAgICAgICBpbmplY3RJbnRvOiBudWxsLFxuICAgICAgICAgICAgcHJvcGVydGllczogW1wic3B5XCIsIFwic3R1YlwiLCBcIm1vY2tcIiwgXCJjbG9ja1wiLCBcInNlcnZlclwiLCBcInJlcXVlc3RzXCJdLFxuICAgICAgICAgICAgdXNlRmFrZVRpbWVyczogdHJ1ZSxcbiAgICAgICAgICAgIHVzZUZha2VTZXJ2ZXI6IHRydWVcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi50ZXN0ID0gdGVzdDtcbiAgICAgICAgcmV0dXJuIHRlc3Q7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi9zYW5kYm94XCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoY29yZSk7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2UgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgIH0gZWxzZSBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufSh0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gfHwgbnVsbCkpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKiBAZGVwZW5kIHRlc3QuanNcbiAqL1xuLyoqXG4gKiBUZXN0IGNhc2UsIHNhbmRib3hlcyBhbGwgdGVzdCBmdW5jdGlvbnNcbiAqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubylcbiAqIEBsaWNlbnNlIEJTRFxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxMC0yMDEzIENocmlzdGlhbiBKb2hhbnNlblxuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVUZXN0KHByb3BlcnR5LCBzZXRVcCwgdGVhckRvd24pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChzZXRVcCkge1xuICAgICAgICAgICAgICAgIHNldFVwLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBleGNlcHRpb24sIHJlc3VsdDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBwcm9wZXJ0eS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGV4Y2VwdGlvbiA9IGU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZWFyRG93bikge1xuICAgICAgICAgICAgICAgIHRlYXJEb3duLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBmdW5jdGlvbiB0ZXN0Q2FzZSh0ZXN0cywgcHJlZml4KSB7XG4gICAgICAgICAgICBpZiAoIXRlc3RzIHx8IHR5cGVvZiB0ZXN0cyAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJzaW5vbi50ZXN0Q2FzZSBuZWVkcyBhbiBvYmplY3Qgd2l0aCB0ZXN0IGZ1bmN0aW9uc1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcHJlZml4ID0gcHJlZml4IHx8IFwidGVzdFwiO1xuICAgICAgICAgICAgdmFyIHJQcmVmaXggPSBuZXcgUmVnRXhwKFwiXlwiICsgcHJlZml4KTtcbiAgICAgICAgICAgIHZhciBtZXRob2RzID0ge307XG4gICAgICAgICAgICB2YXIgc2V0VXAgPSB0ZXN0cy5zZXRVcDtcbiAgICAgICAgICAgIHZhciB0ZWFyRG93biA9IHRlc3RzLnRlYXJEb3duO1xuICAgICAgICAgICAgdmFyIHRlc3ROYW1lLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5LFxuICAgICAgICAgICAgICAgIG1ldGhvZDtcblxuICAgICAgICAgICAgZm9yICh0ZXN0TmFtZSBpbiB0ZXN0cykge1xuICAgICAgICAgICAgICAgIGlmICh0ZXN0cy5oYXNPd25Qcm9wZXJ0eSh0ZXN0TmFtZSkgJiYgIS9eKHNldFVwfHRlYXJEb3duKSQvLnRlc3QodGVzdE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5ID0gdGVzdHNbdGVzdE5hbWVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHkgPT09IFwiZnVuY3Rpb25cIiAmJiByUHJlZml4LnRlc3QodGVzdE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2QgPSBwcm9wZXJ0eTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNldFVwIHx8IHRlYXJEb3duKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kID0gY3JlYXRlVGVzdChwcm9wZXJ0eSwgc2V0VXAsIHRlYXJEb3duKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kc1t0ZXN0TmFtZV0gPSBzaW5vbi50ZXN0KG1ldGhvZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2RzW3Rlc3ROYW1lXSA9IHRlc3RzW3Rlc3ROYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1ldGhvZHM7XG4gICAgICAgIH1cblxuICAgICAgICBzaW5vbi50ZXN0Q2FzZSA9IHRlc3RDYXNlO1xuICAgICAgICByZXR1cm4gdGVzdENhc2U7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICByZXF1aXJlKFwiLi90ZXN0XCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoY29yZSk7XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCB1dGlsL2NvcmUuanNcbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuXG4gICAgICAgIGZ1bmN0aW9uIHRpbWVzSW5Xb3Jkcyhjb3VudCkge1xuICAgICAgICAgICAgc3dpdGNoIChjb3VudCkge1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwib25jZVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwidHdpY2VcIjtcbiAgICAgICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcInRocmljZVwiO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoY291bnQgfHwgMCkgKyBcIiB0aW1lc1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2lub24udGltZXNJbldvcmRzID0gdGltZXNJbldvcmRzO1xuICAgICAgICByZXR1cm4gc2lub24udGltZXNJbldvcmRzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vdXRpbC9jb3JlXCIpO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IG1ha2VBcGkoY29yZSk7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgdXRpbC9jb3JlLmpzXG4gKi9cbi8qKlxuICogRm9ybWF0IGZ1bmN0aW9uc1xuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTQgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgZnVuY3Rpb24gdHlwZU9mKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJudWxsXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJ1bmRlZmluZWRcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBzdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZy5zdWJzdHJpbmcoOCwgc3RyaW5nLmxlbmd0aCAtIDEpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBzaW5vbi50eXBlT2YgPSB0eXBlT2Y7XG4gICAgICAgIHJldHVybiBzaW5vbi50eXBlT2Y7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIGNvcmUgPSByZXF1aXJlKFwiLi91dGlsL2NvcmVcIik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbWFrZUFwaShjb3JlKTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIi8qKlxuICogQGRlcGVuZCAuLi8uLi9zaW5vbi5qc1xuICovXG4vKipcbiAqIFNpbm9uIGNvcmUgdXRpbGl0aWVzLiBGb3IgaW50ZXJuYWwgdXNlIG9ubHkuXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uIChzaW5vbkdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIGRpdiA9IHR5cGVvZiBkb2N1bWVudCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4gICAgZnVuY3Rpb24gaXNET01Ob2RlKG9iaikge1xuICAgICAgICB2YXIgc3VjY2VzcyA9IGZhbHNlO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBvYmouYXBwZW5kQ2hpbGQoZGl2KTtcbiAgICAgICAgICAgIHN1Y2Nlc3MgPSBkaXYucGFyZW50Tm9kZSA9PT0gb2JqO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG9iai5yZW1vdmVDaGlsZChkaXYpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBmYWlsZWQsIG5vdCBtdWNoIHdlIGNhbiBkbyBhYm91dCB0aGF0XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3VjY2VzcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0VsZW1lbnQob2JqKSB7XG4gICAgICAgIHJldHVybiBkaXYgJiYgb2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMSAmJiBpc0RPTU5vZGUob2JqKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0Z1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gXCJmdW5jdGlvblwiIHx8ICEhKG9iaiAmJiBvYmouY29uc3RydWN0b3IgJiYgb2JqLmNhbGwgJiYgb2JqLmFwcGx5KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1JlYWxseU5hTih2YWwpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09IFwibnVtYmVyXCIgJiYgaXNOYU4odmFsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtaXJyb3JQcm9wZXJ0aWVzKHRhcmdldCwgc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoIWhhc093bi5jYWxsKHRhcmdldCwgcHJvcCkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1Jlc3RvcmFibGUob2JqKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIG9iai5yZXN0b3JlID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLnJlc3RvcmUuc2lub247XG4gICAgfVxuXG4gICAgLy8gQ2hlYXAgd2F5IHRvIGRldGVjdCBpZiB3ZSBoYXZlIEVTNSBzdXBwb3J0LlxuICAgIHZhciBoYXNFUzVTdXBwb3J0ID0gXCJrZXlzXCIgaW4gT2JqZWN0O1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBzaW5vbi53cmFwTWV0aG9kID0gZnVuY3Rpb24gd3JhcE1ldGhvZChvYmplY3QsIHByb3BlcnR5LCBtZXRob2QpIHtcbiAgICAgICAgICAgIGlmICghb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlNob3VsZCB3cmFwIHByb3BlcnR5IG9mIG9iamVjdFwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXRob2QgIT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgbWV0aG9kICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk1ldGhvZCB3cmFwcGVyIHNob3VsZCBiZSBhIGZ1bmN0aW9uIG9yIGEgcHJvcGVydHkgZGVzY3JpcHRvclwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gY2hlY2tXcmFwcGVkTWV0aG9kKHdyYXBwZWRNZXRob2QpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3I7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWlzRnVuY3Rpb24od3JhcHBlZE1ldGhvZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQXR0ZW1wdGVkIHRvIHdyYXAgXCIgKyAodHlwZW9mIHdyYXBwZWRNZXRob2QpICsgXCIgcHJvcGVydHkgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5ICsgXCIgYXMgZnVuY3Rpb25cIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh3cmFwcGVkTWV0aG9kLnJlc3RvcmUgJiYgd3JhcHBlZE1ldGhvZC5yZXN0b3JlLnNpbm9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gbmV3IFR5cGVFcnJvcihcIkF0dGVtcHRlZCB0byB3cmFwIFwiICsgcHJvcGVydHkgKyBcIiB3aGljaCBpcyBhbHJlYWR5IHdyYXBwZWRcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh3cmFwcGVkTWV0aG9kLmNhbGxlZEJlZm9yZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdmVyYiA9IHdyYXBwZWRNZXRob2QucmV0dXJucyA/IFwic3R1YmJlZFwiIDogXCJzcGllZCBvblwiO1xuICAgICAgICAgICAgICAgICAgICBlcnJvciA9IG5ldyBUeXBlRXJyb3IoXCJBdHRlbXB0ZWQgdG8gd3JhcCBcIiArIHByb3BlcnR5ICsgXCIgd2hpY2ggaXMgYWxyZWFkeSBcIiArIHZlcmIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAod3JhcHBlZE1ldGhvZCAmJiB3cmFwcGVkTWV0aG9kLnN0YWNrVHJhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yLnN0YWNrICs9IFwiXFxuLS0tLS0tLS0tLS0tLS1cXG5cIiArIHdyYXBwZWRNZXRob2Quc3RhY2tUcmFjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBlcnJvciwgd3JhcHBlZE1ldGhvZCwgaTtcblxuICAgICAgICAgICAgLy8gSUUgOCBkb2VzIG5vdCBzdXBwb3J0IGhhc093blByb3BlcnR5IG9uIHRoZSB3aW5kb3cgb2JqZWN0IGFuZCBGaXJlZm94IGhhcyBhIHByb2JsZW1cbiAgICAgICAgICAgIC8vIHdoZW4gdXNpbmcgaGFzT3duLmNhbGwgb24gb2JqZWN0cyBmcm9tIG90aGVyIGZyYW1lcy5cbiAgICAgICAgICAgIHZhciBvd25lZCA9IG9iamVjdC5oYXNPd25Qcm9wZXJ0eSA/IG9iamVjdC5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkgOiBoYXNPd24uY2FsbChvYmplY3QsIHByb3BlcnR5KTtcblxuICAgICAgICAgICAgaWYgKGhhc0VTNVN1cHBvcnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbWV0aG9kRGVzYyA9ICh0eXBlb2YgbWV0aG9kID09PSBcImZ1bmN0aW9uXCIpID8ge3ZhbHVlOiBtZXRob2R9IDogbWV0aG9kO1xuICAgICAgICAgICAgICAgIHZhciB3cmFwcGVkTWV0aG9kRGVzYyA9IHNpbm9uLmdldFByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIHByb3BlcnR5KTtcblxuICAgICAgICAgICAgICAgIGlmICghd3JhcHBlZE1ldGhvZERlc2MpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQXR0ZW1wdGVkIHRvIHdyYXAgXCIgKyAodHlwZW9mIHdyYXBwZWRNZXRob2QpICsgXCIgcHJvcGVydHkgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5ICsgXCIgYXMgZnVuY3Rpb25cIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh3cmFwcGVkTWV0aG9kRGVzYy5yZXN0b3JlICYmIHdyYXBwZWRNZXRob2REZXNjLnJlc3RvcmUuc2lub24pIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQXR0ZW1wdGVkIHRvIHdyYXAgXCIgKyBwcm9wZXJ0eSArIFwiIHdoaWNoIGlzIGFscmVhZHkgd3JhcHBlZFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh3cmFwcGVkTWV0aG9kRGVzYyAmJiB3cmFwcGVkTWV0aG9kRGVzYy5zdGFja1RyYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvci5zdGFjayArPSBcIlxcbi0tLS0tLS0tLS0tLS0tXFxuXCIgKyB3cmFwcGVkTWV0aG9kRGVzYy5zdGFja1RyYWNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciB0eXBlcyA9IHNpbm9uLm9iamVjdEtleXMobWV0aG9kRGVzYyk7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRNZXRob2QgPSB3cmFwcGVkTWV0aG9kRGVzY1t0eXBlc1tpXV07XG4gICAgICAgICAgICAgICAgICAgIGNoZWNrV3JhcHBlZE1ldGhvZCh3cmFwcGVkTWV0aG9kKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtaXJyb3JQcm9wZXJ0aWVzKG1ldGhvZERlc2MsIHdyYXBwZWRNZXRob2REZXNjKTtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlycm9yUHJvcGVydGllcyhtZXRob2REZXNjW3R5cGVzW2ldXSwgd3JhcHBlZE1ldGhvZERlc2NbdHlwZXNbaV1dKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIG1ldGhvZERlc2MpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3cmFwcGVkTWV0aG9kID0gb2JqZWN0W3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICBjaGVja1dyYXBwZWRNZXRob2Qod3JhcHBlZE1ldGhvZCk7XG4gICAgICAgICAgICAgICAgb2JqZWN0W3Byb3BlcnR5XSA9IG1ldGhvZDtcbiAgICAgICAgICAgICAgICBtZXRob2QuZGlzcGxheU5hbWUgPSBwcm9wZXJ0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWV0aG9kLmRpc3BsYXlOYW1lID0gcHJvcGVydHk7XG5cbiAgICAgICAgICAgIC8vIFNldCB1cCBhIHN0YWNrIHRyYWNlIHdoaWNoIGNhbiBiZSB1c2VkIGxhdGVyIHRvIGZpbmQgd2hhdCBsaW5lIG9mXG4gICAgICAgICAgICAvLyBjb2RlIHRoZSBvcmlnaW5hbCBtZXRob2Qgd2FzIGNyZWF0ZWQgb24uXG4gICAgICAgICAgICBtZXRob2Quc3RhY2tUcmFjZSA9IChuZXcgRXJyb3IoXCJTdGFjayBUcmFjZSBmb3Igb3JpZ2luYWxcIikpLnN0YWNrO1xuXG4gICAgICAgICAgICBtZXRob2QucmVzdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyBGb3IgcHJvdG90eXBlIHByb3BlcnRpZXMgdHJ5IHRvIHJlc2V0IGJ5IGRlbGV0ZSBmaXJzdC5cbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGZhaWxzIChleDogbG9jYWxTdG9yYWdlIG9uIG1vYmlsZSBzYWZhcmkpIHRoZW4gZm9yY2UgYSByZXNldFxuICAgICAgICAgICAgICAgIC8vIHZpYSBkaXJlY3QgYXNzaWdubWVudC5cbiAgICAgICAgICAgICAgICBpZiAoIW93bmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEluIHNvbWUgY2FzZXMgYGRlbGV0ZWAgbWF5IHRocm93IGFuIGVycm9yXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgb2JqZWN0W3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1lbXB0eVxuICAgICAgICAgICAgICAgICAgICAvLyBGb3IgbmF0aXZlIGNvZGUgZnVuY3Rpb25zIGBkZWxldGVgIGZhaWxzIHdpdGhvdXQgdGhyb3dpbmcgYW4gZXJyb3JcbiAgICAgICAgICAgICAgICAgICAgLy8gb24gQ2hyb21lIDwgNDMsIFBoYW50b21KUywgZXRjLlxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaGFzRVM1U3VwcG9ydCkge1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgd3JhcHBlZE1ldGhvZERlc2MpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFVzZSBzdHJpY3QgZXF1YWxpdHkgY29tcGFyaXNvbiB0byBjaGVjayBmYWlsdXJlcyB0aGVuIGZvcmNlIGEgcmVzZXRcbiAgICAgICAgICAgICAgICAvLyB2aWEgZGlyZWN0IGFzc2lnbm1lbnQuXG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdFtwcm9wZXJ0eV0gPT09IG1ldGhvZCkge1xuICAgICAgICAgICAgICAgICAgICBvYmplY3RbcHJvcGVydHldID0gd3JhcHBlZE1ldGhvZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBtZXRob2QucmVzdG9yZS5zaW5vbiA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICghaGFzRVM1U3VwcG9ydCkge1xuICAgICAgICAgICAgICAgIG1pcnJvclByb3BlcnRpZXMobWV0aG9kLCB3cmFwcGVkTWV0aG9kKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1ldGhvZDtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUocHJvdG8pIHtcbiAgICAgICAgICAgIHZhciBGID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICBGLnByb3RvdHlwZSA9IHByb3RvO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBGKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZGVlcEVxdWFsID0gZnVuY3Rpb24gZGVlcEVxdWFsKGEsIGIpIHtcbiAgICAgICAgICAgIGlmIChzaW5vbi5tYXRjaCAmJiBzaW5vbi5tYXRjaC5pc01hdGNoZXIoYSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS50ZXN0KGIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGEgIT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGIgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNSZWFsbHlOYU4oYSkgJiYgaXNSZWFsbHlOYU4oYikgfHwgYSA9PT0gYjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzRWxlbWVudChhKSB8fCBpc0VsZW1lbnQoYikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYSA9PT0gYjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGEgPT09IGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKChhID09PSBudWxsICYmIGIgIT09IG51bGwpIHx8IChhICE9PSBudWxsICYmIGIgPT09IG51bGwpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYSBpbnN0YW5jZW9mIFJlZ0V4cCAmJiBiIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChhLnNvdXJjZSA9PT0gYi5zb3VyY2UpICYmIChhLmdsb2JhbCA9PT0gYi5nbG9iYWwpICYmXG4gICAgICAgICAgICAgICAgICAgIChhLmlnbm9yZUNhc2UgPT09IGIuaWdub3JlQ2FzZSkgJiYgKGEubXVsdGlsaW5lID09PSBiLm11bHRpbGluZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBhU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGEpO1xuICAgICAgICAgICAgaWYgKGFTdHJpbmcgIT09IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChiKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFTdHJpbmcgPT09IFwiW29iamVjdCBEYXRlXVwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEudmFsdWVPZigpID09PSBiLnZhbHVlT2YoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHByb3A7XG4gICAgICAgICAgICB2YXIgYUxlbmd0aCA9IDA7XG4gICAgICAgICAgICB2YXIgYkxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgIGlmIChhU3RyaW5nID09PSBcIltvYmplY3QgQXJyYXldXCIgJiYgYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKHByb3AgaW4gYSkge1xuICAgICAgICAgICAgICAgIGlmIChhLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIGFMZW5ndGggKz0gMTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwcm9wIGluIGIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRlZXBFcXVhbChhW3Byb3BdLCBiW3Byb3BdKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKHByb3AgaW4gYikge1xuICAgICAgICAgICAgICAgIGlmIChiLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIGJMZW5ndGggKz0gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBhTGVuZ3RoID09PSBiTGVuZ3RoO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLmZ1bmN0aW9uTmFtZSA9IGZ1bmN0aW9uIGZ1bmN0aW9uTmFtZShmdW5jKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IGZ1bmMuZGlzcGxheU5hbWUgfHwgZnVuYy5uYW1lO1xuXG4gICAgICAgICAgICAvLyBVc2UgZnVuY3Rpb24gZGVjb21wb3NpdGlvbiBhcyBhIGxhc3QgcmVzb3J0IHRvIGdldCBmdW5jdGlvblxuICAgICAgICAgICAgLy8gbmFtZS4gRG9lcyBub3QgcmVseSBvbiBmdW5jdGlvbiBkZWNvbXBvc2l0aW9uIHRvIHdvcmsgLSBpZiBpdFxuICAgICAgICAgICAgLy8gZG9lc24ndCBkZWJ1Z2dpbmcgd2lsbCBiZSBzbGlnaHRseSBsZXNzIGluZm9ybWF0aXZlXG4gICAgICAgICAgICAvLyAoaS5lLiB0b1N0cmluZyB3aWxsIHNheSAnc3B5JyByYXRoZXIgdGhhbiAnbXlGdW5jJykuXG4gICAgICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IGZ1bmMudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb24gKFteXFxzXFwoXSspLyk7XG4gICAgICAgICAgICAgICAgbmFtZSA9IG1hdGNoZXMgJiYgbWF0Y2hlc1sxXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZnVuY3Rpb25Ub1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZ2V0Q2FsbCAmJiB0aGlzLmNhbGxDb3VudCkge1xuICAgICAgICAgICAgICAgIHZhciB0aGlzVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHByb3A7XG4gICAgICAgICAgICAgICAgdmFyIGkgPSB0aGlzLmNhbGxDb3VudDtcblxuICAgICAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1ZhbHVlID0gdGhpcy5nZXRDYWxsKGkpLnRoaXNWYWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHByb3AgaW4gdGhpc1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpc1ZhbHVlW3Byb3BdID09PSB0aGlzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3A7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpc3BsYXlOYW1lIHx8IFwic2lub24gZmFrZVwiO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLm9iamVjdEtleXMgPSBmdW5jdGlvbiBvYmplY3RLZXlzKG9iaikge1xuICAgICAgICAgICAgaWYgKG9iaiAhPT0gT2JqZWN0KG9iaikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2lub24ub2JqZWN0S2V5cyBjYWxsZWQgb24gYSBub24tb2JqZWN0XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIga2V5cyA9IFtdO1xuICAgICAgICAgICAgdmFyIGtleTtcbiAgICAgICAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5cy5wdXNoKGtleSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ga2V5cztcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5nZXRQcm9wZXJ0eURlc2NyaXB0b3IgPSBmdW5jdGlvbiBnZXRQcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgICAgICAgICAgdmFyIHByb3RvID0gb2JqZWN0O1xuICAgICAgICAgICAgdmFyIGRlc2NyaXB0b3I7XG5cbiAgICAgICAgICAgIHdoaWxlIChwcm90byAmJiAhKGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHByb3RvLCBwcm9wZXJ0eSkpKSB7XG4gICAgICAgICAgICAgICAgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG8pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRlc2NyaXB0b3I7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZ2V0Q29uZmlnID0gZnVuY3Rpb24gKGN1c3RvbSkge1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHt9O1xuICAgICAgICAgICAgY3VzdG9tID0gY3VzdG9tIHx8IHt9O1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRzID0gc2lub24uZGVmYXVsdENvbmZpZztcblxuICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBkZWZhdWx0cykge1xuICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0cy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25maWdbcHJvcF0gPSBjdXN0b20uaGFzT3duUHJvcGVydHkocHJvcCkgPyBjdXN0b21bcHJvcF0gOiBkZWZhdWx0c1twcm9wXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb25maWc7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZGVmYXVsdENvbmZpZyA9IHtcbiAgICAgICAgICAgIGluamVjdEludG9UaGlzOiB0cnVlLFxuICAgICAgICAgICAgaW5qZWN0SW50bzogbnVsbCxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IFtcInNweVwiLCBcInN0dWJcIiwgXCJtb2NrXCIsIFwiY2xvY2tcIiwgXCJzZXJ2ZXJcIiwgXCJyZXF1ZXN0c1wiXSxcbiAgICAgICAgICAgIHVzZUZha2VUaW1lcnM6IHRydWUsXG4gICAgICAgICAgICB1c2VGYWtlU2VydmVyOiB0cnVlXG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24udGltZXNJbldvcmRzID0gZnVuY3Rpb24gdGltZXNJbldvcmRzKGNvdW50KSB7XG4gICAgICAgICAgICByZXR1cm4gY291bnQgPT09IDEgJiYgXCJvbmNlXCIgfHxcbiAgICAgICAgICAgICAgICBjb3VudCA9PT0gMiAmJiBcInR3aWNlXCIgfHxcbiAgICAgICAgICAgICAgICBjb3VudCA9PT0gMyAmJiBcInRocmljZVwiIHx8XG4gICAgICAgICAgICAgICAgKGNvdW50IHx8IDApICsgXCIgdGltZXNcIjtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5jYWxsZWRJbk9yZGVyID0gZnVuY3Rpb24gKHNwaWVzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMSwgbCA9IHNwaWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghc3BpZXNbaSAtIDFdLmNhbGxlZEJlZm9yZShzcGllc1tpXSkgfHwgIXNwaWVzW2ldLmNhbGxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5vcmRlckJ5Rmlyc3RDYWxsID0gZnVuY3Rpb24gKHNwaWVzKSB7XG4gICAgICAgICAgICByZXR1cm4gc3BpZXMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIC8vIHV1aWQsIHdvbid0IGV2ZXIgYmUgZXF1YWxcbiAgICAgICAgICAgICAgICB2YXIgYUNhbGwgPSBhLmdldENhbGwoMCk7XG4gICAgICAgICAgICAgICAgdmFyIGJDYWxsID0gYi5nZXRDYWxsKDApO1xuICAgICAgICAgICAgICAgIHZhciBhSWQgPSBhQ2FsbCAmJiBhQ2FsbC5jYWxsSWQgfHwgLTE7XG4gICAgICAgICAgICAgICAgdmFyIGJJZCA9IGJDYWxsICYmIGJDYWxsLmNhbGxJZCB8fCAtMTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBhSWQgPCBiSWQgPyAtMSA6IDE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5jcmVhdGVTdHViSW5zdGFuY2UgPSBmdW5jdGlvbiAoY29uc3RydWN0b3IpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY29uc3RydWN0b3IgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGUgY29uc3RydWN0b3Igc2hvdWxkIGJlIGEgZnVuY3Rpb24uXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uLnN0dWIoc2lub24uY3JlYXRlKGNvbnN0cnVjdG9yLnByb3RvdHlwZSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLnJlc3RvcmUgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0ICE9PSBudWxsICYmIHR5cGVvZiBvYmplY3QgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNSZXN0b3JhYmxlKG9iamVjdFtwcm9wXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFtwcm9wXS5yZXN0b3JlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzUmVzdG9yYWJsZShvYmplY3QpKSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0LnJlc3RvcmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gc2lub247XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cykge1xuICAgICAgICBtYWtlQXBpKGV4cG9ydHMpO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2lub25HbG9iYWwpIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbkdsb2JhbCk7XG4gICAgfVxufShcbiAgICB0eXBlb2Ygc2lub24gPT09IFwib2JqZWN0XCIgJiYgc2lub24gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuKSk7XG4iLCIvKipcbiAqIE1pbmltYWwgRXZlbnQgaW50ZXJmYWNlIGltcGxlbWVudGF0aW9uXG4gKlxuICogT3JpZ2luYWwgaW1wbGVtZW50YXRpb24gYnkgU3ZlbiBGdWNoczogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vOTk1MDI4XG4gKiBNb2RpZmljYXRpb25zIGFuZCB0ZXN0cyBieSBDaHJpc3RpYW4gSm9oYW5zZW4uXG4gKlxuICogQGF1dGhvciBTdmVuIEZ1Y2hzIChzdmVuZnVjaHNAYXJ0d2ViLWRlc2lnbi5kZSlcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDExIFN2ZW4gRnVjaHMsIENocmlzdGlhbiBKb2hhbnNlblxuICovXG5pZiAodHlwZW9mIHNpbm9uID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgdGhpcy5zaW5vbiA9IHt9O1xufVxuXG4oZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHB1c2ggPSBbXS5wdXNoO1xuXG4gICAgZnVuY3Rpb24gbWFrZUFwaShzaW5vbikge1xuICAgICAgICBzaW5vbi5FdmVudCA9IGZ1bmN0aW9uIEV2ZW50KHR5cGUsIGJ1YmJsZXMsIGNhbmNlbGFibGUsIHRhcmdldCkge1xuICAgICAgICAgICAgdGhpcy5pbml0RXZlbnQodHlwZSwgYnViYmxlcywgY2FuY2VsYWJsZSwgdGFyZ2V0KTtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5FdmVudC5wcm90b3R5cGUgPSB7XG4gICAgICAgICAgICBpbml0RXZlbnQ6IGZ1bmN0aW9uICh0eXBlLCBidWJibGVzLCBjYW5jZWxhYmxlLCB0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgICAgIHRoaXMuYnViYmxlcyA9IGJ1YmJsZXM7XG4gICAgICAgICAgICAgICAgdGhpcy5jYW5jZWxhYmxlID0gY2FuY2VsYWJsZTtcbiAgICAgICAgICAgICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHN0b3BQcm9wYWdhdGlvbjogZnVuY3Rpb24gKCkge30sXG5cbiAgICAgICAgICAgIHByZXZlbnREZWZhdWx0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0UHJldmVudGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5Qcm9ncmVzc0V2ZW50ID0gZnVuY3Rpb24gUHJvZ3Jlc3NFdmVudCh0eXBlLCBwcm9ncmVzc0V2ZW50UmF3LCB0YXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdEV2ZW50KHR5cGUsIGZhbHNlLCBmYWxzZSwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkID0gcHJvZ3Jlc3NFdmVudFJhdy5sb2FkZWQgfHwgbnVsbDtcbiAgICAgICAgICAgIHRoaXMudG90YWwgPSBwcm9ncmVzc0V2ZW50UmF3LnRvdGFsIHx8IG51bGw7XG4gICAgICAgICAgICB0aGlzLmxlbmd0aENvbXB1dGFibGUgPSAhIXByb2dyZXNzRXZlbnRSYXcudG90YWw7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uUHJvZ3Jlc3NFdmVudC5wcm90b3R5cGUgPSBuZXcgc2lub24uRXZlbnQoKTtcblxuICAgICAgICBzaW5vbi5Qcm9ncmVzc0V2ZW50LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IHNpbm9uLlByb2dyZXNzRXZlbnQ7XG5cbiAgICAgICAgc2lub24uQ3VzdG9tRXZlbnQgPSBmdW5jdGlvbiBDdXN0b21FdmVudCh0eXBlLCBjdXN0b21EYXRhLCB0YXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdEV2ZW50KHR5cGUsIGZhbHNlLCBmYWxzZSwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHRoaXMuZGV0YWlsID0gY3VzdG9tRGF0YS5kZXRhaWwgfHwgbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5DdXN0b21FdmVudC5wcm90b3R5cGUgPSBuZXcgc2lub24uRXZlbnQoKTtcblxuICAgICAgICBzaW5vbi5DdXN0b21FdmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBzaW5vbi5DdXN0b21FdmVudDtcblxuICAgICAgICBzaW5vbi5FdmVudFRhcmdldCA9IHtcbiAgICAgICAgICAgIGFkZEV2ZW50TGlzdGVuZXI6IGZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycyA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMgfHwge307XG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudExpc3RlbmVyc1tldmVudF0gPSB0aGlzLmV2ZW50TGlzdGVuZXJzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5ldmVudExpc3RlbmVyc1tldmVudF0sIGxpc3RlbmVyKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlbW92ZUV2ZW50TGlzdGVuZXI6IGZ1bmN0aW9uIHJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuZXZlbnRMaXN0ZW5lcnMgJiYgdGhpcy5ldmVudExpc3RlbmVyc1tldmVudF0gfHwgW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpc3RlbmVyc1tpXSA9PT0gbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZGlzcGF0Y2hFdmVudDogZnVuY3Rpb24gZGlzcGF0Y2hFdmVudChldmVudCkge1xuICAgICAgICAgICAgICAgIHZhciB0eXBlID0gZXZlbnQudHlwZTtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5ldmVudExpc3RlbmVycyAmJiB0aGlzLmV2ZW50TGlzdGVuZXJzW3R5cGVdIHx8IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBsaXN0ZW5lcnNbaV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXJzW2ldLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXJzW2ldLmhhbmRsZUV2ZW50KGV2ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiAhIWV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSkge1xuICAgICAgICB2YXIgc2lub24gPSByZXF1aXJlKFwiLi9jb3JlXCIpO1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICB9XG59KCkpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIGZha2VfeGRvbWFpbl9yZXF1ZXN0LmpzXG4gKiBAZGVwZW5kIGZha2VfeG1sX2h0dHBfcmVxdWVzdC5qc1xuICogQGRlcGVuZCAuLi9mb3JtYXQuanNcbiAqIEBkZXBlbmQgLi4vbG9nX2Vycm9yLmpzXG4gKi9cbi8qKlxuICogVGhlIFNpbm9uIFwic2VydmVyXCIgbWltaWNzIGEgd2ViIHNlcnZlciB0aGF0IHJlY2VpdmVzIHJlcXVlc3RzIGZyb21cbiAqIHNpbm9uLkZha2VYTUxIdHRwUmVxdWVzdCBhbmQgcHJvdmlkZXMgYW4gQVBJIHRvIHJlc3BvbmQgdG8gdGhvc2UgcmVxdWVzdHMsXG4gKiBib3RoIHN5bmNocm9ub3VzbHkgYW5kIGFzeW5jaHJvbm91c2x5LiBUbyByZXNwb25kIHN5bmNocm9udW91c2x5LCBjYW5uZWRcbiAqIGFuc3dlcnMgaGF2ZSB0byBiZSBwcm92aWRlZCB1cGZyb250LlxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgcHVzaCA9IFtdLnB1c2g7XG5cbiAgICBmdW5jdGlvbiByZXNwb25zZUFycmF5KGhhbmRsZXIpIHtcbiAgICAgICAgdmFyIHJlc3BvbnNlID0gaGFuZGxlcjtcblxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGhhbmRsZXIpICE9PSBcIltvYmplY3QgQXJyYXldXCIpIHtcbiAgICAgICAgICAgIHJlc3BvbnNlID0gWzIwMCwge30sIGhhbmRsZXJdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiByZXNwb25zZVsyXSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZha2Ugc2VydmVyIHJlc3BvbnNlIGJvZHkgc2hvdWxkIGJlIHN0cmluZywgYnV0IHdhcyBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiByZXNwb25zZVsyXSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfVxuXG4gICAgdmFyIHdsb2MgPSB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LmxvY2F0aW9uIDoge307XG4gICAgdmFyIHJDdXJyTG9jID0gbmV3IFJlZ0V4cChcIl5cIiArIHdsb2MucHJvdG9jb2wgKyBcIi8vXCIgKyB3bG9jLmhvc3QpO1xuXG4gICAgZnVuY3Rpb24gbWF0Y2hPbmUocmVzcG9uc2UsIHJlcU1ldGhvZCwgcmVxVXJsKSB7XG4gICAgICAgIHZhciBybWV0aCA9IHJlc3BvbnNlLm1ldGhvZDtcbiAgICAgICAgdmFyIG1hdGNoTWV0aG9kID0gIXJtZXRoIHx8IHJtZXRoLnRvTG93ZXJDYXNlKCkgPT09IHJlcU1ldGhvZC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB2YXIgdXJsID0gcmVzcG9uc2UudXJsO1xuICAgICAgICB2YXIgbWF0Y2hVcmwgPSAhdXJsIHx8IHVybCA9PT0gcmVxVXJsIHx8ICh0eXBlb2YgdXJsLnRlc3QgPT09IFwiZnVuY3Rpb25cIiAmJiB1cmwudGVzdChyZXFVcmwpKTtcblxuICAgICAgICByZXR1cm4gbWF0Y2hNZXRob2QgJiYgbWF0Y2hVcmw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWF0Y2gocmVzcG9uc2UsIHJlcXVlc3QpIHtcbiAgICAgICAgdmFyIHJlcXVlc3RVcmwgPSByZXF1ZXN0LnVybDtcblxuICAgICAgICBpZiAoIS9eaHR0cHM/OlxcL1xcLy8udGVzdChyZXF1ZXN0VXJsKSB8fCByQ3VyckxvYy50ZXN0KHJlcXVlc3RVcmwpKSB7XG4gICAgICAgICAgICByZXF1ZXN0VXJsID0gcmVxdWVzdFVybC5yZXBsYWNlKHJDdXJyTG9jLCBcIlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtYXRjaE9uZShyZXNwb25zZSwgdGhpcy5nZXRIVFRQTWV0aG9kKHJlcXVlc3QpLCByZXF1ZXN0VXJsKSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByZXNwb25zZS5yZXNwb25zZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJ1ID0gcmVzcG9uc2UudXJsO1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gW3JlcXVlc3RdLmNvbmNhdChydSAmJiB0eXBlb2YgcnUuZXhlYyA9PT0gXCJmdW5jdGlvblwiID8gcnUuZXhlYyhyZXF1ZXN0VXJsKS5zbGljZSgxKSA6IFtdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UucmVzcG9uc2UuYXBwbHkocmVzcG9uc2UsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHNpbm9uLmZha2VTZXJ2ZXIgPSB7XG4gICAgICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uIChjb25maWcpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VydmVyID0gc2lub24uY3JlYXRlKHRoaXMpO1xuICAgICAgICAgICAgICAgIHNlcnZlci5jb25maWd1cmUoY29uZmlnKTtcbiAgICAgICAgICAgICAgICBpZiAoIXNpbm9uLnhoci5zdXBwb3J0c0NPUlMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy54aHIgPSBzaW5vbi51c2VGYWtlWERvbWFpblJlcXVlc3QoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnhociA9IHNpbm9uLnVzZUZha2VYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzZXJ2ZXIucmVxdWVzdHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHRoaXMueGhyLm9uQ3JlYXRlID0gZnVuY3Rpb24gKHhock9iaikge1xuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIuYWRkUmVxdWVzdCh4aHJPYmopO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gc2VydmVyO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyZTogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICAgICAgICAgIHZhciB3aGl0ZWxpc3QgPSB7XG4gICAgICAgICAgICAgICAgICAgIFwiYXV0b1Jlc3BvbmRcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJhdXRvUmVzcG9uZEFmdGVyXCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwicmVzcG9uZEltbWVkaWF0ZWx5XCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwiZmFrZUhUVFBNZXRob2RzXCI6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHZhciBzZXR0aW5nO1xuXG4gICAgICAgICAgICAgICAgY29uZmlnID0gY29uZmlnIHx8IHt9O1xuICAgICAgICAgICAgICAgIGZvciAoc2V0dGluZyBpbiBjb25maWcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHdoaXRlbGlzdC5oYXNPd25Qcm9wZXJ0eShzZXR0aW5nKSAmJiBjb25maWcuaGFzT3duUHJvcGVydHkoc2V0dGluZykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNbc2V0dGluZ10gPSBjb25maWdbc2V0dGluZ107XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYWRkUmVxdWVzdDogZnVuY3Rpb24gYWRkUmVxdWVzdCh4aHJPYmopIHtcbiAgICAgICAgICAgICAgICB2YXIgc2VydmVyID0gdGhpcztcbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5yZXF1ZXN0cywgeGhyT2JqKTtcblxuICAgICAgICAgICAgICAgIHhock9iai5vblNlbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlcnZlci5oYW5kbGVSZXF1ZXN0KHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXIucmVzcG9uZEltbWVkaWF0ZWx5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXIucmVzcG9uZCgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNlcnZlci5hdXRvUmVzcG9uZCAmJiAhc2VydmVyLnJlc3BvbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5yZXNwb25kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLnJlc3BvbmQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIHNlcnZlci5hdXRvUmVzcG9uZEFmdGVyIHx8IDEwKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLnJlc3BvbmRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGdldEhUVFBNZXRob2Q6IGZ1bmN0aW9uIGdldEhUVFBNZXRob2QocmVxdWVzdCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZha2VIVFRQTWV0aG9kcyAmJiAvcG9zdC9pLnRlc3QocmVxdWVzdC5tZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaGVzID0gKHJlcXVlc3QucmVxdWVzdEJvZHkgfHwgXCJcIikubWF0Y2goL19tZXRob2Q9KFteXFxiO10rKS8pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2hlcyA/IG1hdGNoZXNbMV0gOiByZXF1ZXN0Lm1ldGhvZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVxdWVzdC5tZXRob2Q7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBoYW5kbGVSZXF1ZXN0OiBmdW5jdGlvbiBoYW5kbGVSZXF1ZXN0KHhocikge1xuICAgICAgICAgICAgICAgIGlmICh4aHIuYXN5bmMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnF1ZXVlID0gW107XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5xdWV1ZSwgeGhyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXF1ZXN0KHhocik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgbG9nOiBmdW5jdGlvbiBsb2cocmVzcG9uc2UsIHJlcXVlc3QpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RyO1xuXG4gICAgICAgICAgICAgICAgc3RyID0gXCJSZXF1ZXN0OlxcblwiICsgc2lub24uZm9ybWF0KHJlcXVlc3QpICsgXCJcXG5cXG5cIjtcbiAgICAgICAgICAgICAgICBzdHIgKz0gXCJSZXNwb25zZTpcXG5cIiArIHNpbm9uLmZvcm1hdChyZXNwb25zZSkgKyBcIlxcblxcblwiO1xuXG4gICAgICAgICAgICAgICAgc2lub24ubG9nKHN0cik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXNwb25kV2l0aDogZnVuY3Rpb24gcmVzcG9uZFdpdGgobWV0aG9kLCB1cmwsIGJvZHkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgbWV0aG9kICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZSA9IHJlc3BvbnNlQXJyYXkobWV0aG9kKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5yZXNwb25zZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICBib2R5ID0gbWV0aG9kO1xuICAgICAgICAgICAgICAgICAgICB1cmwgPSBtZXRob2QgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGJvZHkgPSB1cmw7XG4gICAgICAgICAgICAgICAgICAgIHVybCA9IG1ldGhvZDtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwdXNoLmNhbGwodGhpcy5yZXNwb25zZXMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgICAgIHVybDogdXJsLFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogdHlwZW9mIGJvZHkgPT09IFwiZnVuY3Rpb25cIiA/IGJvZHkgOiByZXNwb25zZUFycmF5KGJvZHkpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICByZXNwb25kOiBmdW5jdGlvbiByZXNwb25kKCkge1xuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbmRXaXRoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHF1ZXVlID0gdGhpcy5xdWV1ZSB8fCBbXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVxdWVzdHMgPSBxdWV1ZS5zcGxpY2UoMCwgcXVldWUubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVxdWVzdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVxdWVzdChyZXF1ZXN0c1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcHJvY2Vzc1JlcXVlc3Q6IGZ1bmN0aW9uIHByb2Nlc3NSZXF1ZXN0KHJlcXVlc3QpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVxdWVzdC5hYm9ydGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2UgPSB0aGlzLnJlc3BvbnNlIHx8IFs0MDQsIHt9LCBcIlwiXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZXNwb25zZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGwgPSB0aGlzLnJlc3BvbnNlcy5sZW5ndGgsIGkgPSBsIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2guY2FsbCh0aGlzLCB0aGlzLnJlc3BvbnNlc1tpXSwgcmVxdWVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UgPSB0aGlzLnJlc3BvbnNlc1tpXS5yZXNwb25zZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2cocmVzcG9uc2UsIHJlcXVlc3QpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LnJlc3BvbmQocmVzcG9uc2VbMF0sIHJlc3BvbnNlWzFdLCByZXNwb25zZVsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNpbm9uLmxvZ0Vycm9yKFwiRmFrZSBzZXJ2ZXIgcmVxdWVzdCBwcm9jZXNzaW5nXCIsIGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHJlc3RvcmU6IGZ1bmN0aW9uIHJlc3RvcmUoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueGhyLnJlc3RvcmUgJiYgdGhpcy54aHIucmVzdG9yZS5hcHBseSh0aGlzLnhociwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZmFrZV94ZG9tYWluX3JlcXVlc3RcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zha2VfeG1sX2h0dHBfcmVxdWVzdFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4uL2Zvcm1hdFwiKTtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gc2lub247XG4gICAgfVxuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2UgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1ha2VBcGkoc2lub24pOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgfVxufSgpKTtcbiIsIi8qKlxuICogQGRlcGVuZCBmYWtlX3NlcnZlci5qc1xuICogQGRlcGVuZCBmYWtlX3RpbWVycy5qc1xuICovXG4vKipcbiAqIEFkZC1vbiBmb3Igc2lub24uZmFrZVNlcnZlciB0aGF0IGF1dG9tYXRpY2FsbHkgaGFuZGxlcyBhIGZha2UgdGltZXIgYWxvbmcgd2l0aFxuICogdGhlIEZha2VYTUxIdHRwUmVxdWVzdC4gVGhlIGRpcmVjdCBpbnNwaXJhdGlvbiBmb3IgdGhpcyBhZGQtb24gaXMgalF1ZXJ5XG4gKiAxLjMueCwgd2hpY2ggZG9lcyBub3QgdXNlIHhociBvYmplY3QncyBvbnJlYWR5c3RhdGVoYW5kbGVyIGF0IGFsbCAtIGluc3RlYWQsXG4gKiBpdCBwb2xscyB0aGUgb2JqZWN0IGZvciBjb21wbGV0aW9uIHdpdGggc2V0SW50ZXJ2YWwuIERpc3BpdGUgdGhlIGRpcmVjdFxuICogbW90aXZhdGlvbiwgdGhlcmUgaXMgbm90aGluZyBqUXVlcnktc3BlY2lmaWMgaW4gdGhpcyBmaWxlLCBzbyBpdCBjYW4gYmUgdXNlZFxuICogaW4gYW55IGVudmlyb25tZW50IHdoZXJlIHRoZSBhamF4IGltcGxlbWVudGF0aW9uIGRlcGVuZHMgb24gc2V0SW50ZXJ2YWwgb3JcbiAqIHNldFRpbWVvdXQuXG4gKlxuICogQGF1dGhvciBDaHJpc3RpYW4gSm9oYW5zZW4gKGNocmlzdGlhbkBjam9oYW5zZW4ubm8pXG4gKiBAbGljZW5zZSBCU0RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTAtMjAxMyBDaHJpc3RpYW4gSm9oYW5zZW5cbiAqL1xuKGZ1bmN0aW9uICgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgZnVuY3Rpb24gU2VydmVyKCkge31cbiAgICAgICAgU2VydmVyLnByb3RvdHlwZSA9IHNpbm9uLmZha2VTZXJ2ZXI7XG5cbiAgICAgICAgc2lub24uZmFrZVNlcnZlcldpdGhDbG9jayA9IG5ldyBTZXJ2ZXIoKTtcblxuICAgICAgICBzaW5vbi5mYWtlU2VydmVyV2l0aENsb2NrLmFkZFJlcXVlc3QgPSBmdW5jdGlvbiBhZGRSZXF1ZXN0KHhocikge1xuICAgICAgICAgICAgaWYgKHhoci5hc3luYykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dC5jbG9jayA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2NrID0gc2V0VGltZW91dC5jbG9jaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb2NrID0gc2lub24udXNlRmFrZVRpbWVycygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc2V0Q2xvY2sgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5sb25nZXN0VGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2xvY2tTZXRUaW1lb3V0ID0gdGhpcy5jbG9jay5zZXRUaW1lb3V0O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2xvY2tTZXRJbnRlcnZhbCA9IHRoaXMuY2xvY2suc2V0SW50ZXJ2YWw7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJ2ZXIgPSB0aGlzO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xvY2suc2V0VGltZW91dCA9IGZ1bmN0aW9uIChmbiwgdGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmxvbmdlc3RUaW1lb3V0ID0gTWF0aC5tYXgodGltZW91dCwgc2VydmVyLmxvbmdlc3RUaW1lb3V0IHx8IDApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2xvY2tTZXRUaW1lb3V0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9jay5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uIChmbiwgdGltZW91dCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmxvbmdlc3RUaW1lb3V0ID0gTWF0aC5tYXgodGltZW91dCwgc2VydmVyLmxvbmdlc3RUaW1lb3V0IHx8IDApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2xvY2tTZXRJbnRlcnZhbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uLmZha2VTZXJ2ZXIuYWRkUmVxdWVzdC5jYWxsKHRoaXMsIHhocik7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2lub24uZmFrZVNlcnZlcldpdGhDbG9jay5yZXNwb25kID0gZnVuY3Rpb24gcmVzcG9uZCgpIHtcbiAgICAgICAgICAgIHZhciByZXR1cm5WYWwgPSBzaW5vbi5mYWtlU2VydmVyLnJlc3BvbmQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY2xvY2spIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2NrLnRpY2sodGhpcy5sb25nZXN0VGltZW91dCB8fCAwKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvbmdlc3RUaW1lb3V0ID0gMDtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlc2V0Q2xvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9jay5yZXN0b3JlKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzZXRDbG9jayA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJldHVyblZhbDtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5mYWtlU2VydmVyV2l0aENsb2NrLnJlc3RvcmUgPSBmdW5jdGlvbiByZXN0b3JlKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2xvY2spIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsb2NrLnJlc3RvcmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNpbm9uLmZha2VTZXJ2ZXIucmVzdG9yZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciBpc05vZGUgPSB0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzICYmIHR5cGVvZiByZXF1aXJlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgdmFyIGlzQU1EID0gdHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSBcIm9iamVjdFwiICYmIGRlZmluZS5hbWQ7XG5cbiAgICBmdW5jdGlvbiBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZmFrZV9zZXJ2ZXJcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2Zha2VfdGltZXJzXCIpO1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWFrZUFwaShzaW5vbik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWZcbiAgICB9XG59KCkpO1xuIiwiLyoqXG4gKiBGYWtlIHRpbWVyIEFQSVxuICogc2V0VGltZW91dFxuICogc2V0SW50ZXJ2YWxcbiAqIGNsZWFyVGltZW91dFxuICogY2xlYXJJbnRlcnZhbFxuICogdGlja1xuICogcmVzZXRcbiAqIERhdGVcbiAqXG4gKiBJbnNwaXJlZCBieSBqc1VuaXRNb2NrVGltZU91dCBmcm9tIEpzVW5pdFxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHMsIGxvbCkge1xuICAgICAgICAvKmdsb2JhbCBsb2xleCAqL1xuICAgICAgICB2YXIgbGx4ID0gdHlwZW9mIGxvbGV4ICE9PSBcInVuZGVmaW5lZFwiID8gbG9sZXggOiBsb2w7XG5cbiAgICAgICAgcy51c2VGYWtlVGltZXJzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG5vdztcbiAgICAgICAgICAgIHZhciBtZXRob2RzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXRob2RzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgbm93ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm93ID0gbWV0aG9kcy5zaGlmdCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY2xvY2sgPSBsbHguaW5zdGFsbChub3cgfHwgMCwgbWV0aG9kcyk7XG4gICAgICAgICAgICBjbG9jay5yZXN0b3JlID0gY2xvY2sudW5pbnN0YWxsO1xuICAgICAgICAgICAgcmV0dXJuIGNsb2NrO1xuICAgICAgICB9O1xuXG4gICAgICAgIHMuY2xvY2sgPSB7XG4gICAgICAgICAgICBjcmVhdGU6IGZ1bmN0aW9uIChub3cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGx4LmNyZWF0ZUNsb2NrKG5vdyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcy50aW1lcnMgPSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0OiBzZXRUaW1lb3V0LFxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0OiBjbGVhclRpbWVvdXQsXG4gICAgICAgICAgICBzZXRJbW1lZGlhdGU6ICh0eXBlb2Ygc2V0SW1tZWRpYXRlICE9PSBcInVuZGVmaW5lZFwiID8gc2V0SW1tZWRpYXRlIDogdW5kZWZpbmVkKSxcbiAgICAgICAgICAgIGNsZWFySW1tZWRpYXRlOiAodHlwZW9mIGNsZWFySW1tZWRpYXRlICE9PSBcInVuZGVmaW5lZFwiID8gY2xlYXJJbW1lZGlhdGUgOiB1bmRlZmluZWQpLFxuICAgICAgICAgICAgc2V0SW50ZXJ2YWw6IHNldEludGVydmFsLFxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbDogY2xlYXJJbnRlcnZhbCxcbiAgICAgICAgICAgIERhdGU6IERhdGVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBlcHhvcnRzLCBtb2R1bGUsIGxvbGV4KSB7XG4gICAgICAgIHZhciBjb3JlID0gcmVxdWlyZShcIi4vY29yZVwiKTtcbiAgICAgICAgbWFrZUFwaShjb3JlLCBsb2xleCk7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gY29yZTtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSBpZiAoaXNOb2RlKSB7XG4gICAgICAgIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgbW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgcmVxdWlyZShcImxvbGV4XCIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuICAgIH1cbn0oKSk7XG4iLCIvKipcbiAqIEBkZXBlbmQgY29yZS5qc1xuICogQGRlcGVuZCAuLi9leHRlbmQuanNcbiAqIEBkZXBlbmQgZXZlbnQuanNcbiAqIEBkZXBlbmQgLi4vbG9nX2Vycm9yLmpzXG4gKi9cbi8qKlxuICogRmFrZSBYRG9tYWluUmVxdWVzdCBvYmplY3RcbiAqL1xuaWYgKHR5cGVvZiBzaW5vbiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHRoaXMuc2lub24gPSB7fTtcbn1cblxuLy8gd3JhcHBlciBmb3IgZ2xvYmFsXG4oZnVuY3Rpb24gKGdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHhkciA9IHsgWERvbWFpblJlcXVlc3Q6IGdsb2JhbC5YRG9tYWluUmVxdWVzdCB9O1xuICAgIHhkci5HbG9iYWxYRG9tYWluUmVxdWVzdCA9IGdsb2JhbC5YRG9tYWluUmVxdWVzdDtcbiAgICB4ZHIuc3VwcG9ydHNYRFIgPSB0eXBlb2YgeGRyLkdsb2JhbFhEb21haW5SZXF1ZXN0ICE9PSBcInVuZGVmaW5lZFwiO1xuICAgIHhkci53b3JraW5nWERSID0geGRyLnN1cHBvcnRzWERSID8geGRyLkdsb2JhbFhEb21haW5SZXF1ZXN0IDogZmFsc2U7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIHNpbm9uLnhkciA9IHhkcjtcblxuICAgICAgICBmdW5jdGlvbiBGYWtlWERvbWFpblJlcXVlc3QoKSB7XG4gICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBGYWtlWERvbWFpblJlcXVlc3QuVU5TRU5UO1xuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0Qm9keSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzID0ge307XG4gICAgICAgICAgICB0aGlzLnN0YXR1cyA9IDA7XG4gICAgICAgICAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIEZha2VYRG9tYWluUmVxdWVzdC5vbkNyZWF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgRmFrZVhEb21haW5SZXF1ZXN0Lm9uQ3JlYXRlKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gdmVyaWZ5U3RhdGUoeCkge1xuICAgICAgICAgICAgaWYgKHgucmVhZHlTdGF0ZSAhPT0gRmFrZVhEb21haW5SZXF1ZXN0Lk9QRU5FRCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIklOVkFMSURfU1RBVEVfRVJSXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoeC5zZW5kRmxhZykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIklOVkFMSURfU1RBVEVfRVJSXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gdmVyaWZ5UmVxdWVzdFNlbnQoeCkge1xuICAgICAgICAgICAgaWYgKHgucmVhZHlTdGF0ZSA9PT0gRmFrZVhEb21haW5SZXF1ZXN0LlVOU0VOVCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlcXVlc3Qgbm90IHNlbnRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoeC5yZWFkeVN0YXRlID09PSBGYWtlWERvbWFpblJlcXVlc3QuRE9ORSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlcXVlc3QgZG9uZVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHZlcmlmeVJlc3BvbnNlQm9keVR5cGUoYm9keSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBib2R5ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlc3BvbmQgdG8gZmFrZSBYRG9tYWluUmVxdWVzdCB3aXRoIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHkgKyBcIiwgd2hpY2ggaXMgbm90IGEgc3RyaW5nLlwiKTtcbiAgICAgICAgICAgICAgICBlcnJvci5uYW1lID0gXCJJbnZhbGlkQm9keUV4Y2VwdGlvblwiO1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2lub24uZXh0ZW5kKEZha2VYRG9tYWluUmVxdWVzdC5wcm90b3R5cGUsIHNpbm9uLkV2ZW50VGFyZ2V0LCB7XG4gICAgICAgICAgICBvcGVuOiBmdW5jdGlvbiBvcGVuKG1ldGhvZCwgdXJsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXRob2QgPSBtZXRob2Q7XG4gICAgICAgICAgICAgICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlVGV4dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRmxhZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYRG9tYWluUmVxdWVzdC5PUEVORUQpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVhZHlTdGF0ZUNoYW5nZTogZnVuY3Rpb24gcmVhZHlTdGF0ZUNoYW5nZShzdGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IHN0YXRlO1xuICAgICAgICAgICAgICAgIHZhciBldmVudE5hbWUgPSBcIlwiO1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5yZWFkeVN0YXRlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBGYWtlWERvbWFpblJlcXVlc3QuVU5TRU5UOlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEZha2VYRG9tYWluUmVxdWVzdC5PUEVORUQ6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgRmFrZVhEb21haW5SZXF1ZXN0LkxPQURJTkc6XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNlbmRGbGFnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3JhaXNlIHRoZSBwcm9ncmVzcyBldmVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnROYW1lID0gXCJvbnByb2dyZXNzXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBGYWtlWERvbWFpblJlcXVlc3QuRE9ORTpcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNUaW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudE5hbWUgPSBcIm9udGltZW91dFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXJyb3JGbGFnIHx8ICh0aGlzLnN0YXR1cyA8IDIwMCB8fCB0aGlzLnN0YXR1cyA+IDI5OSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TmFtZSA9IFwib25lcnJvclwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnROYW1lID0gXCJvbmxvYWRcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyByYWlzaW5nIGV2ZW50IChpZiBkZWZpbmVkKVxuICAgICAgICAgICAgICAgIGlmIChldmVudE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2V2ZW50TmFtZV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2V2ZW50TmFtZV0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaW5vbi5sb2dFcnJvcihcIkZha2UgWEhSIFwiICsgZXZlbnROYW1lICsgXCIgaGFuZGxlclwiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHNlbmQ6IGZ1bmN0aW9uIHNlbmQoZGF0YSkge1xuICAgICAgICAgICAgICAgIHZlcmlmeVN0YXRlKHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCEvXihnZXR8aGVhZCkkL2kudGVzdCh0aGlzLm1ldGhvZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0Qm9keSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0gPSBcInRleHQvcGxhaW47Y2hhcnNldD11dGYtOFwiO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5lcnJvckZsYWcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNlbmRGbGFnID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhEb21haW5SZXF1ZXN0Lk9QRU5FRCk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMub25TZW5kID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblNlbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgYWJvcnQ6IGZ1bmN0aW9uIGFib3J0KCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWJvcnRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZVRleHQgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JGbGFnID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPiBzaW5vbi5GYWtlWERvbWFpblJlcXVlc3QuVU5TRU5UICYmIHRoaXMuc2VuZEZsYWcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKHNpbm9uLkZha2VYRG9tYWluUmVxdWVzdC5ET05FKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kRmxhZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHNldFJlc3BvbnNlQm9keTogZnVuY3Rpb24gc2V0UmVzcG9uc2VCb2R5KGJvZHkpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlSZXF1ZXN0U2VudCh0aGlzKTtcbiAgICAgICAgICAgICAgICB2ZXJpZnlSZXNwb25zZUJvZHlUeXBlKGJvZHkpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGNodW5rU2l6ZSA9IHRoaXMuY2h1bmtTaXplIHx8IDEwO1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZVRleHQgPSBcIlwiO1xuXG4gICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhEb21haW5SZXF1ZXN0LkxPQURJTkcpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlVGV4dCArPSBib2R5LnN1YnN0cmluZyhpbmRleCwgaW5kZXggKyBjaHVua1NpemUpO1xuICAgICAgICAgICAgICAgICAgICBpbmRleCArPSBjaHVua1NpemU7XG4gICAgICAgICAgICAgICAgfSB3aGlsZSAoaW5kZXggPCBib2R5Lmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhEb21haW5SZXF1ZXN0LkRPTkUpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzcG9uZDogZnVuY3Rpb24gcmVzcG9uZChzdGF0dXMsIGNvbnRlbnRUeXBlLCBib2R5KSB7XG4gICAgICAgICAgICAgICAgLy8gY29udGVudC10eXBlIGlnbm9yZWQsIHNpbmNlIFhEb21haW5SZXF1ZXN0IGRvZXMgbm90IGNhcnJ5IHRoaXNcbiAgICAgICAgICAgICAgICAvLyB3ZSBrZWVwIHRoZSBzYW1lIHN5bnRheCBmb3IgcmVzcG9uZCguLi4pIGFzIGZvciBGYWtlWE1MSHR0cFJlcXVlc3QgdG8gZWFzZVxuICAgICAgICAgICAgICAgIC8vIHRlc3QgaW50ZWdyYXRpb24gYWNyb3NzIGJyb3dzZXJzXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXMgPSB0eXBlb2Ygc3RhdHVzID09PSBcIm51bWJlclwiID8gc3RhdHVzIDogMjAwO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0UmVzcG9uc2VCb2R5KGJvZHkgfHwgXCJcIik7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzaW11bGF0ZXRpbWVvdXQ6IGZ1bmN0aW9uIHNpbXVsYXRldGltZW91dCgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXR1cyA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5pc1RpbWVvdXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIEFjY2VzcyB0byB0aGlzIHNob3VsZCBhY3R1YWxseSB0aHJvdyBhbiBlcnJvclxuICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VUZXh0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZUNoYW5nZShGYWtlWERvbWFpblJlcXVlc3QuRE9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNpbm9uLmV4dGVuZChGYWtlWERvbWFpblJlcXVlc3QsIHtcbiAgICAgICAgICAgIFVOU0VOVDogMCxcbiAgICAgICAgICAgIE9QRU5FRDogMSxcbiAgICAgICAgICAgIExPQURJTkc6IDMsXG4gICAgICAgICAgICBET05FOiA0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNpbm9uLnVzZUZha2VYRG9tYWluUmVxdWVzdCA9IGZ1bmN0aW9uIHVzZUZha2VYRG9tYWluUmVxdWVzdCgpIHtcbiAgICAgICAgICAgIHNpbm9uLkZha2VYRG9tYWluUmVxdWVzdC5yZXN0b3JlID0gZnVuY3Rpb24gcmVzdG9yZShrZWVwT25DcmVhdGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGRyLnN1cHBvcnRzWERSKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsb2JhbC5YRG9tYWluUmVxdWVzdCA9IHhkci5HbG9iYWxYRG9tYWluUmVxdWVzdDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBkZWxldGUgc2lub24uRmFrZVhEb21haW5SZXF1ZXN0LnJlc3RvcmU7XG5cbiAgICAgICAgICAgICAgICBpZiAoa2VlcE9uQ3JlYXRlICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzaW5vbi5GYWtlWERvbWFpblJlcXVlc3Qub25DcmVhdGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICh4ZHIuc3VwcG9ydHNYRFIpIHtcbiAgICAgICAgICAgICAgICBnbG9iYWwuWERvbWFpblJlcXVlc3QgPSBzaW5vbi5GYWtlWERvbWFpblJlcXVlc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc2lub24uRmFrZVhEb21haW5SZXF1ZXN0O1xuICAgICAgICB9O1xuXG4gICAgICAgIHNpbm9uLkZha2VYRG9tYWluUmVxdWVzdCA9IEZha2VYRG9tYWluUmVxdWVzdDtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgZnVuY3Rpb24gbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICAgICAgdmFyIHNpbm9uID0gcmVxdWlyZShcIi4vY29yZVwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4uL2V4dGVuZFwiKTtcbiAgICAgICAgcmVxdWlyZShcIi4vZXZlbnRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuLi9sb2dfZXJyb3JcIik7XG4gICAgICAgIG1ha2VBcGkoc2lub24pO1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHNpbm9uO1xuICAgIH1cblxuICAgIGlmIChpc0FNRCkge1xuICAgICAgICBkZWZpbmUobG9hZERlcGVuZGVuY2llcyk7XG4gICAgfSBlbHNlIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuICAgIH1cbn0pKHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiBzZWxmKTtcbiIsIi8qKlxuICogQGRlcGVuZCBjb3JlLmpzXG4gKiBAZGVwZW5kIC4uL2V4dGVuZC5qc1xuICogQGRlcGVuZCBldmVudC5qc1xuICogQGRlcGVuZCAuLi9sb2dfZXJyb3IuanNcbiAqL1xuLyoqXG4gKiBGYWtlIFhNTEh0dHBSZXF1ZXN0IG9iamVjdFxuICpcbiAqIEBhdXRob3IgQ2hyaXN0aWFuIEpvaGFuc2VuIChjaHJpc3RpYW5AY2pvaGFuc2VuLm5vKVxuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTMgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cbihmdW5jdGlvbiAoc2lub25HbG9iYWwsIGdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgZnVuY3Rpb24gZ2V0V29ya2luZ1hIUihnbG9iYWxTY29wZSkge1xuICAgICAgICB2YXIgc3VwcG9ydHNYSFIgPSB0eXBlb2YgZ2xvYmFsU2NvcGUuWE1MSHR0cFJlcXVlc3QgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgICAgIGlmIChzdXBwb3J0c1hIUikge1xuICAgICAgICAgICAgcmV0dXJuIGdsb2JhbFNjb3BlLlhNTEh0dHBSZXF1ZXN0O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN1cHBvcnRzQWN0aXZlWCA9IHR5cGVvZiBnbG9iYWxTY29wZS5BY3RpdmVYT2JqZWN0ICE9PSBcInVuZGVmaW5lZFwiO1xuICAgICAgICBpZiAoc3VwcG9ydHNBY3RpdmVYKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgZ2xvYmFsU2NvcGUuQWN0aXZlWE9iamVjdChcIk1TWE1MMi5YTUxIVFRQLjMuMFwiKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIHN1cHBvcnRzUHJvZ3Jlc3MgPSB0eXBlb2YgUHJvZ3Jlc3NFdmVudCAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgICB2YXIgc3VwcG9ydHNDdXN0b21FdmVudCA9IHR5cGVvZiBDdXN0b21FdmVudCAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgICB2YXIgc3VwcG9ydHNGb3JtRGF0YSA9IHR5cGVvZiBGb3JtRGF0YSAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgICB2YXIgc3VwcG9ydHNBcnJheUJ1ZmZlciA9IHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgICB2YXIgc3VwcG9ydHNCbG9iID0gdHlwZW9mIEJsb2IgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgc2lub25YaHIgPSB7IFhNTEh0dHBSZXF1ZXN0OiBnbG9iYWwuWE1MSHR0cFJlcXVlc3QgfTtcbiAgICBzaW5vblhoci5HbG9iYWxYTUxIdHRwUmVxdWVzdCA9IGdsb2JhbC5YTUxIdHRwUmVxdWVzdDtcbiAgICBzaW5vblhoci5HbG9iYWxBY3RpdmVYT2JqZWN0ID0gZ2xvYmFsLkFjdGl2ZVhPYmplY3Q7XG4gICAgc2lub25YaHIuc3VwcG9ydHNBY3RpdmVYID0gdHlwZW9mIHNpbm9uWGhyLkdsb2JhbEFjdGl2ZVhPYmplY3QgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgc2lub25YaHIuc3VwcG9ydHNYSFIgPSB0eXBlb2Ygc2lub25YaHIuR2xvYmFsWE1MSHR0cFJlcXVlc3QgIT09IFwidW5kZWZpbmVkXCI7XG4gICAgc2lub25YaHIud29ya2luZ1hIUiA9IGdldFdvcmtpbmdYSFIoZ2xvYmFsKTtcbiAgICBzaW5vblhoci5zdXBwb3J0c0NPUlMgPSBzaW5vblhoci5zdXBwb3J0c1hIUiAmJiBcIndpdGhDcmVkZW50aWFsc1wiIGluIChuZXcgc2lub25YaHIuR2xvYmFsWE1MSHR0cFJlcXVlc3QoKSk7XG5cbiAgICB2YXIgdW5zYWZlSGVhZGVycyA9IHtcbiAgICAgICAgXCJBY2NlcHQtQ2hhcnNldFwiOiB0cnVlLFxuICAgICAgICBcIkFjY2VwdC1FbmNvZGluZ1wiOiB0cnVlLFxuICAgICAgICBDb25uZWN0aW9uOiB0cnVlLFxuICAgICAgICBcIkNvbnRlbnQtTGVuZ3RoXCI6IHRydWUsXG4gICAgICAgIENvb2tpZTogdHJ1ZSxcbiAgICAgICAgQ29va2llMjogdHJ1ZSxcbiAgICAgICAgXCJDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nXCI6IHRydWUsXG4gICAgICAgIERhdGU6IHRydWUsXG4gICAgICAgIEV4cGVjdDogdHJ1ZSxcbiAgICAgICAgSG9zdDogdHJ1ZSxcbiAgICAgICAgXCJLZWVwLUFsaXZlXCI6IHRydWUsXG4gICAgICAgIFJlZmVyZXI6IHRydWUsXG4gICAgICAgIFRFOiB0cnVlLFxuICAgICAgICBUcmFpbGVyOiB0cnVlLFxuICAgICAgICBcIlRyYW5zZmVyLUVuY29kaW5nXCI6IHRydWUsXG4gICAgICAgIFVwZ3JhZGU6IHRydWUsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiB0cnVlLFxuICAgICAgICBWaWE6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQW4gdXBsb2FkIG9iamVjdCBpcyBjcmVhdGVkIGZvciBlYWNoXG4gICAgLy8gRmFrZVhNTEh0dHBSZXF1ZXN0IGFuZCBhbGxvd3MgdXBsb2FkXG4gICAgLy8gZXZlbnRzIHRvIGJlIHNpbXVsYXRlZCB1c2luZyB1cGxvYWRQcm9ncmVzc1xuICAgIC8vIGFuZCB1cGxvYWRFcnJvci5cbiAgICBmdW5jdGlvbiBVcGxvYWRQcm9ncmVzcygpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycyA9IHtcbiAgICAgICAgICAgIHByb2dyZXNzOiBbXSxcbiAgICAgICAgICAgIGxvYWQ6IFtdLFxuICAgICAgICAgICAgYWJvcnQ6IFtdLFxuICAgICAgICAgICAgZXJyb3I6IFtdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgVXBsb2FkUHJvZ3Jlc3MucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzW2V2ZW50XS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9O1xuXG4gICAgVXBsb2FkUHJvZ3Jlc3MucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5ldmVudExpc3RlbmVyc1tldmVudF0gfHwgW107XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICBpZiAobGlzdGVuZXJzW2ldID09PSBsaXN0ZW5lcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFVwbG9hZFByb2dyZXNzLnByb3RvdHlwZS5kaXNwYXRjaEV2ZW50ID0gZnVuY3Rpb24gZGlzcGF0Y2hFdmVudChldmVudCkge1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5ldmVudExpc3RlbmVyc1tldmVudC50eXBlXSB8fCBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGlzdGVuZXI7IChsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXSkgIT0gbnVsbDsgaSsrKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcihldmVudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gTm90ZSB0aGF0IGZvciBGYWtlWE1MSHR0cFJlcXVlc3QgdG8gd29yayBwcmUgRVM1XG4gICAgLy8gd2UgbG9zZSBzb21lIG9mIHRoZSBhbGlnbm1lbnQgd2l0aCB0aGUgc3BlYy5cbiAgICAvLyBUbyBlbnN1cmUgYXMgY2xvc2UgYSBtYXRjaCBhcyBwb3NzaWJsZSxcbiAgICAvLyBzZXQgcmVzcG9uc2VUeXBlIGJlZm9yZSBjYWxsaW5nIG9wZW4sIHNlbmQgb3IgcmVzcG9uZDtcbiAgICBmdW5jdGlvbiBGYWtlWE1MSHR0cFJlcXVlc3QoKSB7XG4gICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IEZha2VYTUxIdHRwUmVxdWVzdC5VTlNFTlQ7XG4gICAgICAgIHRoaXMucmVxdWVzdEhlYWRlcnMgPSB7fTtcbiAgICAgICAgdGhpcy5yZXF1ZXN0Qm9keSA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gMDtcbiAgICAgICAgdGhpcy5zdGF0dXNUZXh0ID0gXCJcIjtcbiAgICAgICAgdGhpcy51cGxvYWQgPSBuZXcgVXBsb2FkUHJvZ3Jlc3MoKTtcbiAgICAgICAgdGhpcy5yZXNwb25zZVR5cGUgPSBcIlwiO1xuICAgICAgICB0aGlzLnJlc3BvbnNlID0gXCJcIjtcbiAgICAgICAgaWYgKHNpbm9uWGhyLnN1cHBvcnRzQ09SUykge1xuICAgICAgICAgICAgdGhpcy53aXRoQ3JlZGVudGlhbHMgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB4aHIgPSB0aGlzO1xuICAgICAgICB2YXIgZXZlbnRzID0gW1wibG9hZHN0YXJ0XCIsIFwibG9hZFwiLCBcImFib3J0XCIsIFwibG9hZGVuZFwiXTtcblxuICAgICAgICBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSkge1xuICAgICAgICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSB4aHJbXCJvblwiICsgZXZlbnROYW1lXTtcblxuICAgICAgICAgICAgICAgIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lci5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSBldmVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnRzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgRmFrZVhNTEh0dHBSZXF1ZXN0Lm9uQ3JlYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIEZha2VYTUxIdHRwUmVxdWVzdC5vbkNyZWF0ZSh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZlcmlmeVN0YXRlKHhocikge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgIT09IEZha2VYTUxIdHRwUmVxdWVzdC5PUEVORUQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIklOVkFMSURfU1RBVEVfRVJSXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHhoci5zZW5kRmxhZykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSU5WQUxJRF9TVEFURV9FUlJcIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRIZWFkZXIoaGVhZGVycywgaGVhZGVyKSB7XG4gICAgICAgIGhlYWRlciA9IGhlYWRlci50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgIGZvciAodmFyIGggaW4gaGVhZGVycykge1xuICAgICAgICAgICAgaWYgKGgudG9Mb3dlckNhc2UoKSA9PT0gaGVhZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBmaWx0ZXJpbmcgdG8gZW5hYmxlIGEgd2hpdGUtbGlzdCB2ZXJzaW9uIG9mIFNpbm9uIEZha2VYaHIsXG4gICAgLy8gd2hlcmUgd2hpdGVsaXN0ZWQgcmVxdWVzdHMgYXJlIHBhc3NlZCB0aHJvdWdoIHRvIHJlYWwgWEhSXG4gICAgZnVuY3Rpb24gZWFjaChjb2xsZWN0aW9uLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIWNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY29sbGVjdGlvbi5sZW5ndGg7IGkgPCBsOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGNvbGxlY3Rpb25baV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHNvbWUoY29sbGVjdGlvbiwgY2FsbGJhY2spIHtcbiAgICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGNvbGxlY3Rpb24ubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2soY29sbGVjdGlvbltpbmRleF0pID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBsYXJnZXN0IGFyaXR5IGluIFhIUiBpcyA1IC0gWEhSI29wZW5cbiAgICB2YXIgYXBwbHkgPSBmdW5jdGlvbiAob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICAgICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgICBjYXNlIDA6IHJldHVybiBvYmpbbWV0aG9kXSgpO1xuICAgICAgICBjYXNlIDE6IHJldHVybiBvYmpbbWV0aG9kXShhcmdzWzBdKTtcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gb2JqW21ldGhvZF0oYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgICAgIGNhc2UgMzogcmV0dXJuIG9ialttZXRob2RdKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0pO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBvYmpbbWV0aG9kXShhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdKTtcbiAgICAgICAgY2FzZSA1OiByZXR1cm4gb2JqW21ldGhvZF0oYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgYXJnc1szXSwgYXJnc1s0XSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgRmFrZVhNTEh0dHBSZXF1ZXN0LmZpbHRlcnMgPSBbXTtcbiAgICBGYWtlWE1MSHR0cFJlcXVlc3QuYWRkRmlsdGVyID0gZnVuY3Rpb24gYWRkRmlsdGVyKGZuKSB7XG4gICAgICAgIHRoaXMuZmlsdGVycy5wdXNoKGZuKTtcbiAgICB9O1xuICAgIHZhciBJRTZSZSA9IC9NU0lFIDYvO1xuICAgIEZha2VYTUxIdHRwUmVxdWVzdC5kZWZha2UgPSBmdW5jdGlvbiBkZWZha2UoZmFrZVhociwgeGhyQXJncykge1xuICAgICAgICB2YXIgeGhyID0gbmV3IHNpbm9uWGhyLndvcmtpbmdYSFIoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG5cbiAgICAgICAgZWFjaChbXG4gICAgICAgICAgICBcIm9wZW5cIixcbiAgICAgICAgICAgIFwic2V0UmVxdWVzdEhlYWRlclwiLFxuICAgICAgICAgICAgXCJzZW5kXCIsXG4gICAgICAgICAgICBcImFib3J0XCIsXG4gICAgICAgICAgICBcImdldFJlc3BvbnNlSGVhZGVyXCIsXG4gICAgICAgICAgICBcImdldEFsbFJlc3BvbnNlSGVhZGVyc1wiLFxuICAgICAgICAgICAgXCJhZGRFdmVudExpc3RlbmVyXCIsXG4gICAgICAgICAgICBcIm92ZXJyaWRlTWltZVR5cGVcIixcbiAgICAgICAgICAgIFwicmVtb3ZlRXZlbnRMaXN0ZW5lclwiXG4gICAgICAgIF0sIGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgICAgICAgICAgIGZha2VYaHJbbWV0aG9kXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXBwbHkoeGhyLCBtZXRob2QsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgY29weUF0dHJzID0gZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgICAgICAgIGVhY2goYXJncywgZnVuY3Rpb24gKGF0dHIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmYWtlWGhyW2F0dHJdID0geGhyW2F0dHJdO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFJRTZSZS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gc3RhdGVDaGFuZ2UoKSB7XG4gICAgICAgICAgICBmYWtlWGhyLnJlYWR5U3RhdGUgPSB4aHIucmVhZHlTdGF0ZTtcbiAgICAgICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA+PSBGYWtlWE1MSHR0cFJlcXVlc3QuSEVBREVSU19SRUNFSVZFRCkge1xuICAgICAgICAgICAgICAgIGNvcHlBdHRycyhbXCJzdGF0dXNcIiwgXCJzdGF0dXNUZXh0XCJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA+PSBGYWtlWE1MSHR0cFJlcXVlc3QuTE9BRElORykge1xuICAgICAgICAgICAgICAgIGNvcHlBdHRycyhbXCJyZXNwb25zZVRleHRcIiwgXCJyZXNwb25zZVwiXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IEZha2VYTUxIdHRwUmVxdWVzdC5ET05FKSB7XG4gICAgICAgICAgICAgICAgY29weUF0dHJzKFtcInJlc3BvbnNlWE1MXCJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmYWtlWGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSkge1xuICAgICAgICAgICAgICAgIGZha2VYaHIub25yZWFkeXN0YXRlY2hhbmdlLmNhbGwoZmFrZVhociwgeyB0YXJnZXQ6IGZha2VYaHIgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHhoci5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBldmVudCBpbiBmYWtlWGhyLmV2ZW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZha2VYaHIuZXZlbnRMaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoZXZlbnQpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLyplc2xpbnQtZGlzYWJsZSBuby1sb29wLWZ1bmMqL1xuICAgICAgICAgICAgICAgICAgICBlYWNoKGZha2VYaHIuZXZlbnRMaXN0ZW5lcnNbZXZlbnRdLCBmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgLyplc2xpbnQtZW5hYmxlIG5vLWxvb3AtZnVuYyovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeGhyLmFkZEV2ZW50TGlzdGVuZXIoXCJyZWFkeXN0YXRlY2hhbmdlXCIsIHN0YXRlQ2hhbmdlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBzdGF0ZUNoYW5nZTtcbiAgICAgICAgfVxuICAgICAgICBhcHBseSh4aHIsIFwib3BlblwiLCB4aHJBcmdzKTtcbiAgICB9O1xuICAgIEZha2VYTUxIdHRwUmVxdWVzdC51c2VGaWx0ZXJzID0gZmFsc2U7XG5cbiAgICBmdW5jdGlvbiB2ZXJpZnlSZXF1ZXN0T3BlbmVkKHhocikge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgIT09IEZha2VYTUxIdHRwUmVxdWVzdC5PUEVORUQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIklOVkFMSURfU1RBVEVfRVJSIC0gXCIgKyB4aHIucmVhZHlTdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2ZXJpZnlSZXF1ZXN0U2VudCh4aHIpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSBGYWtlWE1MSHR0cFJlcXVlc3QuRE9ORSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVxdWVzdCBkb25lXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmVyaWZ5SGVhZGVyc1JlY2VpdmVkKHhocikge1xuICAgICAgICBpZiAoeGhyLmFzeW5jICYmIHhoci5yZWFkeVN0YXRlICE9PSBGYWtlWE1MSHR0cFJlcXVlc3QuSEVBREVSU19SRUNFSVZFRCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gaGVhZGVycyByZWNlaXZlZFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZlcmlmeVJlc3BvbnNlQm9keVR5cGUoYm9keSkge1xuICAgICAgICBpZiAodHlwZW9mIGJvZHkgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byByZXNwb25kIHRvIGZha2UgWE1MSHR0cFJlcXVlc3Qgd2l0aCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2R5ICsgXCIsIHdoaWNoIGlzIG5vdCBhIHN0cmluZy5cIik7XG4gICAgICAgICAgICBlcnJvci5uYW1lID0gXCJJbnZhbGlkQm9keUV4Y2VwdGlvblwiO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb252ZXJ0VG9BcnJheUJ1ZmZlcihib2R5KSB7XG4gICAgICAgIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYm9keS5sZW5ndGgpO1xuICAgICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYm9keS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoYXJDb2RlID0gYm9keS5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgaWYgKGNoYXJDb2RlID49IDI1Nikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcnJheWJ1ZmZlciBvciBibG9iIHJlc3BvbnNlVHlwZXMgcmVxdWlyZSBiaW5hcnkgc3RyaW5nLCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImludmFsaWQgY2hhcmFjdGVyIFwiICsgYm9keVtpXSArIFwiIGZvdW5kLlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZpZXdbaV0gPSBjaGFyQ29kZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzWG1sQ29udGVudFR5cGUoY29udGVudFR5cGUpIHtcbiAgICAgICAgcmV0dXJuICFjb250ZW50VHlwZSB8fCAvKHRleHRcXC94bWwpfChhcHBsaWNhdGlvblxcL3htbCl8KFxcK3htbCkvLnRlc3QoY29udGVudFR5cGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbnZlcnRSZXNwb25zZUJvZHkocmVzcG9uc2VUeXBlLCBjb250ZW50VHlwZSwgYm9keSkge1xuICAgICAgICBpZiAocmVzcG9uc2VUeXBlID09PSBcIlwiIHx8IHJlc3BvbnNlVHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnRzQXJyYXlCdWZmZXIgJiYgcmVzcG9uc2VUeXBlID09PSBcImFycmF5YnVmZmVyXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBjb252ZXJ0VG9BcnJheUJ1ZmZlcihib2R5KTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXNwb25zZVR5cGUgPT09IFwianNvblwiKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFJldHVybiBwYXJzaW5nIGZhaWx1cmUgYXMgbnVsbFxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnRzQmxvYiAmJiByZXNwb25zZVR5cGUgPT09IFwiYmxvYlwiKSB7XG4gICAgICAgICAgICB2YXIgYmxvYk9wdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIGlmIChjb250ZW50VHlwZSkge1xuICAgICAgICAgICAgICAgIGJsb2JPcHRpb25zLnR5cGUgPSBjb250ZW50VHlwZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgQmxvYihbY29udmVydFRvQXJyYXlCdWZmZXIoYm9keSldLCBibG9iT3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVzcG9uc2VUeXBlID09PSBcImRvY3VtZW50XCIpIHtcbiAgICAgICAgICAgIGlmIChpc1htbENvbnRlbnRUeXBlKGNvbnRlbnRUeXBlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBGYWtlWE1MSHR0cFJlcXVlc3QucGFyc2VYTUwoYm9keSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlc3BvbnNlVHlwZSBcIiArIHJlc3BvbnNlVHlwZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xlYXJSZXNwb25zZSh4aHIpIHtcbiAgICAgICAgaWYgKHhoci5yZXNwb25zZVR5cGUgPT09IFwiXCIgfHwgeGhyLnJlc3BvbnNlVHlwZSA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgICAgICAgIHhoci5yZXNwb25zZSA9IHhoci5yZXNwb25zZVRleHQgPSBcIlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeGhyLnJlc3BvbnNlID0geGhyLnJlc3BvbnNlVGV4dCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgeGhyLnJlc3BvbnNlWE1MID0gbnVsbDtcbiAgICB9XG5cbiAgICBGYWtlWE1MSHR0cFJlcXVlc3QucGFyc2VYTUwgPSBmdW5jdGlvbiBwYXJzZVhNTCh0ZXh0KSB7XG4gICAgICAgIC8vIFRyZWF0IGVtcHR5IHN0cmluZyBhcyBwYXJzaW5nIGZhaWx1cmVcbiAgICAgICAgaWYgKHRleHQgIT09IFwiXCIpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBET01QYXJzZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhcnNlciA9IG5ldyBET01QYXJzZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlci5wYXJzZUZyb21TdHJpbmcodGV4dCwgXCJ0ZXh0L3htbFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHhtbERvYyA9IG5ldyB3aW5kb3cuQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxET01cIik7XG4gICAgICAgICAgICAgICAgeG1sRG9jLmFzeW5jID0gXCJmYWxzZVwiO1xuICAgICAgICAgICAgICAgIHhtbERvYy5sb2FkWE1MKHRleHQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB4bWxEb2M7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gVW5hYmxlIHRvIHBhcnNlIFhNTCAtIG5vIGJpZ2dpZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIEZha2VYTUxIdHRwUmVxdWVzdC5zdGF0dXNDb2RlcyA9IHtcbiAgICAgICAgMTAwOiBcIkNvbnRpbnVlXCIsXG4gICAgICAgIDEwMTogXCJTd2l0Y2hpbmcgUHJvdG9jb2xzXCIsXG4gICAgICAgIDIwMDogXCJPS1wiLFxuICAgICAgICAyMDE6IFwiQ3JlYXRlZFwiLFxuICAgICAgICAyMDI6IFwiQWNjZXB0ZWRcIixcbiAgICAgICAgMjAzOiBcIk5vbi1BdXRob3JpdGF0aXZlIEluZm9ybWF0aW9uXCIsXG4gICAgICAgIDIwNDogXCJObyBDb250ZW50XCIsXG4gICAgICAgIDIwNTogXCJSZXNldCBDb250ZW50XCIsXG4gICAgICAgIDIwNjogXCJQYXJ0aWFsIENvbnRlbnRcIixcbiAgICAgICAgMjA3OiBcIk11bHRpLVN0YXR1c1wiLFxuICAgICAgICAzMDA6IFwiTXVsdGlwbGUgQ2hvaWNlXCIsXG4gICAgICAgIDMwMTogXCJNb3ZlZCBQZXJtYW5lbnRseVwiLFxuICAgICAgICAzMDI6IFwiRm91bmRcIixcbiAgICAgICAgMzAzOiBcIlNlZSBPdGhlclwiLFxuICAgICAgICAzMDQ6IFwiTm90IE1vZGlmaWVkXCIsXG4gICAgICAgIDMwNTogXCJVc2UgUHJveHlcIixcbiAgICAgICAgMzA3OiBcIlRlbXBvcmFyeSBSZWRpcmVjdFwiLFxuICAgICAgICA0MDA6IFwiQmFkIFJlcXVlc3RcIixcbiAgICAgICAgNDAxOiBcIlVuYXV0aG9yaXplZFwiLFxuICAgICAgICA0MDI6IFwiUGF5bWVudCBSZXF1aXJlZFwiLFxuICAgICAgICA0MDM6IFwiRm9yYmlkZGVuXCIsXG4gICAgICAgIDQwNDogXCJOb3QgRm91bmRcIixcbiAgICAgICAgNDA1OiBcIk1ldGhvZCBOb3QgQWxsb3dlZFwiLFxuICAgICAgICA0MDY6IFwiTm90IEFjY2VwdGFibGVcIixcbiAgICAgICAgNDA3OiBcIlByb3h5IEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCIsXG4gICAgICAgIDQwODogXCJSZXF1ZXN0IFRpbWVvdXRcIixcbiAgICAgICAgNDA5OiBcIkNvbmZsaWN0XCIsXG4gICAgICAgIDQxMDogXCJHb25lXCIsXG4gICAgICAgIDQxMTogXCJMZW5ndGggUmVxdWlyZWRcIixcbiAgICAgICAgNDEyOiBcIlByZWNvbmRpdGlvbiBGYWlsZWRcIixcbiAgICAgICAgNDEzOiBcIlJlcXVlc3QgRW50aXR5IFRvbyBMYXJnZVwiLFxuICAgICAgICA0MTQ6IFwiUmVxdWVzdC1VUkkgVG9vIExvbmdcIixcbiAgICAgICAgNDE1OiBcIlVuc3VwcG9ydGVkIE1lZGlhIFR5cGVcIixcbiAgICAgICAgNDE2OiBcIlJlcXVlc3RlZCBSYW5nZSBOb3QgU2F0aXNmaWFibGVcIixcbiAgICAgICAgNDE3OiBcIkV4cGVjdGF0aW9uIEZhaWxlZFwiLFxuICAgICAgICA0MjI6IFwiVW5wcm9jZXNzYWJsZSBFbnRpdHlcIixcbiAgICAgICAgNTAwOiBcIkludGVybmFsIFNlcnZlciBFcnJvclwiLFxuICAgICAgICA1MDE6IFwiTm90IEltcGxlbWVudGVkXCIsXG4gICAgICAgIDUwMjogXCJCYWQgR2F0ZXdheVwiLFxuICAgICAgICA1MDM6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgICA1MDQ6IFwiR2F0ZXdheSBUaW1lb3V0XCIsXG4gICAgICAgIDUwNTogXCJIVFRQIFZlcnNpb24gTm90IFN1cHBvcnRlZFwiXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG1ha2VBcGkoc2lub24pIHtcbiAgICAgICAgc2lub24ueGhyID0gc2lub25YaHI7XG5cbiAgICAgICAgc2lub24uZXh0ZW5kKEZha2VYTUxIdHRwUmVxdWVzdC5wcm90b3R5cGUsIHNpbm9uLkV2ZW50VGFyZ2V0LCB7XG4gICAgICAgICAgICBhc3luYzogdHJ1ZSxcblxuICAgICAgICAgICAgb3BlbjogZnVuY3Rpb24gb3BlbihtZXRob2QsIHVybCwgYXN5bmMsIHVzZXJuYW1lLCBwYXNzd29yZCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWV0aG9kID0gbWV0aG9kO1xuICAgICAgICAgICAgICAgIHRoaXMudXJsID0gdXJsO1xuICAgICAgICAgICAgICAgIHRoaXMuYXN5bmMgPSB0eXBlb2YgYXN5bmMgPT09IFwiYm9vbGVhblwiID8gYXN5bmMgOiB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMudXNlcm5hbWUgPSB1c2VybmFtZTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhc3N3b3JkID0gcGFzc3dvcmQ7XG4gICAgICAgICAgICAgICAgY2xlYXJSZXNwb25zZSh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzID0ge307XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRmxhZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKEZha2VYTUxIdHRwUmVxdWVzdC51c2VGaWx0ZXJzID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB4aHJBcmdzID0gYXJndW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGVmYWtlID0gc29tZShGYWtlWE1MSHR0cFJlcXVlc3QuZmlsdGVycywgZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5hcHBseSh0aGlzLCB4aHJBcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWZha2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBGYWtlWE1MSHR0cFJlcXVlc3QuZGVmYWtlKHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYTUxIdHRwUmVxdWVzdC5PUEVORUQpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVhZHlTdGF0ZUNoYW5nZTogZnVuY3Rpb24gcmVhZHlTdGF0ZUNoYW5nZShzdGF0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IHN0YXRlO1xuXG4gICAgICAgICAgICAgICAgdmFyIHJlYWR5U3RhdGVDaGFuZ2VFdmVudCA9IG5ldyBzaW5vbi5FdmVudChcInJlYWR5c3RhdGVjaGFuZ2VcIiwgZmFsc2UsIGZhbHNlLCB0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5vbnJlYWR5c3RhdGVjaGFuZ2UgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbnJlYWR5c3RhdGVjaGFuZ2UocmVhZHlTdGF0ZUNoYW5nZUV2ZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lub24ubG9nRXJyb3IoXCJGYWtlIFhIUiBvbnJlYWR5c3RhdGVjaGFuZ2UgaGFuZGxlclwiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5yZWFkeVN0YXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgRmFrZVhNTEh0dHBSZXF1ZXN0LkRPTkU6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3VwcG9ydHNQcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkLmRpc3BhdGNoRXZlbnQobmV3IHNpbm9uLlByb2dyZXNzRXZlbnQoXCJwcm9ncmVzc1wiLCB7bG9hZGVkOiAxMDAsIHRvdGFsOiAxMDB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5Qcm9ncmVzc0V2ZW50KFwicHJvZ3Jlc3NcIiwge2xvYWRlZDogMTAwLCB0b3RhbDogMTAwfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGxvYWQuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uRXZlbnQoXCJsb2FkXCIsIGZhbHNlLCBmYWxzZSwgdGhpcykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5FdmVudChcImxvYWRcIiwgZmFsc2UsIGZhbHNlLCB0aGlzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IHNpbm9uLkV2ZW50KFwibG9hZGVuZFwiLCBmYWxzZSwgZmFsc2UsIHRoaXMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChyZWFkeVN0YXRlQ2hhbmdlRXZlbnQpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc2V0UmVxdWVzdEhlYWRlcjogZnVuY3Rpb24gc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdmVyaWZ5U3RhdGUodGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodW5zYWZlSGVhZGVyc1toZWFkZXJdIHx8IC9eKFNlYy18UHJveHktKS8udGVzdChoZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlZnVzZWQgdG8gc2V0IHVuc2FmZSBoZWFkZXIgXFxcIlwiICsgaGVhZGVyICsgXCJcXFwiXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlcXVlc3RIZWFkZXJzW2hlYWRlcl0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGVhZGVyc1toZWFkZXJdICs9IFwiLFwiICsgdmFsdWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SGVhZGVyc1toZWFkZXJdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLy8gSGVscHMgdGVzdGluZ1xuICAgICAgICAgICAgc2V0UmVzcG9uc2VIZWFkZXJzOiBmdW5jdGlvbiBzZXRSZXNwb25zZUhlYWRlcnMoaGVhZGVycykge1xuICAgICAgICAgICAgICAgIHZlcmlmeVJlcXVlc3RPcGVuZWQodGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZUhlYWRlcnMgPSB7fTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGhlYWRlciBpbiBoZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChoZWFkZXJzLmhhc093blByb3BlcnR5KGhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VIZWFkZXJzW2hlYWRlcl0gPSBoZWFkZXJzW2hlYWRlcl07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hc3luYykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhNTEh0dHBSZXF1ZXN0LkhFQURFUlNfUkVDRUlWRUQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IEZha2VYTUxIdHRwUmVxdWVzdC5IRUFERVJTX1JFQ0VJVkVEO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8vIEN1cnJlbnRseSB0cmVhdHMgQUxMIGRhdGEgYXMgYSBET01TdHJpbmcgKGkuZS4gbm8gRG9jdW1lbnQpXG4gICAgICAgICAgICBzZW5kOiBmdW5jdGlvbiBzZW5kKGRhdGEpIHtcbiAgICAgICAgICAgICAgICB2ZXJpZnlTdGF0ZSh0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICghL14oZ2V0fGhlYWQpJC9pLnRlc3QodGhpcy5tZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjb250ZW50VHlwZSA9IGdldEhlYWRlcih0aGlzLnJlcXVlc3RIZWFkZXJzLCBcIkNvbnRlbnQtVHlwZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVxdWVzdEhlYWRlcnNbY29udGVudFR5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLnJlcXVlc3RIZWFkZXJzW2NvbnRlbnRUeXBlXS5zcGxpdChcIjtcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzW2NvbnRlbnRUeXBlXSA9IHZhbHVlWzBdICsgXCI7Y2hhcnNldD11dGYtOFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnRzRm9ybURhdGEgJiYgIShkYXRhIGluc3RhbmNlb2YgRm9ybURhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlcXVlc3RIZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdID0gXCJ0ZXh0L3BsYWluO2NoYXJzZXQ9dXRmLThcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEJvZHkgPSBkYXRhO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JGbGFnID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kRmxhZyA9IHRoaXMuYXN5bmM7XG4gICAgICAgICAgICAgICAgY2xlYXJSZXNwb25zZSh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhNTEh0dHBSZXF1ZXN0Lk9QRU5FRCk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMub25TZW5kID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblNlbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5FdmVudChcImxvYWRzdGFydFwiLCBmYWxzZSwgZmFsc2UsIHRoaXMpKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGFib3J0OiBmdW5jdGlvbiBhYm9ydCgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNsZWFyUmVzcG9uc2UodGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5lcnJvckZsYWcgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdEhlYWRlcnMgPSB7fTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlSGVhZGVycyA9IHt9O1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA+IEZha2VYTUxIdHRwUmVxdWVzdC5VTlNFTlQgJiYgdGhpcy5zZW5kRmxhZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhNTEh0dHBSZXF1ZXN0LkRPTkUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRGbGFnID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gRmFrZVhNTEh0dHBSZXF1ZXN0LlVOU0VOVDtcblxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uRXZlbnQoXCJhYm9ydFwiLCBmYWxzZSwgZmFsc2UsIHRoaXMpKTtcblxuICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkLmRpc3BhdGNoRXZlbnQobmV3IHNpbm9uLkV2ZW50KFwiYWJvcnRcIiwgZmFsc2UsIGZhbHNlLCB0aGlzKSk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMub25lcnJvciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25lcnJvcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGdldFJlc3BvbnNlSGVhZGVyOiBmdW5jdGlvbiBnZXRSZXNwb25zZUhlYWRlcihoZWFkZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlIDwgRmFrZVhNTEh0dHBSZXF1ZXN0LkhFQURFUlNfUkVDRUlWRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKC9eU2V0LUNvb2tpZTI/JC9pLnRlc3QoaGVhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBoZWFkZXIgPSBnZXRIZWFkZXIodGhpcy5yZXNwb25zZUhlYWRlcnMsIGhlYWRlcik7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNwb25zZUhlYWRlcnNbaGVhZGVyXSB8fCBudWxsO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZ2V0QWxsUmVzcG9uc2VIZWFkZXJzOiBmdW5jdGlvbiBnZXRBbGxSZXNwb25zZUhlYWRlcnMoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA8IEZha2VYTUxIdHRwUmVxdWVzdC5IRUFERVJTX1JFQ0VJVkVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gXCJcIjtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGhlYWRlciBpbiB0aGlzLnJlc3BvbnNlSGVhZGVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZXNwb25zZUhlYWRlcnMuaGFzT3duUHJvcGVydHkoaGVhZGVyKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgIS9eU2V0LUNvb2tpZTI/JC9pLnRlc3QoaGVhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVycyArPSBoZWFkZXIgKyBcIjogXCIgKyB0aGlzLnJlc3BvbnNlSGVhZGVyc1toZWFkZXJdICsgXCJcXHJcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc2V0UmVzcG9uc2VCb2R5OiBmdW5jdGlvbiBzZXRSZXNwb25zZUJvZHkoYm9keSkge1xuICAgICAgICAgICAgICAgIHZlcmlmeVJlcXVlc3RTZW50KHRoaXMpO1xuICAgICAgICAgICAgICAgIHZlcmlmeUhlYWRlcnNSZWNlaXZlZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB2ZXJpZnlSZXNwb25zZUJvZHlUeXBlKGJvZHkpO1xuICAgICAgICAgICAgICAgIHZhciBjb250ZW50VHlwZSA9IHRoaXMuZ2V0UmVzcG9uc2VIZWFkZXIoXCJDb250ZW50LVR5cGVcIik7XG5cbiAgICAgICAgICAgICAgICB2YXIgaXNUZXh0UmVzcG9uc2UgPSB0aGlzLnJlc3BvbnNlVHlwZSA9PT0gXCJcIiB8fCB0aGlzLnJlc3BvbnNlVHlwZSA9PT0gXCJ0ZXh0XCI7XG4gICAgICAgICAgICAgICAgY2xlYXJSZXNwb25zZSh0aGlzKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hc3luYykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2h1bmtTaXplID0gdGhpcy5jaHVua1NpemUgfHwgMTA7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlQ2hhbmdlKEZha2VYTUxIdHRwUmVxdWVzdC5MT0FESU5HKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzVGV4dFJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNwb25zZVRleHQgPSB0aGlzLnJlc3BvbnNlICs9IGJvZHkuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIGNodW5rU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleCArPSBjaHVua1NpemU7XG4gICAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKGluZGV4IDwgYm9keS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2UgPSBjb252ZXJ0UmVzcG9uc2VCb2R5KHRoaXMucmVzcG9uc2VUeXBlLCBjb250ZW50VHlwZSwgYm9keSk7XG4gICAgICAgICAgICAgICAgaWYgKGlzVGV4dFJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VUZXh0ID0gdGhpcy5yZXNwb25zZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZXNwb25zZVR5cGUgPT09IFwiZG9jdW1lbnRcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc3BvbnNlWE1MID0gdGhpcy5yZXNwb25zZTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucmVzcG9uc2VUeXBlID09PSBcIlwiICYmIGlzWG1sQ29udGVudFR5cGUoY29udGVudFR5cGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzcG9uc2VYTUwgPSBGYWtlWE1MSHR0cFJlcXVlc3QucGFyc2VYTUwodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGVDaGFuZ2UoRmFrZVhNTEh0dHBSZXF1ZXN0LkRPTkUpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcmVzcG9uZDogZnVuY3Rpb24gcmVzcG9uZChzdGF0dXMsIGhlYWRlcnMsIGJvZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXR1cyA9IHR5cGVvZiBzdGF0dXMgPT09IFwibnVtYmVyXCIgPyBzdGF0dXMgOiAyMDA7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0dXNUZXh0ID0gRmFrZVhNTEh0dHBSZXF1ZXN0LnN0YXR1c0NvZGVzW3RoaXMuc3RhdHVzXTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFJlc3BvbnNlSGVhZGVycyhoZWFkZXJzIHx8IHt9KTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFJlc3BvbnNlQm9keShib2R5IHx8IFwiXCIpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdXBsb2FkUHJvZ3Jlc3M6IGZ1bmN0aW9uIHVwbG9hZFByb2dyZXNzKHByb2dyZXNzRXZlbnRSYXcpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3VwcG9ydHNQcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZC5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5Qcm9ncmVzc0V2ZW50KFwicHJvZ3Jlc3NcIiwgcHJvZ3Jlc3NFdmVudFJhdykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGRvd25sb2FkUHJvZ3Jlc3M6IGZ1bmN0aW9uIGRvd25sb2FkUHJvZ3Jlc3MocHJvZ3Jlc3NFdmVudFJhdykge1xuICAgICAgICAgICAgICAgIGlmIChzdXBwb3J0c1Byb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgc2lub24uUHJvZ3Jlc3NFdmVudChcInByb2dyZXNzXCIsIHByb2dyZXNzRXZlbnRSYXcpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB1cGxvYWRFcnJvcjogZnVuY3Rpb24gdXBsb2FkRXJyb3IoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3VwcG9ydHNDdXN0b21FdmVudCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZC5kaXNwYXRjaEV2ZW50KG5ldyBzaW5vbi5DdXN0b21FdmVudChcImVycm9yXCIsIHtkZXRhaWw6IGVycm9yfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2lub24uZXh0ZW5kKEZha2VYTUxIdHRwUmVxdWVzdCwge1xuICAgICAgICAgICAgVU5TRU5UOiAwLFxuICAgICAgICAgICAgT1BFTkVEOiAxLFxuICAgICAgICAgICAgSEVBREVSU19SRUNFSVZFRDogMixcbiAgICAgICAgICAgIExPQURJTkc6IDMsXG4gICAgICAgICAgICBET05FOiA0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNpbm9uLnVzZUZha2VYTUxIdHRwUmVxdWVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIEZha2VYTUxIdHRwUmVxdWVzdC5yZXN0b3JlID0gZnVuY3Rpb24gcmVzdG9yZShrZWVwT25DcmVhdGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2lub25YaHIuc3VwcG9ydHNYSFIpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0ID0gc2lub25YaHIuR2xvYmFsWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHNpbm9uWGhyLnN1cHBvcnRzQWN0aXZlWCkge1xuICAgICAgICAgICAgICAgICAgICBnbG9iYWwuQWN0aXZlWE9iamVjdCA9IHNpbm9uWGhyLkdsb2JhbEFjdGl2ZVhPYmplY3Q7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVsZXRlIEZha2VYTUxIdHRwUmVxdWVzdC5yZXN0b3JlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGtlZXBPbkNyZWF0ZSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgRmFrZVhNTEh0dHBSZXF1ZXN0Lm9uQ3JlYXRlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoc2lub25YaHIuc3VwcG9ydHNYSFIpIHtcbiAgICAgICAgICAgICAgICBnbG9iYWwuWE1MSHR0cFJlcXVlc3QgPSBGYWtlWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzaW5vblhoci5zdXBwb3J0c0FjdGl2ZVgpIHtcbiAgICAgICAgICAgICAgICBnbG9iYWwuQWN0aXZlWE9iamVjdCA9IGZ1bmN0aW9uIEFjdGl2ZVhPYmplY3Qob2JqSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9iaklkID09PSBcIk1pY3Jvc29mdC5YTUxIVFRQXCIgfHwgL15Nc3htbDJcXC5YTUxIVFRQL2kudGVzdChvYmpJZCkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBGYWtlWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgc2lub25YaHIuR2xvYmFsQWN0aXZlWE9iamVjdChvYmpJZCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIEZha2VYTUxIdHRwUmVxdWVzdDtcbiAgICAgICAgfTtcblxuICAgICAgICBzaW5vbi5GYWtlWE1MSHR0cFJlcXVlc3QgPSBGYWtlWE1MSHR0cFJlcXVlc3Q7XG4gICAgfVxuXG4gICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMgJiYgdHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB2YXIgaXNBTUQgPSB0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09IFwib2JqZWN0XCIgJiYgZGVmaW5lLmFtZDtcblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL2NvcmVcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuLi9leHRlbmRcIik7XG4gICAgICAgIHJlcXVpcmUoXCIuL2V2ZW50XCIpO1xuICAgICAgICByZXF1aXJlKFwiLi4vbG9nX2Vycm9yXCIpO1xuICAgICAgICBtYWtlQXBpKHNpbm9uKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaW5vbjtcbiAgICB9XG5cbiAgICBpZiAoaXNBTUQpIHtcbiAgICAgICAgZGVmaW5lKGxvYWREZXBlbmRlbmNpZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzTm9kZSkge1xuICAgICAgICBsb2FkRGVwZW5kZW5jaWVzKHJlcXVpcmUsIG1vZHVsZS5leHBvcnRzLCBtb2R1bGUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNpbm9uR2xvYmFsKSB7XG4gICAgICAgIG1ha2VBcGkoc2lub25HbG9iYWwpO1xuICAgIH1cbn0oXG4gICAgdHlwZW9mIHNpbm9uID09PSBcIm9iamVjdFwiICYmIHNpbm9uLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4gICAgdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHNlbGZcbikpO1xuIiwiLyoqXG4gKiBAZGVwZW5kIHV0aWwvY29yZS5qc1xuICovXG4oZnVuY3Rpb24gKHNpbm9uR2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICBmdW5jdGlvbiBtYWtlQXBpKHNpbm9uKSB7XG4gICAgICAgIGZ1bmN0aW9uIHdhbGtJbnRlcm5hbChvYmosIGl0ZXJhdG9yLCBjb250ZXh0LCBvcmlnaW5hbE9iaikge1xuICAgICAgICAgICAgdmFyIHByb3RvLCBwcm9wO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAvLyBXZSBleHBsaWNpdGx5IHdhbnQgdG8gZW51bWVyYXRlIHRocm91Z2ggYWxsIG9mIHRoZSBwcm90b3R5cGUncyBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgICAgLy8gaW4gdGhpcyBjYXNlLCB0aGVyZWZvcmUgd2UgZGVsaWJlcmF0ZWx5IGxlYXZlIG91dCBhbiBvd24gcHJvcGVydHkgY2hlY2suXG4gICAgICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgZ3VhcmQtZm9yLWluICovXG4gICAgICAgICAgICAgICAgZm9yIChwcm9wIGluIG9iaikge1xuICAgICAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtwcm9wXSwgcHJvcCwgb2JqKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBndWFyZC1mb3ItaW4gKi9cblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgaykuZ2V0ID09PSBcImZ1bmN0aW9uXCIgP1xuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbE9iaiA6IG9iajtcbiAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHRhcmdldFtrXSwgaywgdGFyZ2V0KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopO1xuICAgICAgICAgICAgaWYgKHByb3RvKSB7XG4gICAgICAgICAgICAgICAgd2Fsa0ludGVybmFsKHByb3RvLCBpdGVyYXRvciwgY29udGV4dCwgb3JpZ2luYWxPYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyogUHVibGljOiB3YWxrcyB0aGUgcHJvdG90eXBlIGNoYWluIG9mIGFuIG9iamVjdCBhbmQgaXRlcmF0ZXMgb3ZlciBldmVyeSBvd24gcHJvcGVydHlcbiAgICAgICAgICogbmFtZSBlbmNvdW50ZXJlZC4gVGhlIGl0ZXJhdG9yIGlzIGNhbGxlZCBpbiB0aGUgc2FtZSBmYXNoaW9uIHRoYXQgQXJyYXkucHJvdG90eXBlLmZvckVhY2hcbiAgICAgICAgICogd29ya3MsIHdoZXJlIGl0IGlzIHBhc3NlZCB0aGUgdmFsdWUsIGtleSwgYW5kIG93biBvYmplY3QgYXMgdGhlIDFzdCwgMm5kLCBhbmQgM3JkIHBvc2l0aW9uYWxcbiAgICAgICAgICogYXJndW1lbnQsIHJlc3BlY3RpdmVseS4gSW4gY2FzZXMgd2hlcmUgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgaXMgbm90IGF2YWlsYWJsZSwgd2FsayB3aWxsXG4gICAgICAgICAqIGRlZmF1bHQgdG8gdXNpbmcgYSBzaW1wbGUgZm9yLi5pbiBsb29wLlxuICAgICAgICAgKlxuICAgICAgICAgKiBvYmogLSBUaGUgb2JqZWN0IHRvIHdhbGsgdGhlIHByb3RvdHlwZSBjaGFpbiBmb3IuXG4gICAgICAgICAqIGl0ZXJhdG9yIC0gVGhlIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBlYWNoIHBhc3Mgb2YgdGhlIHdhbGsuXG4gICAgICAgICAqIGNvbnRleHQgLSAoT3B0aW9uYWwpIFdoZW4gZ2l2ZW4sIHRoZSBpdGVyYXRvciB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoaXMgb2JqZWN0IGFzIHRoZSByZWNlaXZlci5cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIHdhbGsob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIHdhbGtJbnRlcm5hbChvYmosIGl0ZXJhdG9yLCBjb250ZXh0LCBvYmopO1xuICAgICAgICB9XG5cbiAgICAgICAgc2lub24ud2FsayA9IHdhbGs7XG4gICAgICAgIHJldHVybiBzaW5vbi53YWxrO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWREZXBlbmRlbmNpZXMocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICAgIHZhciBzaW5vbiA9IHJlcXVpcmUoXCIuL3V0aWwvY29yZVwiKTtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBtYWtlQXBpKHNpbm9uKTtcbiAgICB9XG5cbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gXCJmdW5jdGlvblwiO1xuICAgIHZhciBpc0FNRCA9IHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gXCJvYmplY3RcIiAmJiBkZWZpbmUuYW1kO1xuXG4gICAgaWYgKGlzQU1EKSB7XG4gICAgICAgIGRlZmluZShsb2FkRGVwZW5kZW5jaWVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpc05vZGUpIHtcbiAgICAgICAgbG9hZERlcGVuZGVuY2llcyhyZXF1aXJlLCBtb2R1bGUuZXhwb3J0cywgbW9kdWxlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzaW5vbkdsb2JhbCkge1xuICAgICAgICBtYWtlQXBpKHNpbm9uR2xvYmFsKTtcbiAgICB9XG59KFxuICAgIHR5cGVvZiBzaW5vbiA9PT0gXCJvYmplY3RcIiAmJiBzaW5vbiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG4pKTtcbiIsIigodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQgJiYgZnVuY3Rpb24gKG0pIHtcbiAgICBkZWZpbmUoXCJmb3JtYXRpb1wiLCBbXCJzYW1zYW1cIl0sIG0pO1xufSkgfHwgKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIgJiYgZnVuY3Rpb24gKG0pIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IG0ocmVxdWlyZShcInNhbXNhbVwiKSk7XG59KSB8fCBmdW5jdGlvbiAobSkgeyB0aGlzLmZvcm1hdGlvID0gbSh0aGlzLnNhbXNhbSk7IH1cbikoZnVuY3Rpb24gKHNhbXNhbSkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIGZvcm1hdGlvID0ge1xuICAgICAgICBleGNsdWRlQ29uc3RydWN0b3JzOiBbXCJPYmplY3RcIiwgL14uJC9dLFxuICAgICAgICBxdW90ZVN0cmluZ3M6IHRydWUsXG4gICAgICAgIGxpbWl0Q2hpbGRyZW5Db3VudDogMFxuICAgIH07XG5cbiAgICB2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuICAgIHZhciBzcGVjaWFsT2JqZWN0cyA9IFtdO1xuICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHNwZWNpYWxPYmplY3RzLnB1c2goeyBvYmplY3Q6IGdsb2JhbCwgdmFsdWU6IFwiW29iamVjdCBnbG9iYWxdXCIgfSk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgc3BlY2lhbE9iamVjdHMucHVzaCh7XG4gICAgICAgICAgICBvYmplY3Q6IGRvY3VtZW50LFxuICAgICAgICAgICAgdmFsdWU6IFwiW29iamVjdCBIVE1MRG9jdW1lbnRdXCJcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHNwZWNpYWxPYmplY3RzLnB1c2goeyBvYmplY3Q6IHdpbmRvdywgdmFsdWU6IFwiW29iamVjdCBXaW5kb3ddXCIgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZnVuY3Rpb25OYW1lKGZ1bmMpIHtcbiAgICAgICAgaWYgKCFmdW5jKSB7IHJldHVybiBcIlwiOyB9XG4gICAgICAgIGlmIChmdW5jLmRpc3BsYXlOYW1lKSB7IHJldHVybiBmdW5jLmRpc3BsYXlOYW1lOyB9XG4gICAgICAgIGlmIChmdW5jLm5hbWUpIHsgcmV0dXJuIGZ1bmMubmFtZTsgfVxuICAgICAgICB2YXIgbWF0Y2hlcyA9IGZ1bmMudG9TdHJpbmcoKS5tYXRjaCgvZnVuY3Rpb25cXHMrKFteXFwoXSspL20pO1xuICAgICAgICByZXR1cm4gKG1hdGNoZXMgJiYgbWF0Y2hlc1sxXSkgfHwgXCJcIjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb25zdHJ1Y3Rvck5hbWUoZiwgb2JqZWN0KSB7XG4gICAgICAgIHZhciBuYW1lID0gZnVuY3Rpb25OYW1lKG9iamVjdCAmJiBvYmplY3QuY29uc3RydWN0b3IpO1xuICAgICAgICB2YXIgZXhjbHVkZXMgPSBmLmV4Y2x1ZGVDb25zdHJ1Y3RvcnMgfHxcbiAgICAgICAgICAgICAgICBmb3JtYXRpby5leGNsdWRlQ29uc3RydWN0b3JzIHx8IFtdO1xuXG4gICAgICAgIHZhciBpLCBsO1xuICAgICAgICBmb3IgKGkgPSAwLCBsID0gZXhjbHVkZXMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4Y2x1ZGVzW2ldID09PSBcInN0cmluZ1wiICYmIGV4Y2x1ZGVzW2ldID09PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV4Y2x1ZGVzW2ldLnRlc3QgJiYgZXhjbHVkZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNDaXJjdWxhcihvYmplY3QsIG9iamVjdHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgIT09IFwib2JqZWN0XCIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgIHZhciBpLCBsO1xuICAgICAgICBmb3IgKGkgPSAwLCBsID0gb2JqZWN0cy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChvYmplY3RzW2ldID09PSBvYmplY3QpIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXNjaWkoZiwgb2JqZWN0LCBwcm9jZXNzZWQsIGluZGVudCkge1xuICAgICAgICBpZiAodHlwZW9mIG9iamVjdCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgdmFyIHFzID0gZi5xdW90ZVN0cmluZ3M7XG4gICAgICAgICAgICB2YXIgcXVvdGUgPSB0eXBlb2YgcXMgIT09IFwiYm9vbGVhblwiIHx8IHFzO1xuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NlZCB8fCBxdW90ZSA/ICdcIicgKyBvYmplY3QgKyAnXCInIDogb2JqZWN0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QgPT09IFwiZnVuY3Rpb25cIiAmJiAhKG9iamVjdCBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICAgICAgICAgIHJldHVybiBhc2NpaS5mdW5jKG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzZWQgPSBwcm9jZXNzZWQgfHwgW107XG5cbiAgICAgICAgaWYgKGlzQ2lyY3VsYXIob2JqZWN0LCBwcm9jZXNzZWQpKSB7IHJldHVybiBcIltDaXJjdWxhcl1cIjsgfVxuXG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gYXNjaWkuYXJyYXkuY2FsbChmLCBvYmplY3QsIHByb2Nlc3NlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9iamVjdCkgeyByZXR1cm4gU3RyaW5nKCgxL29iamVjdCkgPT09IC1JbmZpbml0eSA/IFwiLTBcIiA6IG9iamVjdCk7IH1cbiAgICAgICAgaWYgKHNhbXNhbS5pc0VsZW1lbnQob2JqZWN0KSkgeyByZXR1cm4gYXNjaWkuZWxlbWVudChvYmplY3QpOyB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvYmplY3QudG9TdHJpbmcgPT09IFwiZnVuY3Rpb25cIiAmJlxuICAgICAgICAgICAgICAgIG9iamVjdC50b1N0cmluZyAhPT0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdC50b1N0cmluZygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGksIGw7XG4gICAgICAgIGZvciAoaSA9IDAsIGwgPSBzcGVjaWFsT2JqZWN0cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChvYmplY3QgPT09IHNwZWNpYWxPYmplY3RzW2ldLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzcGVjaWFsT2JqZWN0c1tpXS52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhc2NpaS5vYmplY3QuY2FsbChmLCBvYmplY3QsIHByb2Nlc3NlZCwgaW5kZW50KTtcbiAgICB9XG5cbiAgICBhc2NpaS5mdW5jID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICAgICAgcmV0dXJuIFwiZnVuY3Rpb24gXCIgKyBmdW5jdGlvbk5hbWUoZnVuYykgKyBcIigpIHt9XCI7XG4gICAgfTtcblxuICAgIGFzY2lpLmFycmF5ID0gZnVuY3Rpb24gKGFycmF5LCBwcm9jZXNzZWQpIHtcbiAgICAgICAgcHJvY2Vzc2VkID0gcHJvY2Vzc2VkIHx8IFtdO1xuICAgICAgICBwcm9jZXNzZWQucHVzaChhcnJheSk7XG4gICAgICAgIHZhciBwaWVjZXMgPSBbXTtcbiAgICAgICAgdmFyIGksIGw7XG4gICAgICAgIGwgPSAodGhpcy5saW1pdENoaWxkcmVuQ291bnQgPiAwKSA/IFxuICAgICAgICAgICAgTWF0aC5taW4odGhpcy5saW1pdENoaWxkcmVuQ291bnQsIGFycmF5Lmxlbmd0aCkgOiBhcnJheS5sZW5ndGg7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgcGllY2VzLnB1c2goYXNjaWkodGhpcywgYXJyYXlbaV0sIHByb2Nlc3NlZCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobCA8IGFycmF5Lmxlbmd0aClcbiAgICAgICAgICAgIHBpZWNlcy5wdXNoKFwiWy4uLiBcIiArIChhcnJheS5sZW5ndGggLSBsKSArIFwiIG1vcmUgZWxlbWVudHNdXCIpO1xuXG4gICAgICAgIHJldHVybiBcIltcIiArIHBpZWNlcy5qb2luKFwiLCBcIikgKyBcIl1cIjtcbiAgICB9O1xuXG4gICAgYXNjaWkub2JqZWN0ID0gZnVuY3Rpb24gKG9iamVjdCwgcHJvY2Vzc2VkLCBpbmRlbnQpIHtcbiAgICAgICAgcHJvY2Vzc2VkID0gcHJvY2Vzc2VkIHx8IFtdO1xuICAgICAgICBwcm9jZXNzZWQucHVzaChvYmplY3QpO1xuICAgICAgICBpbmRlbnQgPSBpbmRlbnQgfHwgMDtcbiAgICAgICAgdmFyIHBpZWNlcyA9IFtdLCBwcm9wZXJ0aWVzID0gc2Ftc2FtLmtleXMob2JqZWN0KS5zb3J0KCk7XG4gICAgICAgIHZhciBsZW5ndGggPSAzO1xuICAgICAgICB2YXIgcHJvcCwgc3RyLCBvYmosIGksIGssIGw7XG4gICAgICAgIGwgPSAodGhpcy5saW1pdENoaWxkcmVuQ291bnQgPiAwKSA/IFxuICAgICAgICAgICAgTWF0aC5taW4odGhpcy5saW1pdENoaWxkcmVuQ291bnQsIHByb3BlcnRpZXMubGVuZ3RoKSA6IHByb3BlcnRpZXMubGVuZ3RoO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgIHByb3AgPSBwcm9wZXJ0aWVzW2ldO1xuICAgICAgICAgICAgb2JqID0gb2JqZWN0W3Byb3BdO1xuXG4gICAgICAgICAgICBpZiAoaXNDaXJjdWxhcihvYmosIHByb2Nlc3NlZCkpIHtcbiAgICAgICAgICAgICAgICBzdHIgPSBcIltDaXJjdWxhcl1cIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RyID0gYXNjaWkodGhpcywgb2JqLCBwcm9jZXNzZWQsIGluZGVudCArIDIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzdHIgPSAoL1xccy8udGVzdChwcm9wKSA/ICdcIicgKyBwcm9wICsgJ1wiJyA6IHByb3ApICsgXCI6IFwiICsgc3RyO1xuICAgICAgICAgICAgbGVuZ3RoICs9IHN0ci5sZW5ndGg7XG4gICAgICAgICAgICBwaWVjZXMucHVzaChzdHIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbnMgPSBjb25zdHJ1Y3Rvck5hbWUodGhpcywgb2JqZWN0KTtcbiAgICAgICAgdmFyIHByZWZpeCA9IGNvbnMgPyBcIltcIiArIGNvbnMgKyBcIl0gXCIgOiBcIlwiO1xuICAgICAgICB2YXIgaXMgPSBcIlwiO1xuICAgICAgICBmb3IgKGkgPSAwLCBrID0gaW5kZW50OyBpIDwgazsgKytpKSB7IGlzICs9IFwiIFwiOyB9XG5cbiAgICAgICAgaWYobCA8IHByb3BlcnRpZXMubGVuZ3RoKVxuICAgICAgICAgICAgcGllY2VzLnB1c2goXCJbLi4uIFwiICsgKHByb3BlcnRpZXMubGVuZ3RoIC0gbCkgKyBcIiBtb3JlIGVsZW1lbnRzXVwiKTtcblxuICAgICAgICBpZiAobGVuZ3RoICsgaW5kZW50ID4gODApIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyBcIntcXG4gIFwiICsgaXMgKyBwaWVjZXMuam9pbihcIixcXG4gIFwiICsgaXMpICsgXCJcXG5cIiArXG4gICAgICAgICAgICAgICAgaXMgKyBcIn1cIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJlZml4ICsgXCJ7IFwiICsgcGllY2VzLmpvaW4oXCIsIFwiKSArIFwiIH1cIjtcbiAgICB9O1xuXG4gICAgYXNjaWkuZWxlbWVudCA9IGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHZhciB0YWdOYW1lID0gZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBhdHRycyA9IGVsZW1lbnQuYXR0cmlidXRlcywgYXR0ciwgcGFpcnMgPSBbXSwgYXR0ck5hbWUsIGksIGwsIHZhbDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gYXR0cnMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICBhdHRyID0gYXR0cnMuaXRlbShpKTtcbiAgICAgICAgICAgIGF0dHJOYW1lID0gYXR0ci5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoXCJodG1sOlwiLCBcIlwiKTtcbiAgICAgICAgICAgIHZhbCA9IGF0dHIubm9kZVZhbHVlO1xuICAgICAgICAgICAgaWYgKGF0dHJOYW1lICE9PSBcImNvbnRlbnRlZGl0YWJsZVwiIHx8IHZhbCAhPT0gXCJpbmhlcml0XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoISF2YWwpIHsgcGFpcnMucHVzaChhdHRyTmFtZSArIFwiPVxcXCJcIiArIHZhbCArIFwiXFxcIlwiKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGZvcm1hdHRlZCA9IFwiPFwiICsgdGFnTmFtZSArIChwYWlycy5sZW5ndGggPiAwID8gXCIgXCIgOiBcIlwiKTtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBlbGVtZW50LmlubmVySFRNTDtcblxuICAgICAgICBpZiAoY29udGVudC5sZW5ndGggPiAyMCkge1xuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQuc3Vic3RyKDAsIDIwKSArIFwiWy4uLl1cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXMgPSBmb3JtYXR0ZWQgKyBwYWlycy5qb2luKFwiIFwiKSArIFwiPlwiICsgY29udGVudCArXG4gICAgICAgICAgICAgICAgXCI8L1wiICsgdGFnTmFtZSArIFwiPlwiO1xuXG4gICAgICAgIHJldHVybiByZXMucmVwbGFjZSgvIGNvbnRlbnRFZGl0YWJsZT1cImluaGVyaXRcIi8sIFwiXCIpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBGb3JtYXRpbyhvcHRpb25zKSB7XG4gICAgICAgIGZvciAodmFyIG9wdCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICB0aGlzW29wdF0gPSBvcHRpb25zW29wdF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBGb3JtYXRpby5wcm90b3R5cGUgPSB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogZnVuY3Rpb25OYW1lLFxuXG4gICAgICAgIGNvbmZpZ3VyZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRm9ybWF0aW8ob3B0aW9ucyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgY29uc3RydWN0b3JOYW1lOiBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gY29uc3RydWN0b3JOYW1lKHRoaXMsIG9iamVjdCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXNjaWk6IGZ1bmN0aW9uIChvYmplY3QsIHByb2Nlc3NlZCwgaW5kZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gYXNjaWkodGhpcywgb2JqZWN0LCBwcm9jZXNzZWQsIGluZGVudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIEZvcm1hdGlvLnByb3RvdHlwZTtcbn0pO1xuIiwiLypnbG9iYWwgZ2xvYmFsLCB3aW5kb3cqL1xuLyoqXG4gKiBAYXV0aG9yIENocmlzdGlhbiBKb2hhbnNlbiAoY2hyaXN0aWFuQGNqb2hhbnNlbi5ubykgYW5kIGNvbnRyaWJ1dG9yc1xuICogQGxpY2Vuc2UgQlNEXG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTQgQ2hyaXN0aWFuIEpvaGFuc2VuXG4gKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIC8vIE1ha2UgcHJvcGVydGllcyB3cml0YWJsZSBpbiBJRSwgYXMgcGVyXG4gICAgLy8gaHR0cDovL3d3dy5hZGVxdWF0ZWx5Z29vZC5jb20vUmVwbGFjaW5nLXNldFRpbWVvdXQtR2xvYmFsbHkuaHRtbFxuICAgIC8vIEpTTGludCBiZWluZyBhbmFsXG4gICAgdmFyIGdsYmwgPSBnbG9iYWw7XG5cbiAgICBnbG9iYWwuc2V0VGltZW91dCA9IGdsYmwuc2V0VGltZW91dDtcbiAgICBnbG9iYWwuY2xlYXJUaW1lb3V0ID0gZ2xibC5jbGVhclRpbWVvdXQ7XG4gICAgZ2xvYmFsLnNldEludGVydmFsID0gZ2xibC5zZXRJbnRlcnZhbDtcbiAgICBnbG9iYWwuY2xlYXJJbnRlcnZhbCA9IGdsYmwuY2xlYXJJbnRlcnZhbDtcbiAgICBnbG9iYWwuRGF0ZSA9IGdsYmwuRGF0ZTtcblxuICAgIC8vIHNldEltbWVkaWF0ZSBpcyBub3QgYSBzdGFuZGFyZCBmdW5jdGlvblxuICAgIC8vIGF2b2lkIGFkZGluZyB0aGUgcHJvcCB0byB0aGUgd2luZG93IG9iamVjdCBpZiBub3QgcHJlc2VudFxuICAgIGlmKCdzZXRJbW1lZGlhdGUnIGluIGdsb2JhbCkge1xuICAgICAgICBnbG9iYWwuc2V0SW1tZWRpYXRlID0gZ2xibC5zZXRJbW1lZGlhdGU7XG4gICAgICAgIGdsb2JhbC5jbGVhckltbWVkaWF0ZSA9IGdsYmwuY2xlYXJJbW1lZGlhdGU7XG4gICAgfVxuXG4gICAgLy8gbm9kZSBleHBlY3RzIHNldFRpbWVvdXQvc2V0SW50ZXJ2YWwgdG8gcmV0dXJuIGEgZm4gb2JqZWN0IHcvIC5yZWYoKS8udW5yZWYoKVxuICAgIC8vIGJyb3dzZXJzLCBhIG51bWJlci5cbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2Nqb2hhbnNlbi9TaW5vbi5KUy9wdWxsLzQzNlxuXG4gICAgdmFyIE5PT1AgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB1bmRlZmluZWQ7IH07XG4gICAgdmFyIHRpbWVvdXRSZXN1bHQgPSBzZXRUaW1lb3V0KE5PT1AsIDApO1xuICAgIHZhciBhZGRUaW1lclJldHVybnNPYmplY3QgPSB0eXBlb2YgdGltZW91dFJlc3VsdCA9PT0gXCJvYmplY3RcIjtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dFJlc3VsdCk7XG5cbiAgICB2YXIgTmF0aXZlRGF0ZSA9IERhdGU7XG4gICAgdmFyIHVuaXF1ZVRpbWVySWQgPSAxO1xuXG4gICAgLyoqXG4gICAgICogUGFyc2Ugc3RyaW5ncyBsaWtlIFwiMDE6MTA6MDBcIiAobWVhbmluZyAxIGhvdXIsIDEwIG1pbnV0ZXMsIDAgc2Vjb25kcykgaW50b1xuICAgICAqIG51bWJlciBvZiBtaWxsaXNlY29uZHMuIFRoaXMgaXMgdXNlZCB0byBzdXBwb3J0IGh1bWFuLXJlYWRhYmxlIHN0cmluZ3MgcGFzc2VkXG4gICAgICogdG8gY2xvY2sudGljaygpXG4gICAgICovXG4gICAgZnVuY3Rpb24gcGFyc2VUaW1lKHN0cikge1xuICAgICAgICBpZiAoIXN0cikge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc3RyaW5ncyA9IHN0ci5zcGxpdChcIjpcIik7XG4gICAgICAgIHZhciBsID0gc3RyaW5ncy5sZW5ndGgsIGkgPSBsO1xuICAgICAgICB2YXIgbXMgPSAwLCBwYXJzZWQ7XG5cbiAgICAgICAgaWYgKGwgPiAzIHx8ICEvXihcXGRcXGQ6KXswLDJ9XFxkXFxkPyQvLnRlc3Qoc3RyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGljayBvbmx5IHVuZGVyc3RhbmRzIG51bWJlcnMgYW5kICdoOm06cydcIik7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBwYXJzZWQgPSBwYXJzZUludChzdHJpbmdzW2ldLCAxMCk7XG5cbiAgICAgICAgICAgIGlmIChwYXJzZWQgPj0gNjApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHRpbWUgXCIgKyBzdHIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtcyArPSBwYXJzZWQgKiBNYXRoLnBvdyg2MCwgKGwgLSBpIC0gMSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1zICogMTAwMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGdyb2sgdGhlIGBub3dgIHBhcmFtZXRlciB0byBjcmVhdGVDbG9jay5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRFcG9jaChlcG9jaCkge1xuICAgICAgICBpZiAoIWVwb2NoKSB7IHJldHVybiAwOyB9XG4gICAgICAgIGlmICh0eXBlb2YgZXBvY2guZ2V0VGltZSA9PT0gXCJmdW5jdGlvblwiKSB7IHJldHVybiBlcG9jaC5nZXRUaW1lKCk7IH1cbiAgICAgICAgaWYgKHR5cGVvZiBlcG9jaCA9PT0gXCJudW1iZXJcIikgeyByZXR1cm4gZXBvY2g7IH1cbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm5vdyBzaG91bGQgYmUgbWlsbGlzZWNvbmRzIHNpbmNlIFVOSVggZXBvY2hcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5SYW5nZShmcm9tLCB0bywgdGltZXIpIHtcbiAgICAgICAgcmV0dXJuIHRpbWVyICYmIHRpbWVyLmNhbGxBdCA+PSBmcm9tICYmIHRpbWVyLmNhbGxBdCA8PSB0bztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtaXJyb3JEYXRlUHJvcGVydGllcyh0YXJnZXQsIHNvdXJjZSkge1xuICAgICAgICB2YXIgcHJvcDtcbiAgICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBzcGVjaWFsIG5vdyBpbXBsZW1lbnRhdGlvblxuICAgICAgICBpZiAoc291cmNlLm5vdykge1xuICAgICAgICAgICAgdGFyZ2V0Lm5vdyA9IGZ1bmN0aW9uIG5vdygpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0LmNsb2NrLm5vdztcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgdGFyZ2V0Lm5vdztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBzcGVjaWFsIHRvU291cmNlIGltcGxlbWVudGF0aW9uXG4gICAgICAgIGlmIChzb3VyY2UudG9Tb3VyY2UpIHtcbiAgICAgICAgICAgIHRhcmdldC50b1NvdXJjZSA9IGZ1bmN0aW9uIHRvU291cmNlKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzb3VyY2UudG9Tb3VyY2UoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgdGFyZ2V0LnRvU291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHNwZWNpYWwgdG9TdHJpbmcgaW1wbGVtZW50YXRpb25cbiAgICAgICAgdGFyZ2V0LnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gICAgICAgICAgICByZXR1cm4gc291cmNlLnRvU3RyaW5nKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGFyZ2V0LnByb3RvdHlwZSA9IHNvdXJjZS5wcm90b3R5cGU7XG4gICAgICAgIHRhcmdldC5wYXJzZSA9IHNvdXJjZS5wYXJzZTtcbiAgICAgICAgdGFyZ2V0LlVUQyA9IHNvdXJjZS5VVEM7XG4gICAgICAgIHRhcmdldC5wcm90b3R5cGUudG9VVENTdHJpbmcgPSBzb3VyY2UucHJvdG90eXBlLnRvVVRDU3RyaW5nO1xuXG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlRGF0ZSgpIHtcbiAgICAgICAgZnVuY3Rpb24gQ2xvY2tEYXRlKHllYXIsIG1vbnRoLCBkYXRlLCBob3VyLCBtaW51dGUsIHNlY29uZCwgbXMpIHtcbiAgICAgICAgICAgIC8vIERlZmVuc2l2ZSBhbmQgdmVyYm9zZSB0byBhdm9pZCBwb3RlbnRpYWwgaGFybSBpbiBwYXNzaW5nXG4gICAgICAgICAgICAvLyBleHBsaWNpdCB1bmRlZmluZWQgd2hlbiB1c2VyIGRvZXMgbm90IHBhc3MgYXJndW1lbnRcbiAgICAgICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTmF0aXZlRGF0ZShDbG9ja0RhdGUuY2xvY2subm93KTtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5hdGl2ZURhdGUoeWVhcik7XG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBOYXRpdmVEYXRlKHllYXIsIG1vbnRoKTtcbiAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5hdGl2ZURhdGUoeWVhciwgbW9udGgsIGRhdGUpO1xuICAgICAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTmF0aXZlRGF0ZSh5ZWFyLCBtb250aCwgZGF0ZSwgaG91cik7XG4gICAgICAgICAgICBjYXNlIDU6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBOYXRpdmVEYXRlKHllYXIsIG1vbnRoLCBkYXRlLCBob3VyLCBtaW51dGUpO1xuICAgICAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTmF0aXZlRGF0ZSh5ZWFyLCBtb250aCwgZGF0ZSwgaG91ciwgbWludXRlLCBzZWNvbmQpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5hdGl2ZURhdGUoeWVhciwgbW9udGgsIGRhdGUsIGhvdXIsIG1pbnV0ZSwgc2Vjb25kLCBtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbWlycm9yRGF0ZVByb3BlcnRpZXMoQ2xvY2tEYXRlLCBOYXRpdmVEYXRlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRUaW1lcihjbG9jaywgdGltZXIpIHtcbiAgICAgICAgaWYgKHRpbWVyLmZ1bmMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgbXVzdCBiZSBwcm92aWRlZCB0byB0aW1lciBjYWxsc1wiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2xvY2sudGltZXJzKSB7XG4gICAgICAgICAgICBjbG9jay50aW1lcnMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRpbWVyLmlkID0gdW5pcXVlVGltZXJJZCsrO1xuICAgICAgICB0aW1lci5jcmVhdGVkQXQgPSBjbG9jay5ub3c7XG4gICAgICAgIHRpbWVyLmNhbGxBdCA9IGNsb2NrLm5vdyArICh0aW1lci5kZWxheSB8fCAoY2xvY2suZHVyaW5nVGljayA/IDEgOiAwKSk7XG5cbiAgICAgICAgY2xvY2sudGltZXJzW3RpbWVyLmlkXSA9IHRpbWVyO1xuXG4gICAgICAgIGlmIChhZGRUaW1lclJldHVybnNPYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaWQ6IHRpbWVyLmlkLFxuICAgICAgICAgICAgICAgIHJlZjogTk9PUCxcbiAgICAgICAgICAgICAgICB1bnJlZjogTk9PUFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aW1lci5pZDtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGNvbXBhcmVUaW1lcnMoYSwgYikge1xuICAgICAgICAvLyBTb3J0IGZpcnN0IGJ5IGFic29sdXRlIHRpbWluZ1xuICAgICAgICBpZiAoYS5jYWxsQXQgPCBiLmNhbGxBdCkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhLmNhbGxBdCA+IGIuY2FsbEF0KSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQgbmV4dCBieSBpbW1lZGlhdGUsIGltbWVkaWF0ZSB0aW1lcnMgdGFrZSBwcmVjZWRlbmNlXG4gICAgICAgIGlmIChhLmltbWVkaWF0ZSAmJiAhYi5pbW1lZGlhdGUpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWEuaW1tZWRpYXRlICYmIGIuaW1tZWRpYXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQgbmV4dCBieSBjcmVhdGlvbiB0aW1lLCBlYXJsaWVyLWNyZWF0ZWQgdGltZXJzIHRha2UgcHJlY2VkZW5jZVxuICAgICAgICBpZiAoYS5jcmVhdGVkQXQgPCBiLmNyZWF0ZWRBdCkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhLmNyZWF0ZWRBdCA+IGIuY3JlYXRlZEF0KSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQgbmV4dCBieSBpZCwgbG93ZXItaWQgdGltZXJzIHRha2UgcHJlY2VkZW5jZVxuICAgICAgICBpZiAoYS5pZCA8IGIuaWQpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYS5pZCA+IGIuaWQpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXMgdGltZXIgaWRzIGFyZSB1bmlxdWUsIG5vIGZhbGxiYWNrIGAwYCBpcyBuZWNlc3NhcnlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaXJzdFRpbWVySW5SYW5nZShjbG9jaywgZnJvbSwgdG8pIHtcbiAgICAgICAgdmFyIHRpbWVycyA9IGNsb2NrLnRpbWVycyxcbiAgICAgICAgICAgIHRpbWVyID0gbnVsbCxcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgaXNJblJhbmdlO1xuXG4gICAgICAgIGZvciAoaWQgaW4gdGltZXJzKSB7XG4gICAgICAgICAgICBpZiAodGltZXJzLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgICAgIGlzSW5SYW5nZSA9IGluUmFuZ2UoZnJvbSwgdG8sIHRpbWVyc1tpZF0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzSW5SYW5nZSAmJiAoIXRpbWVyIHx8IGNvbXBhcmVUaW1lcnModGltZXIsIHRpbWVyc1tpZF0pID09PSAxKSkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lciA9IHRpbWVyc1tpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRpbWVyO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGxUaW1lcihjbG9jaywgdGltZXIpIHtcbiAgICAgICAgdmFyIGV4Y2VwdGlvbjtcblxuICAgICAgICBpZiAodHlwZW9mIHRpbWVyLmludGVydmFsID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICBjbG9jay50aW1lcnNbdGltZXIuaWRdLmNhbGxBdCArPSB0aW1lci5pbnRlcnZhbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSBjbG9jay50aW1lcnNbdGltZXIuaWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGltZXIuZnVuYyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgdGltZXIuZnVuYy5hcHBseShudWxsLCB0aW1lci5hcmdzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXZhbCh0aW1lci5mdW5jKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgZXhjZXB0aW9uID0gZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2xvY2sudGltZXJzW3RpbWVyLmlkXSkge1xuICAgICAgICAgICAgaWYgKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRpbWVyVHlwZSh0aW1lcikge1xuICAgICAgICBpZiAodGltZXIuaW1tZWRpYXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJJbW1lZGlhdGVcIjtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGltZXIuaW50ZXJ2YWwgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBcIkludGVydmFsXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gXCJUaW1lb3V0XCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGVhclRpbWVyKGNsb2NrLCB0aW1lcklkLCB0dHlwZSkge1xuICAgICAgICBpZiAoIXRpbWVySWQpIHtcbiAgICAgICAgICAgIC8vIG51bGwgYXBwZWFycyB0byBiZSBhbGxvd2VkIGluIG1vc3QgYnJvd3NlcnMsIGFuZCBhcHBlYXJzIHRvIGJlXG4gICAgICAgICAgICAvLyByZWxpZWQgdXBvbiBieSBzb21lIGxpYnJhcmllcywgbGlrZSBCb290c3RyYXAgY2Fyb3VzZWxcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2xvY2sudGltZXJzKSB7XG4gICAgICAgICAgICBjbG9jay50aW1lcnMgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluIE5vZGUsIHRpbWVySWQgaXMgYW4gb2JqZWN0IHdpdGggLnJlZigpLy51bnJlZigpLCBhbmRcbiAgICAgICAgLy8gaXRzIC5pZCBmaWVsZCBpcyB0aGUgYWN0dWFsIHRpbWVyIGlkLlxuICAgICAgICBpZiAodHlwZW9mIHRpbWVySWQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgIHRpbWVySWQgPSB0aW1lcklkLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNsb2NrLnRpbWVycy5oYXNPd25Qcm9wZXJ0eSh0aW1lcklkKSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCB0aGUgSUQgbWF0Y2hlcyBhIHRpbWVyIG9mIHRoZSBjb3JyZWN0IHR5cGVcbiAgICAgICAgICAgIHZhciB0aW1lciA9IGNsb2NrLnRpbWVyc1t0aW1lcklkXTtcbiAgICAgICAgICAgIGlmICh0aW1lclR5cGUodGltZXIpID09PSB0dHlwZSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBjbG9jay50aW1lcnNbdGltZXJJZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgY2xlYXIgdGltZXI6IHRpbWVyIGNyZWF0ZWQgd2l0aCBzZXRcIiArIHR0eXBlICsgXCIoKSBidXQgY2xlYXJlZCB3aXRoIGNsZWFyXCIgKyB0aW1lclR5cGUodGltZXIpICsgXCIoKVwiKTtcblx0XHRcdH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVuaW5zdGFsbChjbG9jaywgdGFyZ2V0KSB7XG4gICAgICAgIHZhciBtZXRob2QsXG4gICAgICAgICAgICBpLFxuICAgICAgICAgICAgbDtcblxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gY2xvY2subWV0aG9kcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIG1ldGhvZCA9IGNsb2NrLm1ldGhvZHNbaV07XG5cbiAgICAgICAgICAgIGlmICh0YXJnZXRbbWV0aG9kXS5oYWRPd25Qcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFttZXRob2RdID0gY2xvY2tbXCJfXCIgKyBtZXRob2RdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGFyZ2V0W21ldGhvZF07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUHJldmVudCBtdWx0aXBsZSBleGVjdXRpb25zIHdoaWNoIHdpbGwgY29tcGxldGVseSByZW1vdmUgdGhlc2UgcHJvcHNcbiAgICAgICAgY2xvY2subWV0aG9kcyA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhpamFja01ldGhvZCh0YXJnZXQsIG1ldGhvZCwgY2xvY2spIHtcbiAgICAgICAgdmFyIHByb3A7XG5cbiAgICAgICAgY2xvY2tbbWV0aG9kXS5oYWRPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsIG1ldGhvZCk7XG4gICAgICAgIGNsb2NrW1wiX1wiICsgbWV0aG9kXSA9IHRhcmdldFttZXRob2RdO1xuXG4gICAgICAgIGlmIChtZXRob2QgPT09IFwiRGF0ZVwiKSB7XG4gICAgICAgICAgICB2YXIgZGF0ZSA9IG1pcnJvckRhdGVQcm9wZXJ0aWVzKGNsb2NrW21ldGhvZF0sIHRhcmdldFttZXRob2RdKTtcbiAgICAgICAgICAgIHRhcmdldFttZXRob2RdID0gZGF0ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhcmdldFttZXRob2RdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjbG9ja1ttZXRob2RdLmFwcGx5KGNsb2NrLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yIChwcm9wIGluIGNsb2NrW21ldGhvZF0pIHtcbiAgICAgICAgICAgICAgICBpZiAoY2xvY2tbbWV0aG9kXS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRbbWV0aG9kXVtwcm9wXSA9IGNsb2NrW21ldGhvZF1bcHJvcF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGFyZ2V0W21ldGhvZF0uY2xvY2sgPSBjbG9jaztcbiAgICB9XG5cbiAgICB2YXIgdGltZXJzID0ge1xuICAgICAgICBzZXRUaW1lb3V0OiBzZXRUaW1lb3V0LFxuICAgICAgICBjbGVhclRpbWVvdXQ6IGNsZWFyVGltZW91dCxcbiAgICAgICAgc2V0SW1tZWRpYXRlOiBnbG9iYWwuc2V0SW1tZWRpYXRlLFxuICAgICAgICBjbGVhckltbWVkaWF0ZTogZ2xvYmFsLmNsZWFySW1tZWRpYXRlLFxuICAgICAgICBzZXRJbnRlcnZhbDogc2V0SW50ZXJ2YWwsXG4gICAgICAgIGNsZWFySW50ZXJ2YWw6IGNsZWFySW50ZXJ2YWwsXG4gICAgICAgIERhdGU6IERhdGVcbiAgICB9O1xuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHZhciBrcyA9IFtdLFxuICAgICAgICAgICAga2V5O1xuXG4gICAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAga3MucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGtzO1xuICAgIH07XG5cbiAgICBleHBvcnRzLnRpbWVycyA9IHRpbWVycztcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUNsb2NrKG5vdykge1xuICAgICAgICB2YXIgY2xvY2sgPSB7XG4gICAgICAgICAgICBub3c6IGdldEVwb2NoKG5vdyksXG4gICAgICAgICAgICB0aW1lb3V0czoge30sXG4gICAgICAgICAgICBEYXRlOiBjcmVhdGVEYXRlKClcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay5EYXRlLmNsb2NrID0gY2xvY2s7XG5cbiAgICAgICAgY2xvY2suc2V0VGltZW91dCA9IGZ1bmN0aW9uIHNldFRpbWVvdXQoZnVuYywgdGltZW91dCkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRpbWVyKGNsb2NrLCB7XG4gICAgICAgICAgICAgICAgZnVuYzogZnVuYyxcbiAgICAgICAgICAgICAgICBhcmdzOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpLFxuICAgICAgICAgICAgICAgIGRlbGF5OiB0aW1lb3V0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay5jbGVhclRpbWVvdXQgPSBmdW5jdGlvbiBjbGVhclRpbWVvdXQodGltZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNsZWFyVGltZXIoY2xvY2ssIHRpbWVySWQsIFwiVGltZW91dFwiKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uIHNldEludGVydmFsKGZ1bmMsIHRpbWVvdXQpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUaW1lcihjbG9jaywge1xuICAgICAgICAgICAgICAgIGZ1bmM6IGZ1bmMsXG4gICAgICAgICAgICAgICAgYXJnczogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSxcbiAgICAgICAgICAgICAgICBkZWxheTogdGltZW91dCxcbiAgICAgICAgICAgICAgICBpbnRlcnZhbDogdGltZW91dFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2suY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uIGNsZWFySW50ZXJ2YWwodGltZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNsZWFyVGltZXIoY2xvY2ssIHRpbWVySWQsIFwiSW50ZXJ2YWxcIik7XG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2suc2V0SW1tZWRpYXRlID0gZnVuY3Rpb24gc2V0SW1tZWRpYXRlKGZ1bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUaW1lcihjbG9jaywge1xuICAgICAgICAgICAgICAgIGZ1bmM6IGZ1bmMsXG4gICAgICAgICAgICAgICAgYXJnczogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgICAgICAgICAgICBpbW1lZGlhdGU6IHRydWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsb2NrLmNsZWFySW1tZWRpYXRlID0gZnVuY3Rpb24gY2xlYXJJbW1lZGlhdGUodGltZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNsZWFyVGltZXIoY2xvY2ssIHRpbWVySWQsIFwiSW1tZWRpYXRlXCIpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsb2NrLnRpY2sgPSBmdW5jdGlvbiB0aWNrKG1zKSB7XG4gICAgICAgICAgICBtcyA9IHR5cGVvZiBtcyA9PT0gXCJudW1iZXJcIiA/IG1zIDogcGFyc2VUaW1lKG1zKTtcbiAgICAgICAgICAgIHZhciB0aWNrRnJvbSA9IGNsb2NrLm5vdywgdGlja1RvID0gY2xvY2subm93ICsgbXMsIHByZXZpb3VzID0gY2xvY2subm93O1xuICAgICAgICAgICAgdmFyIHRpbWVyID0gZmlyc3RUaW1lckluUmFuZ2UoY2xvY2ssIHRpY2tGcm9tLCB0aWNrVG8pO1xuICAgICAgICAgICAgdmFyIG9sZE5vdztcblxuICAgICAgICAgICAgY2xvY2suZHVyaW5nVGljayA9IHRydWU7XG5cbiAgICAgICAgICAgIHZhciBmaXJzdEV4Y2VwdGlvbjtcbiAgICAgICAgICAgIHdoaWxlICh0aW1lciAmJiB0aWNrRnJvbSA8PSB0aWNrVG8pIHtcbiAgICAgICAgICAgICAgICBpZiAoY2xvY2sudGltZXJzW3RpbWVyLmlkXSkge1xuICAgICAgICAgICAgICAgICAgICB0aWNrRnJvbSA9IGNsb2NrLm5vdyA9IHRpbWVyLmNhbGxBdDtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9sZE5vdyA9IGNsb2NrLm5vdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxUaW1lcihjbG9jaywgdGltZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29tcGVuc2F0ZSBmb3IgYW55IHNldFN5c3RlbVRpbWUoKSBjYWxsIGR1cmluZyB0aW1lciBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9sZE5vdyAhPT0gY2xvY2subm93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja0Zyb20gKz0gY2xvY2subm93IC0gb2xkTm93O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tUbyArPSBjbG9jay5ub3cgLSBvbGROb3c7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgKz0gY2xvY2subm93IC0gb2xkTm93O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaXJzdEV4Y2VwdGlvbiA9IGZpcnN0RXhjZXB0aW9uIHx8IGU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aW1lciA9IGZpcnN0VGltZXJJblJhbmdlKGNsb2NrLCBwcmV2aW91cywgdGlja1RvKTtcbiAgICAgICAgICAgICAgICBwcmV2aW91cyA9IHRpY2tGcm9tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjbG9jay5kdXJpbmdUaWNrID0gZmFsc2U7XG4gICAgICAgICAgICBjbG9jay5ub3cgPSB0aWNrVG87XG5cbiAgICAgICAgICAgIGlmIChmaXJzdEV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgIHRocm93IGZpcnN0RXhjZXB0aW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY2xvY2subm93O1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsb2NrLnJlc2V0ID0gZnVuY3Rpb24gcmVzZXQoKSB7XG4gICAgICAgICAgICBjbG9jay50aW1lcnMgPSB7fTtcbiAgICAgICAgfTtcblxuICAgICAgICBjbG9jay5zZXRTeXN0ZW1UaW1lID0gZnVuY3Rpb24gc2V0U3lzdGVtVGltZShub3cpIHtcbiAgICAgICAgICAgIC8vIGRldGVybWluZSB0aW1lIGRpZmZlcmVuY2VcbiAgICAgICAgICAgIHZhciBuZXdOb3cgPSBnZXRFcG9jaChub3cpO1xuICAgICAgICAgICAgdmFyIGRpZmZlcmVuY2UgPSBuZXdOb3cgLSBjbG9jay5ub3c7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSAnc3lzdGVtIGNsb2NrJ1xuICAgICAgICAgICAgY2xvY2subm93ID0gbmV3Tm93O1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgdGltZXJzIGFuZCBpbnRlcnZhbHMgdG8ga2VlcCB0aGVtIHN0YWJsZVxuICAgICAgICAgICAgZm9yICh2YXIgaWQgaW4gY2xvY2sudGltZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNsb2NrLnRpbWVycy5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRpbWVyID0gY2xvY2sudGltZXJzW2lkXTtcbiAgICAgICAgICAgICAgICAgICAgdGltZXIuY3JlYXRlZEF0ICs9IGRpZmZlcmVuY2U7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVyLmNhbGxBdCArPSBkaWZmZXJlbmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gY2xvY2s7XG4gICAgfVxuICAgIGV4cG9ydHMuY3JlYXRlQ2xvY2sgPSBjcmVhdGVDbG9jaztcblxuICAgIGV4cG9ydHMuaW5zdGFsbCA9IGZ1bmN0aW9uIGluc3RhbGwodGFyZ2V0LCBub3csIHRvRmFrZSkge1xuICAgICAgICB2YXIgaSxcbiAgICAgICAgICAgIGw7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgIHRvRmFrZSA9IG5vdztcbiAgICAgICAgICAgIG5vdyA9IHRhcmdldDtcbiAgICAgICAgICAgIHRhcmdldCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gZ2xvYmFsO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNsb2NrID0gY3JlYXRlQ2xvY2sobm93KTtcblxuICAgICAgICBjbG9jay51bmluc3RhbGwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB1bmluc3RhbGwoY2xvY2ssIHRhcmdldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY2xvY2subWV0aG9kcyA9IHRvRmFrZSB8fCBbXTtcblxuICAgICAgICBpZiAoY2xvY2subWV0aG9kcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNsb2NrLm1ldGhvZHMgPSBrZXlzKHRpbWVycyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gY2xvY2subWV0aG9kcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGhpamFja01ldGhvZCh0YXJnZXQsIGNsb2NrLm1ldGhvZHNbaV0sIGNsb2NrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbG9jaztcbiAgICB9O1xuXG59KGdsb2JhbCB8fCB0aGlzKSk7XG4iLCIoKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kICYmIGZ1bmN0aW9uIChtKSB7IGRlZmluZShcInNhbXNhbVwiLCBtKTsgfSkgfHxcbiAodHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgZnVuY3Rpb24gKG0pIHsgbW9kdWxlLmV4cG9ydHMgPSBtKCk7IH0pIHx8IC8vIE5vZGVcbiBmdW5jdGlvbiAobSkgeyB0aGlzLnNhbXNhbSA9IG0oKTsgfSAvLyBCcm93c2VyIGdsb2JhbHNcbikoZnVuY3Rpb24gKCkge1xuICAgIHZhciBvID0gT2JqZWN0LnByb3RvdHlwZTtcbiAgICB2YXIgZGl2ID0gdHlwZW9mIGRvY3VtZW50ICE9PSBcInVuZGVmaW5lZFwiICYmIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cbiAgICBmdW5jdGlvbiBpc05hTih2YWx1ZSkge1xuICAgICAgICAvLyBVbmxpa2UgZ2xvYmFsIGlzTmFOLCB0aGlzIGF2b2lkcyB0eXBlIGNvZXJjaW9uXG4gICAgICAgIC8vIHR5cGVvZiBjaGVjayBhdm9pZHMgSUUgaG9zdCBvYmplY3QgaXNzdWVzLCBoYXQgdGlwIHRvXG4gICAgICAgIC8vIGxvZGFzaFxuICAgICAgICB2YXIgdmFsID0gdmFsdWU7IC8vIEpzTGludCB0aGlua3MgdmFsdWUgIT09IHZhbHVlIGlzIFwid2VpcmRcIlxuICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiICYmIHZhbHVlICE9PSB2YWw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Q2xhc3ModmFsdWUpIHtcbiAgICAgICAgLy8gUmV0dXJucyB0aGUgaW50ZXJuYWwgW1tDbGFzc11dIGJ5IGNhbGxpbmcgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuICAgICAgICAvLyB3aXRoIHRoZSBwcm92aWRlZCB2YWx1ZSBhcyB0aGlzLiBSZXR1cm4gdmFsdWUgaXMgYSBzdHJpbmcsIG5hbWluZyB0aGVcbiAgICAgICAgLy8gaW50ZXJuYWwgY2xhc3MsIGUuZy4gXCJBcnJheVwiXG4gICAgICAgIHJldHVybiBvLnRvU3RyaW5nLmNhbGwodmFsdWUpLnNwbGl0KC9bIFxcXV0vKVsxXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBzYW1zYW0uaXNBcmd1bWVudHNcbiAgICAgKiBAcGFyYW0gT2JqZWN0IG9iamVjdFxuICAgICAqXG4gICAgICogUmV0dXJucyBgYHRydWVgYCBpZiBgYG9iamVjdGBgIGlzIGFuIGBgYXJndW1lbnRzYGAgb2JqZWN0LFxuICAgICAqIGBgZmFsc2VgYCBvdGhlcndpc2UuXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNBcmd1bWVudHMob2JqZWN0KSB7XG4gICAgICAgIGlmIChnZXRDbGFzcyhvYmplY3QpID09PSAnQXJndW1lbnRzJykgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICBpZiAodHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIiB8fCB0eXBlb2Ygb2JqZWN0Lmxlbmd0aCAhPT0gXCJudW1iZXJcIiB8fFxuICAgICAgICAgICAgICAgIGdldENsYXNzKG9iamVjdCkgPT09IFwiQXJyYXlcIikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0LmNhbGxlZSA9PSBcImZ1bmN0aW9uXCIpIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG9iamVjdFtvYmplY3QubGVuZ3RoXSA9IDY7XG4gICAgICAgICAgICBkZWxldGUgb2JqZWN0W29iamVjdC5sZW5ndGhdO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgc2Ftc2FtLmlzRWxlbWVudFxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqZWN0XG4gICAgICpcbiAgICAgKiBSZXR1cm5zIGBgdHJ1ZWBgIGlmIGBgb2JqZWN0YGAgaXMgYSBET00gZWxlbWVudCBub2RlLiBVbmxpa2VcbiAgICAgKiBVbmRlcnNjb3JlLmpzL2xvZGFzaCwgdGhpcyBmdW5jdGlvbiB3aWxsIHJldHVybiBgYGZhbHNlYGAgaWYgYGBvYmplY3RgYFxuICAgICAqIGlzIGFuICplbGVtZW50LWxpa2UqIG9iamVjdCwgaS5lLiBhIHJlZ3VsYXIgb2JqZWN0IHdpdGggYSBgYG5vZGVUeXBlYGBcbiAgICAgKiBwcm9wZXJ0eSB0aGF0IGhvbGRzIHRoZSB2YWx1ZSBgYDFgYC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0VsZW1lbnQob2JqZWN0KSB7XG4gICAgICAgIGlmICghb2JqZWN0IHx8IG9iamVjdC5ub2RlVHlwZSAhPT0gMSB8fCAhZGl2KSB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgb2JqZWN0LmFwcGVuZENoaWxkKGRpdik7XG4gICAgICAgICAgICBvYmplY3QucmVtb3ZlQ2hpbGQoZGl2KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHNhbXNhbS5rZXlzXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmplY3RcbiAgICAgKlxuICAgICAqIFJldHVybiBhbiBhcnJheSBvZiBvd24gcHJvcGVydHkgbmFtZXMuXG4gICAgICovXG4gICAgZnVuY3Rpb24ga2V5cyhvYmplY3QpIHtcbiAgICAgICAgdmFyIGtzID0gW10sIHByb3A7XG4gICAgICAgIGZvciAocHJvcCBpbiBvYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChvLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wKSkgeyBrcy5wdXNoKHByb3ApOyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBuYW1lIHNhbXNhbS5pc0RhdGVcbiAgICAgKiBAcGFyYW0gT2JqZWN0IHZhbHVlXG4gICAgICpcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIG9iamVjdCBpcyBhIGBgRGF0ZWBgLCBvciAqZGF0ZS1saWtlKi4gRHVjayB0eXBpbmdcbiAgICAgKiBvZiBkYXRlIG9iamVjdHMgd29yayBieSBjaGVja2luZyB0aGF0IHRoZSBvYmplY3QgaGFzIGEgYGBnZXRUaW1lYGBcbiAgICAgKiBmdW5jdGlvbiB3aG9zZSByZXR1cm4gdmFsdWUgZXF1YWxzIHRoZSByZXR1cm4gdmFsdWUgZnJvbSB0aGUgb2JqZWN0J3NcbiAgICAgKiBgYHZhbHVlT2ZgYC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0RhdGUodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZS5nZXRUaW1lID09IFwiZnVuY3Rpb25cIiAmJlxuICAgICAgICAgICAgdmFsdWUuZ2V0VGltZSgpID09IHZhbHVlLnZhbHVlT2YoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBzYW1zYW0uaXNOZWdaZXJvXG4gICAgICogQHBhcmFtIE9iamVjdCB2YWx1ZVxuICAgICAqXG4gICAgICogUmV0dXJucyBgYHRydWVgYCBpZiBgYHZhbHVlYGAgaXMgYGAtMGBgLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlzTmVnWmVybyh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlID09PSAtSW5maW5pdHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG5hbWUgc2Ftc2FtLmVxdWFsXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmoxXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmoyXG4gICAgICpcbiAgICAgKiBSZXR1cm5zIGBgdHJ1ZWBgIGlmIHR3byBvYmplY3RzIGFyZSBzdHJpY3RseSBlcXVhbC4gQ29tcGFyZWQgdG9cbiAgICAgKiBgYD09PWBgIHRoZXJlIGFyZSB0d28gZXhjZXB0aW9uczpcbiAgICAgKlxuICAgICAqICAgLSBOYU4gaXMgY29uc2lkZXJlZCBlcXVhbCB0byBOYU5cbiAgICAgKiAgIC0gLTAgYW5kICswIGFyZSBub3QgY29uc2lkZXJlZCBlcXVhbFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlkZW50aWNhbChvYmoxLCBvYmoyKSB7XG4gICAgICAgIGlmIChvYmoxID09PSBvYmoyIHx8IChpc05hTihvYmoxKSAmJiBpc05hTihvYmoyKSkpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmoxICE9PSAwIHx8IGlzTmVnWmVybyhvYmoxKSA9PT0gaXNOZWdaZXJvKG9iajIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBzYW1zYW0uZGVlcEVxdWFsXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmoxXG4gICAgICogQHBhcmFtIE9iamVjdCBvYmoyXG4gICAgICpcbiAgICAgKiBEZWVwIGVxdWFsIGNvbXBhcmlzb24uIFR3byB2YWx1ZXMgYXJlIFwiZGVlcCBlcXVhbFwiIGlmOlxuICAgICAqXG4gICAgICogICAtIFRoZXkgYXJlIGVxdWFsLCBhY2NvcmRpbmcgdG8gc2Ftc2FtLmlkZW50aWNhbFxuICAgICAqICAgLSBUaGV5IGFyZSBib3RoIGRhdGUgb2JqZWN0cyByZXByZXNlbnRpbmcgdGhlIHNhbWUgdGltZVxuICAgICAqICAgLSBUaGV5IGFyZSBib3RoIGFycmF5cyBjb250YWluaW5nIGVsZW1lbnRzIHRoYXQgYXJlIGFsbCBkZWVwRXF1YWxcbiAgICAgKiAgIC0gVGhleSBhcmUgb2JqZWN0cyB3aXRoIHRoZSBzYW1lIHNldCBvZiBwcm9wZXJ0aWVzLCBhbmQgZWFjaCBwcm9wZXJ0eVxuICAgICAqICAgICBpbiBgYG9iajFgYCBpcyBkZWVwRXF1YWwgdG8gdGhlIGNvcnJlc3BvbmRpbmcgcHJvcGVydHkgaW4gYGBvYmoyYGBcbiAgICAgKlxuICAgICAqIFN1cHBvcnRzIGN5Y2xpYyBvYmplY3RzLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGRlZXBFcXVhbEN5Y2xpYyhvYmoxLCBvYmoyKSB7XG5cbiAgICAgICAgLy8gdXNlZCBmb3IgY3ljbGljIGNvbXBhcmlzb25cbiAgICAgICAgLy8gY29udGFpbiBhbHJlYWR5IHZpc2l0ZWQgb2JqZWN0c1xuICAgICAgICB2YXIgb2JqZWN0czEgPSBbXSxcbiAgICAgICAgICAgIG9iamVjdHMyID0gW10sXG4gICAgICAgIC8vIGNvbnRhaW4gcGF0aGVzIChwb3NpdGlvbiBpbiB0aGUgb2JqZWN0IHN0cnVjdHVyZSlcbiAgICAgICAgLy8gb2YgdGhlIGFscmVhZHkgdmlzaXRlZCBvYmplY3RzXG4gICAgICAgIC8vIGluZGV4ZXMgc2FtZSBhcyBpbiBvYmplY3RzIGFycmF5c1xuICAgICAgICAgICAgcGF0aHMxID0gW10sXG4gICAgICAgICAgICBwYXRoczIgPSBbXSxcbiAgICAgICAgLy8gY29udGFpbnMgY29tYmluYXRpb25zIG9mIGFscmVhZHkgY29tcGFyZWQgb2JqZWN0c1xuICAgICAgICAvLyBpbiB0aGUgbWFubmVyOiB7IFwiJDFbJ3JlZiddJDJbJ3JlZiddXCI6IHRydWUgfVxuICAgICAgICAgICAgY29tcGFyZWQgPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogdXNlZCB0byBjaGVjaywgaWYgdGhlIHZhbHVlIG9mIGEgcHJvcGVydHkgaXMgYW4gb2JqZWN0XG4gICAgICAgICAqIChjeWNsaWMgbG9naWMgaXMgb25seSBuZWVkZWQgZm9yIG9iamVjdHMpXG4gICAgICAgICAqIG9ubHkgbmVlZGVkIGZvciBjeWNsaWMgbG9naWNcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmXG4gICAgICAgICAgICAgICAgICAgICEodmFsdWUgaW5zdGFuY2VvZiBCb29sZWFuKSAmJlxuICAgICAgICAgICAgICAgICAgICAhKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkgICAgJiZcbiAgICAgICAgICAgICAgICAgICAgISh2YWx1ZSBpbnN0YW5jZW9mIE51bWJlcikgICYmXG4gICAgICAgICAgICAgICAgICAgICEodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApICAmJlxuICAgICAgICAgICAgICAgICAgICAhKHZhbHVlIGluc3RhbmNlb2YgU3RyaW5nKSkge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgZ2l2ZW4gb2JqZWN0IGluIHRoZVxuICAgICAgICAgKiBnaXZlbiBvYmplY3RzIGFycmF5LCAtMSBpZiBub3QgY29udGFpbmVkXG4gICAgICAgICAqIG9ubHkgbmVlZGVkIGZvciBjeWNsaWMgbG9naWNcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIGdldEluZGV4KG9iamVjdHMsIG9iaikge1xuXG4gICAgICAgICAgICB2YXIgaTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmplY3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdHNbaV0gPT09IG9iaikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvZXMgdGhlIHJlY3Vyc2lvbiBmb3IgdGhlIGRlZXAgZXF1YWwgY2hlY2tcbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbiBkZWVwRXF1YWwob2JqMSwgb2JqMiwgcGF0aDEsIHBhdGgyKSB7XG4gICAgICAgICAgICB2YXIgdHlwZTEgPSB0eXBlb2Ygb2JqMTtcbiAgICAgICAgICAgIHZhciB0eXBlMiA9IHR5cGVvZiBvYmoyO1xuXG4gICAgICAgICAgICAvLyA9PSBudWxsIGFsc28gbWF0Y2hlcyB1bmRlZmluZWRcbiAgICAgICAgICAgIGlmIChvYmoxID09PSBvYmoyIHx8XG4gICAgICAgICAgICAgICAgICAgIGlzTmFOKG9iajEpIHx8IGlzTmFOKG9iajIpIHx8XG4gICAgICAgICAgICAgICAgICAgIG9iajEgPT0gbnVsbCB8fCBvYmoyID09IG51bGwgfHxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTEgIT09IFwib2JqZWN0XCIgfHwgdHlwZTIgIT09IFwib2JqZWN0XCIpIHtcblxuICAgICAgICAgICAgICAgIHJldHVybiBpZGVudGljYWwob2JqMSwgb2JqMik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEVsZW1lbnRzIGFyZSBvbmx5IGVxdWFsIGlmIGlkZW50aWNhbChleHBlY3RlZCwgYWN0dWFsKVxuICAgICAgICAgICAgaWYgKGlzRWxlbWVudChvYmoxKSB8fCBpc0VsZW1lbnQob2JqMikpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAgICAgICAgIHZhciBpc0RhdGUxID0gaXNEYXRlKG9iajEpLCBpc0RhdGUyID0gaXNEYXRlKG9iajIpO1xuICAgICAgICAgICAgaWYgKGlzRGF0ZTEgfHwgaXNEYXRlMikge1xuICAgICAgICAgICAgICAgIGlmICghaXNEYXRlMSB8fCAhaXNEYXRlMiB8fCBvYmoxLmdldFRpbWUoKSAhPT0gb2JqMi5nZXRUaW1lKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9iajEgaW5zdGFuY2VvZiBSZWdFeHAgJiYgb2JqMiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgICAgIGlmIChvYmoxLnRvU3RyaW5nKCkgIT09IG9iajIudG9TdHJpbmcoKSkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNsYXNzMSA9IGdldENsYXNzKG9iajEpO1xuICAgICAgICAgICAgdmFyIGNsYXNzMiA9IGdldENsYXNzKG9iajIpO1xuICAgICAgICAgICAgdmFyIGtleXMxID0ga2V5cyhvYmoxKTtcbiAgICAgICAgICAgIHZhciBrZXlzMiA9IGtleXMob2JqMik7XG5cbiAgICAgICAgICAgIGlmIChpc0FyZ3VtZW50cyhvYmoxKSB8fCBpc0FyZ3VtZW50cyhvYmoyKSkge1xuICAgICAgICAgICAgICAgIGlmIChvYmoxLmxlbmd0aCAhPT0gb2JqMi5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlMSAhPT0gdHlwZTIgfHwgY2xhc3MxICE9PSBjbGFzczIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXMxLmxlbmd0aCAhPT0ga2V5czIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBrZXksIGksIGwsXG4gICAgICAgICAgICAgICAgLy8gZm9sbG93aW5nIHZhcnMgYXJlIHVzZWQgZm9yIHRoZSBjeWNsaWMgbG9naWNcbiAgICAgICAgICAgICAgICB2YWx1ZTEsIHZhbHVlMixcbiAgICAgICAgICAgICAgICBpc09iamVjdDEsIGlzT2JqZWN0MixcbiAgICAgICAgICAgICAgICBpbmRleDEsIGluZGV4MixcbiAgICAgICAgICAgICAgICBuZXdQYXRoMSwgbmV3UGF0aDI7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGwgPSBrZXlzMS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBrZXlzMVtpXTtcbiAgICAgICAgICAgICAgICBpZiAoIW8uaGFzT3duUHJvcGVydHkuY2FsbChvYmoyLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBTdGFydCBvZiB0aGUgY3ljbGljIGxvZ2ljXG5cbiAgICAgICAgICAgICAgICB2YWx1ZTEgPSBvYmoxW2tleV07XG4gICAgICAgICAgICAgICAgdmFsdWUyID0gb2JqMltrZXldO1xuXG4gICAgICAgICAgICAgICAgaXNPYmplY3QxID0gaXNPYmplY3QodmFsdWUxKTtcbiAgICAgICAgICAgICAgICBpc09iamVjdDIgPSBpc09iamVjdCh2YWx1ZTIpO1xuXG4gICAgICAgICAgICAgICAgLy8gZGV0ZXJtaW5lLCBpZiB0aGUgb2JqZWN0cyB3ZXJlIGFscmVhZHkgdmlzaXRlZFxuICAgICAgICAgICAgICAgIC8vIChpdCdzIGZhc3RlciB0byBjaGVjayBmb3IgaXNPYmplY3QgZmlyc3QsIHRoYW4gdG9cbiAgICAgICAgICAgICAgICAvLyBnZXQgLTEgZnJvbSBnZXRJbmRleCBmb3Igbm9uIG9iamVjdHMpXG4gICAgICAgICAgICAgICAgaW5kZXgxID0gaXNPYmplY3QxID8gZ2V0SW5kZXgob2JqZWN0czEsIHZhbHVlMSkgOiAtMTtcbiAgICAgICAgICAgICAgICBpbmRleDIgPSBpc09iamVjdDIgPyBnZXRJbmRleChvYmplY3RzMiwgdmFsdWUyKSA6IC0xO1xuXG4gICAgICAgICAgICAgICAgLy8gZGV0ZXJtaW5lIHRoZSBuZXcgcGF0aGVzIG9mIHRoZSBvYmplY3RzXG4gICAgICAgICAgICAgICAgLy8gLSBmb3Igbm9uIGN5Y2xpYyBvYmplY3RzIHRoZSBjdXJyZW50IHBhdGggd2lsbCBiZSBleHRlbmRlZFxuICAgICAgICAgICAgICAgIC8vICAgYnkgY3VycmVudCBwcm9wZXJ0eSBuYW1lXG4gICAgICAgICAgICAgICAgLy8gLSBmb3IgY3ljbGljIG9iamVjdHMgdGhlIHN0b3JlZCBwYXRoIGlzIHRha2VuXG4gICAgICAgICAgICAgICAgbmV3UGF0aDEgPSBpbmRleDEgIT09IC0xXG4gICAgICAgICAgICAgICAgICAgID8gcGF0aHMxW2luZGV4MV1cbiAgICAgICAgICAgICAgICAgICAgOiBwYXRoMSArICdbJyArIEpTT04uc3RyaW5naWZ5KGtleSkgKyAnXSc7XG4gICAgICAgICAgICAgICAgbmV3UGF0aDIgPSBpbmRleDIgIT09IC0xXG4gICAgICAgICAgICAgICAgICAgID8gcGF0aHMyW2luZGV4Ml1cbiAgICAgICAgICAgICAgICAgICAgOiBwYXRoMiArICdbJyArIEpTT04uc3RyaW5naWZ5KGtleSkgKyAnXSc7XG5cbiAgICAgICAgICAgICAgICAvLyBzdG9wIHJlY3Vyc2lvbiBpZiBjdXJyZW50IG9iamVjdHMgYXJlIGFscmVhZHkgY29tcGFyZWRcbiAgICAgICAgICAgICAgICBpZiAoY29tcGFyZWRbbmV3UGF0aDEgKyBuZXdQYXRoMl0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gcmVtZW1iZXIgdGhlIGN1cnJlbnQgb2JqZWN0cyBhbmQgdGhlaXIgcGF0aGVzXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4MSA9PT0gLTEgJiYgaXNPYmplY3QxKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdHMxLnB1c2godmFsdWUxKTtcbiAgICAgICAgICAgICAgICAgICAgcGF0aHMxLnB1c2gobmV3UGF0aDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaW5kZXgyID09PSAtMSAmJiBpc09iamVjdDIpIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0czIucHVzaCh2YWx1ZTIpO1xuICAgICAgICAgICAgICAgICAgICBwYXRoczIucHVzaChuZXdQYXRoMik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gcmVtZW1iZXIgdGhhdCB0aGUgY3VycmVudCBvYmplY3RzIGFyZSBhbHJlYWR5IGNvbXBhcmVkXG4gICAgICAgICAgICAgICAgaWYgKGlzT2JqZWN0MSAmJiBpc09iamVjdDIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcGFyZWRbbmV3UGF0aDEgKyBuZXdQYXRoMl0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEVuZCBvZiBjeWNsaWMgbG9naWNcblxuICAgICAgICAgICAgICAgIC8vIG5laXRoZXIgdmFsdWUxIG5vciB2YWx1ZTIgaXMgYSBjeWNsZVxuICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIHdpdGggbmV4dCBsZXZlbFxuICAgICAgICAgICAgICAgIGlmICghZGVlcEVxdWFsKHZhbHVlMSwgdmFsdWUyLCBuZXdQYXRoMSwgbmV3UGF0aDIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICAgIH0ob2JqMSwgb2JqMiwgJyQxJywgJyQyJykpO1xuICAgIH1cblxuICAgIHZhciBtYXRjaDtcblxuICAgIGZ1bmN0aW9uIGFycmF5Q29udGFpbnMoYXJyYXksIHN1YnNldCkge1xuICAgICAgICBpZiAoc3Vic2V0Lmxlbmd0aCA9PT0gMCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICB2YXIgaSwgbCwgaiwgaztcbiAgICAgICAgZm9yIChpID0gMCwgbCA9IGFycmF5Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgaWYgKG1hdGNoKGFycmF5W2ldLCBzdWJzZXRbMF0pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChqID0gMCwgayA9IHN1YnNldC5sZW5ndGg7IGogPCBrOyArK2opIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaChhcnJheVtpICsgal0sIHN1YnNldFtqXSkpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbmFtZSBzYW1zYW0ubWF0Y2hcbiAgICAgKiBAcGFyYW0gT2JqZWN0IG9iamVjdFxuICAgICAqIEBwYXJhbSBPYmplY3QgbWF0Y2hlclxuICAgICAqXG4gICAgICogQ29tcGFyZSBhcmJpdHJhcnkgdmFsdWUgYGBvYmplY3RgYCB3aXRoIG1hdGNoZXIuXG4gICAgICovXG4gICAgbWF0Y2ggPSBmdW5jdGlvbiBtYXRjaChvYmplY3QsIG1hdGNoZXIpIHtcbiAgICAgICAgaWYgKG1hdGNoZXIgJiYgdHlwZW9mIG1hdGNoZXIudGVzdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hlci50ZXN0KG9iamVjdCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG1hdGNoZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoZXIob2JqZWN0KSA9PT0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgbWF0Y2hlciA9IG1hdGNoZXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIHZhciBub3ROdWxsID0gdHlwZW9mIG9iamVjdCA9PT0gXCJzdHJpbmdcIiB8fCAhIW9iamVjdDtcbiAgICAgICAgICAgIHJldHVybiBub3ROdWxsICYmXG4gICAgICAgICAgICAgICAgKFN0cmluZyhvYmplY3QpKS50b0xvd2VyQ2FzZSgpLmluZGV4T2YobWF0Y2hlcikgPj0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoZXIgPT09IG9iamVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaGVyID09PSBvYmplY3Q7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mKG1hdGNoZXIpID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mKG9iamVjdCkgPT09IFwidW5kZWZpbmVkXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2hlciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdCA9PT0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChnZXRDbGFzcyhvYmplY3QpID09PSBcIkFycmF5XCIgJiYgZ2V0Q2xhc3MobWF0Y2hlcikgPT09IFwiQXJyYXlcIikge1xuICAgICAgICAgICAgcmV0dXJuIGFycmF5Q29udGFpbnMob2JqZWN0LCBtYXRjaGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtYXRjaGVyICYmIHR5cGVvZiBtYXRjaGVyID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hlciA9PT0gb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcHJvcDtcbiAgICAgICAgICAgIGZvciAocHJvcCBpbiBtYXRjaGVyKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gb2JqZWN0W3Byb3BdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBvYmplY3QuZ2V0QXR0cmlidXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBvYmplY3QuZ2V0QXR0cmlidXRlKHByb3ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcltwcm9wXSA9PT0gbnVsbCB8fCB0eXBlb2YgbWF0Y2hlcltwcm9wXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBtYXRjaGVyW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiAgdmFsdWUgPT09IFwidW5kZWZpbmVkXCIgfHwgIW1hdGNoKHZhbHVlLCBtYXRjaGVyW3Byb3BdKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNYXRjaGVyIHdhcyBub3QgYSBzdHJpbmcsIGEgbnVtYmVyLCBhIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiZnVuY3Rpb24sIGEgYm9vbGVhbiBvciBhbiBvYmplY3RcIik7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGlzQXJndW1lbnRzOiBpc0FyZ3VtZW50cyxcbiAgICAgICAgaXNFbGVtZW50OiBpc0VsZW1lbnQsXG4gICAgICAgIGlzRGF0ZTogaXNEYXRlLFxuICAgICAgICBpc05lZ1plcm86IGlzTmVnWmVybyxcbiAgICAgICAgaWRlbnRpY2FsOiBpZGVudGljYWwsXG4gICAgICAgIGRlZXBFcXVhbDogZGVlcEVxdWFsQ3ljbGljLFxuICAgICAgICBtYXRjaDogbWF0Y2gsXG4gICAgICAgIGtleXM6IGtleXNcbiAgICB9O1xufSk7XG4iLCJ2YXIgc29ubmUgPSByZXF1aXJlKCcuLi9saWIvbWFpbicpXHJcbnZhciBzaW5vbiA9IHJlcXVpcmUoJ3Npbm9uJylcclxuXHJcbnZhciBtYXliZUlEID0gc29ubmUubWFrZShzb25uZS5kYXRhLm1heWJlLCBzb25uZS5kYXRhLmlkKVxyXG5jb25zdCBJRE1heWJlID0gc29ubmUubWFrZShzb25uZS5kYXRhLmlkLCBzb25uZS5kYXRhLm1heWJlKVxyXG52YXIgbWF5YmVTdGFja3MgPSBbSURNYXliZSwgbWF5YmVJRF1cclxuXHJcbnZhciBtYXliZVN0YXRlID0gc29ubmUubWFrZShzb25uZS5kYXRhLm1heWJlLCBzb25uZS5jb21wLnN0YXRlKVxyXG52YXIgc3RhdGVNYXliZSA9IHNvbm5lLm1ha2Uoc29ubmUuY29tcC5zdGF0ZSwgc29ubmUuZGF0YS5tYXliZSlcclxudmFyIHN0YXRlU3RhY2tzID0gW21heWJlU3RhdGUsIHN0YXRlTWF5YmVdXHJcblxyXG52YXIgbWF5YmVMaXN0ID0gc29ubmUubWFrZShzb25uZS5kYXRhLm1heWJlLCBzb25uZS5kYXRhLmxpc3QpXHJcbnZhciBsaXN0TWF5YmUgPSBzb25uZS5tYWtlKHNvbm5lLmRhdGEubGlzdCwgc29ubmUuZGF0YS5tYXliZSlcclxudmFyIGxpc3RTdGFja3MgPSBbbWF5YmVMaXN0LCBsaXN0TWF5YmVdXHJcblxyXG52YXIgbW9uYWRzID0gbWF5YmVTdGFja3NcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgTWF5YmUgKHRlc3QpIHtcclxuICAgICAgbWF5YmVTdGFja3MuZm9yRWFjaCgobWF5YmUpID0+e1xyXG5cclxuICAgICAgICB2YXIgc3B5ID0gc2lub24uc3B5KChhKSA9PiBhKVxyXG4gICAgICAgIG1heWJlLm9mKDQpXHJcbiAgICAgICAgICAubWFwKGZ1bmN0aW9uICh2YWwpIHtyZXR1cm4gdmFsICsgMX0pXHJcbiAgICAgICAgICAuY2hhaW5NYXliZSgodmFsKT0+IHtcclxuICAgICAgICAgICAgdGVzdC5lcXVhbHModmFsLCA1LCAnQSBjYWxsIHRvIFwibWFwXCIgbW9kaWZpZXMgdGhlIHZhbHVlLCBhbmQgcGFja3MgaXQgYWdhaW4nKVxyXG4gICAgICAgICAgICByZXR1cm4ge21heWJlVmFsOnVuZGVmaW5lZH0gXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIC5tYXAoc3B5KVxyXG4gICAgICAgIHRlc3QuZXF1YWxzKHNweS5jYWxsZWQsIGZhbHNlLCBcIkFmdGVyIGEgdmFsIGlzIHNldCB0byB1bmRlZmluZWQsIGZ1bmN0aW9ucyBhcmUgbm8gbG9uZ2VyIGNhbGxlZFwiKVxyXG5cclxuICAgICAgICBzcHkgPSBzaW5vbi5zcHkoKGEpID0+IGEpXHJcbiAgICAgICAgbWF5YmUub2Yoe2Zvbzp7YmF6OlwiYmFyXCJ9fSlcclxuICAgICAgICAgIC5nZXQoXCJmb29cIilcclxuICAgICAgICAgIC5nZXQoXCJiYXpcIilcclxuICAgICAgICAgIC5tYXAoc3B5KVxyXG4gICAgICAgIHRlc3QuZXF1YWxzKHNweS5sYXN0Q2FsbC5yZXR1cm5WYWx1ZSwgJ2JhcicpXHJcblxyXG4gICAgICAgIHNweSA9IHNpbm9uLnNweSgoYSkgPT4gYSlcclxuICAgICAgICBtYXliZS5vZih7Zm9vOlwiYmFyXCJ9KVxyXG4gICAgICAgICAgLmdldChcImJhclwiKVxyXG4gICAgICAgICAgLm1hcChzcHkpXHJcbiAgICAgICAgdGVzdC5lcXVhbHMoc3B5LmNhbGxlZCwgZmFsc2UsICdXaGVuIHlvdSBnZXQgYW4gdW5kZWZpbmVkIHZhbHVlLCBtYXliZSBpcyBub3QgY2FsbGVkICcpXHJcbiAgICAgIH0pXHJcbiAgICAgIHRlc3QuZG9uZSgpXHJcbiAgICB9LFxyXG4gICAgY2hhaW4gKHRlc3Qpe1xyXG4gICAgICBjb25zdCB2YWwgPSA1XHJcbiAgICAgIG1vbmFkcy5mb3JFYWNoKG1vbmFkID0+IHtcclxuICAgICAgICB2YXIgc3B5ID0gc2lub24uc3B5KChhKSA9PiBhKVxyXG4gICAgICAgIG1vbmFkLm9mKHZhbClcclxuICAgICAgICAgIC5jaGFpbigodmFsKT0+IG1vbmFkLm9mKHZhbCkpXHJcbiAgICAgICAgICAubWFwKHNweSlcdCAgICBcclxuICAgICAgICB0ZXN0LmVxdWFscyhzcHkuZmlyc3RDYWxsLnJldHVyblZhbHVlLCB2YWwsIFwiVW5wYWNraW5nIGEgbW9uYWQgYW5kIHBhY2tpbmcgaXQgYWdhaW4geWVpbGRzIHRoZSBzYW1lIHN0cnVjdHVyZVwiKVxyXG4gICAgICAgIHRlc3QudGhyb3dzKCgpPT4obW9uYWQub2YoNCkuY2hhaW4oKHZhbCk9Pm1vbmFkLm9mKHZhbCkuX3ZhbHVlICkpLCBcIlRoZSBjaGFpbiBtZXRob2QgZXhwZWN0cyBhIHdyYXBwZWQgdmFsdWVcIilcclxuICAgICAgfSkgXHJcbiAgICAgIHRlc3QuZG9uZSgpXHJcbiAgICB9LFxyXG4gICAgLypMaXN0ICh0ZXN0KXtcclxuICAgICAgbWF5YmVJRFxyXG4gICAgICBsaXN0TWF5YmVcclxuICAgICAgdGVzdC5kZWVwRXF1YWwobWF5YmVMaXN0Lm9mKFsxLDIsM10pLm1hcCgoYSk9PihhKzEpKSwgbWF5YmVMaXN0Lm9mKFsyLDMsNF0pLCBcImZvb1wiKVxyXG4gICAgICBkZWJ1Z2dlclxyXG4gICAgICBsaXN0U3RhY2tzLmZvckVhY2goKGxpc3QpID0+e1xyXG4gICAgICAgIGxpc3Qub2YoWzEsMiwzXSlcclxuICAgICAgfSlcclxuICAgICAgdGVzdC5kb25lKClcclxuICAgIH0sKi9cclxuICAgIHN0YXRlKHRlc3Qpe1xyXG4gICAgICBtYXliZVN0YXRlXHJcbiAgICAgIHN0YXRlTWF5YmVcclxuXHJcbiAgICAgIG1heWJlU3RhdGUoIChwcmV2U3RhdGUpID0+ICh7bWF5YmVWYWw6WzQsIHVuZGVmaW5lZCBdIH0pIClcclxuICAgICAgc3RhdGVNYXliZSggKHByZXZTdGF0ZSkgPT4gKFt7bWF5YmVWYWw6NH0sIHVuZGVmaW5lZCBdICkgKVxyXG4gICAgICAgIC5zYXZlKClcclxuICAgICAgICAuX3ZhbHVlKClcclxuXHJcbiAgICAvKiAgc3RhdGVTdGFja3MuZm9yRWFjaChzdGF0ZSA9PiB7XHJcbiAgICAgICAgc3RhdGUub2YoNClcclxuICAgICAgICAgIC5zYXZlKClcclxuICAgICAgICAgIC5sb2FkKClcclxuICAgICAgICAgIC5tYXAoKCk9PjYpXHJcbiAgICAgICAgICAubG9hZCgpXHJcbiAgICAgICAgICBkZWJ1Z2dlclxyXG4gICAgICB9KSovXHJcbiAgICAgIHRlc3QuZG9uZSgpXHJcbiAgICB9XHJcblxyXG4gIH1cclxuIiwiZXhwb3J0cy5iYXNpYyA9IHJlcXVpcmUoXCIuL2Jhc2ljXCIpXHJcbmlmIChnbG9iYWwudjhkZWJ1Zykge1xyXG4gIGdsb2JhbC52OGRlYnVnLkRlYnVnLnNldEJyZWFrT25FeGNlcHRpb24oKVxyXG59XHJcbmdsb2JhbC50ZXN0cyA9IG1vZHVsZS5leHBvcnRzXHJcbiJdfQ==
