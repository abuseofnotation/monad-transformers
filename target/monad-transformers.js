(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports.state = {
  name: 'State',
  of: function of(val) {
    var _this = this;

    return function (prevState) {
      return _this.outer.of([val, prevState]);
    };
  },
  chain: function chain(funk, state) {
    var _this2 = this;

    return function (prevState) {
      return _this2.outer.chain(function (params) {
        var newVal = params[0],
            newState = params[1];
        return funk(newVal)(newState);
      }, state(prevState));
    };
  },
  lift: function lift(val) {
    var _this3 = this;

    return function (prevState) {
      return _this3.outer.chain(function (innerValue) {
        return _this3.outer.of([innerValue, prevState]);
      }, val);
    };
  },
  load: function load(val) {
    var _this4 = this;

    return function (prevState) {
      return _this4.outer.of([prevState, prevState]);
    };
  },
  save: function save(val) {
    var _this5 = this;

    return function (prevState) {
      return _this5.outer.of([val, val]);
    };
  },
  mapState: function mapState(funk, val) {
    var _this6 = this;

    return function (prevState) {
      return _this6.outer.of(funk(val, prevState));
    };
  },
  value: function value(funk, state) {
    return this.outer.value(function (params) {
      return funk(params[0]);
    }, state());
  }
};

},{}],2:[function(require,module,exports){
/* # `data.maybe`
 *
 * The `maybe` monad transformer automatically checks if your value is undefined and
 * stops the computation if it is.
 *
 * ## `value.get(key)`
 *
 * A helper to safely retrieve a possibly undefined property of your value.
 * The value has to be a JS object.
 * 
 * ## `value.chainMaybe(f)
 * 
 * Chains a function that returns a `maybe` value in the computation
 */

'use strict';

exports.maybe = {
  name: 'Maybe',
  // (val) => M({maybeVal:val})
  of: function of(val) {
    return this.outer.of({ maybeVal: val });
  },
  // (val => M({maybeVal:val}) , M({maybeVal:val})) => M({maybeVal:val})
  chain: function chain(funk, mMaybeVal) {
    return this.outer.chain(function (maybeVal) {
      return maybeVal.maybeVal === undefined ? maybeVal : funk(maybeVal.maybeVal);
    }, mMaybeVal);
  },
  // (M(val)) => M({maybeVal:val})
  lift: function lift(mVal) {
    var _this = this;

    return this.outer.chain(function (val) {
      return _this.outer.of({ maybeVal: val });
    }, mVal);
  },
  // ((val) => otherVal, M({maybeVal:val})) => otherVal
  value: function value(funk, mMaybeVal) {
    return this.outer.value(function (maybeVal) {
      return maybeVal.maybeVal === undefined ? maybeVal : funk(maybeVal.maybeVal);
    }, mMaybeVal);
  },
  get: function get(key, val) {
    return this.of(val[key]);
  },
  chainMaybe: function chainMaybe(funk, val) {
    return this.outer.of(funk(val));
  }
};

/* # `data.list`
 *
 * The `list` monad transformer allows you to operate on a list of values.
 * instead of on a single value.
 *
 * ## `List.fromArray(val)
 *
 * Wraps an array in a list monad transformer instance.
 *
 * ## `values.filter(fn)`
 * 
 * Filters out the values that don't match the predicate. Same as `Array.prototype.filter`.
 * 
 * _The behaviour of `Array.prototype.map` is covered by the monad transformer `map` method._
 */

exports.list = {
  name: 'List',
  // (val) => M([val])
  of: function of(val) {
    return this.outer.of([val]);
  },
  // (val => M([val]) , M([val]))=> M([val])
  chain: function chain(funk, mListVal) {
    var _this2 = this;

    return this.outer.chain(function (listVal) {
      return listVal.length === 0 ? _this2.outer.of([]) : listVal.map(funk).reduce(function (accumulatedVal, newVal) {
        return _this2.outer.chain(function (accumulated) {
          return _this2.outer.chain(function (_new) {
            return _this2.outer.of(accumulated.concat(_new));
          }, newVal);
        }, accumulatedVal);
      });
    }, mListVal);
  },
  // (M(val)) => M([val])
  lift: function lift(val) {
    var _this3 = this;

    return this.outer.chain(function (innerValue) {
      return _this3.outer.of([innerValue]);
    }, val);
  },
  // ((val) => otherVal, M([val])) => otherVal
  value: function value(funk, val) {
    return this.outer.value(function (list) {
      return list.map(funk);
    }, val);
  },
  filter: function filter(funk, val) {
    if (funk(val)) {
      return this.of(val);
    } else {
      return this.outer.of([]);
    }
  },
  fromArray: function fromArray(val) {
    if (val.concat && val.map && val.reduce && val.slice) {
      return this.outer.of(val);
    } else {
      throw val + ' is not a list.';
    }
  }
};

/* # `data.writer`
 *
 * The writer monad transformer augments the wrapped value with one additional value
 * which may be used for storing some additional information about the computation.
 *
 * The additional value must have a `concat` method, as `String` or `Array`.
 * 
 * ## `value.tell(val)`
 * Concats `val` to the additional value.
 * 
 *
 * ## `value.listen(f)
 * Calls `f` with the value as an argument. 
 */

var computeLog = function computeLog(log, newLog) {
  if (log === undefined) {
    return newLog;
  } else {
    if (newLog === undefined) {
      return log;
    } else {
      return log.concat(newLog);
    }
  }
};

exports.writer = {
  name: 'Writer',

  // (val) => M([val, log])
  of: function of(val) {
    return this.outer.of([val, undefined]);
  },

  // (val => M([val, log]), M([val, log])) => M([val, log])
  chain: function chain(funk, mWriterVal) {
    var _this4 = this;

    return this.outer.chain(function (writerVal) {
      var val = writerVal[0];
      var log = writerVal[1];
      var newMWriterVal = funk(val);
      return _this4.outer.chain(function (newWriterVal) {
        var newVal = newWriterVal[0];
        var newLog = typeof newWriterVal[1] === 'function' ? newWriterVal[1](log) : newWriterVal[1];
        return _this4.outer.of([newVal, computeLog(log, newLog)]);
      }, newMWriterVal);
    }, mWriterVal);
  },

  // (M(val) => M([val, log])
  lift: function lift(mVal) {
    var _this5 = this;

    return this.outer.chain(function (val) {
      return _this5.outer.of([val, undefined]);
    }, mVal);
  },

  // ((val) => b, M([val, log])) => b
  value: function value(funk, mWriterVal) {
    return this.outer.value(function (writerVal) {
      return funk(writerVal[0]);
    }, mWriterVal);
  },

  tell: function tell(message, val) {
    return this.outer.of([val, message]);
  },
  listen: function listen(funk, val) {
    return this.outer.of([val, funk]);
  }
};

},{}],3:[function(require,module,exports){
/* # Implementing a monad transformer
 *
 * Monad transformers are tricky, and one of the reasons for this is that they require an
 * excessive amount of type juggling. You have to constantly wrap things in boxes and unwrap them
 * again. 
 *
 * One of the aims of this package is to reduce the amount of wrapping and unwrapping needed for
 * making a new transformer and to provide an easy way to define and combine transformers. 
 *
 * With it, all it takes to implement a transformer is implement these four functions: 
 * `of` (AKA `return`), `chain` (AKA `flatMap`) `lift` and `value`(AKA `run`)
 *
 * ## The trivial implementation
 * 
 * Consider the identity Monad transformer. This is a monad transformer that does nothing: 
 * or in other words it produces a monad which behaves the same way as the one it is given to it
 * as an argument. Here is how would the implementation of these methods look like:
 */

'use strict';

exports.idMinimal = {
  name: 'idMinimal',
  /*
   * The `of` function takes a scalar value and returns an instance of the outer monad.
   * In this case we delegate everything to the outer monad's `of` method.
   * We access the outer monad with `this.outer`. 
   */
  // (val) => M(val)
  of: function of(val) {
    return this.outer.of(val);
  },
  /* 
   * `chain` is the heart of any monad or monad transformer.
   *
   * In this case we implement it by just calling the `chain` function of the host monad (using 
   * `this.outer.chain`) with the function given to us as an argument.
   */
  // (val => M(val) , M(val)) => M(val)
  chain: function chain(fn, val) {
    return this.outer.chain(fn, val);
  },
  /* 
   * The `lift` function is kinda like `of`, but it accepts an instance of the outer monad
   * instead of a 'plain' value.
   */
  // (M(val)) => M(val)
  lift: function lift(val) {
    return val;
  },
  /* 
   * Having both 'lift' and 'of' enables us to convert any value created by one monad transformer
   * to a a value that holds all elements of the stack
   *
   * Finally the `value` function provides a way to get 'the value back'
   * What it does is to unwrap a previously-wrapped monad.
   * In this case we didn't do any wrapping, so we don't have to do any unwrapping either.
   */
  // ((val) => otherVal, M(val)) => otherVal
  value: function value(fn, val) {
    return this.outer.value(fn, val);
  }
};

/* # Manipulating the value
 * 
 * All monad transformers do the same thing (given a monad `A`, they produce a
 * monad `B(A)` which somehow augments `A`), but there is no general formula for doing it.
 * 
 * Simpler monads can be implemented just by manipulating the value inside the host monad.
 *
 * Our next implementation of ID will just wrap the underlying value (which we called A)
 * in a plain object.
 *
 * So `M(A)` would become `M ({idVal:A})` when we wrap it and will be back to `M(A)` when we
 * unwrap it.
 *
 * Here is how this implementation would look like:
 */

exports.id = {
  name: 'Id',

  /*
   * The `of` function takes a scalar value and returns an instance of the outer monad.
   * In this case we delegate everything to the outer monad's `of` method.
   * We access the outer monad with `this.outer`. 
   */

  // (val) => M({idVal:val})
  of: function of(val) {
    return this.outer.of({ idVal: val });
  },
  /* 
   *
   * chain just calls the `chain` function of the host monad like in the previous example.
   * The difference is that it applies some transformation to the value in order to fit 
   * the new context. 
   */
  // (val => M({idVal:val}) , M({idVal:val})) => M({idVal:val})
  chain: function chain(fn, mIdVal) {
    return this.outer.chain(function (idVal) {
      return fn(idVal.idVal);
    }, mIdVal);
  },
  /* 
   * The `lift` function uses `chain` + `of` (which is the same as `map`) to go to the host monad
   * and modify the value inside it.
   */
  // (M(val)) => M({idVal:val})
  lift: function lift(mVal) {
    var _this = this;

    return this.outer.chain(function (val) {
      return _this.outer.of({ idVal: val });
    }, mVal);
  },
  /*
   * Lastly we have the `value` function (or the interpreter), which unwraps a previously-wrapped
   * value.
   */
  // ((val) => otherVal, M({idVal:val})) => otherVal
  value: function value(fn, mIdVal) {
    return this.outer.value(function (idVal) {
      return fn(idVal.idVal);
    }, mIdVal);
  }
};

/*
 * Notice that we are always returning an instance of the outer monad.
 *
 * That is, if you are to apply the transformation several times,
 * the values nest inside M: M({idVal:{idVal: a}})
 *
 * However not all monad transformers are like that.
 *
 * ## A more complex structure
 *
 * So far we have seen monad transformers which only deal with the value inside the given
 * monad A. However not all monad transformers are like that. 
 *
 * There are monad transformers which add additional structure to the monad itself.
 * Examples of the first type are all transformers that we have seen so far.
 * An example of the second type is the 'State' monad, which given the same value `M(A)`, will 
 * produce something like `() =>{ M([A, State]) }`. That is, the transformer adds the state
 * value to the 'host' monad `M`, and then it wraps the monad itself in a function.
 *
 * Now consider an alternative, a little more complex implementation of the ID monad. One
 * which wraps the M monad into another plain object, so the value of M(A) becomes
 * `{idContainer: M({idVal:a})}`. Notice that the transformer consists of two parts: one which 
 * wraps around the host monad, and one which wraps around the value in it.
 */

exports.idWrapped = {
  name: 'IdWrapped',

  // (val) => {idContainer: M({idVal:a})}
  of: function of(val) {
    return {
      idContainer: this.outer.of({ idVal: val })
    };
  },

  // (a => {idContainer:M({idVal:a})}, {idContainer:M({idVal:a})}) => {idContainer:M({idVal:a})}
  chain: function chain(fn, idContainerMIdVal) {
    return {
      idContainer: this.outer.chain(function (idVal) {
        var val = fn(idVal.idVal);
        return val.idContainer;
      }, idContainerMIdVal.idContainer)
    };
  },

  // (M(val)) => {idContainer:M({idVal:val})}
  lift: function lift(mVal) {
    var _this2 = this;

    return {
      idContainer: this.outer.chain(function (val) {
        return _this2.outer.of({ idVal: val });
      }, mVal)
    };
  },

  // ((val) => otherVal, {idContainer: M({idVal:val}))}=> otherVal
  value: function value(fn, idContainerMIdVal) {
    return this.outer.value(function (idVal) {
      return fn(idVal.idVal);
    }, idContainerMIdVal.idContainer);
  }
};

/* The key difference is that with this monad nesting happens both inside the host monad and
 * outside of it. If we apply the transformation two times the value becomes:
 * `{idContainer:{idContainer:M({idVal:{idVal:a}})}}`.
 */

},{}],4:[function(require,module,exports){
(function (process,global){
'use strict';

exports.id = require('./id');
exports.data = require('./data');
exports.comp = require('./comp');

var createStack = require('./stack');

// Object.assign polyfil
if (!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function value(target) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object');
      }

      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if (nextSource === undefined || nextSource === null) {
          continue;
        }
        nextSource = Object(nextSource);

        var keysArray = Object.keys(nextSource);
        for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex];
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if (desc !== undefined && desc.enumerable) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
      return to;
    }
  });
}

// Checks if a given property is part of the general monad definition interface
var isReserverMonadKey = function isReserverMonadKey(key) {
  return key !== 'name' && key !== 'map' && key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'value';
};

// Maps the values of a given obj excluding the reserved ones.
var monadMapVals = function monadMapVals(funk, obj) {
  return Object.keys(obj).filter(isReserverMonadKey).reduce(function (newObj, key) {
    newObj[key] = funk(obj[key], obj);
    return newObj;
  }, {});
};

// Unwraps a wrapped value
var unwrap = function unwrap(val) {
  if (!val.hasOwnProperty('_value')) {
    throw JSON.stringify(val) + ' is not a wrapped value';
  }
  return val._value;
};

// Wraps a value in a specified prototype
var wrapVal = function wrapVal(proto, val) {
  var obj = Object.create(proto);
  obj._value = val;
  return Object.freeze(obj);
};

exports.make = function make_monad() {
  // Initilize the stack component, that actually does most of the work
  var stack = createStack(Array.prototype.slice.call(arguments));

  // Define the prototype of the resulting monad stack
  var baseStackProto = {
    stack: stack,
    // Add chain function
    chain: function chain(funk) {
      var funkAndUnwrap = function funkAndUnwrap(val) {
        return unwrap(funk(val));
      };
      if (!process.debug) {
        funkAndUnwrap.toString = function () {
          return 'unwrap(' + funk.toString() + ')';
        };
      }
      return create(stack.last.chain(funkAndUnwrap, this._value));
    },
    lift: function lift(proto, val) {
      return create(stack.lift(proto, val));
    },
    // Add 'map' and 'of' functions
    of: function of(value) {
      return create(stack.last.of(value));
    },
    map: function map(funk) {
      var _this = this;

      return this.chain(function (val) {
        return _this.of(funk(val));
      });
    },
    value: function value(callback) {
      callback = callback !== undefined ? callback : function (a) {
        return a;
      };
      return stack.last.value(callback, this._value);
    }
  };

  // Promotes a method from a monad definition so it can be used as a static method
  var toInstance = function toInstance(funk, outer) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      return this.chain(function (val) {
        return create(stack.lift(outer.original, funk.apply(outer, args.concat([val]))));
      });
    };
  };

  // Augment the stack prototype with helper methods
  var stackProto = Object.assign.apply(null, [baseStackProto].concat(stack._members.map(function (monad) {
    return monadMapVals(toInstance, monad);
  })));

  // The constructor function creates a new object and wraps it in the stack prototype
  var create = function create(val) {
    return wrapVal(stackProto, val);
  };

  // Add relevant methods from the monadic interface to the stack constructor
  create.of = stackProto.of;
  create.lift = stackProto.lift;

  // Promotes a method from a monad definition so it can be used as a static method
  var toConstructor = function toConstructor(funk, outer) {
    return function () {
      return create(stack.lift(outer.original, funk.apply(outer, arguments)));
    };
  };
  // Augment the stack constructor with helper methods
  return Object.assign.apply(null, [create].concat(stack._members.map(function (monad) {
    return monadMapVals(toConstructor, monad);
  })));
};
global.mtl = module.exports;

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./comp":1,"./data":2,"./id":3,"./stack":5,"_process":6}],5:[function(require,module,exports){
'use strict';

module.exports = function createStack(monadStack) {
  // Generate errors
  var error = new Error('The first argument must be a stack member');

  // Add the ID monad at the bottom of the monad stack
  var stack = [idProto].concat(monadStack);

  stack.forEach(function (member) {
    if (typeof member !== 'object') {
      throw new Error('Stack members must be objects');
    }
  });

  // Perform some preprocessing on the stack
  var stackProcessed = processStack(stack);

  // Define the lift operation which takes a value of a given level of the stack and lifts it to the last level
  var lift = function lift(_x, _x2) {
    var _again = true;

    _function: while (_again) {
      var val = _x,
          level = _x2;
      _again = false;

      // Get the stack prototypes for the previous and the next level
      var nextLevel = level + 1;
      var nextMember = stackProcessed[level + 1];
      // Do not do anything if the value is already at the last level.
      if (nextMember !== undefined) {
        // Perform the lift operation at the necessary level
        // Call the function recursively to get to the next one
        _x = nextMember.lift(val);
        _x2 = nextLevel;
        _again = true;
        nextLevel = nextMember = undefined;
        continue _function;
      } else {
        return val;
      }
    }
  };

  // Takes funk and from it creates a stack operation
  var operation = function operation(funk) {
    return function (proto, val) {
      // Determine the level of the value, given the proto
      var level = stack.indexOf(proto);
      // Throw an error if the value is invalid
      if (level === -1) {
        throw error;
      }
      return funk(val, level);
    };
  };
  // Dispatches an operation to the correct stack level
  var fromStack = function fromStack(name) {
    return function (val, level) {
      return stackProcessed[level][name](val);
    };
  };

  return {
    lift: operation(lift),
    of: operation(fromStack('of')),
    chain: operation(fromStack('chain')),
    last: stackProcessed[stackProcessed.length - 1],
    id: idProto,
    _members: stackProcessed
  };
};

var processStack = function processStack(baseStack) {
  return stateMap(baseStack, function (item, state) {
    var prevItemProcessed = state.prevItemProcessed || idProto;
    // Apply the processing function on each stack member
    var itemProcessed = processProtoNew(item, prevItemProcessed);
    return [itemProcessed, {
      prevItemProcessed: itemProcessed
    }];
  });
};

// A stateful version of the map function:
// f accepts an array item and a state(defaults to an object) and returns the processed version of the item plus a new state
var stateMap = function stateMap(arr, f) {
  return arr.reduce(function (arrayAndState, item) {
    var itemAndState = f(item, arrayAndState[1]);
    return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1]];
  }, [[], {}])[0];
};

var clone = function clone(obj) {
  return Object.keys(obj).reduce(function (newObj, key) {
    newObj[key] = obj[key];
    return newObj;
  }, {});
};

var processProtoNew = function processProtoNew(proto, outer) {
  var protoProcessed = clone(proto);
  protoProcessed.name = proto.name + '/' + outer.name;
  protoProcessed.outer = outer;
  // Save the original so we can do typechecks and route method calls
  protoProcessed.original = proto;
  return protoProcessed;
};

// The identity monad, which lies at the bottom of each stack
var idProto = {
  name: 'root',
  of: function of(val) {
    return val;
  },
  chain: function chain(funk, val) {
    return funk(val);
  },
  map: function map(funk, val) {
    return funk(val);
  },
  value: function value(funk, val) {
    return funk(val);
  }
};

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

},{}]},{},[1,2,3,4,5])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJDOi9wci9zb25uZS9saWIvY29tcC5qcyIsIkM6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzIiwiQzovcHIvc29ubmUvbGliL2lkLmpzIiwiQzovcHIvc29ubmUvbGliL21haW4uanMiLCJDOi9wci9zb25uZS9saWIvc3RhY2suanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLENBQUMsS0FBSyxHQUFHO0FBQ2QsTUFBSSxFQUFFLE9BQU87QUFDYixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7OztBQUNQLFdBQU8sVUFBQyxTQUFTO2FBQUssTUFBSyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQUEsQ0FBQTtHQUN0RDtBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7OztBQUNsQixXQUFPLFVBQUMsU0FBUzthQUNmLE9BQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFDLE1BQU0sRUFBSztBQUMzQixZQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQUUsUUFBUSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5QyxlQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtPQUM5QixFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUFBLENBQUE7R0FDdkI7QUFDRCxNQUFJLEVBQUMsY0FBQyxHQUFHLEVBQUU7OztBQUNULFdBQU8sVUFBQyxTQUFTO2FBQ2YsT0FBSyxLQUFLLENB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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgc3RhdGUpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB0aGlzLm91dGVyLmNoYWluKChwYXJhbXMpID0+IHtcclxuICAgICAgICBjb25zdCBuZXdWYWwgPSBwYXJhbXNbMF0sIG5ld1N0YXRlID0gcGFyYW1zWzFdXHJcbiAgICAgICAgcmV0dXJuIGZ1bmsobmV3VmFsKShuZXdTdGF0ZSlcclxuICAgICAgfSwgc3RhdGUocHJldlN0YXRlKSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+XHJcbiAgICAgIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2YoW2lubmVyVmFsdWUsIHByZXZTdGF0ZV0pLCB2YWwpXHJcbiAgfSxcclxuICBsb2FkICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFtwcmV2U3RhdGUsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBzYXZlICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHZhbF0pXHJcbiAgfSxcclxuICBtYXBTdGF0ZSAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihmdW5rKHZhbCwgcHJldlN0YXRlKSlcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCBzdGF0ZSkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKHBhcmFtcykgPT4ge1xyXG4gICAgICByZXR1cm4gZnVuayhwYXJhbXNbMF0pXHJcbiAgICB9LCBzdGF0ZSgpKVxyXG4gIH1cclxufVxyXG4iLCIvKiAjIGBkYXRhLm1heWJlYFxyXG4gKlxyXG4gKiBUaGUgYG1heWJlYCBtb25hZCB0cmFuc2Zvcm1lciBhdXRvbWF0aWNhbGx5IGNoZWNrcyBpZiB5b3VyIHZhbHVlIGlzIHVuZGVmaW5lZCBhbmRcclxuICogc3RvcHMgdGhlIGNvbXB1dGF0aW9uIGlmIGl0IGlzLlxyXG4gKlxyXG4gKiAjIyBgdmFsdWUuZ2V0KGtleSlgXHJcbiAqXHJcbiAqIEEgaGVscGVyIHRvIHNhZmVseSByZXRyaWV2ZSBhIHBvc3NpYmx5IHVuZGVmaW5lZCBwcm9wZXJ0eSBvZiB5b3VyIHZhbHVlLlxyXG4gKiBUaGUgdmFsdWUgaGFzIHRvIGJlIGEgSlMgb2JqZWN0LlxyXG4gKiBcclxuICogIyMgYHZhbHVlLmNoYWluTWF5YmUoZilcclxuICogXHJcbiAqIENoYWlucyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGBtYXliZWAgdmFsdWUgaW4gdGhlIGNvbXB1dGF0aW9uXHJcbiAqL1xyXG5cclxuZXhwb3J0cy5tYXliZSA9IHtcclxuICBuYW1lOiAnTWF5YmUnLFxyXG4gIC8vICh2YWwpID0+IE0oe21heWJlVmFsOnZhbH0pXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4gdGhpcy5vdXRlci5vZih7bWF5YmVWYWw6IHZhbCB9KSB9LFxyXG4gIC8vICh2YWwgPT4gTSh7bWF5YmVWYWw6dmFsfSkgLCBNKHttYXliZVZhbDp2YWx9KSkgPT4gTSh7bWF5YmVWYWw6dmFsfSlcclxuICBjaGFpbiAoZnVuaywgbU1heWJlVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigobWF5YmVWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIG1heWJlVmFsLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBtYXliZVZhbCA6IGZ1bmsobWF5YmVWYWwubWF5YmVWYWwpXHJcbiAgICB9LCBtTWF5YmVWYWwpXHJcbiAgfSxcclxuICAvLyAoTSh2YWwpKSA9PiBNKHttYXliZVZhbDp2YWx9KVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe21heWJlVmFsOiB2YWx9KSwgbVZhbClcclxuICB9LFxyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgTSh7bWF5YmVWYWw6dmFsfSkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZ1bmssIG1NYXliZVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKG1heWJlVmFsKSA9PiB7XHJcbiAgICAgIHJldHVybiBtYXliZVZhbC5tYXliZVZhbCA9PT0gdW5kZWZpbmVkID8gbWF5YmVWYWwgOiBmdW5rKG1heWJlVmFsLm1heWJlVmFsKVxyXG4gICAgfSwgbU1heWJlVmFsKVxyXG4gIH0sXHJcbiAgZ2V0IChrZXksIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub2YodmFsW2tleV0pXHJcbiAgfSxcclxuICBjaGFpbk1heWJlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKGZ1bmsodmFsKSlcclxuICB9XHJcbn1cclxuXHJcbi8qICMgYGRhdGEubGlzdGBcclxuICpcclxuICogVGhlIGBsaXN0YCBtb25hZCB0cmFuc2Zvcm1lciBhbGxvd3MgeW91IHRvIG9wZXJhdGUgb24gYSBsaXN0IG9mIHZhbHVlcy5cclxuICogaW5zdGVhZCBvZiBvbiBhIHNpbmdsZSB2YWx1ZS5cclxuICpcclxuICogIyMgYExpc3QuZnJvbUFycmF5KHZhbClcclxuICpcclxuICogV3JhcHMgYW4gYXJyYXkgaW4gYSBsaXN0IG1vbmFkIHRyYW5zZm9ybWVyIGluc3RhbmNlLlxyXG4gKlxyXG4gKiAjIyBgdmFsdWVzLmZpbHRlcihmbilgXHJcbiAqIFxyXG4gKiBGaWx0ZXJzIG91dCB0aGUgdmFsdWVzIHRoYXQgZG9uJ3QgbWF0Y2ggdGhlIHByZWRpY2F0ZS4gU2FtZSBhcyBgQXJyYXkucHJvdG90eXBlLmZpbHRlcmAuXHJcbiAqIFxyXG4gKiBfVGhlIGJlaGF2aW91ciBvZiBgQXJyYXkucHJvdG90eXBlLm1hcGAgaXMgY292ZXJlZCBieSB0aGUgbW9uYWQgdHJhbnNmb3JtZXIgYG1hcGAgbWV0aG9kLl9cclxuICovXHJcblxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ0xpc3QnLFxyXG4gIC8vICh2YWwpID0+IE0oW3ZhbF0pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbF0pXHJcbiAgfSxcclxuICAvLyAodmFsID0+IE0oW3ZhbF0pICwgTShbdmFsXSkpPT4gTShbdmFsXSlcclxuICBjaGFpbiAoZnVuaywgbUxpc3RWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGxpc3RWYWwgPT4ge1xyXG4gICAgICByZXR1cm4gbGlzdFZhbC5sZW5ndGggPT09IDAgPyB0aGlzLm91dGVyLm9mKFtdKSA6IGxpc3RWYWxcclxuICAgICAgICAubWFwKGZ1bmspXHJcbiAgICAgICAgLnJlZHVjZSgoYWNjdW11bGF0ZWRWYWwsIG5ld1ZhbCkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oYWNjdW11bGF0ZWQgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbihfbmV3ID0+IFxyXG4gICAgICAgICAgICAgIHRoaXMub3V0ZXIub2YoYWNjdW11bGF0ZWQuY29uY2F0KF9uZXcpKSwgbmV3VmFsKVxyXG4gICAgICAgIH0sIGFjY3VtdWxhdGVkVmFsKVxyXG4gICAgICB9KVxyXG4gICAgfSwgbUxpc3RWYWwpXHJcbiAgfSxcclxuICAvLyAoTSh2YWwpKSA9PiBNKFt2YWxdKVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWx1ZSA9PiB0aGlzLm91dGVyLm9mKFtpbm5lclZhbHVlXSksIHZhbClcclxuICB9LFxyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgTShbdmFsXSkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGxpc3QpID0+IHtcclxuICAgICAgcmV0dXJuIGxpc3QubWFwKGZ1bmspXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuICBmaWx0ZXIgKGZ1bmssIHZhbCkge1xyXG4gICAgaWYgKGZ1bmsodmFsKSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5vZih2YWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbXSlcclxuICAgIH1cclxuICB9LFxyXG4gIGZyb21BcnJheSAodmFsKSB7XHJcbiAgICBpZiAodmFsLmNvbmNhdCAmJiB2YWwubWFwICYmIHZhbC5yZWR1Y2UgJiYgdmFsLnNsaWNlKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHZhbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IHZhbCArICcgaXMgbm90IGEgbGlzdC4nXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKiAjIGBkYXRhLndyaXRlcmBcclxuICpcclxuICogVGhlIHdyaXRlciBtb25hZCB0cmFuc2Zvcm1lciBhdWdtZW50cyB0aGUgd3JhcHBlZCB2YWx1ZSB3aXRoIG9uZSBhZGRpdGlvbmFsIHZhbHVlXHJcbiAqIHdoaWNoIG1heSBiZSB1c2VkIGZvciBzdG9yaW5nIHNvbWUgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgY29tcHV0YXRpb24uXHJcbiAqXHJcbiAqIFRoZSBhZGRpdGlvbmFsIHZhbHVlIG11c3QgaGF2ZSBhIGBjb25jYXRgIG1ldGhvZCwgYXMgYFN0cmluZ2Agb3IgYEFycmF5YC5cclxuICogXHJcbiAqICMjIGB2YWx1ZS50ZWxsKHZhbClgXHJcbiAqIENvbmNhdHMgYHZhbGAgdG8gdGhlIGFkZGl0aW9uYWwgdmFsdWUuXHJcbiAqIFxyXG4gKlxyXG4gKiAjIyBgdmFsdWUubGlzdGVuKGYpXHJcbiAqIENhbGxzIGBmYCB3aXRoIHRoZSB2YWx1ZSBhcyBhbiBhcmd1bWVudC4gXHJcbiAqL1xyXG5cclxuY29uc3QgY29tcHV0ZUxvZyA9IChsb2csIG5ld0xvZykgPT4ge1xyXG4gIGlmKGxvZyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gbmV3TG9nXHJcbiAgfSBlbHNlIHtcclxuICAgIGlmIChuZXdMb2cgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXR1cm4gbG9nXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gbG9nLmNvbmNhdChuZXdMb2cpXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnRzLndyaXRlciA9IHtcclxuICBuYW1lOiAnV3JpdGVyJyxcclxuXHJcbiAgLy8gKHZhbCkgPT4gTShbdmFsLCBsb2ddKVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWwsIHVuZGVmaW5lZF0pXHJcbiAgfSxcclxuXHJcbiAgLy8gKHZhbCA9PiBNKFt2YWwsIGxvZ10pLCBNKFt2YWwsIGxvZ10pKSA9PiBNKFt2YWwsIGxvZ10pXHJcbiAgY2hhaW4gKGZ1bmssIG1Xcml0ZXJWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh3cml0ZXJWYWwpID0+IHtcclxuICAgICAgY29uc3QgdmFsID0gd3JpdGVyVmFsWzBdXHJcbiAgICAgIGNvbnN0IGxvZyA9IHdyaXRlclZhbFsxXSBcclxuICAgICAgY29uc3QgbmV3TVdyaXRlclZhbCA9IGZ1bmsodmFsKVxyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigobmV3V3JpdGVyVmFsKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbmV3VmFsID0gbmV3V3JpdGVyVmFsWzBdXHJcbiAgICAgICAgY29uc3QgbmV3TG9nID0gdHlwZW9mIG5ld1dyaXRlclZhbFsxXSA9PT0gJ2Z1bmN0aW9uJyA/IG5ld1dyaXRlclZhbFsxXShsb2cpIDogbmV3V3JpdGVyVmFsWzFdXHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW25ld1ZhbCwgY29tcHV0ZUxvZyhsb2csIG5ld0xvZyldKVxyXG4gICAgICB9LCBuZXdNV3JpdGVyVmFsKVxyXG4gICAgfSwgbVdyaXRlclZhbClcclxuXHJcbiAgfSxcclxuXHJcbiAgLy8gKE0odmFsKSA9PiBNKFt2YWwsIGxvZ10pXHJcbiAgbGlmdCAobVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKHZhbCkgPT4gdGhpcy5vdXRlci5vZihbdmFsLCB1bmRlZmluZWRdKSwgbVZhbClcclxuICB9LFxyXG5cclxuICAvLyAoKHZhbCkgPT4gYiwgTShbdmFsLCBsb2ddKSkgPT4gYlxyXG4gIHZhbHVlIChmdW5rLCBtV3JpdGVyVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZSgod3JpdGVyVmFsKSA9PiB7XHJcbiAgICAgIHJldHVybiBmdW5rKHdyaXRlclZhbFswXSlcclxuICAgIH0sIG1Xcml0ZXJWYWwpXHJcbiAgfSxcclxuXHJcbiAgdGVsbCAobWVzc2FnZSwgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbdmFsLCBtZXNzYWdlXSlcclxuICB9LFxyXG4gIGxpc3RlbiAoZnVuaywgdmFsKXtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWwsIGZ1bmtdKVxyXG4gIH1cclxufVxyXG4iLCIvKiAjIEltcGxlbWVudGluZyBhIG1vbmFkIHRyYW5zZm9ybWVyXHJcbiAqXHJcbiAqIE1vbmFkIHRyYW5zZm9ybWVycyBhcmUgdHJpY2t5LCBhbmQgb25lIG9mIHRoZSByZWFzb25zIGZvciB0aGlzIGlzIHRoYXQgdGhleSByZXF1aXJlIGFuXHJcbiAqIGV4Y2Vzc2l2ZSBhbW91bnQgb2YgdHlwZSBqdWdnbGluZy4gWW91IGhhdmUgdG8gY29uc3RhbnRseSB3cmFwIHRoaW5ncyBpbiBib3hlcyBhbmQgdW53cmFwIHRoZW1cclxuICogYWdhaW4uIFxyXG4gKlxyXG4gKiBPbmUgb2YgdGhlIGFpbXMgb2YgdGhpcyBwYWNrYWdlIGlzIHRvIHJlZHVjZSB0aGUgYW1vdW50IG9mIHdyYXBwaW5nIGFuZCB1bndyYXBwaW5nIG5lZWRlZCBmb3JcclxuICogbWFraW5nIGEgbmV3IHRyYW5zZm9ybWVyIGFuZCB0byBwcm92aWRlIGFuIGVhc3kgd2F5IHRvIGRlZmluZSBhbmQgY29tYmluZSB0cmFuc2Zvcm1lcnMuIFxyXG4gKlxyXG4gKiBXaXRoIGl0LCBhbGwgaXQgdGFrZXMgdG8gaW1wbGVtZW50IGEgdHJhbnNmb3JtZXIgaXMgaW1wbGVtZW50IHRoZXNlIGZvdXIgZnVuY3Rpb25zOiBcclxuICogYG9mYCAoQUtBIGByZXR1cm5gKSwgYGNoYWluYCAoQUtBIGBmbGF0TWFwYCkgYGxpZnRgIGFuZCBgdmFsdWVgKEFLQSBgcnVuYClcclxuICpcclxuICogIyMgVGhlIHRyaXZpYWwgaW1wbGVtZW50YXRpb25cclxuICogXHJcbiAqIENvbnNpZGVyIHRoZSBpZGVudGl0eSBNb25hZCB0cmFuc2Zvcm1lci4gVGhpcyBpcyBhIG1vbmFkIHRyYW5zZm9ybWVyIHRoYXQgZG9lcyBub3RoaW5nOiBcclxuICogb3IgaW4gb3RoZXIgd29yZHMgaXQgcHJvZHVjZXMgYSBtb25hZCB3aGljaCBiZWhhdmVzIHRoZSBzYW1lIHdheSBhcyB0aGUgb25lIGl0IGlzIGdpdmVuIHRvIGl0XHJcbiAqIGFzIGFuIGFyZ3VtZW50LiBIZXJlIGlzIGhvdyB3b3VsZCB0aGUgaW1wbGVtZW50YXRpb24gb2YgdGhlc2UgbWV0aG9kcyBsb29rIGxpa2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZE1pbmltYWwgPSB7XHJcbiAgbmFtZTogJ2lkTWluaW1hbCcsXHJcbi8qXHJcbiAqIFRoZSBgb2ZgIGZ1bmN0aW9uIHRha2VzIGEgc2NhbGFyIHZhbHVlIGFuZCByZXR1cm5zIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRlbGVnYXRlIGV2ZXJ5dGhpbmcgdG8gdGhlIG91dGVyIG1vbmFkJ3MgYG9mYCBtZXRob2QuXHJcbiAqIFdlIGFjY2VzcyB0aGUgb3V0ZXIgbW9uYWQgd2l0aCBgdGhpcy5vdXRlcmAuIFxyXG4gKi9cclxuICAvLyAodmFsKSA9PiBNKHZhbClcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZih2YWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIGBjaGFpbmAgaXMgdGhlIGhlYXJ0IG9mIGFueSBtb25hZCBvciBtb25hZCB0cmFuc2Zvcm1lci5cclxuICpcclxuICogSW4gdGhpcyBjYXNlIHdlIGltcGxlbWVudCBpdCBieSBqdXN0IGNhbGxpbmcgdGhlIGBjaGFpbmAgZnVuY3Rpb24gb2YgdGhlIGhvc3QgbW9uYWQgKHVzaW5nIFxyXG4gKiBgdGhpcy5vdXRlci5jaGFpbmApIHdpdGggdGhlIGZ1bmN0aW9uIGdpdmVuIHRvIHVzIGFzIGFuIGFyZ3VtZW50LlxyXG4gKi9cclxuICAvLyAodmFsID0+IE0odmFsKSAsIE0odmFsKSkgPT4gTSh2YWwpXHJcbiAgY2hhaW4gKGZuLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGZuLCB2YWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIFRoZSBgbGlmdGAgZnVuY3Rpb24gaXMga2luZGEgbGlrZSBgb2ZgLCBidXQgaXQgYWNjZXB0cyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWRcclxuICogaW5zdGVhZCBvZiBhICdwbGFpbicgdmFsdWUuXHJcbiAqL1xyXG4gIC8vIChNKHZhbCkpID0+IE0odmFsKVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbFxyXG4gIH0sXHJcbi8qIFxyXG4gKiBIYXZpbmcgYm90aCAnbGlmdCcgYW5kICdvZicgZW5hYmxlcyB1cyB0byBjb252ZXJ0IGFueSB2YWx1ZSBjcmVhdGVkIGJ5IG9uZSBtb25hZCB0cmFuc2Zvcm1lclxyXG4gKiB0byBhIGEgdmFsdWUgdGhhdCBob2xkcyBhbGwgZWxlbWVudHMgb2YgdGhlIHN0YWNrXHJcbiAqXHJcbiAqIEZpbmFsbHkgdGhlIGB2YWx1ZWAgZnVuY3Rpb24gcHJvdmlkZXMgYSB3YXkgdG8gZ2V0ICd0aGUgdmFsdWUgYmFjaydcclxuICogV2hhdCBpdCBkb2VzIGlzIHRvIHVud3JhcCBhIHByZXZpb3VzbHktd3JhcHBlZCBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRpZG4ndCBkbyBhbnkgd3JhcHBpbmcsIHNvIHdlIGRvbid0IGhhdmUgdG8gZG8gYW55IHVud3JhcHBpbmcgZWl0aGVyLlxyXG4gKi9cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0odmFsKSkgPT4gb3RoZXJWYWxcclxuICB2YWx1ZSAoZm4sIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoZm4sIHZhbClcclxuICB9XHJcbn1cclxuXHJcbi8qICMgTWFuaXB1bGF0aW5nIHRoZSB2YWx1ZVxyXG4gKiBcclxuICogQWxsIG1vbmFkIHRyYW5zZm9ybWVycyBkbyB0aGUgc2FtZSB0aGluZyAoZ2l2ZW4gYSBtb25hZCBgQWAsIHRoZXkgcHJvZHVjZSBhXHJcbiAqIG1vbmFkIGBCKEEpYCB3aGljaCBzb21laG93IGF1Z21lbnRzIGBBYCksIGJ1dCB0aGVyZSBpcyBubyBnZW5lcmFsIGZvcm11bGEgZm9yIGRvaW5nIGl0LlxyXG4gKiBcclxuICogU2ltcGxlciBtb25hZHMgY2FuIGJlIGltcGxlbWVudGVkIGp1c3QgYnkgbWFuaXB1bGF0aW5nIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGhvc3QgbW9uYWQuXHJcbiAqXHJcbiAqIE91ciBuZXh0IGltcGxlbWVudGF0aW9uIG9mIElEIHdpbGwganVzdCB3cmFwIHRoZSB1bmRlcmx5aW5nIHZhbHVlICh3aGljaCB3ZSBjYWxsZWQgQSlcclxuICogaW4gYSBwbGFpbiBvYmplY3QuXHJcbiAqXHJcbiAqIFNvIGBNKEEpYCB3b3VsZCBiZWNvbWUgYE0gKHtpZFZhbDpBfSlgIHdoZW4gd2Ugd3JhcCBpdCBhbmQgd2lsbCBiZSBiYWNrIHRvIGBNKEEpYCB3aGVuIHdlXHJcbiAqIHVud3JhcCBpdC5cclxuICpcclxuICogSGVyZSBpcyBob3cgdGhpcyBpbXBsZW1lbnRhdGlvbiB3b3VsZCBsb29rIGxpa2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZCA9IHtcclxuICBuYW1lOiAnSWQnLFxyXG5cclxuLypcclxuICogVGhlIGBvZmAgZnVuY3Rpb24gdGFrZXMgYSBzY2FsYXIgdmFsdWUgYW5kIHJldHVybnMgYW4gaW5zdGFuY2Ugb2YgdGhlIG91dGVyIG1vbmFkLlxyXG4gKiBJbiB0aGlzIGNhc2Ugd2UgZGVsZWdhdGUgZXZlcnl0aGluZyB0byB0aGUgb3V0ZXIgbW9uYWQncyBgb2ZgIG1ldGhvZC5cclxuICogV2UgYWNjZXNzIHRoZSBvdXRlciBtb25hZCB3aXRoIGB0aGlzLm91dGVyYC4gXHJcbiAqL1xyXG5cclxuICAvLyAodmFsKSA9PiBNKHtpZFZhbDp2YWx9KVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsIH0pXHJcbiAgfSxcclxuLyogXHJcbiAqXHJcbiAqIGNoYWluIGp1c3QgY2FsbHMgdGhlIGBjaGFpbmAgZnVuY3Rpb24gb2YgdGhlIGhvc3QgbW9uYWQgbGlrZSBpbiB0aGUgcHJldmlvdXMgZXhhbXBsZS5cclxuICogVGhlIGRpZmZlcmVuY2UgaXMgdGhhdCBpdCBhcHBsaWVzIHNvbWUgdHJhbnNmb3JtYXRpb24gdG8gdGhlIHZhbHVlIGluIG9yZGVyIHRvIGZpdCBcclxuICogdGhlIG5ldyBjb250ZXh0LiBcclxuICovXHJcbiAgLy8gKHZhbCA9PiBNKHtpZFZhbDp2YWx9KSAsIE0oe2lkVmFsOnZhbH0pKSA9PiBNKHtpZFZhbDp2YWx9KVxyXG4gIGNoYWluIChmbiwgbUlkVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigoaWRWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgfSwgbUlkVmFsKVxyXG4gIH0sXHJcbi8qIFxyXG4gKiBUaGUgYGxpZnRgIGZ1bmN0aW9uIHVzZXMgYGNoYWluYCArIGBvZmAgKHdoaWNoIGlzIHRoZSBzYW1lIGFzIGBtYXBgKSB0byBnbyB0byB0aGUgaG9zdCBtb25hZFxyXG4gKiBhbmQgbW9kaWZ5IHRoZSB2YWx1ZSBpbnNpZGUgaXQuXHJcbiAqL1xyXG4gIC8vIChNKHZhbCkpID0+IE0oe2lkVmFsOnZhbH0pXHJcbiAgbGlmdCAobVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKHZhbCkgPT4gdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbH0pLCBtVmFsKVxyXG4gIH0sXHJcbi8qXHJcbiAqIExhc3RseSB3ZSBoYXZlIHRoZSBgdmFsdWVgIGZ1bmN0aW9uIChvciB0aGUgaW50ZXJwcmV0ZXIpLCB3aGljaCB1bndyYXBzIGEgcHJldmlvdXNseS13cmFwcGVkXHJcbiAqIHZhbHVlLlxyXG4gKi9cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0oe2lkVmFsOnZhbH0pKSA9PiBvdGhlclZhbFxyXG4gIHZhbHVlIChmbiwgbUlkVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZSgoaWRWYWwpPT4ge1xyXG4gICAgICByZXR1cm4gZm4oaWRWYWwuaWRWYWwpXHJcbiAgICB9LCBtSWRWYWwpXHJcbiAgfVxyXG59XHJcblxyXG4vKlxyXG4gKiBOb3RpY2UgdGhhdCB3ZSBhcmUgYWx3YXlzIHJldHVybmluZyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWQuXHJcbiAqXHJcbiAqIFRoYXQgaXMsIGlmIHlvdSBhcmUgdG8gYXBwbHkgdGhlIHRyYW5zZm9ybWF0aW9uIHNldmVyYWwgdGltZXMsXHJcbiAqIHRoZSB2YWx1ZXMgbmVzdCBpbnNpZGUgTTogTSh7aWRWYWw6e2lkVmFsOiBhfX0pXHJcbiAqXHJcbiAqIEhvd2V2ZXIgbm90IGFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgYXJlIGxpa2UgdGhhdC5cclxuICpcclxuICogIyMgQSBtb3JlIGNvbXBsZXggc3RydWN0dXJlXHJcbiAqXHJcbiAqIFNvIGZhciB3ZSBoYXZlIHNlZW4gbW9uYWQgdHJhbnNmb3JtZXJzIHdoaWNoIG9ubHkgZGVhbCB3aXRoIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGdpdmVuXHJcbiAqIG1vbmFkIEEuIEhvd2V2ZXIgbm90IGFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgYXJlIGxpa2UgdGhhdC4gXHJcbiAqXHJcbiAqIFRoZXJlIGFyZSBtb25hZCB0cmFuc2Zvcm1lcnMgd2hpY2ggYWRkIGFkZGl0aW9uYWwgc3RydWN0dXJlIHRvIHRoZSBtb25hZCBpdHNlbGYuXHJcbiAqIEV4YW1wbGVzIG9mIHRoZSBmaXJzdCB0eXBlIGFyZSBhbGwgdHJhbnNmb3JtZXJzIHRoYXQgd2UgaGF2ZSBzZWVuIHNvIGZhci5cclxuICogQW4gZXhhbXBsZSBvZiB0aGUgc2Vjb25kIHR5cGUgaXMgdGhlICdTdGF0ZScgbW9uYWQsIHdoaWNoIGdpdmVuIHRoZSBzYW1lIHZhbHVlIGBNKEEpYCwgd2lsbCBcclxuICogcHJvZHVjZSBzb21ldGhpbmcgbGlrZSBgKCkgPT57IE0oW0EsIFN0YXRlXSkgfWAuIFRoYXQgaXMsIHRoZSB0cmFuc2Zvcm1lciBhZGRzIHRoZSBzdGF0ZVxyXG4gKiB2YWx1ZSB0byB0aGUgJ2hvc3QnIG1vbmFkIGBNYCwgYW5kIHRoZW4gaXQgd3JhcHMgdGhlIG1vbmFkIGl0c2VsZiBpbiBhIGZ1bmN0aW9uLlxyXG4gKlxyXG4gKiBOb3cgY29uc2lkZXIgYW4gYWx0ZXJuYXRpdmUsIGEgbGl0dGxlIG1vcmUgY29tcGxleCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSUQgbW9uYWQuIE9uZVxyXG4gKiB3aGljaCB3cmFwcyB0aGUgTSBtb25hZCBpbnRvIGFub3RoZXIgcGxhaW4gb2JqZWN0LCBzbyB0aGUgdmFsdWUgb2YgTShBKSBiZWNvbWVzXHJcbiAqIGB7aWRDb250YWluZXI6IE0oe2lkVmFsOmF9KX1gLiBOb3RpY2UgdGhhdCB0aGUgdHJhbnNmb3JtZXIgY29uc2lzdHMgb2YgdHdvIHBhcnRzOiBvbmUgd2hpY2ggXHJcbiAqIHdyYXBzIGFyb3VuZCB0aGUgaG9zdCBtb25hZCwgYW5kIG9uZSB3aGljaCB3cmFwcyBhcm91bmQgdGhlIHZhbHVlIGluIGl0LlxyXG4gKi9cclxuXHJcbmV4cG9ydHMuaWRXcmFwcGVkID0ge1xyXG4gIG5hbWU6ICdJZFdyYXBwZWQnLFxyXG5cclxuICAvLyAodmFsKSA9PiB7aWRDb250YWluZXI6IE0oe2lkVmFsOmF9KX1cclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZENvbnRhaW5lcjogdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbH0pXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLy8gKGEgPT4ge2lkQ29udGFpbmVyOk0oe2lkVmFsOmF9KX0sIHtpZENvbnRhaW5lcjpNKHtpZFZhbDphfSl9KSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfVxyXG4gIGNoYWluIChmbiwgaWRDb250YWluZXJNSWRWYWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLmNoYWluKChpZFZhbCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgICAgIHJldHVybiB2YWwuaWRDb250YWluZXJcclxuICAgICAgfSwgaWRDb250YWluZXJNSWRWYWwuaWRDb250YWluZXIpXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLy8gKE0odmFsKSkgPT4ge2lkQ29udGFpbmVyOk0oe2lkVmFsOnZhbH0pfVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWx9KSwgbVZhbClcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIHtpZENvbnRhaW5lcjogTSh7aWRWYWw6dmFsfSkpfT0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZuLCBpZENvbnRhaW5lck1JZFZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGlkVmFsKT0+IHtcclxuICAgICAgcmV0dXJuIGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgfSwgaWRDb250YWluZXJNSWRWYWwuaWRDb250YWluZXIpXHJcbiAgfVxyXG59XHJcblxyXG4vKiBUaGUga2V5IGRpZmZlcmVuY2UgaXMgdGhhdCB3aXRoIHRoaXMgbW9uYWQgbmVzdGluZyBoYXBwZW5zIGJvdGggaW5zaWRlIHRoZSBob3N0IG1vbmFkIGFuZFxyXG4gKiBvdXRzaWRlIG9mIGl0LiBJZiB3ZSBhcHBseSB0aGUgdHJhbnNmb3JtYXRpb24gdHdvIHRpbWVzIHRoZSB2YWx1ZSBiZWNvbWVzOlxyXG4gKiBge2lkQ29udGFpbmVyOntpZENvbnRhaW5lcjpNKHtpZFZhbDp7aWRWYWw6YX19KX19YC5cclxuICovXHJcbiIsImV4cG9ydHMuaWQgPSByZXF1aXJlKCcuL2lkJylcclxuZXhwb3J0cy5kYXRhID0gcmVxdWlyZSgnLi9kYXRhJylcclxuZXhwb3J0cy5jb21wID0gcmVxdWlyZSgnLi9jb21wJylcclxuXHJcbmNvbnN0IGNyZWF0ZVN0YWNrID0gcmVxdWlyZSgnLi9zdGFjaycpXHJcblxyXG4vLyBPYmplY3QuYXNzaWduIHBvbHlmaWxcclxuaWYgKCFPYmplY3QuYXNzaWduKSB7XHJcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KE9iamVjdCwgJ2Fzc2lnbicsIHtcclxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxyXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxyXG4gICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICB2YWx1ZTogZnVuY3Rpb24gKHRhcmdldCkge1xyXG4gICAgICAndXNlIHN0cmljdCdcclxuICAgICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldCA9PT0gbnVsbCkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IGZpcnN0IGFyZ3VtZW50IHRvIG9iamVjdCcpXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHZhciB0byA9IE9iamVjdCh0YXJnZXQpXHJcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaV1cclxuICAgICAgICBpZiAobmV4dFNvdXJjZSA9PT0gdW5kZWZpbmVkIHx8IG5leHRTb3VyY2UgPT09IG51bGwpIHtcclxuICAgICAgICAgIGNvbnRpbnVlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5leHRTb3VyY2UgPSBPYmplY3QobmV4dFNvdXJjZSlcclxuXHJcbiAgICAgICAgdmFyIGtleXNBcnJheSA9IE9iamVjdC5rZXlzKG5leHRTb3VyY2UpXHJcbiAgICAgICAgZm9yICh2YXIgbmV4dEluZGV4ID0gMCwgbGVuID0ga2V5c0FycmF5Lmxlbmd0aDsgbmV4dEluZGV4IDwgbGVuOyBuZXh0SW5kZXgrKykge1xyXG4gICAgICAgICAgdmFyIG5leHRLZXkgPSBrZXlzQXJyYXlbbmV4dEluZGV4XVxyXG4gICAgICAgICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5leHRTb3VyY2UsIG5leHRLZXkpXHJcbiAgICAgICAgICBpZiAoZGVzYyAhPT0gdW5kZWZpbmVkICYmIGRlc2MuZW51bWVyYWJsZSkge1xyXG4gICAgICAgICAgICB0b1tuZXh0S2V5XSA9IG5leHRTb3VyY2VbbmV4dEtleV1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRvXHJcbiAgICB9XHJcbiAgfSlcclxufVxyXG5cclxuLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gcHJvcGVydHkgaXMgcGFydCBvZiB0aGUgZ2VuZXJhbCBtb25hZCBkZWZpbml0aW9uIGludGVyZmFjZVxyXG5jb25zdCBpc1Jlc2VydmVyTW9uYWRLZXkgPSAoa2V5KSA9PiBrZXkgIT09ICduYW1lJyAmJiBrZXkgIT09ICdtYXAnICYmIGtleSAhPT0gJ29mJyAmJiBrZXkgIT09ICdjaGFpbicgJiYga2V5ICE9PSAnbGlmdCcgJiYga2V5ICE9PSAndmFsdWUnXHJcblxyXG4vLyBNYXBzIHRoZSB2YWx1ZXMgb2YgYSBnaXZlbiBvYmogZXhjbHVkaW5nIHRoZSByZXNlcnZlZCBvbmVzLlxyXG5jb25zdCBtb25hZE1hcFZhbHMgPSAoZnVuaywgb2JqKSA9PiB7XHJcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iailcclxuICAgIC5maWx0ZXIoaXNSZXNlcnZlck1vbmFkS2V5KVxyXG4gICAgLnJlZHVjZSgobmV3T2JqLCBrZXkpID0+IHtcclxuICAgICAgbmV3T2JqW2tleV0gPSBmdW5rKG9ialtrZXldLCBvYmopXHJcbiAgICAgIHJldHVybiBuZXdPYmpcclxuICAgIH0sIHt9KVxyXG59XHJcblxyXG4vLyBVbndyYXBzIGEgd3JhcHBlZCB2YWx1ZVxyXG5jb25zdCB1bndyYXAgPSAodmFsKSA9PiB7XHJcbiAgaWYgKCF2YWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7dGhyb3cgSlNPTi5zdHJpbmdpZnkodmFsKSArICcgaXMgbm90IGEgd3JhcHBlZCB2YWx1ZSd9XHJcbiAgcmV0dXJuIHZhbC5fdmFsdWVcclxufVxyXG5cclxuLy8gV3JhcHMgYSB2YWx1ZSBpbiBhIHNwZWNpZmllZCBwcm90b3R5cGVcclxuY29uc3Qgd3JhcFZhbCA9IChwcm90bywgdmFsKSA9PiB7XHJcbiAgdmFyIG9iaiA9IE9iamVjdC5jcmVhdGUocHJvdG8pXHJcbiAgb2JqLl92YWx1ZSA9IHZhbFxyXG4gIHJldHVybiBPYmplY3QuZnJlZXplKG9iailcclxufVxyXG5cclxuZXhwb3J0cy5tYWtlID0gZnVuY3Rpb24gbWFrZV9tb25hZCAoKSB7XHJcbiAgLy8gSW5pdGlsaXplIHRoZSBzdGFjayBjb21wb25lbnQsIHRoYXQgYWN0dWFsbHkgZG9lcyBtb3N0IG9mIHRoZSB3b3JrXHJcbiAgY29uc3Qgc3RhY2sgPSBjcmVhdGVTdGFjayhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3QgYmFzZVN0YWNrUHJvdG8gPSB7XHJcbiAgICBzdGFjazogc3RhY2ssXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICBpZiAoIXByb2Nlc3MuZGVidWcpIHtcclxuICAgICAgICBmdW5rQW5kVW53cmFwLnRvU3RyaW5nID0gKCkgPT4gJ3Vud3JhcCgnICsgZnVuay50b1N0cmluZygpICsgJyknXHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0LmNoYWluKGZ1bmtBbmRVbndyYXAsIHRoaXMuX3ZhbHVlKSlcclxuICAgIH0sXHJcbiAgICBsaWZ0IChwcm90bywgdmFsKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChwcm90bywgdmFsKSlcclxuICAgIH0sXHJcbiAgICAvLyBBZGQgJ21hcCcgYW5kICdvZicgZnVuY3Rpb25zXHJcbiAgICBvZiAodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0Lm9mKHZhbHVlKSlcclxuICAgIH0sXHJcbiAgICBtYXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxyXG4gICAgfSxcclxuICAgIHZhbHVlIChjYWxsYmFjaykge1xyXG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrICE9PSB1bmRlZmluZWQgPyBjYWxsYmFjayA6IGEgPT4gYVxyXG4gICAgICByZXR1cm4gc3RhY2subGFzdC52YWx1ZShjYWxsYmFjaywgdGhpcy5fdmFsdWUpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBQcm9tb3RlcyBhIG1ldGhvZCBmcm9tIGEgbW9uYWQgZGVmaW5pdGlvbiBzbyBpdCBjYW4gYmUgdXNlZCBhcyBhIHN0YXRpYyBtZXRob2RcclxuICBjb25zdCB0b0luc3RhbmNlID0gKGZ1bmssIG91dGVyKSA9PiBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQob3V0ZXIub3JpZ2luYWwsIGZ1bmsuYXBwbHkob3V0ZXIsIGFyZ3MuY29uY2F0KFt2YWxdKSkpKVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIC8vIEF1Z21lbnQgdGhlIHN0YWNrIHByb3RvdHlwZSB3aXRoIGhlbHBlciBtZXRob2RzXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IE9iamVjdC5hc3NpZ24uYXBwbHkobnVsbCwgW2Jhc2VTdGFja1Byb3RvXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0luc3RhbmNlLCBtb25hZCkpKSlcclxuXHJcbiAgLy8gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGNyZWF0ZXMgYSBuZXcgb2JqZWN0IGFuZCB3cmFwcyBpdCBpbiB0aGUgc3RhY2sgcHJvdG90eXBlXHJcbiAgY29uc3QgY3JlYXRlID0gKHZhbCkgPT4ge1xyXG4gICAgcmV0dXJuIHdyYXBWYWwoc3RhY2tQcm90bywgdmFsKVxyXG4gIH1cclxuXHJcbiAgLy8gQWRkIHJlbGV2YW50IG1ldGhvZHMgZnJvbSB0aGUgbW9uYWRpYyBpbnRlcmZhY2UgdG8gdGhlIHN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZS5saWZ0ID0gc3RhY2tQcm90by5saWZ0XHJcblxyXG4gIC8vIFByb21vdGVzIGEgbWV0aG9kIGZyb20gYSBtb25hZCBkZWZpbml0aW9uIHNvIGl0IGNhbiBiZSB1c2VkIGFzIGEgc3RhdGljIG1ldGhvZFxyXG4gIGNvbnN0IHRvQ29uc3RydWN0b3IgPSAoZnVuaywgb3V0ZXIpID0+IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChvdXRlci5vcmlnaW5hbCwgZnVuay5hcHBseShvdXRlciwgYXJndW1lbnRzKSkpXHJcbiAgfVxyXG4gIC8vIEF1Z21lbnQgdGhlIHN0YWNrIGNvbnN0cnVjdG9yIHdpdGggaGVscGVyIG1ldGhvZHNcclxuICByZXR1cm4gT2JqZWN0LmFzc2lnbi5hcHBseShudWxsLCBbY3JlYXRlXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0NvbnN0cnVjdG9yLCBtb25hZCkpKSlcclxufVxyXG5nbG9iYWwubXRsID0gbW9kdWxlLmV4cG9ydHNcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjcmVhdGVTdGFjayAobW9uYWRTdGFjaykge1xyXG4gIC8vIEdlbmVyYXRlIGVycm9yc1xyXG4gIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0YWNrIG1lbWJlcicpXHJcblxyXG4gIC8vIEFkZCB0aGUgSUQgbW9uYWQgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbW9uYWQgc3RhY2tcclxuICBjb25zdCBzdGFjayA9IFtpZFByb3RvXS5jb25jYXQobW9uYWRTdGFjaylcclxuXHJcbiAgc3RhY2suZm9yRWFjaChtZW1iZXIgPT4ge1xyXG4gICAgaWYgKHR5cGVvZiBtZW1iZXIgIT09ICdvYmplY3QnKSB7dGhyb3cgbmV3IEVycm9yKCdTdGFjayBtZW1iZXJzIG11c3QgYmUgb2JqZWN0cycpfVxyXG4gIH0pXHJcblxyXG4gIC8vIFBlcmZvcm0gc29tZSBwcmVwcm9jZXNzaW5nIG9uIHRoZSBzdGFja1xyXG4gIGNvbnN0IHN0YWNrUHJvY2Vzc2VkID0gcHJvY2Vzc1N0YWNrKHN0YWNrKVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIGxpZnQgb3BlcmF0aW9uIHdoaWNoIHRha2VzIGEgdmFsdWUgb2YgYSBnaXZlbiBsZXZlbCBvZiB0aGUgc3RhY2sgYW5kIGxpZnRzIGl0IHRvIHRoZSBsYXN0IGxldmVsXHJcbiAgY29uc3QgbGlmdCA9ICh2YWwsIGxldmVsKSA9PiB7XHJcbiAgICAvLyBHZXQgdGhlIHN0YWNrIHByb3RvdHlwZXMgZm9yIHRoZSBwcmV2aW91cyBhbmQgdGhlIG5leHQgbGV2ZWxcclxuICAgIGNvbnN0IG5leHRMZXZlbCA9IGxldmVsICsgMVxyXG4gICAgY29uc3QgbmV4dE1lbWJlciA9IHN0YWNrUHJvY2Vzc2VkW2xldmVsICsgMV1cclxuICAgIC8vIERvIG5vdCBkbyBhbnl0aGluZyBpZiB0aGUgdmFsdWUgaXMgYWxyZWFkeSBhdCB0aGUgbGFzdCBsZXZlbC5cclxuICAgIGlmIChuZXh0TWVtYmVyICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgLy8gUGVyZm9ybSB0aGUgbGlmdCBvcGVyYXRpb24gYXQgdGhlIG5lY2Vzc2FyeSBsZXZlbFxyXG4gICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiByZWN1cnNpdmVseSB0byBnZXQgdG8gdGhlIG5leHQgb25lXHJcbiAgICAgIHJldHVybiBsaWZ0KG5leHRNZW1iZXIubGlmdCh2YWwpLCBuZXh0TGV2ZWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdmFsXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBUYWtlcyBmdW5rIGFuZCBmcm9tIGl0IGNyZWF0ZXMgYSBzdGFjayBvcGVyYXRpb25cclxuICBjb25zdCBvcGVyYXRpb24gPSAoZnVuaykgPT4ge1xyXG4gICAgcmV0dXJuIChwcm90bywgdmFsKSA9PiB7XHJcbiAgICAgIC8vIERldGVybWluZSB0aGUgbGV2ZWwgb2YgdGhlIHZhbHVlLCBnaXZlbiB0aGUgcHJvdG9cclxuICAgICAgY29uc3QgbGV2ZWwgPSBzdGFjay5pbmRleE9mKHByb3RvKVxyXG4gICAgICAvLyBUaHJvdyBhbiBlcnJvciBpZiB0aGUgdmFsdWUgaXMgaW52YWxpZFxyXG4gICAgICBpZiAobGV2ZWwgPT09IC0xKSB7dGhyb3cgZXJyb3J9XHJcbiAgICAgIHJldHVybiBmdW5rKHZhbCwgbGV2ZWwpXHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIERpc3BhdGNoZXMgYW4gb3BlcmF0aW9uIHRvIHRoZSBjb3JyZWN0IHN0YWNrIGxldmVsXHJcbiAgY29uc3QgZnJvbVN0YWNrID0gKG5hbWUpID0+IHtcclxuICAgIHJldHVybiAodmFsLCBsZXZlbCkgPT4gc3RhY2tQcm9jZXNzZWRbbGV2ZWxdW25hbWVdKHZhbClcclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBsaWZ0OiBvcGVyYXRpb24obGlmdCksXHJcbiAgICBvZjogb3BlcmF0aW9uKGZyb21TdGFjaygnb2YnKSksXHJcbiAgICBjaGFpbjogb3BlcmF0aW9uKGZyb21TdGFjaygnY2hhaW4nKSksXHJcbiAgICBsYXN0OiBzdGFja1Byb2Nlc3NlZCBbc3RhY2tQcm9jZXNzZWQubGVuZ3RoIC0gMV0sXHJcbiAgICBpZDogaWRQcm90byxcclxuICAgIF9tZW1iZXJzOiBzdGFja1Byb2Nlc3NlZFxyXG4gIH1cclxufVxyXG5cclxuY29uc3QgcHJvY2Vzc1N0YWNrID0gKGJhc2VTdGFjaykgPT5cclxuICBzdGF0ZU1hcChiYXNlU3RhY2ssIChpdGVtLCBzdGF0ZSkgPT4ge1xyXG4gICAgY29uc3QgcHJldkl0ZW1Qcm9jZXNzZWQgPSBzdGF0ZS5wcmV2SXRlbVByb2Nlc3NlZCB8fCBpZFByb3RvXHJcbiAgICAvLyBBcHBseSB0aGUgcHJvY2Vzc2luZyBmdW5jdGlvbiBvbiBlYWNoIHN0YWNrIG1lbWJlclxyXG4gICAgY29uc3QgaXRlbVByb2Nlc3NlZCA9IHByb2Nlc3NQcm90b05ldyhpdGVtLCBwcmV2SXRlbVByb2Nlc3NlZClcclxuICAgIHJldHVybiBbXHJcbiAgICAgICAgaXRlbVByb2Nlc3NlZCxcclxuICAgICAge1xyXG4gICAgICAgIHByZXZJdGVtUHJvY2Vzc2VkOiBpdGVtUHJvY2Vzc2VkXHJcbiAgICAgIH1cclxuICAgIF1cclxuICB9KVxyXG5cclxuLy8gQSBzdGF0ZWZ1bCB2ZXJzaW9uIG9mIHRoZSBtYXAgZnVuY3Rpb246XHJcbi8vIGYgYWNjZXB0cyBhbiBhcnJheSBpdGVtIGFuZCBhIHN0YXRlKGRlZmF1bHRzIHRvIGFuIG9iamVjdCkgYW5kIHJldHVybnMgdGhlIHByb2Nlc3NlZCB2ZXJzaW9uIG9mIHRoZSBpdGVtIHBsdXMgYSBuZXcgc3RhdGVcclxuY29uc3Qgc3RhdGVNYXAgPSAoYXJyLCBmKSA9PlxyXG4gIGFyci5yZWR1Y2UoKGFycmF5QW5kU3RhdGUsIGl0ZW0pID0+IHtcclxuICAgIGNvbnN0IGl0ZW1BbmRTdGF0ZSA9IChmKGl0ZW0sIGFycmF5QW5kU3RhdGVbMV0pKVxyXG4gICAgcmV0dXJuIFthcnJheUFuZFN0YXRlWzBdLmNvbmNhdChbaXRlbUFuZFN0YXRlWzBdXSksIGl0ZW1BbmRTdGF0ZVsxXSBdXHJcbiAgfSwgW1tdLCB7fV0pWzBdXHJcblxyXG5jb25zdCBjbG9uZSA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaikucmVkdWNlKChuZXdPYmosIGtleSkgPT4ge1xyXG4gIG5ld09ialtrZXldID0gb2JqW2tleV1cclxuICByZXR1cm4gbmV3T2JqXHJcbn0sIHt9KVxyXG5cclxuY29uc3QgcHJvY2Vzc1Byb3RvTmV3ID0gKHByb3RvLCBvdXRlcikgPT4ge1xyXG4gIGNvbnN0IHByb3RvUHJvY2Vzc2VkID0gY2xvbmUocHJvdG8pXHJcbiAgcHJvdG9Qcm9jZXNzZWQubmFtZSA9IHByb3RvLm5hbWUgKyAnLycgKyBvdXRlci5uYW1lXHJcbiAgcHJvdG9Qcm9jZXNzZWQub3V0ZXIgPSBvdXRlclxyXG4gIC8vIFNhdmUgdGhlIG9yaWdpbmFsIHNvIHdlIGNhbiBkbyB0eXBlY2hlY2tzIGFuZCByb3V0ZSBtZXRob2QgY2FsbHNcclxuICBwcm90b1Byb2Nlc3NlZC5vcmlnaW5hbCA9IHByb3RvXHJcbiAgcmV0dXJuIHByb3RvUHJvY2Vzc2VkXHJcbn1cclxuXHJcbi8vIFRoZSBpZGVudGl0eSBtb25hZCwgd2hpY2ggbGllcyBhdCB0aGUgYm90dG9tIG9mIGVhY2ggc3RhY2tcclxuY29uc3QgaWRQcm90byA9IHtcclxuICBuYW1lOiAncm9vdCcsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbFxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgbWFwIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9XHJcbn1cclxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iXX0=
