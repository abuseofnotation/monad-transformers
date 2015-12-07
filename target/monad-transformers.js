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
'use strict';

exports.maybe = {
  name: 'Maybe',
  of: function of(val) {
    return this.outer.of({ maybeVal: val });
  },
  chain: function chain(funk, val) {
    return this.outer.chain(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
    }, val);
  },
  lift: function lift(val) {
    var _this = this;

    return this.outer.chain(function (innerValue) {
      return _this.outer.of({ maybeVal: innerValue });
    }, val);
  },
  value: function value(funk, val) {
    return this.outer.value(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
    }, val);
  },
  get: function get(key, val) {
    return this.of(val[key]);
  },
  chainMaybe: function chainMaybe(funk, val) {
    return this.outer.of(funk(val));
  }
};
exports.list = {
  name: 'List',
  of: function of(val) {
    return this.outer.of([val]);
  },
  chain: function chain(funk, val) {
    var _this2 = this;

    // TODO - reduce this to something more readable
    return this.outer.chain(function (innerVal) {
      return innerVal.length === 0 ? _this2.outer.of([]) : innerVal.map(funk).reduce(function (accumulatedVal, newVal) {
        return _this2.outer.chain(function (accumulated) {
          return _this2.outer.chain(function (_new) {
            return _this2.outer.of(accumulated.concat(_new));
          }, newVal);
        }, accumulatedVal);
      });
    }, val);
  },
  lift: function lift(val) {
    var _this3 = this;

    return this.outer.chain(function (innerValue) {
      return _this3.outer.of([innerValue]);
    }, val);
  },
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
/*
 * #Three implementations of the Identity Monad Transformer
 *
 * Monad transformers are tricky. All of them do the same thing (given a monad A, they produce a
 * monad B(A) which somehow augments A), but they do have to follow any rules while doing it.
 *
 * One huge difference is that some monad transformers only deal with the value inside the given
 * monad A and some add additional structure to the monad itself. An example of the first type
 * is the 'Maybe' monad transformer, which given a value of type  M(A) (monad that encapsulates
 * an A), creates a value of type M(Maybe(A)). An example of the second type is the 'State'
 * monad, which given the same value M(A), will produce something like () =>{ M([A, State]) }.
 * That is, the transformer adds the state value to the 'host' monad 'M', and then it wraps the
 * monad itself in a function.
 *
 * So far this sounds not that important, but what happens when you compose several monads
 * together? We are about to find out in the examples.
 */

/* Consider the identity Monad transformer. A transformer that produces a monad which behaves
 * the same way as the one it is given as an argument. One way to write it is just to wrap the
 * underlying value (which we called A) in an plain object.
 * So M(A) becomes M ({idVal:A}).
 * Here is how this implementation would look in this case:
 */

'use strict';

exports.id = {
  name: 'Id',

  // (a) => M({idVal:a})
  of: function of(val) {
    return this.outer.of({ idVal: val });
  },

  // (a => M({idVal:a}) , M({idVal:a})) => M({idVal:a})
  chain: function chain(funk, val) {
    return this.outer.chain(function (innerId) {
      return funk(innerId.idVal);
    }, val);
  },

  // (M(a)) => M({idVal:a})
  lift: function lift(val) {
    var _this = this;

    return this.outer.chain(function (innerValue) {
      return _this.outer.of({ idVal: innerValue });
    }, val);
  },

  // ((a) => b, M({idVal:a})) => b
  value: function value(funk, val) {
    return this.outer.value(function (innerId) {
      return funk(innerId.idVal);
    }, val);
  }
};

/* Notice that We are always returning an instance of the outer monad, so if you are to apply
 * the transformation several times, you get a simple nested value: M({idVal:{idVal: a}})
 *
 * Now consider an alternative, a little more complex implementation of the ID monad. One
 * which wraps the M monad into another plain object, so the value of M(A) becomes
 * {idContainer: M({idVal:a})}. Notice that the transformer consists of two parts which wrap
 * around the host monad:
 */

exports.idWrapped = {
  name: 'IdWrapped',

  // (a) => {idContainer: M({idVal:a})}
  of: function of(val) {
    return {
      idContainer: this.outer.of({ idVal: val })
    };
  },

  // (a => {idContainer:M({idVal:a})}, {idContainer:M({idVal:a})}) => {idContainer:M({idVal:a})}
  chain: function chain(funk, id) {
    return {
      idContainer: this.outer.chain(function (innerId) {
        var val = funk(innerId.idVal);
        return val.idContainer;
      }, id.idContainer)
    };
  },

  // (M(a)) => {idContainer:M({idVal:a})}
  lift: function lift(val) {
    var _this2 = this;

    return {
      idContainer: this.outer.chain(function (innerValue) {
        return _this2.outer.of({ idVal: innerValue });
      }, val)
    };
  },

  // ((a) => b, M({idVal:a})) => b
  value: function value(funk, val) {
    return this.outer.value(function (innerId) {
      return funk(innerId.idVal);
    }, val.idContainer);
  }
};

/* The key difference is that this monad nests in both directions. If we apply it two times
 * the value becomes: {idContainer:{idContainer:M({idVal:{idVal:a}})}}. Thus, when
 */
exports.idMinimal = {
  name: 'idMinimal',
  of: function of(val) {
    return this.outer.of(val);
  },
  chain: function chain(funk, val) {
    return this.outer.chain(funk, val);
  },
  lift: function lift(val) {
    return val;
  },
  value: function value(funk, val) {
    return this.outer.value(funk, val);
  }
};

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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJDOi9wci9zb25uZS9saWIvY29tcC5qcyIsIkM6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzIiwiQzovcHIvc29ubmUvbGliL2lkLmpzIiwiQzovcHIvc29ubmUvbGliL21haW4uanMiLCJDOi9wci9zb25uZS9saWIvc3RhY2suanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLENBQUMsS0FBSyxHQUFHO0FBQ2QsTUFBSSxFQUFFLE9BQU87QUFDYixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7OztBQUNQLFdBQU8sVUFBQyxTQUFTO2FBQUssTUFBSyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQUEsQ0FBQTtHQUN0RDtBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7OztBQUNsQixXQUFPLFVBQUMsU0FBUzthQUNmLE9BQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFDLE1BQU0sRUFBSztBQUMzQixZQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQUUsUUFBUSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5QyxlQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtPQUM5QixFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUFBLENBQUE7R0FDdkI7QUFDRCxNQUFJLEVBQUMsY0FBQyxHQUFHLEVBQUU7OztBQUNULFdBQU8sVUFBQyxTQUFTO2FBQ2YsT0FBSyxLQUFLLENB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydHMuc3RhdGUgPSB7XHJcbiAgbmFtZTogJ1N0YXRlJyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihbdmFsLCBwcmV2U3RhdGVdKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHN0YXRlKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdGhpcy5vdXRlci5jaGFpbigocGFyYW1zKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbmV3VmFsID0gcGFyYW1zWzBdLCBuZXdTdGF0ZSA9IHBhcmFtc1sxXVxyXG4gICAgICAgIHJldHVybiBmdW5rKG5ld1ZhbCkobmV3U3RhdGUpXHJcbiAgICAgIH0sIHN0YXRlKHByZXZTdGF0ZSkpXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB0aGlzLm91dGVyLmNoYWluKChpbm5lclZhbHVlKSA9PiB0aGlzLm91dGVyLm9mKFtpbm5lclZhbHVlLCBwcmV2U3RhdGVdKSwgdmFsKVxyXG4gIH0sXHJcbiAgbG9hZCAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihbcHJldlN0YXRlLCBwcmV2U3RhdGVdKVxyXG4gIH0sXHJcbiAgc2F2ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihbdmFsLCB2YWxdKVxyXG4gIH0sXHJcbiAgbWFwU3RhdGUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IHRoaXMub3V0ZXIub2YoZnVuayh2YWwsIHByZXZTdGF0ZSkpXHJcbiAgfSxcclxuICB2YWx1ZSAoZnVuaywgc3RhdGUpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChwYXJhbXMpID0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsocGFyYW1zWzBdKVxyXG4gICAgfSwgc3RhdGUoKSlcclxuICB9XHJcbn1cclxuIiwiZXhwb3J0cy5tYXliZSA9IHtcclxuICBuYW1lOiAnTWF5YmUnLFxyXG4gIG9mICh2YWwpIHsgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe21heWJlVmFsOiB2YWwgfSkgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigoaW5uZXJNYXliZSkgPT4ge1xyXG4gICAgICByZXR1cm4gaW5uZXJNYXliZS5tYXliZVZhbCA9PT0gdW5kZWZpbmVkID8gaW5uZXJNYXliZSA6IGZ1bmsoaW5uZXJNYXliZS5tYXliZVZhbClcclxuICAgIH0sIHZhbClcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2Yoe21heWJlVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChpbm5lck1heWJlKSA9PiB7XHJcbiAgICAgIHJldHVybiBpbm5lck1heWJlLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBpbm5lck1heWJlIDogZnVuayhpbm5lck1heWJlLm1heWJlVmFsKVxyXG4gICAgfSwgdmFsKVxyXG4gIH0sXHJcbiAgZ2V0IChrZXksIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub2YodmFsW2tleV0pXHJcbiAgfSxcclxuICBjaGFpbk1heWJlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKGZ1bmsodmFsKSlcclxuICB9XHJcbn1cclxuZXhwb3J0cy5saXN0ID0ge1xyXG4gIG5hbWU6ICdMaXN0JyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbdmFsXSlcclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIC8vIFRPRE8gLSByZWR1Y2UgdGhpcyB0byBzb21ldGhpbmcgbW9yZSByZWFkYWJsZVxyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWwgPT4ge1xyXG4gICAgICByZXR1cm4gaW5uZXJWYWwubGVuZ3RoID09PSAwID8gdGhpcy5vdXRlci5vZihbXSkgOiBpbm5lclZhbFxyXG4gICAgICAgIC5tYXAoZnVuaylcclxuICAgICAgICAucmVkdWNlKChhY2N1bXVsYXRlZFZhbCwgbmV3VmFsKSA9PiB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbihhY2N1bXVsYXRlZCA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKF9uZXcgPT4gXHJcbiAgICAgICAgICAgICAgdGhpcy5vdXRlci5vZihhY2N1bXVsYXRlZC5jb25jYXQoX25ldykpLCBuZXdWYWwpXHJcbiAgICAgICAgfSwgYWNjdW11bGF0ZWRWYWwpXHJcbiAgICAgIH0pXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGlubmVyVmFsdWUgPT4gdGhpcy5vdXRlci5vZihbaW5uZXJWYWx1ZV0pLCB2YWwpXHJcbiAgfSxcclxuICB2YWx1ZSAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZSgobGlzdCkgPT4ge1xyXG4gICAgICByZXR1cm4gbGlzdC5tYXAoZnVuaylcclxuICAgIH0sIHZhbClcclxuICB9LFxyXG4gIGZpbHRlciAoZnVuaywgdmFsKSB7XHJcbiAgICBpZiAoZnVuayh2YWwpKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm9mKHZhbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFtdKVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgZnJvbUFycmF5ICh2YWwpIHtcclxuICAgIGlmICh2YWwuY29uY2F0ICYmIHZhbC5tYXAgJiYgdmFsLnJlZHVjZSAmJiB2YWwuc2xpY2UpIHtcclxuICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2YodmFsKVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhyb3cgdmFsICsgJyBpcyBub3QgYSBsaXN0LidcclxuICAgIH1cclxuICB9XHJcbn1cclxuY29uc3QgY29tcHV0ZUxvZyA9IChsb2csIG5ld0xvZykgPT4ge1xyXG4gIGlmKGxvZyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gbmV3TG9nXHJcbiAgfSBlbHNlIHtcclxuICAgIGlmIChuZXdMb2cgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXR1cm4gbG9nXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gbG9nLmNvbmNhdChuZXdMb2cpXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnRzLndyaXRlciA9IHtcclxuICBuYW1lOiAnV3JpdGVyJyxcclxuXHJcbiAgLy8gKHZhbCkgPT4gTShbdmFsLCBsb2ddKVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWwsIHVuZGVmaW5lZF0pXHJcbiAgfSxcclxuXHJcbiAgLy8gKHZhbCA9PiBNKFt2YWwsIGxvZ10pLCBNKFt2YWwsIGxvZ10pKSA9PiBNKFt2YWwsIGxvZ10pXHJcbiAgY2hhaW4gKGZ1bmssIG1Xcml0ZXJWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh3cml0ZXJWYWwpID0+IHtcclxuICAgICAgY29uc3QgdmFsID0gd3JpdGVyVmFsWzBdXHJcbiAgICAgIGNvbnN0IGxvZyA9IHdyaXRlclZhbFsxXSBcclxuICAgICAgY29uc3QgbmV3TVdyaXRlclZhbCA9IGZ1bmsodmFsKVxyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigobmV3V3JpdGVyVmFsKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbmV3VmFsID0gbmV3V3JpdGVyVmFsWzBdXHJcbiAgICAgICAgY29uc3QgbmV3TG9nID0gdHlwZW9mIG5ld1dyaXRlclZhbFsxXSA9PT0gJ2Z1bmN0aW9uJyA/IG5ld1dyaXRlclZhbFsxXShsb2cpIDogbmV3V3JpdGVyVmFsWzFdXHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW25ld1ZhbCwgY29tcHV0ZUxvZyhsb2csIG5ld0xvZyldKVxyXG4gICAgICB9LCBuZXdNV3JpdGVyVmFsKVxyXG4gICAgfSwgbVdyaXRlclZhbClcclxuICB9LFxyXG5cclxuICAvLyAoTSh2YWwpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBsaWZ0IChtVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigodmFsKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHVuZGVmaW5lZF0pLCBtVmFsKVxyXG4gIH0sXHJcblxyXG4gIC8vICgodmFsKSA9PiBiLCBNKFt2YWwsIGxvZ10pKSA9PiBiXHJcbiAgdmFsdWUgKGZ1bmssIG1Xcml0ZXJWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKCh3cml0ZXJWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsod3JpdGVyVmFsWzBdKVxyXG4gICAgfSwgbVdyaXRlclZhbClcclxuICB9LFxyXG5cclxuICB0ZWxsIChtZXNzYWdlLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWwsIG1lc3NhZ2VdKVxyXG4gIH0sXHJcbiAgbGlzdGVuIChmdW5rLCB2YWwpe1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbCwgZnVua10pXHJcbiAgfVxyXG59XHJcbiIsIi8qXHJcbiAqICNUaHJlZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhlIElkZW50aXR5IE1vbmFkIFRyYW5zZm9ybWVyXHJcbiAqXHJcbiAqIE1vbmFkIHRyYW5zZm9ybWVycyBhcmUgdHJpY2t5LiBBbGwgb2YgdGhlbSBkbyB0aGUgc2FtZSB0aGluZyAoZ2l2ZW4gYSBtb25hZCBBLCB0aGV5IHByb2R1Y2UgYVxyXG4gKiBtb25hZCBCKEEpIHdoaWNoIHNvbWVob3cgYXVnbWVudHMgQSksIGJ1dCB0aGV5IGRvIGhhdmUgdG8gZm9sbG93IGFueSBydWxlcyB3aGlsZSBkb2luZyBpdC5cclxuICpcclxuICogT25lIGh1Z2UgZGlmZmVyZW5jZSBpcyB0aGF0IHNvbWUgbW9uYWQgdHJhbnNmb3JtZXJzIG9ubHkgZGVhbCB3aXRoIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGdpdmVuXHJcbiAqIG1vbmFkIEEgYW5kIHNvbWUgYWRkIGFkZGl0aW9uYWwgc3RydWN0dXJlIHRvIHRoZSBtb25hZCBpdHNlbGYuIEFuIGV4YW1wbGUgb2YgdGhlIGZpcnN0IHR5cGVcclxuICogaXMgdGhlICdNYXliZScgbW9uYWQgdHJhbnNmb3JtZXIsIHdoaWNoIGdpdmVuIGEgdmFsdWUgb2YgdHlwZSAgTShBKSAobW9uYWQgdGhhdCBlbmNhcHN1bGF0ZXNcclxuICogYW4gQSksIGNyZWF0ZXMgYSB2YWx1ZSBvZiB0eXBlIE0oTWF5YmUoQSkpLiBBbiBleGFtcGxlIG9mIHRoZSBzZWNvbmQgdHlwZSBpcyB0aGUgJ1N0YXRlJ1xyXG4gKiBtb25hZCwgd2hpY2ggZ2l2ZW4gdGhlIHNhbWUgdmFsdWUgTShBKSwgd2lsbCBwcm9kdWNlIHNvbWV0aGluZyBsaWtlICgpID0+eyBNKFtBLCBTdGF0ZV0pIH0uXHJcbiAqIFRoYXQgaXMsIHRoZSB0cmFuc2Zvcm1lciBhZGRzIHRoZSBzdGF0ZSB2YWx1ZSB0byB0aGUgJ2hvc3QnIG1vbmFkICdNJywgYW5kIHRoZW4gaXQgd3JhcHMgdGhlXHJcbiAqIG1vbmFkIGl0c2VsZiBpbiBhIGZ1bmN0aW9uLlxyXG4gKlxyXG4gKiBTbyBmYXIgdGhpcyBzb3VuZHMgbm90IHRoYXQgaW1wb3J0YW50LCBidXQgd2hhdCBoYXBwZW5zIHdoZW4geW91IGNvbXBvc2Ugc2V2ZXJhbCBtb25hZHNcclxuICogdG9nZXRoZXI/IFdlIGFyZSBhYm91dCB0byBmaW5kIG91dCBpbiB0aGUgZXhhbXBsZXMuXHJcbiAqL1xyXG5cclxuLyogQ29uc2lkZXIgdGhlIGlkZW50aXR5IE1vbmFkIHRyYW5zZm9ybWVyLiBBIHRyYW5zZm9ybWVyIHRoYXQgcHJvZHVjZXMgYSBtb25hZCB3aGljaCBiZWhhdmVzXHJcbiAqIHRoZSBzYW1lIHdheSBhcyB0aGUgb25lIGl0IGlzIGdpdmVuIGFzIGFuIGFyZ3VtZW50LiBPbmUgd2F5IHRvIHdyaXRlIGl0IGlzIGp1c3QgdG8gd3JhcCB0aGVcclxuICogdW5kZXJseWluZyB2YWx1ZSAod2hpY2ggd2UgY2FsbGVkIEEpIGluIGFuIHBsYWluIG9iamVjdC5cclxuICogU28gTShBKSBiZWNvbWVzIE0gKHtpZFZhbDpBfSkuXHJcbiAqIEhlcmUgaXMgaG93IHRoaXMgaW1wbGVtZW50YXRpb24gd291bGQgbG9vayBpbiB0aGlzIGNhc2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZCA9IHtcclxuICBuYW1lOiAnSWQnLFxyXG5cclxuICAvLyAoYSkgPT4gTSh7aWRWYWw6YX0pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWwgfSlcclxuICB9LFxyXG5cclxuICAvLyAoYSA9PiBNKHtpZFZhbDphfSkgLCBNKHtpZFZhbDphfSkpID0+IE0oe2lkVmFsOmF9KVxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChpbm5lcklkKSA9PiB7XHJcbiAgICAgIHJldHVybiBmdW5rKGlubmVySWQuaWRWYWwpXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuXHJcbiAgLy8gKE0oYSkpID0+IE0oe2lkVmFsOmF9KVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICB9LFxyXG5cclxuICAvLyAoKGEpID0+IGIsIE0oe2lkVmFsOmF9KSkgPT4gYlxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChpbm5lcklkKT0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0sIHZhbClcclxuICB9XHJcbn1cclxuXHJcbi8qIE5vdGljZSB0aGF0IFdlIGFyZSBhbHdheXMgcmV0dXJuaW5nIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZCwgc28gaWYgeW91IGFyZSB0byBhcHBseVxyXG4gKiB0aGUgdHJhbnNmb3JtYXRpb24gc2V2ZXJhbCB0aW1lcywgeW91IGdldCBhIHNpbXBsZSBuZXN0ZWQgdmFsdWU6IE0oe2lkVmFsOntpZFZhbDogYX19KVxyXG4gKlxyXG4gKiBOb3cgY29uc2lkZXIgYW4gYWx0ZXJuYXRpdmUsIGEgbGl0dGxlIG1vcmUgY29tcGxleCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSUQgbW9uYWQuIE9uZVxyXG4gKiB3aGljaCB3cmFwcyB0aGUgTSBtb25hZCBpbnRvIGFub3RoZXIgcGxhaW4gb2JqZWN0LCBzbyB0aGUgdmFsdWUgb2YgTShBKSBiZWNvbWVzXHJcbiAqIHtpZENvbnRhaW5lcjogTSh7aWRWYWw6YX0pfS4gTm90aWNlIHRoYXQgdGhlIHRyYW5zZm9ybWVyIGNvbnNpc3RzIG9mIHR3byBwYXJ0cyB3aGljaCB3cmFwXHJcbiAqIGFyb3VuZCB0aGUgaG9zdCBtb25hZDpcclxuICovXHJcblxyXG5leHBvcnRzLmlkV3JhcHBlZCA9IHtcclxuICBuYW1lOiAnSWRXcmFwcGVkJyxcclxuXHJcbiAgLy8gKGEpID0+IHtpZENvbnRhaW5lcjogTSh7aWRWYWw6YX0pfVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsfSlcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoYSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfSwge2lkQ29udGFpbmVyOk0oe2lkVmFsOmF9KX0pID0+IHtpZENvbnRhaW5lcjpNKHtpZFZhbDphfSl9XHJcbiAgY2hhaW4gKGZ1bmssIGlkKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZENvbnRhaW5lcjogdGhpcy5vdXRlci5jaGFpbigoaW5uZXJJZCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgICAgICByZXR1cm4gdmFsLmlkQ29udGFpbmVyXHJcbiAgICAgIH0sIGlkLmlkQ29udGFpbmVyKVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8vIChNKGEpKSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaWRDb250YWluZXI6IHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoKGEpID0+IGIsIE0oe2lkVmFsOmF9KSkgPT4gYlxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChpbm5lcklkKT0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0sIHZhbC5pZENvbnRhaW5lcilcclxuICB9XHJcbn1cclxuXHJcbi8qIFRoZSBrZXkgZGlmZmVyZW5jZSBpcyB0aGF0IHRoaXMgbW9uYWQgbmVzdHMgaW4gYm90aCBkaXJlY3Rpb25zLiBJZiB3ZSBhcHBseSBpdCB0d28gdGltZXNcclxuICogdGhlIHZhbHVlIGJlY29tZXM6IHtpZENvbnRhaW5lcjp7aWRDb250YWluZXI6TSh7aWRWYWw6e2lkVmFsOmF9fSl9fS4gVGh1cywgd2hlblxyXG4gKi9cclxuZXhwb3J0cy5pZE1pbmltYWwgPSB7XHJcbiAgbmFtZTogJ2lkTWluaW1hbCcsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YodmFsKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oZnVuaywgdmFsKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICB2YWx1ZSAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZShmdW5rLCB2YWwpXHJcbiAgfVxyXG59XHJcbiIsImV4cG9ydHMuaWQgPSByZXF1aXJlKCcuL2lkJylcclxuZXhwb3J0cy5kYXRhID0gcmVxdWlyZSgnLi9kYXRhJylcclxuZXhwb3J0cy5jb21wID0gcmVxdWlyZSgnLi9jb21wJylcclxuXHJcbmNvbnN0IGNyZWF0ZVN0YWNrID0gcmVxdWlyZSgnLi9zdGFjaycpXHJcblxyXG4vLyBPYmplY3QuYXNzaWduIHBvbHlmaWxcclxuaWYgKCFPYmplY3QuYXNzaWduKSB7XHJcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KE9iamVjdCwgJ2Fzc2lnbicsIHtcclxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxyXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxyXG4gICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICB2YWx1ZTogZnVuY3Rpb24gKHRhcmdldCkge1xyXG4gICAgICAndXNlIHN0cmljdCdcclxuICAgICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldCA9PT0gbnVsbCkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IGZpcnN0IGFyZ3VtZW50IHRvIG9iamVjdCcpXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHZhciB0byA9IE9iamVjdCh0YXJnZXQpXHJcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaV1cclxuICAgICAgICBpZiAobmV4dFNvdXJjZSA9PT0gdW5kZWZpbmVkIHx8IG5leHRTb3VyY2UgPT09IG51bGwpIHtcclxuICAgICAgICAgIGNvbnRpbnVlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5leHRTb3VyY2UgPSBPYmplY3QobmV4dFNvdXJjZSlcclxuXHJcbiAgICAgICAgdmFyIGtleXNBcnJheSA9IE9iamVjdC5rZXlzKG5leHRTb3VyY2UpXHJcbiAgICAgICAgZm9yICh2YXIgbmV4dEluZGV4ID0gMCwgbGVuID0ga2V5c0FycmF5Lmxlbmd0aDsgbmV4dEluZGV4IDwgbGVuOyBuZXh0SW5kZXgrKykge1xyXG4gICAgICAgICAgdmFyIG5leHRLZXkgPSBrZXlzQXJyYXlbbmV4dEluZGV4XVxyXG4gICAgICAgICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5leHRTb3VyY2UsIG5leHRLZXkpXHJcbiAgICAgICAgICBpZiAoZGVzYyAhPT0gdW5kZWZpbmVkICYmIGRlc2MuZW51bWVyYWJsZSkge1xyXG4gICAgICAgICAgICB0b1tuZXh0S2V5XSA9IG5leHRTb3VyY2VbbmV4dEtleV1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRvXHJcbiAgICB9XHJcbiAgfSlcclxufVxyXG5cclxuLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gcHJvcGVydHkgaXMgcGFydCBvZiB0aGUgZ2VuZXJhbCBtb25hZCBkZWZpbml0aW9uIGludGVyZmFjZVxyXG5jb25zdCBpc1Jlc2VydmVyTW9uYWRLZXkgPSAoa2V5KSA9PiBrZXkgIT09ICduYW1lJyAmJiBrZXkgIT09ICdtYXAnICYmIGtleSAhPT0gJ29mJyAmJiBrZXkgIT09ICdjaGFpbicgJiYga2V5ICE9PSAnbGlmdCcgJiYga2V5ICE9PSAndmFsdWUnXHJcblxyXG4vLyBNYXBzIHRoZSB2YWx1ZXMgb2YgYSBnaXZlbiBvYmogZXhjbHVkaW5nIHRoZSByZXNlcnZlZCBvbmVzLlxyXG5jb25zdCBtb25hZE1hcFZhbHMgPSAoZnVuaywgb2JqKSA9PiB7XHJcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iailcclxuICAgIC5maWx0ZXIoaXNSZXNlcnZlck1vbmFkS2V5KVxyXG4gICAgLnJlZHVjZSgobmV3T2JqLCBrZXkpID0+IHtcclxuICAgICAgbmV3T2JqW2tleV0gPSBmdW5rKG9ialtrZXldLCBvYmopXHJcbiAgICAgIHJldHVybiBuZXdPYmpcclxuICAgIH0sIHt9KVxyXG59XHJcblxyXG4vLyBVbndyYXBzIGEgd3JhcHBlZCB2YWx1ZVxyXG5jb25zdCB1bndyYXAgPSAodmFsKSA9PiB7XHJcbiAgaWYgKCF2YWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7dGhyb3cgSlNPTi5zdHJpbmdpZnkodmFsKSArICcgaXMgbm90IGEgd3JhcHBlZCB2YWx1ZSd9XHJcbiAgcmV0dXJuIHZhbC5fdmFsdWVcclxufVxyXG5cclxuLy8gV3JhcHMgYSB2YWx1ZSBpbiBhIHNwZWNpZmllZCBwcm90b3R5cGVcclxuY29uc3Qgd3JhcFZhbCA9IChwcm90bywgdmFsKSA9PiB7XHJcbiAgdmFyIG9iaiA9IE9iamVjdC5jcmVhdGUocHJvdG8pXHJcbiAgb2JqLl92YWx1ZSA9IHZhbFxyXG4gIHJldHVybiBPYmplY3QuZnJlZXplKG9iailcclxufVxyXG5cclxuZXhwb3J0cy5tYWtlID0gZnVuY3Rpb24gbWFrZV9tb25hZCAoKSB7XHJcbiAgLy8gSW5pdGlsaXplIHRoZSBzdGFjayBjb21wb25lbnQsIHRoYXQgYWN0dWFsbHkgZG9lcyBtb3N0IG9mIHRoZSB3b3JrXHJcbiAgY29uc3Qgc3RhY2sgPSBjcmVhdGVTdGFjayhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3QgYmFzZVN0YWNrUHJvdG8gPSB7XHJcbiAgICBzdGFjazogc3RhY2ssXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICBpZiAoIXByb2Nlc3MuZGVidWcpIHtcclxuICAgICAgICBmdW5rQW5kVW53cmFwLnRvU3RyaW5nID0gKCkgPT4gJ3Vud3JhcCgnICsgZnVuay50b1N0cmluZygpICsgJyknXHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0LmNoYWluKGZ1bmtBbmRVbndyYXAsIHRoaXMuX3ZhbHVlKSlcclxuICAgIH0sXHJcbiAgICBsaWZ0IChwcm90bywgdmFsKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChwcm90bywgdmFsKSlcclxuICAgIH0sXHJcbiAgICAvLyBBZGQgJ21hcCcgYW5kICdvZicgZnVuY3Rpb25zXHJcbiAgICBvZiAodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0Lm9mKHZhbHVlKSlcclxuICAgIH0sXHJcbiAgICBtYXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxyXG4gICAgfSxcclxuICAgIHZhbHVlIChjYWxsYmFjaykge1xyXG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrICE9PSB1bmRlZmluZWQgPyBjYWxsYmFjayA6IGEgPT4gYVxyXG4gICAgICByZXR1cm4gc3RhY2subGFzdC52YWx1ZShjYWxsYmFjaywgdGhpcy5fdmFsdWUpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBQcm9tb3RlcyBhIG1ldGhvZCBmcm9tIGEgbW9uYWQgZGVmaW5pdGlvbiBzbyBpdCBjYW4gYmUgdXNlZCBhcyBhIHN0YXRpYyBtZXRob2RcclxuICBjb25zdCB0b0luc3RhbmNlID0gKGZ1bmssIG91dGVyKSA9PiBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQob3V0ZXIub3JpZ2luYWwsIGZ1bmsuYXBwbHkob3V0ZXIsIGFyZ3MuY29uY2F0KFt2YWxdKSkpKVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIC8vIEF1Z21lbnQgdGhlIHN0YWNrIHByb3RvdHlwZSB3aXRoIGhlbHBlciBtZXRob2RzXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IE9iamVjdC5hc3NpZ24uYXBwbHkobnVsbCwgW2Jhc2VTdGFja1Byb3RvXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0luc3RhbmNlLCBtb25hZCkpKSlcclxuXHJcbiAgLy8gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGNyZWF0ZXMgYSBuZXcgb2JqZWN0IGFuZCB3cmFwcyBpdCBpbiB0aGUgc3RhY2sgcHJvdG90eXBlXHJcbiAgY29uc3QgY3JlYXRlID0gKHZhbCkgPT4ge1xyXG4gICAgcmV0dXJuIHdyYXBWYWwoc3RhY2tQcm90bywgdmFsKVxyXG4gIH1cclxuXHJcbiAgLy8gQWRkIHJlbGV2YW50IG1ldGhvZHMgZnJvbSB0aGUgbW9uYWRpYyBpbnRlcmZhY2UgdG8gdGhlIHN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZS5saWZ0ID0gc3RhY2tQcm90by5saWZ0XHJcblxyXG4gIC8vIFByb21vdGVzIGEgbWV0aG9kIGZyb20gYSBtb25hZCBkZWZpbml0aW9uIHNvIGl0IGNhbiBiZSB1c2VkIGFzIGEgc3RhdGljIG1ldGhvZFxyXG4gIGNvbnN0IHRvQ29uc3RydWN0b3IgPSAoZnVuaywgb3V0ZXIpID0+IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChvdXRlci5vcmlnaW5hbCwgZnVuay5hcHBseShvdXRlciwgYXJndW1lbnRzKSkpXHJcbiAgfVxyXG4gIC8vIEF1Z21lbnQgdGhlIHN0YWNrIGNvbnN0cnVjdG9yIHdpdGggaGVscGVyIG1ldGhvZHNcclxuICByZXR1cm4gT2JqZWN0LmFzc2lnbi5hcHBseShudWxsLCBbY3JlYXRlXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0NvbnN0cnVjdG9yLCBtb25hZCkpKSlcclxufVxyXG5nbG9iYWwubXRsID0gbW9kdWxlLmV4cG9ydHNcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjcmVhdGVTdGFjayAobW9uYWRTdGFjaykge1xyXG4gIC8vIEdlbmVyYXRlIGVycm9yc1xyXG4gIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0YWNrIG1lbWJlcicpXHJcblxyXG4gIC8vIEFkZCB0aGUgSUQgbW9uYWQgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbW9uYWQgc3RhY2tcclxuICBjb25zdCBzdGFjayA9IFtpZFByb3RvXS5jb25jYXQobW9uYWRTdGFjaylcclxuXHJcbiAgc3RhY2suZm9yRWFjaChtZW1iZXIgPT4ge1xyXG4gICAgaWYgKHR5cGVvZiBtZW1iZXIgIT09ICdvYmplY3QnKSB7dGhyb3cgbmV3IEVycm9yKCdTdGFjayBtZW1iZXJzIG11c3QgYmUgb2JqZWN0cycpfVxyXG4gIH0pXHJcblxyXG4gIC8vIFBlcmZvcm0gc29tZSBwcmVwcm9jZXNzaW5nIG9uIHRoZSBzdGFja1xyXG4gIGNvbnN0IHN0YWNrUHJvY2Vzc2VkID0gcHJvY2Vzc1N0YWNrKHN0YWNrKVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIGxpZnQgb3BlcmF0aW9uIHdoaWNoIHRha2VzIGEgdmFsdWUgb2YgYSBnaXZlbiBsZXZlbCBvZiB0aGUgc3RhY2sgYW5kIGxpZnRzIGl0IHRvIHRoZSBsYXN0IGxldmVsXHJcbiAgY29uc3QgbGlmdCA9ICh2YWwsIGxldmVsKSA9PiB7XHJcbiAgICAvLyBHZXQgdGhlIHN0YWNrIHByb3RvdHlwZXMgZm9yIHRoZSBwcmV2aW91cyBhbmQgdGhlIG5leHQgbGV2ZWxcclxuICAgIGNvbnN0IG5leHRMZXZlbCA9IGxldmVsICsgMVxyXG4gICAgY29uc3QgbmV4dE1lbWJlciA9IHN0YWNrUHJvY2Vzc2VkW2xldmVsICsgMV1cclxuICAgIC8vIERvIG5vdCBkbyBhbnl0aGluZyBpZiB0aGUgdmFsdWUgaXMgYWxyZWFkeSBhdCB0aGUgbGFzdCBsZXZlbC5cclxuICAgIGlmIChuZXh0TWVtYmVyICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgLy8gUGVyZm9ybSB0aGUgbGlmdCBvcGVyYXRpb24gYXQgdGhlIG5lY2Vzc2FyeSBsZXZlbFxyXG4gICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiByZWN1cnNpdmVseSB0byBnZXQgdG8gdGhlIG5leHQgb25lXHJcbiAgICAgIHJldHVybiBsaWZ0KG5leHRNZW1iZXIubGlmdCh2YWwpLCBuZXh0TGV2ZWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdmFsXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBUYWtlcyBmdW5rIGFuZCBmcm9tIGl0IGNyZWF0ZXMgYSBzdGFjayBvcGVyYXRpb25cclxuICBjb25zdCBvcGVyYXRpb24gPSAoZnVuaykgPT4ge1xyXG4gICAgcmV0dXJuIChwcm90bywgdmFsKSA9PiB7XHJcbiAgICAgIC8vIERldGVybWluZSB0aGUgbGV2ZWwgb2YgdGhlIHZhbHVlLCBnaXZlbiB0aGUgcHJvdG9cclxuICAgICAgY29uc3QgbGV2ZWwgPSBzdGFjay5pbmRleE9mKHByb3RvKVxyXG4gICAgICAvLyBUaHJvdyBhbiBlcnJvciBpZiB0aGUgdmFsdWUgaXMgaW52YWxpZFxyXG4gICAgICBpZiAobGV2ZWwgPT09IC0xKSB7dGhyb3cgZXJyb3J9XHJcbiAgICAgIHJldHVybiBmdW5rKHZhbCwgbGV2ZWwpXHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIERpc3BhdGNoZXMgYW4gb3BlcmF0aW9uIHRvIHRoZSBjb3JyZWN0IHN0YWNrIGxldmVsXHJcbiAgY29uc3QgZnJvbVN0YWNrID0gKG5hbWUpID0+IHtcclxuICAgIHJldHVybiAodmFsLCBsZXZlbCkgPT4gc3RhY2tQcm9jZXNzZWRbbGV2ZWxdW25hbWVdKHZhbClcclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBsaWZ0OiBvcGVyYXRpb24obGlmdCksXHJcbiAgICBvZjogb3BlcmF0aW9uKGZyb21TdGFjaygnb2YnKSksXHJcbiAgICBjaGFpbjogb3BlcmF0aW9uKGZyb21TdGFjaygnY2hhaW4nKSksXHJcbiAgICBsYXN0OiBzdGFja1Byb2Nlc3NlZCBbc3RhY2tQcm9jZXNzZWQubGVuZ3RoIC0gMV0sXHJcbiAgICBpZDogaWRQcm90byxcclxuICAgIF9tZW1iZXJzOiBzdGFja1Byb2Nlc3NlZFxyXG4gIH1cclxufVxyXG5cclxuY29uc3QgcHJvY2Vzc1N0YWNrID0gKGJhc2VTdGFjaykgPT5cclxuICBzdGF0ZU1hcChiYXNlU3RhY2ssIChpdGVtLCBzdGF0ZSkgPT4ge1xyXG4gICAgY29uc3QgcHJldkl0ZW1Qcm9jZXNzZWQgPSBzdGF0ZS5wcmV2SXRlbVByb2Nlc3NlZCB8fCBpZFByb3RvXHJcbiAgICAvLyBBcHBseSB0aGUgcHJvY2Vzc2luZyBmdW5jdGlvbiBvbiBlYWNoIHN0YWNrIG1lbWJlclxyXG4gICAgY29uc3QgaXRlbVByb2Nlc3NlZCA9IHByb2Nlc3NQcm90b05ldyhpdGVtLCBwcmV2SXRlbVByb2Nlc3NlZClcclxuICAgIHJldHVybiBbXHJcbiAgICAgICAgaXRlbVByb2Nlc3NlZCxcclxuICAgICAge1xyXG4gICAgICAgIHByZXZJdGVtUHJvY2Vzc2VkOiBpdGVtUHJvY2Vzc2VkXHJcbiAgICAgIH1cclxuICAgIF1cclxuICB9KVxyXG5cclxuLy8gQSBzdGF0ZWZ1bCB2ZXJzaW9uIG9mIHRoZSBtYXAgZnVuY3Rpb246XHJcbi8vIGYgYWNjZXB0cyBhbiBhcnJheSBpdGVtIGFuZCBhIHN0YXRlKGRlZmF1bHRzIHRvIGFuIG9iamVjdCkgYW5kIHJldHVybnMgdGhlIHByb2Nlc3NlZCB2ZXJzaW9uIG9mIHRoZSBpdGVtIHBsdXMgYSBuZXcgc3RhdGVcclxuY29uc3Qgc3RhdGVNYXAgPSAoYXJyLCBmKSA9PlxyXG4gIGFyci5yZWR1Y2UoKGFycmF5QW5kU3RhdGUsIGl0ZW0pID0+IHtcclxuICAgIGNvbnN0IGl0ZW1BbmRTdGF0ZSA9IChmKGl0ZW0sIGFycmF5QW5kU3RhdGVbMV0pKVxyXG4gICAgcmV0dXJuIFthcnJheUFuZFN0YXRlWzBdLmNvbmNhdChbaXRlbUFuZFN0YXRlWzBdXSksIGl0ZW1BbmRTdGF0ZVsxXSBdXHJcbiAgfSwgW1tdLCB7fV0pWzBdXHJcblxyXG5jb25zdCBjbG9uZSA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaikucmVkdWNlKChuZXdPYmosIGtleSkgPT4ge1xyXG4gIG5ld09ialtrZXldID0gb2JqW2tleV1cclxuICByZXR1cm4gbmV3T2JqXHJcbn0sIHt9KVxyXG5cclxuY29uc3QgcHJvY2Vzc1Byb3RvTmV3ID0gKHByb3RvLCBvdXRlcikgPT4ge1xyXG4gIGNvbnN0IHByb3RvUHJvY2Vzc2VkID0gY2xvbmUocHJvdG8pXHJcbiAgcHJvdG9Qcm9jZXNzZWQubmFtZSA9IHByb3RvLm5hbWUgKyAnLycgKyBvdXRlci5uYW1lXHJcbiAgcHJvdG9Qcm9jZXNzZWQub3V0ZXIgPSBvdXRlclxyXG4gIC8vIFNhdmUgdGhlIG9yaWdpbmFsIHNvIHdlIGNhbiBkbyB0eXBlY2hlY2tzIGFuZCByb3V0ZSBtZXRob2QgY2FsbHNcclxuICBwcm90b1Byb2Nlc3NlZC5vcmlnaW5hbCA9IHByb3RvXHJcbiAgcmV0dXJuIHByb3RvUHJvY2Vzc2VkXHJcbn1cclxuXHJcbi8vIFRoZSBpZGVudGl0eSBtb25hZCwgd2hpY2ggbGllcyBhdCB0aGUgYm90dG9tIG9mIGVhY2ggc3RhY2tcclxuY29uc3QgaWRQcm90byA9IHtcclxuICBuYW1lOiAncm9vdCcsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbFxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgbWFwIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9XHJcbn1cclxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iXX0=
