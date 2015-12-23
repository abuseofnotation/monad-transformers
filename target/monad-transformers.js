(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Task = require('data.task');

exports.task = {
  // (val) => Task(val)
  of: Task.of,
  // (val => Task(val), Task(val)) => Task(val)
  chain: function chain(fn, task) {
    return task.chain(fn);
  },
  // (val) => Task(val)
  lift: Task.of,

  // ((val) => otherVal, Task(val)) => otherVal
  value: function value(fn, task) {
    task.fork(function (a) {
      return a;
    }, fn);
  },
  fromTask: function fromTask(fn) {
    return new Task(fn);
  },
  cont: function cont(fn, val) {
    return new Task(fn(val));
  },
  rejected: Task.rejected
};

},{"data.task":8}],2:[function(require,module,exports){
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
  statefulMap: function statefulMap(funk, val) {
    var _this6 = this;

    return function (prevState) {
      return _this6.outer.of(funk(val, prevState));
    };
  },
  statefulChain: function statefulChain(funk, val) {
    return function (prevState) {
      return funk(val, prevState);
    };
  },
  value: function value(funk, state) {
    return this.outer.value(function (params) {
      return funk(params[0]);
    }, state());
  }
};

},{}],3:[function(require,module,exports){
/* # Types API
 *
 * Here is a list of all monad transformers and the methods that they add to the wrapper object.
 *
/* ## `data.maybe`
 *
 * The `maybe` monad transformer automatically checks if your value is undefined and
 * stops the computation if it is.
 *
 * ### `value.get(key)`
 *
 * A helper to safely retrieve a possibly undefined property of your value.
 * The value has to be a JS object.
 * 
 * ### `value.chainMaybe(f)`
 * 
 * Chains a function that returns a `maybe` value in the computation
 *
 * ### Source
 */

//TODO use this
'use strict';

var nothing = { maybeVal: undefined };
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
  maybeMap: function maybeMap(funk, val) {
    return this.of(funk(val));
  }
};

/* ## `data.list`
 *
 * The `list` monad transformer allows you to operate on a list of values.
 * instead of on a single value.
 *
 * ### `List.fromArray(val)`
 *
 * Wraps an array in a list monad transformer instance.
 *
 * ### `values.filter(fn)`
 * 
 * Filters out the values that don't match the predicate. Same as `Array.prototype.filter`.
 * 
 * _The behaviour of `Array.prototype.map` is covered by the monad transformer `map` method._
 *
 * ### Source
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

/* ## `data.writer`
 *
 * The writer monad transformer augments the wrapped value with one additional value
 * which may be used for storing some additional information about the computation.
 *
 * The additional value must have a `concat` method, as `String` or `Array`.
 * 
 * ### `value.tell(val)`
 * 
 * Concats `val` to the additional value.
 *
 * ### `value.listen(f)`
 *
 * Calls `f` with the additional value as an argument. 
 *
 * ###Source
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

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
/* #Overview
 *
 * The package consists of the following components:
 * 
 * ## Object wrapper
 * 
 * The object wrapper, exposed via the `mtl.make` function, combines one or several monad 
 * transformer definitions and mixes them into one fantasy land-complied monad.
 */
'use strict';

var mtl = {};
mtl.make = require('./wrapper');

/* ## Monad transformer definitions
 * 
 * The library offers 4 monad transformer definitions, distributed in two packages:
 * `data` and `comp`.
 *
 */
mtl.data = require('./data');
mtl.comp = require('./comp');

mtl.base = require('./base');
mtl.id = require('./id');

/* ## Predefined stacks
 * 
 * The library features five predefined monad stacks which serve the most common use cases.
 *
 */
mtl.simple = mtl.make(mtl.data.maybe, mtl.data.writer);
mtl.stateful = mtl.make(mtl.data.maybe, mtl.data.writer, mtl.comp.state);
mtl.list = mtl.make(mtl.data.list, mtl.data.maybe, mtl.data.writer);
mtl.statelist = mtl.make(mtl.data.list, mtl.data.maybe, mtl.data.writer, mtl.comp.state);

mtl.advanced = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.state);
mtl.advanced.prototype.rejectedMap = function (fn) {
  var _this = this;

  return mtl.advanced(function () {
    return _this._value().rejectedMap(fn);
  });
};
module.exports = mtl;

},{"./base":1,"./comp":2,"./data":3,"./id":4,"./wrapper":7}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
(function (process){
'use strict';

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

module.exports = function make_monad() {
  // Initilize the stack component, that actually does most of the work
  var stack = createStack(Array.prototype.slice.call(arguments));

  // Define the prototype of the resulting monad stack
  var baseStackProto = {
    stack: stack,
    prototype: this.prototype,
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
    tap: function tap(funk) {
      return funk(this);
    },
    value: function value(callback) {
      callback = callback !== undefined ? callback : function (a) {
        return a;
      };
      return stack.last.value(callback, this._value);
    }
  };

  // Promotes a method from a monad definition so it can be used for chaining
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
  create.prototype = stackProto;

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

},{"./stack":6,"_process":10}],8:[function(require,module,exports){
module.exports = require('./task');

},{"./task":9}],9:[function(require,module,exports){
(function (process){
'use strict';


/**
 * A helper for delaying the execution of a function.
 * @private
 * @summary (Any... -> Any) -> Void
 */
var delayed = typeof setImmediate !== 'undefined'?  setImmediate
            : typeof process !== 'undefined'?       process.nextTick
            : /* otherwise */                       setTimeout

/**
 * @module lib/task
 */
module.exports = Task;

// -- Implementation ---------------------------------------------------

/**
 * The `Task[α, β]` structure represents values that depend on time. This
 * allows one to model time-based effects explicitly, such that one can have
 * full knowledge of when they're dealing with delayed computations, latency,
 * or anything that can not be computed immediately.
 *
 * A common use for this structure is to replace the usual Continuation-Passing
 * Style form of programming, in order to be able to compose and sequence
 * time-dependent effects using the generic and powerful monadic operations.
 *
 * @class
 * @summary
 * ((α → Void), (β → Void) → Void), (Void → Void) → Task[α, β]
 *
 * Task[α, β] <: Chain[β]
 *               , Monad[β]
 *               , Functor[β]
 *               , Applicative[β]
 *               , Semigroup[β]
 *               , Monoid[β]
 *               , Show
 */
function Task(computation, cleanup) {
  this.fork = computation;

  this.cleanup = cleanup || function() {};
}

/**
 * Constructs a new `Task[α, β]` containing the single value `β`.
 *
 * `β` can be any value, including `null`, `undefined`, or another
 * `Task[α, β]` structure.
 *
 * @summary β → Task[α, β]
 */
Task.prototype.of = function _of(b) {
  return new Task(function(_, resolve) {
    return resolve(b);
  });
};

Task.of = Task.prototype.of;

/**
 * Constructs a new `Task[α, β]` containing the single value `α`.
 *
 * `α` can be any value, including `null`, `undefined`, or another
 * `Task[α, β]` structure.
 *
 * @summary α → Task[α, β]
 */
Task.prototype.rejected = function _rejected(a) {
  return new Task(function(reject) {
    return reject(a);
  });
};

Task.rejected = Task.prototype.rejected;

// -- Functor ----------------------------------------------------------

/**
 * Transforms the successful value of the `Task[α, β]` using a regular unary
 * function.
 *
 * @summary @Task[α, β] => (β → γ) → Task[α, γ]
 */
Task.prototype.map = function _map(f) {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return reject(a);
    }, function(b) {
      return resolve(f(b));
    });
  }, cleanup);
};

// -- Chain ------------------------------------------------------------

/**
 * Transforms the succesful value of the `Task[α, β]` using a function to a
 * monad.
 *
 * @summary @Task[α, β] => (β → Task[α, γ]) → Task[α, γ]
 */
Task.prototype.chain = function _chain(f) {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return reject(a);
    }, function(b) {
      return f(b).fork(reject, resolve);
    });
  }, cleanup);
};

// -- Apply ------------------------------------------------------------

/**
 * Applys the successful value of the `Task[α, (β → γ)]` to the successful
 * value of the `Task[α, β]`
 *
 * @summary @Task[α, (β → γ)] => Task[α, β] → Task[α, γ]
 */

Task.prototype.ap = function _ap(f2) {
  return this.chain(function(f) {
    return f2.map(f);
  });
};

// -- Semigroup ------------------------------------------------------------

/**
 * Selects the earlier of the two tasks `Task[α, β]`
 *
 * @summary @Task[α, β] => Task[α, β] → Task[α, β]
 */

Task.prototype.concat = function _concat(that) {
  var forkThis = this.fork;
  var forkThat = that.fork;
  var cleanupThis = this.cleanup;
  var cleanupThat = that.cleanup;

  function cleanupBoth(state) {
    cleanupThis(state[0]);
    cleanupThat(state[1]);
  }

  return new Task(function(reject, resolve) {
    var done = false;
    var allState;
    var thisState = forkThis(guard(reject), guard(resolve));
    var thatState = forkThat(guard(reject), guard(resolve));

    return allState = [thisState, thatState];

    function guard(f) {
      return function(x) {
        if (!done) {
          done = true;
          delayed(function(){ cleanupBoth(allState) })
          return f(x);
        }
      };
    }
  }, cleanupBoth);

};

// -- Monoid ------------------------------------------------------------

/**
 * Returns a Task that will never resolve
 *
 * @summary Void → Task[α, _]
 */
Task.empty = function _empty() {
  return new Task(function() {});
};

Task.prototype.empty = Task.empty;

// -- Show -------------------------------------------------------------

/**
 * Returns a textual representation of the `Task[α, β]`
 *
 * @summary @Task[α, β] => Void → String
 */
Task.prototype.toString = function _toString() {
  return 'Task';
};

// -- Extracting and recovering ----------------------------------------

/**
 * Transforms a failure value into a new `Task[α, β]`. Does nothing if the
 * structure already contains a successful value.
 *
 * @summary @Task[α, β] => (α → Task[γ, β]) → Task[γ, β]
 */
Task.prototype.orElse = function _orElse(f) {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return f(a).fork(reject, resolve);
    }, function(b) {
      return resolve(b);
    });
  }, cleanup);
};

// -- Folds and extended transformations -------------------------------

/**
 * Catamorphism. Takes two functions, applies the leftmost one to the failure
 * value, and the rightmost one to the successful value, depending on which one
 * is present.
 *
 * @summary @Task[α, β] => (α → γ), (β → γ) → Task[δ, γ]
 */
Task.prototype.fold = function _fold(f, g) {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return resolve(f(a));
    }, function(b) {
      return resolve(g(b));
    });
  }, cleanup);
};

/**
 * Catamorphism.
 *
 * @summary @Task[α, β] => { Rejected: α → γ, Resolved: β → γ } → Task[δ, γ]
 */
Task.prototype.cata = function _cata(pattern) {
  return this.fold(pattern.Rejected, pattern.Resolved);
};

/**
 * Swaps the disjunction values.
 *
 * @summary @Task[α, β] => Void → Task[β, α]
 */
Task.prototype.swap = function _swap() {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return resolve(a);
    }, function(b) {
      return reject(b);
    });
  }, cleanup);
};

/**
 * Maps both sides of the disjunction.
 *
 * @summary @Task[α, β] => (α → γ), (β → δ) → Task[γ, δ]
 */
Task.prototype.bimap = function _bimap(f, g) {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return reject(f(a));
    }, function(b) {
      return resolve(g(b));
    });
  }, cleanup);
};

/**
 * Maps the left side of the disjunction (failure).
 *
 * @summary @Task[α, β] => (α → γ) → Task[γ, β]
 */
Task.prototype.rejectedMap = function _rejectedMap(f) {
  var fork = this.fork;
  var cleanup = this.cleanup;

  return new Task(function(reject, resolve) {
    return fork(function(a) {
      return reject(f(a));
    }, function(b) {
      return resolve(b);
    });
  }, cleanup);
};

}).call(this,require('_process'))

},{"_process":10}],10:[function(require,module,exports){
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

},{}]},{},[1,2,3,4,5,6,7])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJDOi9wci9zb25uZS9saWIvYmFzZS5qcyIsIkM6L3ByL3Nvbm5lL2xpYi9jb21wLmpzIiwiQzovcHIvc29ubmUvbGliL2RhdGEuanMiLCJDOi9wci9zb25uZS9saWIvaWQuanMiLCJDOi9wci9zb25uZS9saWIvbWFpbi5qcyIsIkM6L3ByL3Nvbm5lL2xpYi9zdGFjay5qcyIsIkM6L3ByL3Nvbm5lL2xpYi93cmFwcGVyLmpzIiwibm9kZV9tb2R1bGVzL2RhdGEudGFzay9saWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGF0YS50YXNrL2xpYi90YXNrLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQ0EsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFBOztBQUVqQyxPQUFPLENBQUMsSUFBSSxHQUFHOztBQUViLElBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTs7QUFFWCxPQUFLLEVBQUEsZUFBQyxFQUFFLEVBQUUsSUFBSSxFQUFFO0FBQ2QsV0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0dBQ3RCOztBQUVELE1BQUksRUFBRSxJQUFJLENBQUMsRUFBRTs7O0FBR2IsT0FBSyxFQUFBLGVBQUMsRUFBRSxFQUFFLElBQUksRUFBRTtBQUNkLFFBQUksQ0FBQyxJQUFJLENBQUMsVUFBQyxDQUFDO2FBQUcsQ0FBQztLQUFBLEVBQUUsRUFBRSxDQUFDLENBQUE7R0FDdEI7QUFDRCxVQUFRLEVBQUEsa0JBQUMsRUFBRSxFQUFFO0FBQ1gsV0FBTyxJQUFJLElBQUksQ0FBQyxFQUFF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Q0FDbkgsQ0FBQTs7Ozs7QUM1SEQ7QUFDQTs7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDalRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5jb25zdCBUYXNrID0gcmVxdWlyZSgnZGF0YS50YXNrJylcblxuZXhwb3J0cy50YXNrID0ge1xuICAvLyAodmFsKSA9PiBUYXNrKHZhbClcbiAgb2Y6IFRhc2sub2YsXG4gIC8vICh2YWwgPT4gVGFzayh2YWwpLCBUYXNrKHZhbCkpID0+IFRhc2sodmFsKVxuICBjaGFpbihmbiwgdGFzaykge1xuICAgIHJldHVybiB0YXNrLmNoYWluKGZuKSAgICAgXG4gIH0sXG4gIC8vICh2YWwpID0+IFRhc2sodmFsKVxuICBsaWZ0OiBUYXNrLm9mLFxuXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgVGFzayh2YWwpKSA9PiBvdGhlclZhbFxuICB2YWx1ZShmbiwgdGFzaykge1xuICAgIHRhc2suZm9yaygoYSk9PmEsIGZuKVxuICB9LFxuICBmcm9tVGFzayhmbikge1xuICAgIHJldHVybiBuZXcgVGFzayhmbilcbiAgfSxcbiAgY29udCAoZm4sIHZhbCkge1xuICAgIHJldHVybiBuZXcgVGFzayhmbih2YWwpKVxuICB9LFxuICByZWplY3RlZDogVGFzay5yZWplY3RlZFxufVxuIiwiZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgc3RhdGUpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB0aGlzLm91dGVyLmNoYWluKChwYXJhbXMpID0+IHtcclxuICAgICAgICBjb25zdCBuZXdWYWwgPSBwYXJhbXNbMF0sIG5ld1N0YXRlID0gcGFyYW1zWzFdXHJcbiAgICAgICAgcmV0dXJuIGZ1bmsobmV3VmFsKShuZXdTdGF0ZSlcclxuICAgICAgfSwgc3RhdGUocHJldlN0YXRlKSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+XHJcbiAgICAgIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2YoW2lubmVyVmFsdWUsIHByZXZTdGF0ZV0pLCB2YWwpXHJcbiAgfSxcclxuICBsb2FkICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFtwcmV2U3RhdGUsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBzYXZlICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHZhbF0pXHJcbiAgfSxcclxuICBzdGF0ZWZ1bE1hcCAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihmdW5rKHZhbCwgcHJldlN0YXRlKSlcclxuICB9LFxyXG4gIHN0YXRlZnVsQ2hhaW4oZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gZnVuayh2YWwsIHByZXZTdGF0ZSlcclxuICB9LFxyXG4gIHZhbHVlIChmdW5rLCBzdGF0ZSkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKHBhcmFtcykgPT4ge1xyXG4gICAgICByZXR1cm4gZnVuayhwYXJhbXNbMF0pXHJcbiAgICB9LCBzdGF0ZSgpKVxyXG4gIH1cclxufVxyXG4iLCIvKiAjIFR5cGVzIEFQSVxyXG4gKlxyXG4gKiBIZXJlIGlzIGEgbGlzdCBvZiBhbGwgbW9uYWQgdHJhbnNmb3JtZXJzIGFuZCB0aGUgbWV0aG9kcyB0aGF0IHRoZXkgYWRkIHRvIHRoZSB3cmFwcGVyIG9iamVjdC5cclxuICpcclxuLyogIyMgYGRhdGEubWF5YmVgXHJcbiAqXHJcbiAqIFRoZSBgbWF5YmVgIG1vbmFkIHRyYW5zZm9ybWVyIGF1dG9tYXRpY2FsbHkgY2hlY2tzIGlmIHlvdXIgdmFsdWUgaXMgdW5kZWZpbmVkIGFuZFxyXG4gKiBzdG9wcyB0aGUgY29tcHV0YXRpb24gaWYgaXQgaXMuXHJcbiAqXHJcbiAqICMjIyBgdmFsdWUuZ2V0KGtleSlgXHJcbiAqXHJcbiAqIEEgaGVscGVyIHRvIHNhZmVseSByZXRyaWV2ZSBhIHBvc3NpYmx5IHVuZGVmaW5lZCBwcm9wZXJ0eSBvZiB5b3VyIHZhbHVlLlxyXG4gKiBUaGUgdmFsdWUgaGFzIHRvIGJlIGEgSlMgb2JqZWN0LlxyXG4gKiBcclxuICogIyMjIGB2YWx1ZS5jaGFpbk1heWJlKGYpYFxyXG4gKiBcclxuICogQ2hhaW5zIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYG1heWJlYCB2YWx1ZSBpbiB0aGUgY29tcHV0YXRpb25cclxuICpcclxuICogIyMjIFNvdXJjZVxyXG4gKi9cclxuXHJcbi8vVE9ETyB1c2UgdGhpc1xyXG5jb25zdCBub3RoaW5nID0ge21heWJlVmFsOnVuZGVmaW5lZH1cclxuZXhwb3J0cy5tYXliZSA9IHtcclxuICBuYW1lOiAnTWF5YmUnLFxyXG4gIC8vICh2YWwpID0+IE0oe21heWJlVmFsOnZhbH0pXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4gdGhpcy5vdXRlci5vZih7bWF5YmVWYWw6IHZhbCB9KSB9LFxyXG4gIC8vICh2YWwgPT4gTSh7bWF5YmVWYWw6dmFsfSkgLCBNKHttYXliZVZhbDp2YWx9KSkgPT4gTSh7bWF5YmVWYWw6dmFsfSlcclxuICBjaGFpbiAoZnVuaywgbU1heWJlVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigobWF5YmVWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIG1heWJlVmFsLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBtYXliZVZhbCA6IGZ1bmsobWF5YmVWYWwubWF5YmVWYWwpXHJcbiAgICB9LCBtTWF5YmVWYWwpXHJcbiAgfSxcclxuICAvLyAoTSh2YWwpKSA9PiBNKHttYXliZVZhbDp2YWx9KVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe21heWJlVmFsOiB2YWx9KSwgbVZhbClcclxuICB9LFxyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgTSh7bWF5YmVWYWw6dmFsfSkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZ1bmssIG1NYXliZVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKG1heWJlVmFsKSA9PiB7XHJcbiAgICAgIHJldHVybiBtYXliZVZhbC5tYXliZVZhbCA9PT0gdW5kZWZpbmVkID8gbWF5YmVWYWwgOiBmdW5rKG1heWJlVmFsLm1heWJlVmFsKVxyXG4gICAgfSwgbU1heWJlVmFsKVxyXG4gIH0sXHJcbiAgZ2V0IChrZXksIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub2YodmFsW2tleV0pXHJcbiAgfSxcclxuICBtYXliZU1hcCAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vZihmdW5rKHZhbCkpXHJcbiAgfVxyXG59XHJcblxyXG4vKiAjIyBgZGF0YS5saXN0YFxyXG4gKlxyXG4gKiBUaGUgYGxpc3RgIG1vbmFkIHRyYW5zZm9ybWVyIGFsbG93cyB5b3UgdG8gb3BlcmF0ZSBvbiBhIGxpc3Qgb2YgdmFsdWVzLlxyXG4gKiBpbnN0ZWFkIG9mIG9uIGEgc2luZ2xlIHZhbHVlLlxyXG4gKlxyXG4gKiAjIyMgYExpc3QuZnJvbUFycmF5KHZhbClgXHJcbiAqXHJcbiAqIFdyYXBzIGFuIGFycmF5IGluIGEgbGlzdCBtb25hZCB0cmFuc2Zvcm1lciBpbnN0YW5jZS5cclxuICpcclxuICogIyMjIGB2YWx1ZXMuZmlsdGVyKGZuKWBcclxuICogXHJcbiAqIEZpbHRlcnMgb3V0IHRoZSB2YWx1ZXMgdGhhdCBkb24ndCBtYXRjaCB0aGUgcHJlZGljYXRlLiBTYW1lIGFzIGBBcnJheS5wcm90b3R5cGUuZmlsdGVyYC5cclxuICogXHJcbiAqIF9UaGUgYmVoYXZpb3VyIG9mIGBBcnJheS5wcm90b3R5cGUubWFwYCBpcyBjb3ZlcmVkIGJ5IHRoZSBtb25hZCB0cmFuc2Zvcm1lciBgbWFwYCBtZXRob2QuX1xyXG4gKlxyXG4gKiAjIyMgU291cmNlXHJcbiAqL1xyXG5cclxuZXhwb3J0cy5saXN0ID0ge1xyXG4gIG5hbWU6ICdMaXN0JyxcclxuICAvLyAodmFsKSA9PiBNKFt2YWxdKVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWxdKVxyXG4gIH0sXHJcbiAgLy8gKHZhbCA9PiBNKFt2YWxdKSAsIE0oW3ZhbF0pKT0+IE0oW3ZhbF0pXHJcbiAgY2hhaW4gKGZ1bmssIG1MaXN0VmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbihsaXN0VmFsID0+IHtcclxuICAgICAgcmV0dXJuIGxpc3RWYWwubGVuZ3RoID09PSAwID8gdGhpcy5vdXRlci5vZihbXSkgOiBsaXN0VmFsXHJcbiAgICAgICAgLm1hcChmdW5rKVxyXG4gICAgICAgIC5yZWR1Y2UoKGFjY3VtdWxhdGVkVmFsLCBuZXdWYWwpID0+IHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGFjY3VtdWxhdGVkID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oX25ldyA9PiBcclxuICAgICAgICAgICAgICB0aGlzLm91dGVyLm9mKGFjY3VtdWxhdGVkLmNvbmNhdChfbmV3KSksIG5ld1ZhbClcclxuICAgICAgICB9LCBhY2N1bXVsYXRlZFZhbClcclxuICAgICAgfSlcclxuICAgIH0sIG1MaXN0VmFsKVxyXG4gIH0sXHJcbiAgLy8gKE0odmFsKSkgPT4gTShbdmFsXSlcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGlubmVyVmFsdWUgPT4gdGhpcy5vdXRlci5vZihbaW5uZXJWYWx1ZV0pLCB2YWwpXHJcbiAgfSxcclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0oW3ZhbF0pKSA9PiBvdGhlclZhbFxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChsaXN0KSA9PiB7XHJcbiAgICAgIHJldHVybiBsaXN0Lm1hcChmdW5rKVxyXG4gICAgfSwgdmFsKVxyXG4gIH0sXHJcbiAgZmlsdGVyIChmdW5rLCB2YWwpIHtcclxuICAgIGlmIChmdW5rKHZhbCkpIHtcclxuICAgICAgcmV0dXJuIHRoaXMub2YodmFsKVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW10pXHJcbiAgICB9XHJcbiAgfSxcclxuICBmcm9tQXJyYXkgKHZhbCkge1xyXG4gICAgaWYgKHZhbC5jb25jYXQgJiYgdmFsLm1hcCAmJiB2YWwucmVkdWNlICYmIHZhbC5zbGljZSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5vZih2YWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aHJvdyB2YWwgKyAnIGlzIG5vdCBhIGxpc3QuJ1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyogIyMgYGRhdGEud3JpdGVyYFxyXG4gKlxyXG4gKiBUaGUgd3JpdGVyIG1vbmFkIHRyYW5zZm9ybWVyIGF1Z21lbnRzIHRoZSB3cmFwcGVkIHZhbHVlIHdpdGggb25lIGFkZGl0aW9uYWwgdmFsdWVcclxuICogd2hpY2ggbWF5IGJlIHVzZWQgZm9yIHN0b3Jpbmcgc29tZSBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjb21wdXRhdGlvbi5cclxuICpcclxuICogVGhlIGFkZGl0aW9uYWwgdmFsdWUgbXVzdCBoYXZlIGEgYGNvbmNhdGAgbWV0aG9kLCBhcyBgU3RyaW5nYCBvciBgQXJyYXlgLlxyXG4gKiBcclxuICogIyMjIGB2YWx1ZS50ZWxsKHZhbClgXHJcbiAqIFxyXG4gKiBDb25jYXRzIGB2YWxgIHRvIHRoZSBhZGRpdGlvbmFsIHZhbHVlLlxyXG4gKlxyXG4gKiAjIyMgYHZhbHVlLmxpc3RlbihmKWBcclxuICpcclxuICogQ2FsbHMgYGZgIHdpdGggdGhlIGFkZGl0aW9uYWwgdmFsdWUgYXMgYW4gYXJndW1lbnQuIFxyXG4gKlxyXG4gKiAjIyNTb3VyY2VcclxuICovXHJcblxyXG5jb25zdCBjb21wdXRlTG9nID0gKGxvZywgbmV3TG9nKSA9PiB7XHJcbiAgaWYobG9nID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBuZXdMb2dcclxuICB9IGVsc2Uge1xyXG4gICAgaWYgKG5ld0xvZyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiBsb2dcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBsb2cuY29uY2F0KG5ld0xvZylcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydHMud3JpdGVyID0ge1xyXG4gIG5hbWU6ICdXcml0ZXInLFxyXG5cclxuICAvLyAodmFsKSA9PiBNKFt2YWwsIGxvZ10pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbCwgdW5kZWZpbmVkXSlcclxuICB9LFxyXG5cclxuICAvLyAodmFsID0+IE0oW3ZhbCwgbG9nXSksIE0oW3ZhbCwgbG9nXSkpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBjaGFpbiAoZnVuaywgbVdyaXRlclZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKHdyaXRlclZhbCkgPT4ge1xyXG4gICAgICBjb25zdCB2YWwgPSB3cml0ZXJWYWxbMF1cclxuICAgICAgY29uc3QgbG9nID0gd3JpdGVyVmFsWzFdIFxyXG4gICAgICBjb25zdCBuZXdNV3JpdGVyVmFsID0gZnVuayh2YWwpXHJcbiAgICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChuZXdXcml0ZXJWYWwpID0+IHtcclxuICAgICAgICBjb25zdCBuZXdWYWwgPSBuZXdXcml0ZXJWYWxbMF1cclxuICAgICAgICBjb25zdCBuZXdMb2cgPSB0eXBlb2YgbmV3V3JpdGVyVmFsWzFdID09PSAnZnVuY3Rpb24nID8gbmV3V3JpdGVyVmFsWzFdKGxvZykgOiBuZXdXcml0ZXJWYWxbMV1cclxuICAgICAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbbmV3VmFsLCBjb21wdXRlTG9nKGxvZywgbmV3TG9nKV0pXHJcbiAgICAgIH0sIG5ld01Xcml0ZXJWYWwpXHJcbiAgICB9LCBtV3JpdGVyVmFsKVxyXG5cclxuICB9LFxyXG5cclxuICAvLyAoTSh2YWwpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBsaWZ0IChtVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigodmFsKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHVuZGVmaW5lZF0pLCBtVmFsKVxyXG4gIH0sXHJcblxyXG4gIC8vICgodmFsKSA9PiBiLCBNKFt2YWwsIGxvZ10pKSA9PiBiXHJcbiAgdmFsdWUgKGZ1bmssIG1Xcml0ZXJWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKCh3cml0ZXJWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsod3JpdGVyVmFsWzBdKVxyXG4gICAgfSwgbVdyaXRlclZhbClcclxuICB9LFxyXG5cclxuICB0ZWxsIChtZXNzYWdlLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWwsIG1lc3NhZ2VdKVxyXG4gIH0sXHJcbiAgbGlzdGVuIChmdW5rLCB2YWwpe1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbCwgZnVua10pXHJcbiAgfVxyXG59XHJcbiIsIi8qICMgSW1wbGVtZW50aW5nIGEgbW9uYWQgdHJhbnNmb3JtZXJcclxuICpcclxuICogTW9uYWQgdHJhbnNmb3JtZXJzIGFyZSB0cmlja3ksIGFuZCBvbmUgb2YgdGhlIHJlYXNvbnMgZm9yIHRoaXMgaXMgdGhhdCB0aGV5IHJlcXVpcmUgYW5cclxuICogZXhjZXNzaXZlIGFtb3VudCBvZiB0eXBlIGp1Z2dsaW5nLiBZb3UgaGF2ZSB0byBjb25zdGFudGx5IHdyYXAgdGhpbmdzIGluIGJveGVzIGFuZCB1bndyYXAgdGhlbVxyXG4gKiBhZ2Fpbi4gXHJcbiAqXHJcbiAqIE9uZSBvZiB0aGUgYWltcyBvZiB0aGlzIHBhY2thZ2UgaXMgdG8gcmVkdWNlIHRoZSBhbW91bnQgb2Ygd3JhcHBpbmcgYW5kIHVud3JhcHBpbmcgbmVlZGVkIGZvclxyXG4gKiBtYWtpbmcgYSBuZXcgdHJhbnNmb3JtZXIgYW5kIHRvIHByb3ZpZGUgYW4gZWFzeSB3YXkgdG8gZGVmaW5lIGFuZCBjb21iaW5lIHRyYW5zZm9ybWVycy4gXHJcbiAqXHJcbiAqIFdpdGggaXQsIGFsbCBpdCB0YWtlcyB0byBpbXBsZW1lbnQgYSB0cmFuc2Zvcm1lciBpcyBpbXBsZW1lbnQgdGhlc2UgZm91ciBmdW5jdGlvbnM6IFxyXG4gKiBgb2ZgIChBS0EgYHJldHVybmApLCBgY2hhaW5gIChBS0EgYGZsYXRNYXBgKSBgbGlmdGAgYW5kIGB2YWx1ZWAoQUtBIGBydW5gKVxyXG4gKlxyXG4gKiAjIyBUaGUgdHJpdmlhbCBpbXBsZW1lbnRhdGlvblxyXG4gKiBcclxuICogQ29uc2lkZXIgdGhlIGlkZW50aXR5IE1vbmFkIHRyYW5zZm9ybWVyLiBUaGlzIGlzIGEgbW9uYWQgdHJhbnNmb3JtZXIgdGhhdCBkb2VzIG5vdGhpbmc6IFxyXG4gKiBvciBpbiBvdGhlciB3b3JkcyBpdCBwcm9kdWNlcyBhIG1vbmFkIHdoaWNoIGJlaGF2ZXMgdGhlIHNhbWUgd2F5IGFzIHRoZSBvbmUgaXQgaXMgZ2l2ZW4gdG8gaXRcclxuICogYXMgYW4gYXJndW1lbnQuIEhlcmUgaXMgaG93IHdvdWxkIHRoZSBpbXBsZW1lbnRhdGlvbiBvZiB0aGVzZSBtZXRob2RzIGxvb2sgbGlrZTpcclxuICovXHJcblxyXG5leHBvcnRzLmlkTWluaW1hbCA9IHtcclxuICBuYW1lOiAnaWRNaW5pbWFsJyxcclxuLypcclxuICogVGhlIGBvZmAgZnVuY3Rpb24gdGFrZXMgYSBzY2FsYXIgdmFsdWUgYW5kIHJldHVybnMgYW4gaW5zdGFuY2Ugb2YgdGhlIG91dGVyIG1vbmFkLlxyXG4gKiBJbiB0aGlzIGNhc2Ugd2UgZGVsZWdhdGUgZXZlcnl0aGluZyB0byB0aGUgb3V0ZXIgbW9uYWQncyBgb2ZgIG1ldGhvZC5cclxuICogV2UgYWNjZXNzIHRoZSBvdXRlciBtb25hZCB3aXRoIGB0aGlzLm91dGVyYC4gXHJcbiAqL1xyXG4gIC8vICh2YWwpID0+IE0odmFsKVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHZhbClcclxuICB9LFxyXG4vKiBcclxuICogYGNoYWluYCBpcyB0aGUgaGVhcnQgb2YgYW55IG1vbmFkIG9yIG1vbmFkIHRyYW5zZm9ybWVyLlxyXG4gKlxyXG4gKiBJbiB0aGlzIGNhc2Ugd2UgaW1wbGVtZW50IGl0IGJ5IGp1c3QgY2FsbGluZyB0aGUgYGNoYWluYCBmdW5jdGlvbiBvZiB0aGUgaG9zdCBtb25hZCAodXNpbmcgXHJcbiAqIGB0aGlzLm91dGVyLmNoYWluYCkgd2l0aCB0aGUgZnVuY3Rpb24gZ2l2ZW4gdG8gdXMgYXMgYW4gYXJndW1lbnQuXHJcbiAqL1xyXG4gIC8vICh2YWwgPT4gTSh2YWwpICwgTSh2YWwpKSA9PiBNKHZhbClcclxuICBjaGFpbiAoZm4sIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oZm4sIHZhbClcclxuICB9LFxyXG4vKiBcclxuICogVGhlIGBsaWZ0YCBmdW5jdGlvbiBpcyBraW5kYSBsaWtlIGBvZmAsIGJ1dCBpdCBhY2NlcHRzIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZFxyXG4gKiBpbnN0ZWFkIG9mIGEgJ3BsYWluJyB2YWx1ZS5cclxuICovXHJcbiAgLy8gKE0odmFsKSkgPT4gTSh2YWwpXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuLyogXHJcbiAqIEhhdmluZyBib3RoICdsaWZ0JyBhbmQgJ29mJyBlbmFibGVzIHVzIHRvIGNvbnZlcnQgYW55IHZhbHVlIGNyZWF0ZWQgYnkgb25lIG1vbmFkIHRyYW5zZm9ybWVyXHJcbiAqIHRvIGEgYSB2YWx1ZSB0aGF0IGhvbGRzIGFsbCBlbGVtZW50cyBvZiB0aGUgc3RhY2tcclxuICpcclxuICogRmluYWxseSB0aGUgYHZhbHVlYCBmdW5jdGlvbiBwcm92aWRlcyBhIHdheSB0byBnZXQgJ3RoZSB2YWx1ZSBiYWNrJ1xyXG4gKiBXaGF0IGl0IGRvZXMgaXMgdG8gdW53cmFwIGEgcHJldmlvdXNseS13cmFwcGVkIG1vbmFkLlxyXG4gKiBJbiB0aGlzIGNhc2Ugd2UgZGlkbid0IGRvIGFueSB3cmFwcGluZywgc28gd2UgZG9uJ3QgaGF2ZSB0byBkbyBhbnkgdW53cmFwcGluZyBlaXRoZXIuXHJcbiAqL1xyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgTSh2YWwpKSA9PiBvdGhlclZhbFxyXG4gIHZhbHVlIChmbiwgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZShmbiwgdmFsKVxyXG4gIH1cclxufVxyXG5cclxuLyogIyBNYW5pcHVsYXRpbmcgdGhlIHZhbHVlXHJcbiAqIFxyXG4gKiBBbGwgbW9uYWQgdHJhbnNmb3JtZXJzIGRvIHRoZSBzYW1lIHRoaW5nIChnaXZlbiBhIG1vbmFkIGBBYCwgdGhleSBwcm9kdWNlIGFcclxuICogbW9uYWQgYEIoQSlgIHdoaWNoIHNvbWVob3cgYXVnbWVudHMgYEFgKSwgYnV0IHRoZXJlIGlzIG5vIGdlbmVyYWwgZm9ybXVsYSBmb3IgZG9pbmcgaXQuXHJcbiAqIFxyXG4gKiBTaW1wbGVyIG1vbmFkcyBjYW4gYmUgaW1wbGVtZW50ZWQganVzdCBieSBtYW5pcHVsYXRpbmcgdGhlIHZhbHVlIGluc2lkZSB0aGUgaG9zdCBtb25hZC5cclxuICpcclxuICogT3VyIG5leHQgaW1wbGVtZW50YXRpb24gb2YgSUQgd2lsbCBqdXN0IHdyYXAgdGhlIHVuZGVybHlpbmcgdmFsdWUgKHdoaWNoIHdlIGNhbGxlZCBBKVxyXG4gKiBpbiBhIHBsYWluIG9iamVjdC5cclxuICpcclxuICogU28gYE0oQSlgIHdvdWxkIGJlY29tZSBgTSAoe2lkVmFsOkF9KWAgd2hlbiB3ZSB3cmFwIGl0IGFuZCB3aWxsIGJlIGJhY2sgdG8gYE0oQSlgIHdoZW4gd2VcclxuICogdW53cmFwIGl0LlxyXG4gKlxyXG4gKiBIZXJlIGlzIGhvdyB0aGlzIGltcGxlbWVudGF0aW9uIHdvdWxkIGxvb2sgbGlrZTpcclxuICovXHJcblxyXG5leHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJZCcsXHJcblxyXG4vKlxyXG4gKiBUaGUgYG9mYCBmdW5jdGlvbiB0YWtlcyBhIHNjYWxhciB2YWx1ZSBhbmQgcmV0dXJucyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWQuXHJcbiAqIEluIHRoaXMgY2FzZSB3ZSBkZWxlZ2F0ZSBldmVyeXRoaW5nIHRvIHRoZSBvdXRlciBtb25hZCdzIGBvZmAgbWV0aG9kLlxyXG4gKiBXZSBhY2Nlc3MgdGhlIG91dGVyIG1vbmFkIHdpdGggYHRoaXMub3V0ZXJgLiBcclxuICovXHJcblxyXG4gIC8vICh2YWwpID0+IE0oe2lkVmFsOnZhbH0pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWwgfSlcclxuICB9LFxyXG4vKiBcclxuICpcclxuICogY2hhaW4ganVzdCBjYWxscyB0aGUgYGNoYWluYCBmdW5jdGlvbiBvZiB0aGUgaG9zdCBtb25hZCBsaWtlIGluIHRoZSBwcmV2aW91cyBleGFtcGxlLlxyXG4gKiBUaGUgZGlmZmVyZW5jZSBpcyB0aGF0IGl0IGFwcGxpZXMgc29tZSB0cmFuc2Zvcm1hdGlvbiB0byB0aGUgdmFsdWUgaW4gb3JkZXIgdG8gZml0IFxyXG4gKiB0aGUgbmV3IGNvbnRleHQuIFxyXG4gKi9cclxuICAvLyAodmFsID0+IE0oe2lkVmFsOnZhbH0pICwgTSh7aWRWYWw6dmFsfSkpID0+IE0oe2lkVmFsOnZhbH0pXHJcbiAgY2hhaW4gKGZuLCBtSWRWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChpZFZhbCkgPT4ge1xyXG4gICAgICByZXR1cm4gZm4oaWRWYWwuaWRWYWwpXHJcbiAgICB9LCBtSWRWYWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIFRoZSBgbGlmdGAgZnVuY3Rpb24gdXNlcyBgY2hhaW5gICsgYG9mYCAod2hpY2ggaXMgdGhlIHNhbWUgYXMgYG1hcGApIHRvIGdvIHRvIHRoZSBob3N0IG1vbmFkXHJcbiAqIGFuZCBtb2RpZnkgdGhlIHZhbHVlIGluc2lkZSBpdC5cclxuICovXHJcbiAgLy8gKE0odmFsKSkgPT4gTSh7aWRWYWw6dmFsfSlcclxuICBsaWZ0IChtVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigodmFsKSA9PiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsfSksIG1WYWwpXHJcbiAgfSxcclxuLypcclxuICogTGFzdGx5IHdlIGhhdmUgdGhlIGB2YWx1ZWAgZnVuY3Rpb24gKG9yIHRoZSBpbnRlcnByZXRlciksIHdoaWNoIHVud3JhcHMgYSBwcmV2aW91c2x5LXdyYXBwZWRcclxuICogdmFsdWUuXHJcbiAqL1xyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgTSh7aWRWYWw6dmFsfSkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZuLCBtSWRWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChpZFZhbCk9PiB7XHJcbiAgICAgIHJldHVybiBmbihpZFZhbC5pZFZhbClcclxuICAgIH0sIG1JZFZhbClcclxuICB9XHJcbn1cclxuXHJcbi8qXHJcbiAqIE5vdGljZSB0aGF0IHdlIGFyZSBhbHdheXMgcmV0dXJuaW5nIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICpcclxuICogVGhhdCBpcywgaWYgeW91IGFyZSB0byBhcHBseSB0aGUgdHJhbnNmb3JtYXRpb24gc2V2ZXJhbCB0aW1lcyxcclxuICogdGhlIHZhbHVlcyBuZXN0IGluc2lkZSBNOiBNKHtpZFZhbDp7aWRWYWw6IGF9fSlcclxuICpcclxuICogSG93ZXZlciBub3QgYWxsIG1vbmFkIHRyYW5zZm9ybWVycyBhcmUgbGlrZSB0aGF0LlxyXG4gKlxyXG4gKiAjIyBBIG1vcmUgY29tcGxleCBzdHJ1Y3R1cmVcclxuICpcclxuICogU28gZmFyIHdlIGhhdmUgc2VlbiBtb25hZCB0cmFuc2Zvcm1lcnMgd2hpY2ggb25seSBkZWFsIHdpdGggdGhlIHZhbHVlIGluc2lkZSB0aGUgZ2l2ZW5cclxuICogbW9uYWQgQS4gSG93ZXZlciBub3QgYWxsIG1vbmFkIHRyYW5zZm9ybWVycyBhcmUgbGlrZSB0aGF0LiBcclxuICpcclxuICogVGhlcmUgYXJlIG1vbmFkIHRyYW5zZm9ybWVycyB3aGljaCBhZGQgYWRkaXRpb25hbCBzdHJ1Y3R1cmUgdG8gdGhlIG1vbmFkIGl0c2VsZi5cclxuICogRXhhbXBsZXMgb2YgdGhlIGZpcnN0IHR5cGUgYXJlIGFsbCB0cmFuc2Zvcm1lcnMgdGhhdCB3ZSBoYXZlIHNlZW4gc28gZmFyLlxyXG4gKiBBbiBleGFtcGxlIG9mIHRoZSBzZWNvbmQgdHlwZSBpcyB0aGUgJ1N0YXRlJyBtb25hZCwgd2hpY2ggZ2l2ZW4gdGhlIHNhbWUgdmFsdWUgYE0oQSlgLCB3aWxsIFxyXG4gKiBwcm9kdWNlIHNvbWV0aGluZyBsaWtlIGAoKSA9PnsgTShbQSwgU3RhdGVdKSB9YC4gVGhhdCBpcywgdGhlIHRyYW5zZm9ybWVyIGFkZHMgdGhlIHN0YXRlXHJcbiAqIHZhbHVlIHRvIHRoZSAnaG9zdCcgbW9uYWQgYE1gLCBhbmQgdGhlbiBpdCB3cmFwcyB0aGUgbW9uYWQgaXRzZWxmIGluIGEgZnVuY3Rpb24uXHJcbiAqXHJcbiAqIE5vdyBjb25zaWRlciBhbiBhbHRlcm5hdGl2ZSwgYSBsaXR0bGUgbW9yZSBjb21wbGV4IGltcGxlbWVudGF0aW9uIG9mIHRoZSBJRCBtb25hZC4gT25lXHJcbiAqIHdoaWNoIHdyYXBzIHRoZSBNIG1vbmFkIGludG8gYW5vdGhlciBwbGFpbiBvYmplY3QsIHNvIHRoZSB2YWx1ZSBvZiBNKEEpIGJlY29tZXNcclxuICogYHtpZENvbnRhaW5lcjogTSh7aWRWYWw6YX0pfWAuIE5vdGljZSB0aGF0IHRoZSB0cmFuc2Zvcm1lciBjb25zaXN0cyBvZiB0d28gcGFydHM6IG9uZSB3aGljaCBcclxuICogd3JhcHMgYXJvdW5kIHRoZSBob3N0IG1vbmFkLCBhbmQgb25lIHdoaWNoIHdyYXBzIGFyb3VuZCB0aGUgdmFsdWUgaW4gaXQuXHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZFdyYXBwZWQgPSB7XHJcbiAgbmFtZTogJ0lkV3JhcHBlZCcsXHJcblxyXG4gIC8vICh2YWwpID0+IHtpZENvbnRhaW5lcjogTSh7aWRWYWw6YX0pfVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsfSlcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoYSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfSwge2lkQ29udGFpbmVyOk0oe2lkVmFsOmF9KX0pID0+IHtpZENvbnRhaW5lcjpNKHtpZFZhbDphfSl9XHJcbiAgY2hhaW4gKGZuLCBpZENvbnRhaW5lck1JZFZhbCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaWRDb250YWluZXI6IHRoaXMub3V0ZXIuY2hhaW4oKGlkVmFsKSA9PiB7XHJcbiAgICAgICAgY29uc3QgdmFsID0gZm4oaWRWYWwuaWRWYWwpXHJcbiAgICAgICAgcmV0dXJuIHZhbC5pZENvbnRhaW5lclxyXG4gICAgICB9LCBpZENvbnRhaW5lck1JZFZhbC5pZENvbnRhaW5lcilcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoTSh2YWwpKSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6dmFsfSl9XHJcbiAgbGlmdCAobVZhbCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaWRDb250YWluZXI6IHRoaXMub3V0ZXIuY2hhaW4oKHZhbCkgPT4gdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbH0pLCBtVmFsKVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwge2lkQ29udGFpbmVyOiBNKHtpZFZhbDp2YWx9KSl9PT4gb3RoZXJWYWxcclxuICB2YWx1ZSAoZm4sIGlkQ29udGFpbmVyTUlkVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZSgoaWRWYWwpPT4ge1xyXG4gICAgICByZXR1cm4gZm4oaWRWYWwuaWRWYWwpXHJcbiAgICB9LCBpZENvbnRhaW5lck1JZFZhbC5pZENvbnRhaW5lcilcclxuICB9XHJcbn1cclxuXHJcbi8qIFRoZSBrZXkgZGlmZmVyZW5jZSBpcyB0aGF0IHdpdGggdGhpcyBtb25hZCBuZXN0aW5nIGhhcHBlbnMgYm90aCBpbnNpZGUgdGhlIGhvc3QgbW9uYWQgYW5kXHJcbiAqIG91dHNpZGUgb2YgaXQuIElmIHdlIGFwcGx5IHRoZSB0cmFuc2Zvcm1hdGlvbiB0d28gdGltZXMgdGhlIHZhbHVlIGJlY29tZXM6XHJcbiAqIGB7aWRDb250YWluZXI6e2lkQ29udGFpbmVyOk0oe2lkVmFsOntpZFZhbDphfX0pfX1gLlxyXG4gKi9cclxuIiwiLyogI092ZXJ2aWV3XHJcbiAqXHJcbiAqIFRoZSBwYWNrYWdlIGNvbnNpc3RzIG9mIHRoZSBmb2xsb3dpbmcgY29tcG9uZW50czpcclxuICogXHJcbiAqICMjIE9iamVjdCB3cmFwcGVyXHJcbiAqIFxyXG4gKiBUaGUgb2JqZWN0IHdyYXBwZXIsIGV4cG9zZWQgdmlhIHRoZSBgbXRsLm1ha2VgIGZ1bmN0aW9uLCBjb21iaW5lcyBvbmUgb3Igc2V2ZXJhbCBtb25hZCBcclxuICogdHJhbnNmb3JtZXIgZGVmaW5pdGlvbnMgYW5kIG1peGVzIHRoZW0gaW50byBvbmUgZmFudGFzeSBsYW5kLWNvbXBsaWVkIG1vbmFkLlxyXG4gKi9cclxuY29uc3QgbXRsID0ge31cclxubXRsLm1ha2UgPSByZXF1aXJlKCcuL3dyYXBwZXInKVxyXG5cclxuLyogIyMgTW9uYWQgdHJhbnNmb3JtZXIgZGVmaW5pdGlvbnNcclxuICogXHJcbiAqIFRoZSBsaWJyYXJ5IG9mZmVycyA0IG1vbmFkIHRyYW5zZm9ybWVyIGRlZmluaXRpb25zLCBkaXN0cmlidXRlZCBpbiB0d28gcGFja2FnZXM6XHJcbiAqIGBkYXRhYCBhbmQgYGNvbXBgLlxyXG4gKlxyXG4gKi9cclxubXRsLmRhdGEgPSByZXF1aXJlKCcuL2RhdGEnKVxyXG5tdGwuY29tcCA9IHJlcXVpcmUoJy4vY29tcCcpXHJcblxyXG5tdGwuYmFzZSA9IHJlcXVpcmUoJy4vYmFzZScpXHJcbm10bC5pZCA9IHJlcXVpcmUoJy4vaWQnKVxyXG5cclxuLyogIyMgUHJlZGVmaW5lZCBzdGFja3NcclxuICogXHJcbiAqIFRoZSBsaWJyYXJ5IGZlYXR1cmVzIGZpdmUgcHJlZGVmaW5lZCBtb25hZCBzdGFja3Mgd2hpY2ggc2VydmUgdGhlIG1vc3QgY29tbW9uIHVzZSBjYXNlcy5cclxuICpcclxuICovXHJcbm10bC5zaW1wbGUgPSBtdGwubWFrZShtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyKVxyXG5tdGwuc3RhdGVmdWwgPSBtdGwubWFrZShtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyLCBtdGwuY29tcC5zdGF0ZSlcclxubXRsLmxpc3QgPSBtdGwubWFrZShtdGwuZGF0YS5saXN0LCBtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyKVxyXG5tdGwuc3RhdGVsaXN0ID0gbXRsLm1ha2UobXRsLmRhdGEubGlzdCwgbXRsLmRhdGEubWF5YmUsIG10bC5kYXRhLndyaXRlciwgbXRsLmNvbXAuc3RhdGUpXHJcblxyXG5tdGwuYWR2YW5jZWQgPSBtdGwubWFrZShtdGwuYmFzZS50YXNrLCBtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyLCBtdGwuY29tcC5zdGF0ZSlcclxubXRsLmFkdmFuY2VkLnByb3RvdHlwZS5yZWplY3RlZE1hcCA9IGZ1bmN0aW9uKGZuKSB7XHJcbiAgcmV0dXJuIG10bC5hZHZhbmNlZCgoKSA9PiB0aGlzLl92YWx1ZSgpLnJlamVjdGVkTWFwKGZuKSlcclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IG10bFxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZVN0YWNrIChtb25hZFN0YWNrKSB7XHJcbiAgLy8gR2VuZXJhdGUgZXJyb3JzXHJcbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1RoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RhY2sgbWVtYmVyJylcclxuXHJcbiAgLy8gQWRkIHRoZSBJRCBtb25hZCBhdCB0aGUgYm90dG9tIG9mIHRoZSBtb25hZCBzdGFja1xyXG4gIGNvbnN0IHN0YWNrID0gW2lkUHJvdG9dLmNvbmNhdChtb25hZFN0YWNrKVxyXG5cclxuICBzdGFjay5mb3JFYWNoKG1lbWJlciA9PiB7XHJcbiAgICBpZiAodHlwZW9mIG1lbWJlciAhPT0gJ29iamVjdCcpIHt0aHJvdyBuZXcgRXJyb3IoJ1N0YWNrIG1lbWJlcnMgbXVzdCBiZSBvYmplY3RzJyl9XHJcbiAgfSlcclxuXHJcbiAgLy8gUGVyZm9ybSBzb21lIHByZXByb2Nlc3Npbmcgb24gdGhlIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2tQcm9jZXNzZWQgPSBwcm9jZXNzU3RhY2soc3RhY2spXHJcblxyXG4gIC8vIERlZmluZSB0aGUgbGlmdCBvcGVyYXRpb24gd2hpY2ggdGFrZXMgYSB2YWx1ZSBvZiBhIGdpdmVuIGxldmVsIG9mIHRoZSBzdGFjayBhbmQgbGlmdHMgaXQgdG8gdGhlIGxhc3QgbGV2ZWxcclxuICBjb25zdCBsaWZ0ID0gKHZhbCwgbGV2ZWwpID0+IHtcclxuICAgIC8vIEdldCB0aGUgc3RhY2sgcHJvdG90eXBlcyBmb3IgdGhlIHByZXZpb3VzIGFuZCB0aGUgbmV4dCBsZXZlbFxyXG4gICAgY29uc3QgbmV4dExldmVsID0gbGV2ZWwgKyAxXHJcbiAgICBjb25zdCBuZXh0TWVtYmVyID0gc3RhY2tQcm9jZXNzZWRbbGV2ZWwgKyAxXVxyXG4gICAgLy8gRG8gbm90IGRvIGFueXRoaW5nIGlmIHRoZSB2YWx1ZSBpcyBhbHJlYWR5IGF0IHRoZSBsYXN0IGxldmVsLlxyXG4gICAgaWYgKG5leHRNZW1iZXIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAvLyBQZXJmb3JtIHRoZSBsaWZ0IG9wZXJhdGlvbiBhdCB0aGUgbmVjZXNzYXJ5IGxldmVsXHJcbiAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5IHRvIGdldCB0byB0aGUgbmV4dCBvbmVcclxuICAgICAgcmV0dXJuIGxpZnQobmV4dE1lbWJlci5saWZ0KHZhbCksIG5leHRMZXZlbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiB2YWxcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFRha2VzIGZ1bmsgYW5kIGZyb20gaXQgY3JlYXRlcyBhIHN0YWNrIG9wZXJhdGlvblxyXG4gIGNvbnN0IG9wZXJhdGlvbiA9IChmdW5rKSA9PiB7XHJcbiAgICByZXR1cm4gKHByb3RvLCB2YWwpID0+IHtcclxuICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBsZXZlbCBvZiB0aGUgdmFsdWUsIGdpdmVuIHRoZSBwcm90b1xyXG4gICAgICBjb25zdCBsZXZlbCA9IHN0YWNrLmluZGV4T2YocHJvdG8pXHJcbiAgICAgIC8vIFRocm93IGFuIGVycm9yIGlmIHRoZSB2YWx1ZSBpcyBpbnZhbGlkXHJcbiAgICAgIGlmIChsZXZlbCA9PT0gLTEpIHt0aHJvdyBlcnJvcn1cclxuICAgICAgcmV0dXJuIGZ1bmsodmFsLCBsZXZlbClcclxuICAgIH1cclxuICB9XHJcbiAgLy8gRGlzcGF0Y2hlcyBhbiBvcGVyYXRpb24gdG8gdGhlIGNvcnJlY3Qgc3RhY2sgbGV2ZWxcclxuICBjb25zdCBmcm9tU3RhY2sgPSAobmFtZSkgPT4ge1xyXG4gICAgcmV0dXJuICh2YWwsIGxldmVsKSA9PiBzdGFja1Byb2Nlc3NlZFtsZXZlbF1bbmFtZV0odmFsKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGxpZnQ6IG9wZXJhdGlvbihsaWZ0KSxcclxuICAgIG9mOiBvcGVyYXRpb24oZnJvbVN0YWNrKCdvZicpKSxcclxuICAgIGNoYWluOiBvcGVyYXRpb24oZnJvbVN0YWNrKCdjaGFpbicpKSxcclxuICAgIGxhc3Q6IHN0YWNrUHJvY2Vzc2VkIFtzdGFja1Byb2Nlc3NlZC5sZW5ndGggLSAxXSxcclxuICAgIGlkOiBpZFByb3RvLFxyXG4gICAgX21lbWJlcnM6IHN0YWNrUHJvY2Vzc2VkXHJcbiAgfVxyXG59XHJcblxyXG5jb25zdCBwcm9jZXNzU3RhY2sgPSAoYmFzZVN0YWNrKSA9PlxyXG4gIHN0YXRlTWFwKGJhc2VTdGFjaywgKGl0ZW0sIHN0YXRlKSA9PiB7XHJcbiAgICBjb25zdCBwcmV2SXRlbVByb2Nlc3NlZCA9IHN0YXRlLnByZXZJdGVtUHJvY2Vzc2VkIHx8IGlkUHJvdG9cclxuICAgIC8vIEFwcGx5IHRoZSBwcm9jZXNzaW5nIGZ1bmN0aW9uIG9uIGVhY2ggc3RhY2sgbWVtYmVyXHJcbiAgICBjb25zdCBpdGVtUHJvY2Vzc2VkID0gcHJvY2Vzc1Byb3RvTmV3KGl0ZW0sIHByZXZJdGVtUHJvY2Vzc2VkKVxyXG4gICAgcmV0dXJuIFtcclxuICAgICAgICBpdGVtUHJvY2Vzc2VkLFxyXG4gICAgICB7XHJcbiAgICAgICAgcHJldkl0ZW1Qcm9jZXNzZWQ6IGl0ZW1Qcm9jZXNzZWRcclxuICAgICAgfVxyXG4gICAgXVxyXG4gIH0pXHJcblxyXG4vLyBBIHN0YXRlZnVsIHZlcnNpb24gb2YgdGhlIG1hcCBmdW5jdGlvbjpcclxuLy8gZiBhY2NlcHRzIGFuIGFycmF5IGl0ZW0gYW5kIGEgc3RhdGUoZGVmYXVsdHMgdG8gYW4gb2JqZWN0KSBhbmQgcmV0dXJucyB0aGUgcHJvY2Vzc2VkIHZlcnNpb24gb2YgdGhlIGl0ZW0gcGx1cyBhIG5ldyBzdGF0ZVxyXG5jb25zdCBzdGF0ZU1hcCA9IChhcnIsIGYpID0+XHJcbiAgYXJyLnJlZHVjZSgoYXJyYXlBbmRTdGF0ZSwgaXRlbSkgPT4ge1xyXG4gICAgY29uc3QgaXRlbUFuZFN0YXRlID0gKGYoaXRlbSwgYXJyYXlBbmRTdGF0ZVsxXSkpXHJcbiAgICByZXR1cm4gW2FycmF5QW5kU3RhdGVbMF0uY29uY2F0KFtpdGVtQW5kU3RhdGVbMF1dKSwgaXRlbUFuZFN0YXRlWzFdIF1cclxuICB9LCBbW10sIHt9XSlbMF1cclxuXHJcbmNvbnN0IGNsb25lID0gKG9iaikgPT4gT2JqZWN0LmtleXMob2JqKS5yZWR1Y2UoKG5ld09iaiwga2V5KSA9PiB7XHJcbiAgbmV3T2JqW2tleV0gPSBvYmpba2V5XVxyXG4gIHJldHVybiBuZXdPYmpcclxufSwge30pXHJcblxyXG5jb25zdCBwcm9jZXNzUHJvdG9OZXcgPSAocHJvdG8sIG91dGVyKSA9PiB7XHJcbiAgY29uc3QgcHJvdG9Qcm9jZXNzZWQgPSBjbG9uZShwcm90bylcclxuICBwcm90b1Byb2Nlc3NlZC5uYW1lID0gcHJvdG8ubmFtZSArICcvJyArIG91dGVyLm5hbWVcclxuICBwcm90b1Byb2Nlc3NlZC5vdXRlciA9IG91dGVyXHJcbiAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgc28gd2UgY2FuIGRvIHR5cGVjaGVja3MgYW5kIHJvdXRlIG1ldGhvZCBjYWxsc1xyXG4gIHByb3RvUHJvY2Vzc2VkLm9yaWdpbmFsID0gcHJvdG9cclxuICByZXR1cm4gcHJvdG9Qcm9jZXNzZWRcclxufVxyXG5cclxuLy8gVGhlIGlkZW50aXR5IG1vbmFkLCB3aGljaCBsaWVzIGF0IHRoZSBib3R0b20gb2YgZWFjaCBzdGFja1xyXG5jb25zdCBpZFByb3RvID0ge1xyXG4gIG5hbWU6ICdyb290JyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gZnVuayh2YWwpXHJcbiAgfSxcclxuICBtYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH1cclxufVxyXG4iLCJjb25zdCBjcmVhdGVTdGFjayA9IHJlcXVpcmUoJy4vc3RhY2snKVxuXG4vLyBPYmplY3QuYXNzaWduIHBvbHlmaWxcbmlmICghT2JqZWN0LmFzc2lnbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoT2JqZWN0LCAnYXNzaWduJywge1xuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogZnVuY3Rpb24gKHRhcmdldCkge1xuICAgICAgJ3VzZSBzdHJpY3QnXG4gICAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IGZpcnN0IGFyZ3VtZW50IHRvIG9iamVjdCcpXG4gICAgICB9XG5cbiAgICAgIHZhciB0byA9IE9iamVjdCh0YXJnZXQpXG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgbmV4dFNvdXJjZSA9IGFyZ3VtZW50c1tpXVxuICAgICAgICBpZiAobmV4dFNvdXJjZSA9PT0gdW5kZWZpbmVkIHx8IG5leHRTb3VyY2UgPT09IG51bGwpIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIG5leHRTb3VyY2UgPSBPYmplY3QobmV4dFNvdXJjZSlcblxuICAgICAgICB2YXIga2V5c0FycmF5ID0gT2JqZWN0LmtleXMobmV4dFNvdXJjZSlcbiAgICAgICAgZm9yICh2YXIgbmV4dEluZGV4ID0gMCwgbGVuID0ga2V5c0FycmF5Lmxlbmd0aDsgbmV4dEluZGV4IDwgbGVuOyBuZXh0SW5kZXgrKykge1xuICAgICAgICAgIHZhciBuZXh0S2V5ID0ga2V5c0FycmF5W25leHRJbmRleF1cbiAgICAgICAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobmV4dFNvdXJjZSwgbmV4dEtleSlcbiAgICAgICAgICBpZiAoZGVzYyAhPT0gdW5kZWZpbmVkICYmIGRlc2MuZW51bWVyYWJsZSkge1xuICAgICAgICAgICAgdG9bbmV4dEtleV0gPSBuZXh0U291cmNlW25leHRLZXldXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdG9cbiAgICB9XG4gIH0pXG59XG5cbi8vIENoZWNrcyBpZiBhIGdpdmVuIHByb3BlcnR5IGlzIHBhcnQgb2YgdGhlIGdlbmVyYWwgbW9uYWQgZGVmaW5pdGlvbiBpbnRlcmZhY2VcbmNvbnN0IGlzUmVzZXJ2ZXJNb25hZEtleSA9IChrZXkpID0+IGtleSAhPT0gJ25hbWUnICYmIGtleSAhPT0gJ21hcCcgJiYga2V5ICE9PSAnb2YnICYmIGtleSAhPT0gJ2NoYWluJyAmJiBrZXkgIT09ICdsaWZ0JyAmJiBrZXkgIT09ICd2YWx1ZSdcblxuLy8gTWFwcyB0aGUgdmFsdWVzIG9mIGEgZ2l2ZW4gb2JqIGV4Y2x1ZGluZyB0aGUgcmVzZXJ2ZWQgb25lcy5cbmNvbnN0IG1vbmFkTWFwVmFscyA9IChmdW5rLCBvYmopID0+IHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iailcbiAgICAuZmlsdGVyKGlzUmVzZXJ2ZXJNb25hZEtleSlcbiAgICAucmVkdWNlKChuZXdPYmosIGtleSkgPT4ge1xuICAgICAgbmV3T2JqW2tleV0gPSBmdW5rKG9ialtrZXldLCBvYmopXG4gICAgICByZXR1cm4gbmV3T2JqXG4gICAgfSwge30pXG59XG5cbi8vIFVud3JhcHMgYSB3cmFwcGVkIHZhbHVlXG5jb25zdCB1bndyYXAgPSAodmFsKSA9PiB7XG4gIGlmICghdmFsLmhhc093blByb3BlcnR5KCdfdmFsdWUnKSkge3Rocm93IEpTT04uc3RyaW5naWZ5KHZhbCkgKyAnIGlzIG5vdCBhIHdyYXBwZWQgdmFsdWUnfVxuICByZXR1cm4gdmFsLl92YWx1ZVxufVxuXG4vLyBXcmFwcyBhIHZhbHVlIGluIGEgc3BlY2lmaWVkIHByb3RvdHlwZVxuY29uc3Qgd3JhcFZhbCA9IChwcm90bywgdmFsKSA9PiB7XG4gIHZhciBvYmogPSBPYmplY3QuY3JlYXRlKHByb3RvKVxuICBvYmouX3ZhbHVlID0gdmFsXG4gIHJldHVybiBPYmplY3QuZnJlZXplKG9iailcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtYWtlX21vbmFkICgpIHtcbiAgLy8gSW5pdGlsaXplIHRoZSBzdGFjayBjb21wb25lbnQsIHRoYXQgYWN0dWFsbHkgZG9lcyBtb3N0IG9mIHRoZSB3b3JrXG4gIGNvbnN0IHN0YWNrID0gY3JlYXRlU3RhY2soQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSlcblxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXG4gIGNvbnN0IGJhc2VTdGFja1Byb3RvID0ge1xuICAgIHN0YWNrOiBzdGFjayxcbiAgICBwcm90b3R5cGU6IHRoaXMucHJvdG90eXBlLFxuICAgIC8vIEFkZCBjaGFpbiBmdW5jdGlvblxuICAgIGNoYWluIChmdW5rKSB7XG4gICAgICBjb25zdCBmdW5rQW5kVW53cmFwID0gKHZhbCkgPT4gdW53cmFwKGZ1bmsodmFsKSlcbiAgICAgIGlmICghcHJvY2Vzcy5kZWJ1Zykge1xuICAgICAgICBmdW5rQW5kVW53cmFwLnRvU3RyaW5nID0gKCkgPT4gJ3Vud3JhcCgnICsgZnVuay50b1N0cmluZygpICsgJyknXG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxhc3QuY2hhaW4oZnVua0FuZFVud3JhcCwgdGhpcy5fdmFsdWUpKVxuICAgIH0sXG4gICAgbGlmdCAocHJvdG8sIHZhbCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5saWZ0KHByb3RvLCB2YWwpKVxuICAgIH0sXG4gICAgLy8gQWRkICdtYXAnIGFuZCAnb2YnIGZ1bmN0aW9uc1xuICAgIG9mICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5sYXN0Lm9mKHZhbHVlKSlcbiAgICB9LFxuICAgIG1hcCAoZnVuaykge1xuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxuICAgIH0sXG4gICAgdGFwIChmdW5rKSB7XG4gICAgICByZXR1cm4gZnVuayh0aGlzKVxuICAgIH0sXG4gICAgdmFsdWUgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrICE9PSB1bmRlZmluZWQgPyBjYWxsYmFjayA6IGEgPT4gYVxuICAgICAgcmV0dXJuIHN0YWNrLmxhc3QudmFsdWUoY2FsbGJhY2ssIHRoaXMuX3ZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIC8vIFByb21vdGVzIGEgbWV0aG9kIGZyb20gYSBtb25hZCBkZWZpbml0aW9uIHNvIGl0IGNhbiBiZSB1c2VkIGZvciBjaGFpbmluZ1xuICBjb25zdCB0b0luc3RhbmNlID0gKGZ1bmssIG91dGVyKSA9PiBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB7XG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQob3V0ZXIub3JpZ2luYWwsIGZ1bmsuYXBwbHkob3V0ZXIsIGFyZ3MuY29uY2F0KFt2YWxdKSkpKVxuICAgIH0pXG4gIH1cblxuICAvLyBBdWdtZW50IHRoZSBzdGFjayBwcm90b3R5cGUgd2l0aCBoZWxwZXIgbWV0aG9kc1xuICBjb25zdCBzdGFja1Byb3RvID0gT2JqZWN0LmFzc2lnbi5hcHBseShudWxsLCBbYmFzZVN0YWNrUHJvdG9dLmNvbmNhdChzdGFjay5fbWVtYmVycy5tYXAobW9uYWQgPT4gbW9uYWRNYXBWYWxzKHRvSW5zdGFuY2UsIG1vbmFkKSkpKVxuXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IG9iamVjdCBhbmQgd3JhcHMgaXQgaW4gdGhlIHN0YWNrIHByb3RvdHlwZVxuICBjb25zdCBjcmVhdGUgPSAodmFsKSA9PiB7XG4gICAgcmV0dXJuIHdyYXBWYWwoc3RhY2tQcm90bywgdmFsKVxuICB9XG5cbiAgLy8gQWRkIHJlbGV2YW50IG1ldGhvZHMgZnJvbSB0aGUgbW9uYWRpYyBpbnRlcmZhY2UgdG8gdGhlIHN0YWNrIGNvbnN0cnVjdG9yXG4gIGNyZWF0ZS5vZiA9IHN0YWNrUHJvdG8ub2ZcbiAgY3JlYXRlLmxpZnQgPSBzdGFja1Byb3RvLmxpZnRcbiAgY3JlYXRlLnByb3RvdHlwZSA9IHN0YWNrUHJvdG9cblxuICAvLyBQcm9tb3RlcyBhIG1ldGhvZCBmcm9tIGEgbW9uYWQgZGVmaW5pdGlvbiBzbyBpdCBjYW4gYmUgdXNlZCBhcyBhIHN0YXRpYyBtZXRob2RcbiAgY29uc3QgdG9Db25zdHJ1Y3RvciA9IChmdW5rLCBvdXRlcikgPT4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChvdXRlci5vcmlnaW5hbCwgZnVuay5hcHBseShvdXRlciwgYXJndW1lbnRzKSkpXG4gIH1cbiAgLy8gQXVnbWVudCB0aGUgc3RhY2sgY29uc3RydWN0b3Igd2l0aCBoZWxwZXIgbWV0aG9kc1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbi5hcHBseShudWxsLCBbY3JlYXRlXS5jb25jYXQoc3RhY2suX21lbWJlcnMubWFwKG1vbmFkID0+IG1vbmFkTWFwVmFscyh0b0NvbnN0cnVjdG9yLCBtb25hZCkpKSlcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi90YXNrJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cblxuLyoqXG4gKiBBIGhlbHBlciBmb3IgZGVsYXlpbmcgdGhlIGV4ZWN1dGlvbiBvZiBhIGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqIEBzdW1tYXJ5IChBbnkuLi4gLT4gQW55KSAtPiBWb2lkXG4gKi9cbnZhciBkZWxheWVkID0gdHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gJ3VuZGVmaW5lZCc/ICBzZXRJbW1lZGlhdGVcbiAgICAgICAgICAgIDogdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnPyAgICAgICBwcm9jZXNzLm5leHRUaWNrXG4gICAgICAgICAgICA6IC8qIG90aGVyd2lzZSAqLyAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dFxuXG4vKipcbiAqIEBtb2R1bGUgbGliL3Rhc2tcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBUYXNrO1xuXG4vLyAtLSBJbXBsZW1lbnRhdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBUaGUgYFRhc2tbzrEsIM6yXWAgc3RydWN0dXJlIHJlcHJlc2VudHMgdmFsdWVzIHRoYXQgZGVwZW5kIG9uIHRpbWUuIFRoaXNcbiAqIGFsbG93cyBvbmUgdG8gbW9kZWwgdGltZS1iYXNlZCBlZmZlY3RzIGV4cGxpY2l0bHksIHN1Y2ggdGhhdCBvbmUgY2FuIGhhdmVcbiAqIGZ1bGwga25vd2xlZGdlIG9mIHdoZW4gdGhleSdyZSBkZWFsaW5nIHdpdGggZGVsYXllZCBjb21wdXRhdGlvbnMsIGxhdGVuY3ksXG4gKiBvciBhbnl0aGluZyB0aGF0IGNhbiBub3QgYmUgY29tcHV0ZWQgaW1tZWRpYXRlbHkuXG4gKlxuICogQSBjb21tb24gdXNlIGZvciB0aGlzIHN0cnVjdHVyZSBpcyB0byByZXBsYWNlIHRoZSB1c3VhbCBDb250aW51YXRpb24tUGFzc2luZ1xuICogU3R5bGUgZm9ybSBvZiBwcm9ncmFtbWluZywgaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBjb21wb3NlIGFuZCBzZXF1ZW5jZVxuICogdGltZS1kZXBlbmRlbnQgZWZmZWN0cyB1c2luZyB0aGUgZ2VuZXJpYyBhbmQgcG93ZXJmdWwgbW9uYWRpYyBvcGVyYXRpb25zLlxuICpcbiAqIEBjbGFzc1xuICogQHN1bW1hcnlcbiAqICgozrEg4oaSIFZvaWQpLCAozrIg4oaSIFZvaWQpIOKGkiBWb2lkKSwgKFZvaWQg4oaSIFZvaWQpIOKGkiBUYXNrW86xLCDOsl1cbiAqXG4gKiBUYXNrW86xLCDOsl0gPDogQ2hhaW5bzrJdXG4gKiAgICAgICAgICAgICAgICwgTW9uYWRbzrJdXG4gKiAgICAgICAgICAgICAgICwgRnVuY3RvclvOsl1cbiAqICAgICAgICAgICAgICAgLCBBcHBsaWNhdGl2ZVvOsl1cbiAqICAgICAgICAgICAgICAgLCBTZW1pZ3JvdXBbzrJdXG4gKiAgICAgICAgICAgICAgICwgTW9ub2lkW86yXVxuICogICAgICAgICAgICAgICAsIFNob3dcbiAqL1xuZnVuY3Rpb24gVGFzayhjb21wdXRhdGlvbiwgY2xlYW51cCkge1xuICB0aGlzLmZvcmsgPSBjb21wdXRhdGlvbjtcblxuICB0aGlzLmNsZWFudXAgPSBjbGVhbnVwIHx8IGZ1bmN0aW9uKCkge307XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIG5ldyBgVGFza1vOsSwgzrJdYCBjb250YWluaW5nIHRoZSBzaW5nbGUgdmFsdWUgYM6yYC5cbiAqXG4gKiBgzrJgIGNhbiBiZSBhbnkgdmFsdWUsIGluY2x1ZGluZyBgbnVsbGAsIGB1bmRlZmluZWRgLCBvciBhbm90aGVyXG4gKiBgVGFza1vOsSwgzrJdYCBzdHJ1Y3R1cmUuXG4gKlxuICogQHN1bW1hcnkgzrIg4oaSIFRhc2tbzrEsIM6yXVxuICovXG5UYXNrLnByb3RvdHlwZS5vZiA9IGZ1bmN0aW9uIF9vZihiKSB7XG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihfLCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoYik7XG4gIH0pO1xufTtcblxuVGFzay5vZiA9IFRhc2sucHJvdG90eXBlLm9mO1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBuZXcgYFRhc2tbzrEsIM6yXWAgY29udGFpbmluZyB0aGUgc2luZ2xlIHZhbHVlIGDOsWAuXG4gKlxuICogYM6xYCBjYW4gYmUgYW55IHZhbHVlLCBpbmNsdWRpbmcgYG51bGxgLCBgdW5kZWZpbmVkYCwgb3IgYW5vdGhlclxuICogYFRhc2tbzrEsIM6yXWAgc3RydWN0dXJlLlxuICpcbiAqIEBzdW1tYXJ5IM6xIOKGkiBUYXNrW86xLCDOsl1cbiAqL1xuVGFzay5wcm90b3R5cGUucmVqZWN0ZWQgPSBmdW5jdGlvbiBfcmVqZWN0ZWQoYSkge1xuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0KSB7XG4gICAgcmV0dXJuIHJlamVjdChhKTtcbiAgfSk7XG59O1xuXG5UYXNrLnJlamVjdGVkID0gVGFzay5wcm90b3R5cGUucmVqZWN0ZWQ7XG5cbi8vIC0tIEZ1bmN0b3IgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgdGhlIHN1Y2Nlc3NmdWwgdmFsdWUgb2YgdGhlIGBUYXNrW86xLCDOsl1gIHVzaW5nIGEgcmVndWxhciB1bmFyeVxuICogZnVuY3Rpb24uXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiAozrIg4oaSIM6zKSDihpIgVGFza1vOsSwgzrNdXG4gKi9cblRhc2sucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIF9tYXAoZikge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZWplY3QoYSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZihiKSk7XG4gICAgfSk7XG4gIH0sIGNsZWFudXApO1xufTtcblxuLy8gLS0gQ2hhaW4gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogVHJhbnNmb3JtcyB0aGUgc3VjY2VzZnVsIHZhbHVlIG9mIHRoZSBgVGFza1vOsSwgzrJdYCB1c2luZyBhIGZ1bmN0aW9uIHRvIGFcbiAqIG1vbmFkLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6yIOKGkiBUYXNrW86xLCDOs10pIOKGkiBUYXNrW86xLCDOs11cbiAqL1xuVGFzay5wcm90b3R5cGUuY2hhaW4gPSBmdW5jdGlvbiBfY2hhaW4oZikge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZWplY3QoYSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIGYoYikuZm9yayhyZWplY3QsIHJlc29sdmUpO1xuICAgIH0pO1xuICB9LCBjbGVhbnVwKTtcbn07XG5cbi8vIC0tIEFwcGx5IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEFwcGx5cyB0aGUgc3VjY2Vzc2Z1bCB2YWx1ZSBvZiB0aGUgYFRhc2tbzrEsICjOsiDihpIgzrMpXWAgdG8gdGhlIHN1Y2Nlc3NmdWxcbiAqIHZhbHVlIG9mIHRoZSBgVGFza1vOsSwgzrJdYFxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCAozrIg4oaSIM6zKV0gPT4gVGFza1vOsSwgzrJdIOKGkiBUYXNrW86xLCDOs11cbiAqL1xuXG5UYXNrLnByb3RvdHlwZS5hcCA9IGZ1bmN0aW9uIF9hcChmMikge1xuICByZXR1cm4gdGhpcy5jaGFpbihmdW5jdGlvbihmKSB7XG4gICAgcmV0dXJuIGYyLm1hcChmKTtcbiAgfSk7XG59O1xuXG4vLyAtLSBTZW1pZ3JvdXAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogU2VsZWN0cyB0aGUgZWFybGllciBvZiB0aGUgdHdvIHRhc2tzIGBUYXNrW86xLCDOsl1gXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiBUYXNrW86xLCDOsl0g4oaSIFRhc2tbzrEsIM6yXVxuICovXG5cblRhc2sucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIF9jb25jYXQodGhhdCkge1xuICB2YXIgZm9ya1RoaXMgPSB0aGlzLmZvcms7XG4gIHZhciBmb3JrVGhhdCA9IHRoYXQuZm9yaztcbiAgdmFyIGNsZWFudXBUaGlzID0gdGhpcy5jbGVhbnVwO1xuICB2YXIgY2xlYW51cFRoYXQgPSB0aGF0LmNsZWFudXA7XG5cbiAgZnVuY3Rpb24gY2xlYW51cEJvdGgoc3RhdGUpIHtcbiAgICBjbGVhbnVwVGhpcyhzdGF0ZVswXSk7XG4gICAgY2xlYW51cFRoYXQoc3RhdGVbMV0pO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHZhciBkb25lID0gZmFsc2U7XG4gICAgdmFyIGFsbFN0YXRlO1xuICAgIHZhciB0aGlzU3RhdGUgPSBmb3JrVGhpcyhndWFyZChyZWplY3QpLCBndWFyZChyZXNvbHZlKSk7XG4gICAgdmFyIHRoYXRTdGF0ZSA9IGZvcmtUaGF0KGd1YXJkKHJlamVjdCksIGd1YXJkKHJlc29sdmUpKTtcblxuICAgIHJldHVybiBhbGxTdGF0ZSA9IFt0aGlzU3RhdGUsIHRoYXRTdGF0ZV07XG5cbiAgICBmdW5jdGlvbiBndWFyZChmKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oeCkge1xuICAgICAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICBkZWxheWVkKGZ1bmN0aW9uKCl7IGNsZWFudXBCb3RoKGFsbFN0YXRlKSB9KVxuICAgICAgICAgIHJldHVybiBmKHgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSwgY2xlYW51cEJvdGgpO1xuXG59O1xuXG4vLyAtLSBNb25vaWQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogUmV0dXJucyBhIFRhc2sgdGhhdCB3aWxsIG5ldmVyIHJlc29sdmVcbiAqXG4gKiBAc3VtbWFyeSBWb2lkIOKGkiBUYXNrW86xLCBfXVxuICovXG5UYXNrLmVtcHR5ID0gZnVuY3Rpb24gX2VtcHR5KCkge1xuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24oKSB7fSk7XG59O1xuXG5UYXNrLnByb3RvdHlwZS5lbXB0eSA9IFRhc2suZW1wdHk7XG5cbi8vIC0tIFNob3cgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFJldHVybnMgYSB0ZXh0dWFsIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBgVGFza1vOsSwgzrJdYFxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gVm9pZCDihpIgU3RyaW5nXG4gKi9cblRhc2sucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gX3RvU3RyaW5nKCkge1xuICByZXR1cm4gJ1Rhc2snO1xufTtcblxuLy8gLS0gRXh0cmFjdGluZyBhbmQgcmVjb3ZlcmluZyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogVHJhbnNmb3JtcyBhIGZhaWx1cmUgdmFsdWUgaW50byBhIG5ldyBgVGFza1vOsSwgzrJdYC4gRG9lcyBub3RoaW5nIGlmIHRoZVxuICogc3RydWN0dXJlIGFscmVhZHkgY29udGFpbnMgYSBzdWNjZXNzZnVsIHZhbHVlLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiBUYXNrW86zLCDOsl0pIOKGkiBUYXNrW86zLCDOsl1cbiAqL1xuVGFzay5wcm90b3R5cGUub3JFbHNlID0gZnVuY3Rpb24gX29yRWxzZShmKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIGYoYSkuZm9yayhyZWplY3QsIHJlc29sdmUpO1xuICAgIH0sIGZ1bmN0aW9uKGIpIHtcbiAgICAgIHJldHVybiByZXNvbHZlKGIpO1xuICAgIH0pO1xuICB9LCBjbGVhbnVwKTtcbn07XG5cbi8vIC0tIEZvbGRzIGFuZCBleHRlbmRlZCB0cmFuc2Zvcm1hdGlvbnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIENhdGFtb3JwaGlzbS4gVGFrZXMgdHdvIGZ1bmN0aW9ucywgYXBwbGllcyB0aGUgbGVmdG1vc3Qgb25lIHRvIHRoZSBmYWlsdXJlXG4gKiB2YWx1ZSwgYW5kIHRoZSByaWdodG1vc3Qgb25lIHRvIHRoZSBzdWNjZXNzZnVsIHZhbHVlLCBkZXBlbmRpbmcgb24gd2hpY2ggb25lXG4gKiBpcyBwcmVzZW50LlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiDOsyksICjOsiDihpIgzrMpIOKGkiBUYXNrW860LCDOs11cbiAqL1xuVGFzay5wcm90b3R5cGUuZm9sZCA9IGZ1bmN0aW9uIF9mb2xkKGYsIGcpIHtcbiAgdmFyIGZvcmsgPSB0aGlzLmZvcms7XG4gIHZhciBjbGVhbnVwID0gdGhpcy5jbGVhbnVwO1xuXG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihyZWplY3QsIHJlc29sdmUpIHtcbiAgICByZXR1cm4gZm9yayhmdW5jdGlvbihhKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShmKGEpKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShnKGIpKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vKipcbiAqIENhdGFtb3JwaGlzbS5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+IHsgUmVqZWN0ZWQ6IM6xIOKGkiDOsywgUmVzb2x2ZWQ6IM6yIOKGkiDOsyB9IOKGkiBUYXNrW860LCDOs11cbiAqL1xuVGFzay5wcm90b3R5cGUuY2F0YSA9IGZ1bmN0aW9uIF9jYXRhKHBhdHRlcm4pIHtcbiAgcmV0dXJuIHRoaXMuZm9sZChwYXR0ZXJuLlJlamVjdGVkLCBwYXR0ZXJuLlJlc29sdmVkKTtcbn07XG5cbi8qKlxuICogU3dhcHMgdGhlIGRpc2p1bmN0aW9uIHZhbHVlcy5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+IFZvaWQg4oaSIFRhc2tbzrIsIM6xXVxuICovXG5UYXNrLnByb3RvdHlwZS5zd2FwID0gZnVuY3Rpb24gX3N3YXAoKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUoYSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlamVjdChiKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vKipcbiAqIE1hcHMgYm90aCBzaWRlcyBvZiB0aGUgZGlzanVuY3Rpb24uXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiAozrEg4oaSIM6zKSwgKM6yIOKGkiDOtCkg4oaSIFRhc2tbzrMsIM60XVxuICovXG5UYXNrLnByb3RvdHlwZS5iaW1hcCA9IGZ1bmN0aW9uIF9iaW1hcChmLCBnKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlamVjdChmKGEpKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShnKGIpKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vKipcbiAqIE1hcHMgdGhlIGxlZnQgc2lkZSBvZiB0aGUgZGlzanVuY3Rpb24gKGZhaWx1cmUpLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiDOsykg4oaSIFRhc2tbzrMsIM6yXVxuICovXG5UYXNrLnByb3RvdHlwZS5yZWplY3RlZE1hcCA9IGZ1bmN0aW9uIF9yZWplY3RlZE1hcChmKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlamVjdChmKGEpKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShiKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iXX0=
