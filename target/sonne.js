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

    console.log('list  ', val);
    // TODO - reduce this to something more readable
    return this.outer.chain(function (innerVal) {
      debugger;
      return innerVal.reduce(function (accumulatedVal, newVal) {
        return _this2.outer.chain(function (accumulated) {
          innerVal;
          val;
          debugger;
          return _this2.outer.chain(function (_new) {
            return _this2.outer.of(accumulated.concat(_new));
          }, funk(newVal));
        }, accumulatedVal);
      }, _this2.outer.of([]));
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

    console.log('writer', mWriterVal);
    return this.outer.chain(function (writerVal) {
      var val = writerVal[0];
      var log = writerVal[1];
      var newMWriterVal = funk(val);
      return _this4.outer.chain(function (newWriterVal) {
        var newVal = newWriterVal[0];
        var newLog = typeof newWriterVal[1] === 'function' ? newWriterVal[1](log) : newWriterVal[1];
        //Gotta have them null checks
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
(function (process){
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

}).call(this,require('_process'))

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
      nextLevel = nextMember = undefined;
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJEOi9wci9zb25uZS9saWIvY29tcC5qcyIsIkQ6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzIiwiRDovcHIvc29ubmUvbGliL2lkLmpzIiwiRDovcHIvc29ubmUvbGliL21haW4uanMiLCJEOi9wci9zb25uZS9saWIvc3RhY2suanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLENBQUMsS0FBSyxHQUFHO0FBQ2QsTUFBSSxFQUFFLE9BQU87QUFDYixJQUFFLEVBQUMsWUFBQyxHQUFHLEVBQUU7OztBQUNQLFdBQU8sVUFBQyxTQUFTO2FBQUssTUFBSyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0tBQUEsQ0FBQTtHQUN0RDtBQUNELE9BQUssRUFBQyxlQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7OztBQUNsQixXQUFPLFVBQUMsU0FBUzthQUNmLE9BQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFDLE1BQU0sRUFBSztBQUMzQixZQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQUUsUUFBUSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5QyxlQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtPQUM5QixFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUFBLENBQUE7R0FDdkI7QUFDRCxNQUFJLEVBQUMsY0FBQyxHQUFHLEVBQUU7OztBQUNULFdBQU8sVUFBQyxTQUFTO2FBQ2YsT0FBSyxLQUFLLENB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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgc3RhdGUpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB0aGlzLm91dGVyLmNoYWluKChwYXJhbXMpID0+IHtcclxuICAgICAgICBjb25zdCBuZXdWYWwgPSBwYXJhbXNbMF0sIG5ld1N0YXRlID0gcGFyYW1zWzFdXHJcbiAgICAgICAgcmV0dXJuIGZ1bmsobmV3VmFsKShuZXdTdGF0ZSlcclxuICAgICAgfSwgc3RhdGUocHJldlN0YXRlKSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+XHJcbiAgICAgIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2YoW2lubmVyVmFsdWUsIHByZXZTdGF0ZV0pLCB2YWwpXHJcbiAgfSxcclxuICBsb2FkICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFtwcmV2U3RhdGUsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBzYXZlICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHZhbF0pXHJcbiAgfSxcclxuICBtYXBTdGF0ZSAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihmdW5rKHZhbCwgcHJldlN0YXRlKSlcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCBzdGF0ZSkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKHBhcmFtcykgPT4ge1xyXG4gICAgICByZXR1cm4gZnVuayhwYXJhbXNbMF0pXHJcbiAgICB9LCBzdGF0ZSgpKVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLm1heWJlID0ge1xyXG4gIG5hbWU6ICdNYXliZScsXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4gdGhpcy5vdXRlci5vZih7bWF5YmVWYWw6IHZhbCB9KSB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChpbm5lck1heWJlKSA9PiB7XHJcbiAgICAgIHJldHVybiBpbm5lck1heWJlLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBpbm5lck1heWJlIDogZnVuayhpbm5lck1heWJlLm1heWJlVmFsKVxyXG4gICAgfSwgdmFsKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigoaW5uZXJWYWx1ZSkgPT4gdGhpcy5vdXRlci5vZih7bWF5YmVWYWw6IGlubmVyVmFsdWV9KSwgdmFsKVxyXG4gIH0sXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGlubmVyTWF5YmUpID0+IHtcclxuICAgICAgcmV0dXJuIGlubmVyTWF5YmUubWF5YmVWYWwgPT09IHVuZGVmaW5lZCA/IGlubmVyTWF5YmUgOiBmdW5rKGlubmVyTWF5YmUubWF5YmVWYWwpXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuICBnZXQgKGtleSwgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vZih2YWxba2V5XSlcclxuICB9LFxyXG4gIGNoYWluTWF5YmUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoZnVuayh2YWwpKVxyXG4gIH1cclxufVxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ0xpc3QnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWxdKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgY29uc29sZS5sb2coJ2xpc3QgICcsIHZhbClcclxuICAgIC8vIFRPRE8gLSByZWR1Y2UgdGhpcyB0byBzb21ldGhpbmcgbW9yZSByZWFkYWJsZVxyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWwgPT4ge1xyXG4gICAgICBkZWJ1Z2dlclxyXG4gICAgICByZXR1cm4gaW5uZXJWYWwucmVkdWNlKChhY2N1bXVsYXRlZFZhbCwgbmV3VmFsKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oYWNjdW11bGF0ZWQgPT4ge1xyXG4gICAgICAgICAgaW5uZXJWYWxcclxuICAgICAgICAgIHZhbFxyXG4gICAgICAgICAgZGVidWdnZXJcclxuICAgICAgICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKF9uZXcgPT4gdGhpcy5vdXRlci5vZihhY2N1bXVsYXRlZC5jb25jYXQoX25ldykpLCBmdW5rKG5ld1ZhbCkpXHJcbiAgICAgICAgfSwgYWNjdW11bGF0ZWRWYWwpXHJcbiAgICAgIH0sIHRoaXMub3V0ZXIub2YoW10pKSBcclxuICAgIH0sIHZhbClcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWx1ZSA9PiB0aGlzLm91dGVyLm9mKFtpbm5lclZhbHVlXSksIHZhbClcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChsaXN0KSA9PiB7XHJcbiAgICAgIHJldHVybiBsaXN0Lm1hcChmdW5rKVxyXG4gICAgfSwgdmFsKVxyXG4gIH0sXHJcbiAgZmlsdGVyIChmdW5rLCB2YWwpIHtcclxuICAgIGlmIChmdW5rKHZhbCkpIHtcclxuICAgICAgcmV0dXJuIHRoaXMub2YodmFsKVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW10pXHJcbiAgICB9XHJcbiAgfSxcclxuICBmcm9tQXJyYXkgKHZhbCkge1xyXG4gICAgaWYgKHZhbC5jb25jYXQgJiYgdmFsLm1hcCAmJiB2YWwucmVkdWNlICYmIHZhbC5zbGljZSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5vZih2YWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aHJvdyB2YWwgKyAnIGlzIG5vdCBhIGxpc3QuJ1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5jb25zdCBjb21wdXRlTG9nID0gKGxvZywgbmV3TG9nKSA9PiB7XHJcbiAgaWYobG9nID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBuZXdMb2dcclxuICB9IGVsc2Uge1xyXG4gICAgaWYgKG5ld0xvZyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiBsb2dcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBsb2cuY29uY2F0KG5ld0xvZylcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydHMud3JpdGVyID0ge1xyXG4gIG5hbWU6ICdXcml0ZXInLFxyXG5cclxuICAvLyAodmFsKSA9PiBNKFt2YWwsIGxvZ10pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbCwgdW5kZWZpbmVkXSlcclxuICB9LFxyXG5cclxuICAvLyAodmFsID0+IE0oW3ZhbCwgbG9nXSksIE0oW3ZhbCwgbG9nXSkpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBjaGFpbiAoZnVuaywgbVdyaXRlclZhbCkge1xyXG4gICAgY29uc29sZS5sb2coJ3dyaXRlcicsIG1Xcml0ZXJWYWwpXHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigod3JpdGVyVmFsKSA9PiB7XHJcbiAgICAgIGNvbnN0IHZhbCA9IHdyaXRlclZhbFswXVxyXG4gICAgICBjb25zdCBsb2cgPSB3cml0ZXJWYWxbMV0gXHJcbiAgICAgIGNvbnN0IG5ld01Xcml0ZXJWYWwgPSBmdW5rKHZhbClcclxuICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKG5ld1dyaXRlclZhbCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5ld1ZhbCA9IG5ld1dyaXRlclZhbFswXVxyXG4gICAgICAgIGNvbnN0IG5ld0xvZyA9IHR5cGVvZiBuZXdXcml0ZXJWYWxbMV0gPT09ICdmdW5jdGlvbicgPyBuZXdXcml0ZXJWYWxbMV0obG9nKSA6IG5ld1dyaXRlclZhbFsxXVxyXG4gICAgICAgIC8vR290dGEgaGF2ZSB0aGVtIG51bGwgY2hlY2tzXHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW25ld1ZhbCwgY29tcHV0ZUxvZyhsb2csIG5ld0xvZyldKVxyXG4gICAgICB9LCBuZXdNV3JpdGVyVmFsKVxyXG4gICAgfSwgbVdyaXRlclZhbClcclxuICB9LFxyXG5cclxuICAvLyAoTSh2YWwpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBsaWZ0IChtVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigodmFsKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHVuZGVmaW5lZF0pLCBtVmFsKVxyXG4gIH0sXHJcblxyXG4gIC8vICgodmFsKSA9PiBiLCBNKFt2YWwsIGxvZ10pKSA9PiBiXHJcbiAgdmFsdWUgKGZ1bmssIG1Xcml0ZXJWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKCh3cml0ZXJWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsod3JpdGVyVmFsWzBdKVxyXG4gICAgfSwgbVdyaXRlclZhbClcclxuICB9LFxyXG5cclxuICB0ZWxsIChtZXNzYWdlLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWwsIG1lc3NhZ2VdKVxyXG4gIH0sXHJcbiAgbGlzdGVuIChmdW5rLCB2YWwpe1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbCwgZnVua10pXHJcbiAgfVxyXG59XHJcbiIsIi8qXHJcbiAqICNUaHJlZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhlIElkZW50aXR5IE1vbmFkIFRyYW5zZm9ybWVyXHJcbiAqXHJcbiAqIE1vbmFkIHRyYW5zZm9ybWVycyBhcmUgdHJpY2t5LiBBbGwgb2YgdGhlbSBkbyB0aGUgc2FtZSB0aGluZyAoZ2l2ZW4gYSBtb25hZCBBLCB0aGV5IHByb2R1Y2UgYVxyXG4gKiBtb25hZCBCKEEpIHdoaWNoIHNvbWVob3cgYXVnbWVudHMgQSksIGJ1dCB0aGV5IGRvIGhhdmUgdG8gZm9sbG93IGFueSBydWxlcyB3aGlsZSBkb2luZyBpdC5cclxuICpcclxuICogT25lIGh1Z2UgZGlmZmVyZW5jZSBpcyB0aGF0IHNvbWUgbW9uYWQgdHJhbnNmb3JtZXJzIG9ubHkgZGVhbCB3aXRoIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGdpdmVuXHJcbiAqIG1vbmFkIEEgYW5kIHNvbWUgYWRkIGFkZGl0aW9uYWwgc3RydWN0dXJlIHRvIHRoZSBtb25hZCBpdHNlbGYuIEFuIGV4YW1wbGUgb2YgdGhlIGZpcnN0IHR5cGVcclxuICogaXMgdGhlICdNYXliZScgbW9uYWQgdHJhbnNmb3JtZXIsIHdoaWNoIGdpdmVuIGEgdmFsdWUgb2YgdHlwZSAgTShBKSAobW9uYWQgdGhhdCBlbmNhcHN1bGF0ZXNcclxuICogYW4gQSksIGNyZWF0ZXMgYSB2YWx1ZSBvZiB0eXBlIE0oTWF5YmUoQSkpLiBBbiBleGFtcGxlIG9mIHRoZSBzZWNvbmQgdHlwZSBpcyB0aGUgJ1N0YXRlJ1xyXG4gKiBtb25hZCwgd2hpY2ggZ2l2ZW4gdGhlIHNhbWUgdmFsdWUgTShBKSwgd2lsbCBwcm9kdWNlIHNvbWV0aGluZyBsaWtlICgpID0+eyBNKFtBLCBTdGF0ZV0pIH0uXHJcbiAqIFRoYXQgaXMsIHRoZSB0cmFuc2Zvcm1lciBhZGRzIHRoZSBzdGF0ZSB2YWx1ZSB0byB0aGUgJ2hvc3QnIG1vbmFkICdNJywgYW5kIHRoZW4gaXQgd3JhcHMgdGhlXHJcbiAqIG1vbmFkIGl0c2VsZiBpbiBhIGZ1bmN0aW9uLlxyXG4gKlxyXG4gKiBTbyBmYXIgdGhpcyBzb3VuZHMgbm90IHRoYXQgaW1wb3J0YW50LCBidXQgd2hhdCBoYXBwZW5zIHdoZW4geW91IGNvbXBvc2Ugc2V2ZXJhbCBtb25hZHNcclxuICogdG9nZXRoZXI/IFdlIGFyZSBhYm91dCB0byBmaW5kIG91dCBpbiB0aGUgZXhhbXBsZXMuXHJcbiAqL1xyXG5cclxuLyogQ29uc2lkZXIgdGhlIGlkZW50aXR5IE1vbmFkIHRyYW5zZm9ybWVyLiBBIHRyYW5zZm9ybWVyIHRoYXQgcHJvZHVjZXMgYSBtb25hZCB3aGljaCBiZWhhdmVzXHJcbiAqIHRoZSBzYW1lIHdheSBhcyB0aGUgb25lIGl0IGlzIGdpdmVuIGFzIGFuIGFyZ3VtZW50LiBPbmUgd2F5IHRvIHdyaXRlIGl0IGlzIGp1c3QgdG8gd3JhcCB0aGVcclxuICogdW5kZXJseWluZyB2YWx1ZSAod2hpY2ggd2UgY2FsbGVkIEEpIGluIGFuIHBsYWluIG9iamVjdC5cclxuICogU28gTShBKSBiZWNvbWVzIE0gKHtpZFZhbDpBfSkuXHJcbiAqIEhlcmUgaXMgaG93IHRoaXMgaW1wbGVtZW50YXRpb24gd291bGQgbG9vayBpbiB0aGlzIGNhc2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZCA9IHtcclxuICBuYW1lOiAnSWQnLFxyXG5cclxuICAvLyAoYSkgPT4gTSh7aWRWYWw6YX0pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWwgfSlcclxuICB9LFxyXG5cclxuICAvLyAoYSA9PiBNKHtpZFZhbDphfSkgLCBNKHtpZFZhbDphfSkpID0+IE0oe2lkVmFsOmF9KVxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChpbm5lcklkKSA9PiB7XHJcbiAgICAgIHJldHVybiBmdW5rKGlubmVySWQuaWRWYWwpXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuXHJcbiAgLy8gKE0oYSkpID0+IE0oe2lkVmFsOmF9KVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICB9LFxyXG5cclxuICAvLyAoKGEpID0+IGIsIE0oe2lkVmFsOmF9KSkgPT4gYlxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChpbm5lcklkKT0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0sIHZhbClcclxuICB9XHJcbn1cclxuXHJcbi8qIE5vdGljZSB0aGF0IFdlIGFyZSBhbHdheXMgcmV0dXJuaW5nIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZCwgc28gaWYgeW91IGFyZSB0byBhcHBseVxyXG4gKiB0aGUgdHJhbnNmb3JtYXRpb24gc2V2ZXJhbCB0aW1lcywgeW91IGdldCBhIHNpbXBsZSBuZXN0ZWQgdmFsdWU6IE0oe2lkVmFsOntpZFZhbDogYX19KVxyXG4gKlxyXG4gKiBOb3cgY29uc2lkZXIgYW4gYWx0ZXJuYXRpdmUsIGEgbGl0dGxlIG1vcmUgY29tcGxleCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSUQgbW9uYWQuIE9uZVxyXG4gKiB3aGljaCB3cmFwcyB0aGUgTSBtb25hZCBpbnRvIGFub3RoZXIgcGxhaW4gb2JqZWN0LCBzbyB0aGUgdmFsdWUgb2YgTShBKSBiZWNvbWVzXHJcbiAqIHtpZENvbnRhaW5lcjogTSh7aWRWYWw6YX0pfS4gTm90aWNlIHRoYXQgdGhlIHRyYW5zZm9ybWVyIGNvbnNpc3RzIG9mIHR3byBwYXJ0cyB3aGljaCB3cmFwXHJcbiAqIGFyb3VuZCB0aGUgaG9zdCBtb25hZDpcclxuICovXHJcblxyXG5leHBvcnRzLmlkV3JhcHBlZCA9IHtcclxuICBuYW1lOiAnSWRXcmFwcGVkJyxcclxuXHJcbiAgLy8gKGEpID0+IHtpZENvbnRhaW5lcjogTSh7aWRWYWw6YX0pfVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsfSlcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoYSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfSwge2lkQ29udGFpbmVyOk0oe2lkVmFsOmF9KX0pID0+IHtpZENvbnRhaW5lcjpNKHtpZFZhbDphfSl9XHJcbiAgY2hhaW4gKGZ1bmssIGlkKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZENvbnRhaW5lcjogdGhpcy5vdXRlci5jaGFpbigoaW5uZXJJZCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgICAgICByZXR1cm4gdmFsLmlkQ29udGFpbmVyXHJcbiAgICAgIH0sIGlkLmlkQ29udGFpbmVyKVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8vIChNKGEpKSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaWRDb250YWluZXI6IHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoKGEpID0+IGIsIE0oe2lkVmFsOmF9KSkgPT4gYlxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChpbm5lcklkKT0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0sIHZhbC5pZENvbnRhaW5lcilcclxuICB9XHJcbn1cclxuXHJcbi8qIFRoZSBrZXkgZGlmZmVyZW5jZSBpcyB0aGF0IHRoaXMgbW9uYWQgbmVzdHMgaW4gYm90aCBkaXJlY3Rpb25zLiBJZiB3ZSBhcHBseSBpdCB0d28gdGltZXNcclxuICogdGhlIHZhbHVlIGJlY29tZXM6IHtpZENvbnRhaW5lcjp7aWRDb250YWluZXI6TSh7aWRWYWw6e2lkVmFsOmF9fSl9fS4gVGh1cywgd2hlblxyXG4gKi9cclxuZXhwb3J0cy5pZE1pbmltYWwgPSB7XHJcbiAgbmFtZTogJ2lkTWluaW1hbCcsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YodmFsKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oZnVuaywgdmFsKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICB2YWx1ZSAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZShmdW5rLCB2YWwpXHJcbiAgfVxyXG59XHJcbiIsImV4cG9ydHMuaWQgPSByZXF1aXJlKCcuL2lkJylcclxuZXhwb3J0cy5kYXRhID0gcmVxdWlyZSgnLi9kYXRhJylcclxuZXhwb3J0cy5jb21wID0gcmVxdWlyZSgnLi9jb21wJylcclxuXHJcbmNvbnN0IGNyZWF0ZVN0YWNrID0gcmVxdWlyZSgnLi9zdGFjaycpXHJcblxyXG4vLyBPYmplY3QuYXNzaWduIHBvbHlmaWxcclxuaWYgKCFPYmplY3QuYXNzaWduKSB7XHJcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KE9iamVjdCwgJ2Fzc2lnbicsIHtcclxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxyXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxyXG4gICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICB2YWx1ZTogZnVuY3Rpb24gKHRhcmdldCkge1xyXG4gICAgICAndXNlIHN0cmljdCdcclxuICAgICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldCA9PT0gbnVsbCkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IGZpcnN0IGFyZ3VtZW50IHRvIG9iamVjdCcpXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHZhciB0byA9IE9iamVjdCh0YXJnZXQpXHJcbiAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaV1cclxuICAgICAgICBpZiAobmV4dFNvdXJjZSA9PT0gdW5kZWZpbmVkIHx8IG5leHRTb3VyY2UgPT09IG51bGwpIHtcclxuICAgICAgICAgIGNvbnRpbnVlXHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5leHRTb3VyY2UgPSBPYmplY3QobmV4dFNvdXJjZSlcclxuXHJcbiAgICAgICAgdmFyIGtleXNBcnJheSA9IE9iamVjdC5rZXlzKG5leHRTb3VyY2UpXHJcbiAgICAgICAgZm9yICh2YXIgbmV4dEluZGV4ID0gMCwgbGVuID0ga2V5c0FycmF5Lmxlbmd0aDsgbmV4dEluZGV4IDwgbGVuOyBuZXh0SW5kZXgrKykge1xyXG4gICAgICAgICAgdmFyIG5leHRLZXkgPSBrZXlzQXJyYXlbbmV4dEluZGV4XVxyXG4gICAgICAgICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5leHRTb3VyY2UsIG5leHRLZXkpXHJcbiAgICAgICAgICBpZiAoZGVzYyAhPT0gdW5kZWZpbmVkICYmIGRlc2MuZW51bWVyYWJsZSkge1xyXG4gICAgICAgICAgICB0b1tuZXh0S2V5XSA9IG5leHRTb3VyY2VbbmV4dEtleV1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRvXHJcbiAgICB9XHJcbiAgfSlcclxufVxyXG5cclxuLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gcHJvcGVydHkgaXMgcGFydCBvZiB0aGUgZ2VuZXJhbCBtb25hZCBkZWZpbml0aW9uIGludGVyZmFjZVxyXG5jb25zdCBpc1Jlc2VydmVyTW9uYWRLZXkgPSAoa2V5KSA9PiBrZXkgIT09ICduYW1lJyAmJiBrZXkgIT09ICdtYXAnICYmIGtleSAhPT0gJ29mJyAmJiBrZXkgIT09ICdjaGFpbicgJiYga2V5ICE9PSAnbGlmdCcgJiYga2V5ICE9PSAndmFsdWUnXHJcblxyXG4vLyBNYXBzIHRoZSB2YWx1ZXMgb2YgYSBnaXZlbiBvYmogZXhjbHVkaW5nIHRoZSByZXNlcnZlZCBvbmVzLlxyXG5jb25zdCBtb25hZE1hcFZhbHMgPSAoZnVuaywgb2JqKSA9PiB7XHJcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iailcclxuICAgIC5maWx0ZXIoaXNSZXNlcnZlck1vbmFkS2V5KVxyXG4gICAgLnJlZHVjZSgobmV3T2JqLCBrZXkpID0+IHtcclxuICAgICAgbmV3T2JqW2tleV0gPSBmdW5rKG9ialtrZXldLCBvYmopXHJcbiAgICAgIHJldHVybiBuZXdPYmpcclxuICAgIH0sIHt9KVxyXG59XHJcblxyXG4vLyBVbndyYXBzIGEgd3JhcHBlZCB2YWx1ZVxyXG5jb25zdCB1bndyYXAgPSAodmFsKSA9PiB7XHJcbiAgaWYgKCF2YWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7dGhyb3cgSlNPTi5zdHJpbmdpZnkodmFsKSArICcgaXMgbm90IGEgd3JhcHBlZCB2YWx1ZSd9XHJcbiAgcmV0dXJuIHZhbC5fdmFsdWVcclxufVxyXG5cclxuLy8gV3JhcHMgYSB2YWx1ZSBpbiBhIHNwZWNpZmllZCBwcm90b3R5cGVcclxuY29uc3Qgd3JhcFZhbCA9IChwcm90bywgdmFsKSA9PiB7XHJcbiAgdmFyIG9iaiA9IE9iamVjdC5jcmVhdGUocHJvdG8pXHJcbiAgb2JqLl92YWx1ZSA9IHZhbFxyXG4gIHJldHVybiBPYmplY3QuZnJlZXplKG9iailcclxufVxyXG5cclxuZXhwb3J0cy5tYWtlID0gZnVuY3Rpb24gbWFrZV9tb25hZCAoKSB7XHJcbiAgLy8gSW5pdGlsaXplIHRoZSBzdGFjayBjb21wb25lbnQsIHRoYXQgYWN0dWFsbHkgZG9lcyBtb3N0IG9mIHRoZSB3b3JrXHJcbiAgY29uc3Qgc3RhY2sgPSBjcmVhdGVTdGFjayhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3QgYmFzZVN0YWNrUHJvdG8gPSB7XHJcbiAgICBzdGFjazogc3RhY2ssXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICBpZiAoIXByb2Nlc3MuZGVidWcpIHtcclxuICAgICAgICBmdW5rQW5kVW53cmFwLnRvU3RyaW5nID0gKCkgPT4gJ3Vud3JhcCgnICsgZnVuay50b1N0cmluZygpICsgJyknXHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0LmNoYWluKGZ1bmtBbmRVbndyYXAsIHRoaXMuX3ZhbHVlKSlcclxuICAgIH0sXHJcbiAgICBsaWZ0IChwcm90bywgdmFsKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChwcm90bywgdmFsKSlcclxuICAgIH0sXHJcbiAgICAvLyBBZGQgJ21hcCcgYW5kICdvZicgZnVuY3Rpb25zXHJcbiAgICBvZiAodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0Lm9mKHZhbHVlKSlcclxuICAgIH0sXHJcbiAgICBtYXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxyXG4gICAgfSxcclxuICAgIHZhbHVlIChjYWxsYmFjaykge1xyXG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrICE9PSB1bmRlZmluZWQgPyBjYWxsYmFjayA6IGEgPT4gYVxyXG4gICAgICByZXR1cm4gc3RhY2subGFzdC52YWx1ZShjYWxsYmFjaywgdGhpcy5fdmFsdWUpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBQcm9tb3RlcyBhIG1ldGhvZCBmcm9tIGEgbW9uYWQgZGVmaW5pdGlvbiBzbyBpdCBjYW4gYmUgdXNlZCBhcyBhIHN0YXRpYyBtZXRob2RcclxuICBjb25zdCB0b0luc3RhbmNlID0gKGZ1bmssIG91dGVyKSA9PiBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQob3V0ZXIub3JpZ2luYWwsIGZ1bmsuYXBwbHkob3V0ZXIsIGFyZ3MuY29uY2F0KFt2YWxdKSkpKVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIC8vIEF1Z21lbnQgdGhlIHN0YWNrIHByb3RvdHlwZSB3aXRoIGhlbHBlciBtZXRob2RzXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IE9iamVjdC5hc3NpZ24uYXBwbHkobnVsbCwgW2Jhc2VTdGFja1Byb3RvXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0luc3RhbmNlLCBtb25hZCkpKSlcclxuXHJcbiAgLy8gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGNyZWF0ZXMgYSBuZXcgb2JqZWN0IGFuZCB3cmFwcyBpdCBpbiB0aGUgc3RhY2sgcHJvdG90eXBlXHJcbiAgY29uc3QgY3JlYXRlID0gKHZhbCkgPT4ge1xyXG4gICAgcmV0dXJuIHdyYXBWYWwoc3RhY2tQcm90bywgdmFsKVxyXG4gIH1cclxuXHJcbiAgLy8gQWRkIHJlbGV2YW50IG1ldGhvZHMgZnJvbSB0aGUgbW9uYWRpYyBpbnRlcmZhY2UgdG8gdGhlIHN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZS5saWZ0ID0gc3RhY2tQcm90by5saWZ0XHJcblxyXG4gIC8vIFByb21vdGVzIGEgbWV0aG9kIGZyb20gYSBtb25hZCBkZWZpbml0aW9uIHNvIGl0IGNhbiBiZSB1c2VkIGFzIGEgc3RhdGljIG1ldGhvZFxyXG4gIGNvbnN0IHRvQ29uc3RydWN0b3IgPSAoZnVuaywgb3V0ZXIpID0+IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChvdXRlci5vcmlnaW5hbCwgZnVuay5hcHBseShvdXRlciwgYXJndW1lbnRzKSkpXHJcbiAgfVxyXG4gIC8vIEF1Z21lbnQgdGhlIHN0YWNrIGNvbnN0cnVjdG9yIHdpdGggaGVscGVyIG1ldGhvZHNcclxuICByZXR1cm4gT2JqZWN0LmFzc2lnbi5hcHBseShudWxsLCBbY3JlYXRlXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0NvbnN0cnVjdG9yLCBtb25hZCkpKSlcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZVN0YWNrIChtb25hZFN0YWNrKSB7XHJcbiAgLy8gR2VuZXJhdGUgZXJyb3JzXHJcbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1RoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RhY2sgbWVtYmVyJylcclxuXHJcbiAgLy8gQWRkIHRoZSBJRCBtb25hZCBhdCB0aGUgYm90dG9tIG9mIHRoZSBtb25hZCBzdGFja1xyXG4gIGNvbnN0IHN0YWNrID0gW2lkUHJvdG9dLmNvbmNhdChtb25hZFN0YWNrKVxyXG5cclxuICBzdGFjay5mb3JFYWNoKG1lbWJlciA9PiB7XHJcbiAgICBpZiAodHlwZW9mIG1lbWJlciAhPT0gJ29iamVjdCcpIHt0aHJvdyBuZXcgRXJyb3IoJ1N0YWNrIG1lbWJlcnMgbXVzdCBiZSBvYmplY3RzJyl9XHJcbiAgfSlcclxuXHJcbiAgLy8gUGVyZm9ybSBzb21lIHByZXByb2Nlc3Npbmcgb24gdGhlIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2tQcm9jZXNzZWQgPSBwcm9jZXNzU3RhY2soc3RhY2spXHJcblxyXG4gIC8vIERlZmluZSB0aGUgbGlmdCBvcGVyYXRpb24gd2hpY2ggdGFrZXMgYSB2YWx1ZSBvZiBhIGdpdmVuIGxldmVsIG9mIHRoZSBzdGFjayBhbmQgbGlmdHMgaXQgdG8gdGhlIGxhc3QgbGV2ZWxcclxuICBjb25zdCBsaWZ0ID0gKHZhbCwgbGV2ZWwpID0+IHtcclxuICAgIC8vIEdldCB0aGUgc3RhY2sgcHJvdG90eXBlcyBmb3IgdGhlIHByZXZpb3VzIGFuZCB0aGUgbmV4dCBsZXZlbFxyXG4gICAgY29uc3QgbmV4dExldmVsID0gbGV2ZWwgKyAxXHJcbiAgICBjb25zdCBuZXh0TWVtYmVyID0gc3RhY2tQcm9jZXNzZWRbbGV2ZWwgKyAxXVxyXG4gICAgLy8gRG8gbm90IGRvIGFueXRoaW5nIGlmIHRoZSB2YWx1ZSBpcyBhbHJlYWR5IGF0IHRoZSBsYXN0IGxldmVsLlxyXG4gICAgaWYgKG5leHRNZW1iZXIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAvLyBQZXJmb3JtIHRoZSBsaWZ0IG9wZXJhdGlvbiBhdCB0aGUgbmVjZXNzYXJ5IGxldmVsXHJcbiAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5IHRvIGdldCB0byB0aGUgbmV4dCBvbmVcclxuICAgICAgcmV0dXJuIGxpZnQobmV4dE1lbWJlci5saWZ0KHZhbCksIG5leHRMZXZlbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiB2YWxcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFRha2VzIGZ1bmsgYW5kIGZyb20gaXQgY3JlYXRlcyBhIHN0YWNrIG9wZXJhdGlvblxyXG4gIGNvbnN0IG9wZXJhdGlvbiA9IChmdW5rKSA9PiB7XHJcbiAgICByZXR1cm4gKHByb3RvLCB2YWwpID0+IHtcclxuICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBsZXZlbCBvZiB0aGUgdmFsdWUsIGdpdmVuIHRoZSBwcm90b1xyXG4gICAgICBjb25zdCBsZXZlbCA9IHN0YWNrLmluZGV4T2YocHJvdG8pXHJcbiAgICAgIC8vIFRocm93IGFuIGVycm9yIGlmIHRoZSB2YWx1ZSBpcyBpbnZhbGlkXHJcbiAgICAgIGlmIChsZXZlbCA9PT0gLTEpIHt0aHJvdyBlcnJvcn1cclxuICAgICAgcmV0dXJuIGZ1bmsodmFsLCBsZXZlbClcclxuICAgIH1cclxuICB9XHJcbiAgLy8gRGlzcGF0Y2hlcyBhbiBvcGVyYXRpb24gdG8gdGhlIGNvcnJlY3Qgc3RhY2sgbGV2ZWxcclxuICBjb25zdCBmcm9tU3RhY2sgPSAobmFtZSkgPT4ge1xyXG4gICAgcmV0dXJuICh2YWwsIGxldmVsKSA9PiBzdGFja1Byb2Nlc3NlZFtsZXZlbF1bbmFtZV0odmFsKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGxpZnQ6IG9wZXJhdGlvbihsaWZ0KSxcclxuICAgIG9mOiBvcGVyYXRpb24oZnJvbVN0YWNrKCdvZicpKSxcclxuICAgIGNoYWluOiBvcGVyYXRpb24oZnJvbVN0YWNrKCdjaGFpbicpKSxcclxuICAgIGxhc3Q6IHN0YWNrUHJvY2Vzc2VkIFtzdGFja1Byb2Nlc3NlZC5sZW5ndGggLSAxXSxcclxuICAgIGlkOiBpZFByb3RvLFxyXG4gICAgX21lbWJlcnM6IHN0YWNrUHJvY2Vzc2VkXHJcbiAgfVxyXG59XHJcblxyXG5jb25zdCBwcm9jZXNzU3RhY2sgPSAoYmFzZVN0YWNrKSA9PlxyXG4gIHN0YXRlTWFwKGJhc2VTdGFjaywgKGl0ZW0sIHN0YXRlKSA9PiB7XHJcbiAgICBjb25zdCBwcmV2SXRlbVByb2Nlc3NlZCA9IHN0YXRlLnByZXZJdGVtUHJvY2Vzc2VkIHx8IGlkUHJvdG9cclxuICAgIC8vIEFwcGx5IHRoZSBwcm9jZXNzaW5nIGZ1bmN0aW9uIG9uIGVhY2ggc3RhY2sgbWVtYmVyXHJcbiAgICBjb25zdCBpdGVtUHJvY2Vzc2VkID0gcHJvY2Vzc1Byb3RvTmV3KGl0ZW0sIHByZXZJdGVtUHJvY2Vzc2VkKVxyXG4gICAgcmV0dXJuIFtcclxuICAgICAgICBpdGVtUHJvY2Vzc2VkLFxyXG4gICAgICB7XHJcbiAgICAgICAgcHJldkl0ZW1Qcm9jZXNzZWQ6IGl0ZW1Qcm9jZXNzZWRcclxuICAgICAgfVxyXG4gICAgXVxyXG4gIH0pXHJcblxyXG4vLyBBIHN0YXRlZnVsIHZlcnNpb24gb2YgdGhlIG1hcCBmdW5jdGlvbjpcclxuLy8gZiBhY2NlcHRzIGFuIGFycmF5IGl0ZW0gYW5kIGEgc3RhdGUoZGVmYXVsdHMgdG8gYW4gb2JqZWN0KSBhbmQgcmV0dXJucyB0aGUgcHJvY2Vzc2VkIHZlcnNpb24gb2YgdGhlIGl0ZW0gcGx1cyBhIG5ldyBzdGF0ZVxyXG5jb25zdCBzdGF0ZU1hcCA9IChhcnIsIGYpID0+XHJcbiAgYXJyLnJlZHVjZSgoYXJyYXlBbmRTdGF0ZSwgaXRlbSkgPT4ge1xyXG4gICAgY29uc3QgaXRlbUFuZFN0YXRlID0gKGYoaXRlbSwgYXJyYXlBbmRTdGF0ZVsxXSkpXHJcbiAgICByZXR1cm4gW2FycmF5QW5kU3RhdGVbMF0uY29uY2F0KFtpdGVtQW5kU3RhdGVbMF1dKSwgaXRlbUFuZFN0YXRlWzFdIF1cclxuICB9LCBbW10sIHt9XSlbMF1cclxuXHJcbmNvbnN0IGNsb25lID0gKG9iaikgPT4gT2JqZWN0LmtleXMob2JqKS5yZWR1Y2UoKG5ld09iaiwga2V5KSA9PiB7XHJcbiAgbmV3T2JqW2tleV0gPSBvYmpba2V5XVxyXG4gIHJldHVybiBuZXdPYmpcclxufSwge30pXHJcblxyXG5jb25zdCBwcm9jZXNzUHJvdG9OZXcgPSAocHJvdG8sIG91dGVyKSA9PiB7XHJcbiAgY29uc3QgcHJvdG9Qcm9jZXNzZWQgPSBjbG9uZShwcm90bylcclxuICBwcm90b1Byb2Nlc3NlZC5uYW1lID0gcHJvdG8ubmFtZSArICcvJyArIG91dGVyLm5hbWVcclxuICBwcm90b1Byb2Nlc3NlZC5vdXRlciA9IG91dGVyXHJcbiAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgc28gd2UgY2FuIGRvIHR5cGVjaGVja3MgYW5kIHJvdXRlIG1ldGhvZCBjYWxsc1xyXG4gIHByb3RvUHJvY2Vzc2VkLm9yaWdpbmFsID0gcHJvdG9cclxuICByZXR1cm4gcHJvdG9Qcm9jZXNzZWRcclxufVxyXG5cclxuLy8gVGhlIGlkZW50aXR5IG1vbmFkLCB3aGljaCBsaWVzIGF0IHRoZSBib3R0b20gb2YgZWFjaCBzdGFja1xyXG5jb25zdCBpZFByb3RvID0ge1xyXG4gIG5hbWU6ICdyb290JyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gZnVuayh2YWwpXHJcbiAgfSxcclxuICBtYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH1cclxufVxyXG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiJdfQ==
