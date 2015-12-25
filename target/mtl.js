/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	/* #Overview
	 *
	 * The package consists of the following components:
	 * 
	 * ## Object wrapper
	 * 
	 * The [object wrapper](wrapper.md), exposed via the `mtl.make` function, combines one or several monad 
	 * transformer definitions and mixes them into one 
	 * [Fantasy Land compliant](https://github.com/fantasyland/fantasy-land) monad.
	 */
	var mtl = {};
	mtl.make = __webpack_require__(1);
	
	/* ## Monad transformer definitions
	 * 
	 * The library contains four [monad transformer definitions](api.md), distributed in two packages:
	 * `data` and `comp`. It also contains three versions of the identity monad transformer, useful
	 * as a reference when implementing (custom monad transformers)[implementing-transformer.md].
	 *
	 */
	mtl.data = __webpack_require__(4);
	mtl.comp = __webpack_require__(5);
	mtl.id = __webpack_require__(6);
	
	/* ## Base monads
	 * 
	 * When stacking monad transformers, a you must place one plain monad at the bottom of the stack.
	 * This monad serves as the stack's base. 
	 *
	 * By default, the package uses the identity monad as a base but it also defines a wrapper which
	 * allow you to use the [Task monad](https://github.com/folktale/data.task) from Folktale as a base.
	 */
	
	mtl.base = __webpack_require__(7);
	
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
	/*
	 * [_View in GitHub_](../lib/main.js)
	 */

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';
	
	/* # The object wrapper
	 *
	 * The library provides a module which allows you to combine several monad transformer definitions
	 * and create a object-oriented wrapper for using the resulting monad.
	 * 
	 * ## Creating a monad constructor
	 *
	 * You can create a monad constructor using the `mtl.make` function:
	 *
	 * ###`mtl.make([baseMonad], monadTransformer1, monadTransformer2)`
	 *
	 * ####`baseMonad (monadDefinition)`
	 *
	 * Optionally you can pass the definition of the monad that would sit at the bottom of the stack, 
	 * as a first argument of the `make` function.
	 *
	 * The parameter is optional. By default, the package uses the identity monad as a base.
	 *
	 * ####`monadTransformer<1-n> (monadTransformerDefinition)`
	 *
	 * Pass the definitions of the monad transformers which would augment the base monad. 
	 * Note that monad transformations are usually not commutative, so the order in which the arguments
	 * are placed matters.
	 *
	 * The function returns an `objectWrapper` which allows you instantiate monads from all kinds of values.
	 *
	 * ## Creating monads
	 *
	 * Monads are generally created using [type-specific methods](api.md) like `fromArray` (for stacks that include the
	 * list transformation, or `fromState` (for stateful computations), but for the sake of completeness
	 * several generic methods are also provided.
	 *
	 * ### `objectWrapper.of(value)`
	 *
	 * Constructs a monad from a plain non-monadic value.
	 *
	 * ### `objectWrapper.lift(monadTransformerDefinition, value)`
	 *
	 * Constructs a monad from a value created at a higher level of the stack. See 
	 * [this article](https://en.wikibooks.org/wiki/Haskell/Monad_transformers#Lifting) for more information.
	 *
	 * ### `objectWrapper(value)`
	 *
	 * Constructs a monad from a value which obeys the structure of the monad stack i.e. "wraps" the value
	 * into a monadic interface.
	 *
	 * ## Using monads
	 *
	 * Again there are many methods that you would use to manipulate a monad which are [type-specific](api.md). 
	 * Here are the generic ones:
	 *
	 * ###`monad.map(f)`
	 *
	 * Applies `f` to the value or values that are inside the monad and wraps the resulting value in a new monad instance.
	 *
	 * ###`monad.chain(f)`
	 *
	 * Applies `f` to the value or values that are inside the monad and returns a new monad instance
	 *
	 * ###`monad.tap(f)`
	 *
	 * Applies the f to the monad and returns the result.
	 *
	 * ###`monad.value()`
	 *
	 * Runs the computation inside the monad and returns its value, if applicable.
	 *
	 * For more information, see the [Fantasy Land spec](https://github.com/fantasyland/fantasy-land).
	 *
	 * ## Source
	 */
	var createStack = __webpack_require__(3);
	
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
	
	module.exports = function make() {
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
	
	  // Promotes a method from a monad definition so it can be used as a static method
	  var toConstructor = function toConstructor(funk, outer) {
	    return function () {
	      return create(stack.lift(outer.original, funk.apply(outer, arguments)));
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
	
	  // Augment the stack constructor with helper methods
	  return Object.assign.apply(null, [create].concat(stack._members.map(function (monad) {
	    return monadMapVals(toConstructor, monad);
	  })));
	};
	
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
	
	/*
	 * [_View in GitHub_](../lib/wrapper.js)
	 */
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(2)))

/***/ },
/* 2 */
/***/ function(module, exports) {

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


/***/ },
/* 3 */
/***/ function(module, exports) {

	'use strict';
	
	function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }
	
	module.exports = function createStack(monadStack) {
	  // Generate errors
	  var error = new Error('The first argument must be a stack member');
	
	  // Add the ID monad at the bottom of the monad stack
	  var stack = [idProto].concat(monadStack);
	
	  stack.forEach(function (member) {
	    if ((typeof member === 'undefined' ? 'undefined' : _typeof(member)) !== 'object') {
	      throw new Error('Stack members must be objects');
	    }
	  });
	
	  // Perform some preprocessing on the stack
	  var stackProcessed = processStack(stack);
	
	  // Define the lift operation which takes a value of a given level of the stack and lifts it to the last level
	  var lift = function lift(val, level) {
	    // Get the stack prototypes for the next level
	    var nextLevel = level + 1;
	    var nextMember = stackProcessed[level + 1];
	    // Do not do anything if the value is already at the last level.
	    if (nextMember !== undefined) {
	      // Perform the lift operation at the necessary level
	      // Call the function recursively to get to the next one
	      return lift(nextMember.lift(val), nextLevel);
	    } else {
	      return val;
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
	    var prevItemProcessed = state || idProto;
	    // Apply the processing function on each stack member
	    var itemProcessed = processProtoNew(item, prevItemProcessed);
	    return [itemProcessed, itemProcessed];
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

/***/ },
/* 4 */
/***/ function(module, exports) {

	'use strict';
	
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
	 * ### `value.maybeMap(f)`
	 * 
	 * Chains a function that returns a `maybe` value in the computation
	 *
	 * ### Definition
	 *
	 * ![Maybe](img/maybe.png)
	 *
	 * ### Source
	 */
	
	//TODO use this
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
	/* 
	 * [_View in GitHub_](../lib/data.js)
	 */
	
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
	/* 
	 * [_View in GitHub_](../lib/data.js)
	 */
	
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
	 * ### Definition
	 *
	 * ![Writer](img/writer.png)
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
	/* 
	 * [_View in GitHub_](../lib/data.js)
	 */

/***/ },
/* 5 */
/***/ function(module, exports) {

	'use strict';
	
	/* ## `comp.state`
	 * 
	 * The `state` monad transformer allows you to keep one additional state value
	 * with your computation.
	 *
	 * ### Definition
	 *
	 * ![State](img/state.png)
	 *
	 * ###Source
	 */
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
	
	/* 
	 * [_View in GitHub_](../lib/comp.js)
	 */
	
	/* ## References
	 * 
	 * All images, taken from [the Wikipedia article on monad transformers](https://en.wikipedia.org/wiki/Monad_transformer).
	 */

/***/ },
/* 6 */
/***/ function(module, exports) {

	'use strict';
	
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
	
	/*
	 * [_View in GitHub_](../lib/id.js)
	 */

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var Task = __webpack_require__(8);
	
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

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(9);


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate, process) {'use strict';
	
	
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(10).setImmediate, __webpack_require__(2)))

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate, clearImmediate) {var nextTick = __webpack_require__(2).nextTick;
	var apply = Function.prototype.apply;
	var slice = Array.prototype.slice;
	var immediateIds = {};
	var nextImmediateId = 0;
	
	// DOM APIs, for completeness
	
	exports.setTimeout = function() {
	  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
	};
	exports.setInterval = function() {
	  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
	};
	exports.clearTimeout =
	exports.clearInterval = function(timeout) { timeout.close(); };
	
	function Timeout(id, clearFn) {
	  this._id = id;
	  this._clearFn = clearFn;
	}
	Timeout.prototype.unref = Timeout.prototype.ref = function() {};
	Timeout.prototype.close = function() {
	  this._clearFn.call(window, this._id);
	};
	
	// Does not start the time, just sets up the members needed.
	exports.enroll = function(item, msecs) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = msecs;
	};
	
	exports.unenroll = function(item) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = -1;
	};
	
	exports._unrefActive = exports.active = function(item) {
	  clearTimeout(item._idleTimeoutId);
	
	  var msecs = item._idleTimeout;
	  if (msecs >= 0) {
	    item._idleTimeoutId = setTimeout(function onTimeout() {
	      if (item._onTimeout)
	        item._onTimeout();
	    }, msecs);
	  }
	};
	
	// That's not how node.js implements it but the exposed api is the same.
	exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
	  var id = nextImmediateId++;
	  var args = arguments.length < 2 ? false : slice.call(arguments, 1);
	
	  immediateIds[id] = true;
	
	  nextTick(function onNextTick() {
	    if (immediateIds[id]) {
	      // fn.call() is faster so we optimize for the common use-case
	      // @see http://jsperf.com/call-apply-segu
	      if (args) {
	        fn.apply(null, args);
	      } else {
	        fn.call(null);
	      }
	      // Prevent ids from leaking
	      exports.clearImmediate(id);
	    }
	  });
	
	  return id;
	};
	
	exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
	  delete immediateIds[id];
	};
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(10).setImmediate, __webpack_require__(10).clearImmediate))

/***/ }
/******/ ]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgMTg3NzE5ZTgxY2I5YWE1ZTIxNjMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9tYWluLmpzIiwid2VicGFjazovLy9DOi9wci9zb25uZS9saWIvd3JhcHBlci5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi9wcm9jZXNzL2Jyb3dzZXIuanMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9zdGFjay5qcyIsIndlYnBhY2s6Ly8vQzovcHIvc29ubmUvbGliL2RhdGEuanMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9jb21wLmpzIiwid2VicGFjazovLy9DOi9wci9zb25uZS9saWIvaWQuanMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9iYXNlLmpzIiwid2VicGFjazovLy8uL34vZGF0YS50YXNrL2xpYi9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9+L2RhdGEudGFzay9saWIvdGFzay5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSx1QkFBZTtBQUNmO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDNUJBLEtBQU0sR0FBRyxHQUFHLEVBQUU7QUFDZCxJQUFHLENBQUMsSUFBSSxHQUFHLG1CQUFPLENBQUMsQ0FBVyxDQUFDOzs7Ozs7Ozs7QUFTL0IsSUFBRyxDQUFDLElBQUksR0FBRyxtQkFBTyxDQUFDLENBQVEsQ0FBQztBQUM1QixJQUFHLENBQUMsSUFBSSxH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OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHO0FBQ0g7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUc7QUFDSDs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhCQUE2Qix3QkFBd0I7QUFDckQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFHOztBQUVIOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdDQUErQjtBQUMvQjs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsNkJBQTRCLG1DQUFtQztBQUMvRDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBLE1BQUs7QUFDTCxJQUFHO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQSxNQUFLO0FBQ0wsSUFBRztBQUNIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBSztBQUNMO0FBQ0EsTUFBSztBQUNMLElBQUc7QUFDSDs7Ozs7Ozs7QUNoVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRDQUEyQyxpQkFBaUI7O0FBRTVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUc7O0FBRUg7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsRyIsImZpbGUiOiJtdGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSlcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcblxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0ZXhwb3J0czoge30sXG4gXHRcdFx0aWQ6IG1vZHVsZUlkLFxuIFx0XHRcdGxvYWRlZDogZmFsc2VcbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubG9hZGVkID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuIFx0Ly8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4gXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXygwKTtcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIHdlYnBhY2svYm9vdHN0cmFwIDE4NzcxOWU4MWNiOWFhNWUyMTYzXG4gKiovIiwiLyogI092ZXJ2aWV3XHJcbiAqXHJcbiAqIFRoZSBwYWNrYWdlIGNvbnNpc3RzIG9mIHRoZSBmb2xsb3dpbmcgY29tcG9uZW50czpcclxuICogXHJcbiAqICMjIE9iamVjdCB3cmFwcGVyXHJcbiAqIFxyXG4gKiBUaGUgW29iamVjdCB3cmFwcGVyXSh3cmFwcGVyLm1kKSwgZXhwb3NlZCB2aWEgdGhlIGBtdGwubWFrZWAgZnVuY3Rpb24sIGNvbWJpbmVzIG9uZSBvciBzZXZlcmFsIG1vbmFkIFxyXG4gKiB0cmFuc2Zvcm1lciBkZWZpbml0aW9ucyBhbmQgbWl4ZXMgdGhlbSBpbnRvIG9uZSBcclxuICogW0ZhbnRhc3kgTGFuZCBjb21wbGlhbnRdKGh0dHBzOi8vZ2l0aHViLmNvbS9mYW50YXN5bGFuZC9mYW50YXN5LWxhbmQpIG1vbmFkLlxyXG4gKi9cclxuY29uc3QgbXRsID0ge31cclxubXRsLm1ha2UgPSByZXF1aXJlKCcuL3dyYXBwZXInKVxyXG5cclxuLyogIyMgTW9uYWQgdHJhbnNmb3JtZXIgZGVmaW5pdGlvbnNcclxuICogXHJcbiAqIFRoZSBsaWJyYXJ5IGNvbnRhaW5zIGZvdXIgW21vbmFkIHRyYW5zZm9ybWVyIGRlZmluaXRpb25zXShhcGkubWQpLCBkaXN0cmlidXRlZCBpbiB0d28gcGFja2FnZXM6XHJcbiAqIGBkYXRhYCBhbmQgYGNvbXBgLiBJdCBhbHNvIGNvbnRhaW5zIHRocmVlIHZlcnNpb25zIG9mIHRoZSBpZGVudGl0eSBtb25hZCB0cmFuc2Zvcm1lciwgdXNlZnVsXHJcbiAqIGFzIGEgcmVmZXJlbmNlIHdoZW4gaW1wbGVtZW50aW5nIChjdXN0b20gbW9uYWQgdHJhbnNmb3JtZXJzKVtpbXBsZW1lbnRpbmctdHJhbnNmb3JtZXIubWRdLlxyXG4gKlxyXG4gKi9cclxubXRsLmRhdGEgPSByZXF1aXJlKCcuL2RhdGEnKVxyXG5tdGwuY29tcCA9IHJlcXVpcmUoJy4vY29tcCcpXHJcbm10bC5pZCA9IHJlcXVpcmUoJy4vaWQnKVxyXG5cclxuXHJcbi8qICMjIEJhc2UgbW9uYWRzXHJcbiAqIFxyXG4gKiBXaGVuIHN0YWNraW5nIG1vbmFkIHRyYW5zZm9ybWVycywgYSB5b3UgbXVzdCBwbGFjZSBvbmUgcGxhaW4gbW9uYWQgYXQgdGhlIGJvdHRvbSBvZiB0aGUgc3RhY2suXHJcbiAqIFRoaXMgbW9uYWQgc2VydmVzIGFzIHRoZSBzdGFjaydzIGJhc2UuIFxyXG4gKlxyXG4gKiBCeSBkZWZhdWx0LCB0aGUgcGFja2FnZSB1c2VzIHRoZSBpZGVudGl0eSBtb25hZCBhcyBhIGJhc2UgYnV0IGl0IGFsc28gZGVmaW5lcyBhIHdyYXBwZXIgd2hpY2hcclxuICogYWxsb3cgeW91IHRvIHVzZSB0aGUgW1Rhc2sgbW9uYWRdKGh0dHBzOi8vZ2l0aHViLmNvbS9mb2xrdGFsZS9kYXRhLnRhc2spIGZyb20gRm9sa3RhbGUgYXMgYSBiYXNlLlxyXG4gKi9cclxuXHJcbm10bC5iYXNlID0gcmVxdWlyZSgnLi9iYXNlJylcclxuXHJcbi8qICMjIFByZWRlZmluZWQgc3RhY2tzXHJcbiAqIFxyXG4gKiBUaGUgbGlicmFyeSBmZWF0dXJlcyBmaXZlIHByZWRlZmluZWQgbW9uYWQgc3RhY2tzIHdoaWNoIHNlcnZlIHRoZSBtb3N0IGNvbW1vbiB1c2UgY2FzZXMuXHJcbiAqXHJcbiAqL1xyXG5tdGwuc2ltcGxlID0gbXRsLm1ha2UobXRsLmRhdGEubWF5YmUsIG10bC5kYXRhLndyaXRlcilcclxubXRsLnN0YXRlZnVsID0gbXRsLm1ha2UobXRsLmRhdGEubWF5YmUsIG10bC5kYXRhLndyaXRlciwgbXRsLmNvbXAuc3RhdGUpXHJcbm10bC5saXN0ID0gbXRsLm1ha2UobXRsLmRhdGEubGlzdCwgbXRsLmRhdGEubWF5YmUsIG10bC5kYXRhLndyaXRlcilcclxubXRsLnN0YXRlbGlzdCA9IG10bC5tYWtlKG10bC5kYXRhLmxpc3QsIG10bC5kYXRhLm1heWJlLCBtdGwuZGF0YS53cml0ZXIsIG10bC5jb21wLnN0YXRlKVxyXG5cclxubXRsLmFkdmFuY2VkID0gbXRsLm1ha2UobXRsLmJhc2UudGFzaywgbXRsLmRhdGEubWF5YmUsIG10bC5kYXRhLndyaXRlciwgbXRsLmNvbXAuc3RhdGUpXHJcbm10bC5hZHZhbmNlZC5wcm90b3R5cGUucmVqZWN0ZWRNYXAgPSBmdW5jdGlvbihmbikge1xyXG4gIHJldHVybiBtdGwuYWR2YW5jZWQoKCkgPT4gdGhpcy5fdmFsdWUoKS5yZWplY3RlZE1hcChmbikpXHJcbn1cclxubW9kdWxlLmV4cG9ydHMgPSBtdGxcclxuLypcclxuICogW19WaWV3IGluIEdpdEh1Yl9dKC4uL2xpYi9tYWluLmpzKVxyXG4gKi9cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL21haW4uanNcbiAqKi8iLCIvKiAjIFRoZSBvYmplY3Qgd3JhcHBlclxyXG4gKlxyXG4gKiBUaGUgbGlicmFyeSBwcm92aWRlcyBhIG1vZHVsZSB3aGljaCBhbGxvd3MgeW91IHRvIGNvbWJpbmUgc2V2ZXJhbCBtb25hZCB0cmFuc2Zvcm1lciBkZWZpbml0aW9uc1xyXG4gKiBhbmQgY3JlYXRlIGEgb2JqZWN0LW9yaWVudGVkIHdyYXBwZXIgZm9yIHVzaW5nIHRoZSByZXN1bHRpbmcgbW9uYWQuXHJcbiAqIFxyXG4gKiAjIyBDcmVhdGluZyBhIG1vbmFkIGNvbnN0cnVjdG9yXHJcbiAqXHJcbiAqIFlvdSBjYW4gY3JlYXRlIGEgbW9uYWQgY29uc3RydWN0b3IgdXNpbmcgdGhlIGBtdGwubWFrZWAgZnVuY3Rpb246XHJcbiAqXHJcbiAqICMjI2BtdGwubWFrZShbYmFzZU1vbmFkXSwgbW9uYWRUcmFuc2Zvcm1lcjEsIG1vbmFkVHJhbnNmb3JtZXIyKWBcclxuICpcclxuICogIyMjI2BiYXNlTW9uYWQgKG1vbmFkRGVmaW5pdGlvbilgXHJcbiAqXHJcbiAqIE9wdGlvbmFsbHkgeW91IGNhbiBwYXNzIHRoZSBkZWZpbml0aW9uIG9mIHRoZSBtb25hZCB0aGF0IHdvdWxkIHNpdCBhdCB0aGUgYm90dG9tIG9mIHRoZSBzdGFjaywgXHJcbiAqIGFzIGEgZmlyc3QgYXJndW1lbnQgb2YgdGhlIGBtYWtlYCBmdW5jdGlvbi5cclxuICpcclxuICogVGhlIHBhcmFtZXRlciBpcyBvcHRpb25hbC4gQnkgZGVmYXVsdCwgdGhlIHBhY2thZ2UgdXNlcyB0aGUgaWRlbnRpdHkgbW9uYWQgYXMgYSBiYXNlLlxyXG4gKlxyXG4gKiAjIyMjYG1vbmFkVHJhbnNmb3JtZXI8MS1uPiAobW9uYWRUcmFuc2Zvcm1lckRlZmluaXRpb24pYFxyXG4gKlxyXG4gKiBQYXNzIHRoZSBkZWZpbml0aW9ucyBvZiB0aGUgbW9uYWQgdHJhbnNmb3JtZXJzIHdoaWNoIHdvdWxkIGF1Z21lbnQgdGhlIGJhc2UgbW9uYWQuIFxyXG4gKiBOb3RlIHRoYXQgbW9uYWQgdHJhbnNmb3JtYXRpb25zIGFyZSB1c3VhbGx5IG5vdCBjb21tdXRhdGl2ZSwgc28gdGhlIG9yZGVyIGluIHdoaWNoIHRoZSBhcmd1bWVudHNcclxuICogYXJlIHBsYWNlZCBtYXR0ZXJzLlxyXG4gKlxyXG4gKiBUaGUgZnVuY3Rpb24gcmV0dXJucyBhbiBgb2JqZWN0V3JhcHBlcmAgd2hpY2ggYWxsb3dzIHlvdSBpbnN0YW50aWF0ZSBtb25hZHMgZnJvbSBhbGwga2luZHMgb2YgdmFsdWVzLlxyXG4gKlxyXG4gKiAjIyBDcmVhdGluZyBtb25hZHNcclxuICpcclxuICogTW9uYWRzIGFyZSBnZW5lcmFsbHkgY3JlYXRlZCB1c2luZyBbdHlwZS1zcGVjaWZpYyBtZXRob2RzXShhcGkubWQpIGxpa2UgYGZyb21BcnJheWAgKGZvciBzdGFja3MgdGhhdCBpbmNsdWRlIHRoZVxyXG4gKiBsaXN0IHRyYW5zZm9ybWF0aW9uLCBvciBgZnJvbVN0YXRlYCAoZm9yIHN0YXRlZnVsIGNvbXB1dGF0aW9ucyksIGJ1dCBmb3IgdGhlIHNha2Ugb2YgY29tcGxldGVuZXNzXHJcbiAqIHNldmVyYWwgZ2VuZXJpYyBtZXRob2RzIGFyZSBhbHNvIHByb3ZpZGVkLlxyXG4gKlxyXG4gKiAjIyMgYG9iamVjdFdyYXBwZXIub2YodmFsdWUpYFxyXG4gKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbW9uYWQgZnJvbSBhIHBsYWluIG5vbi1tb25hZGljIHZhbHVlLlxyXG4gKlxyXG4gKiAjIyMgYG9iamVjdFdyYXBwZXIubGlmdChtb25hZFRyYW5zZm9ybWVyRGVmaW5pdGlvbiwgdmFsdWUpYFxyXG4gKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbW9uYWQgZnJvbSBhIHZhbHVlIGNyZWF0ZWQgYXQgYSBoaWdoZXIgbGV2ZWwgb2YgdGhlIHN0YWNrLiBTZWUgXHJcbiAqIFt0aGlzIGFydGljbGVdKGh0dHBzOi8vZW4ud2lraWJvb2tzLm9yZy93aWtpL0hhc2tlbGwvTW9uYWRfdHJhbnNmb3JtZXJzI0xpZnRpbmcpIGZvciBtb3JlIGluZm9ybWF0aW9uLlxyXG4gKlxyXG4gKiAjIyMgYG9iamVjdFdyYXBwZXIodmFsdWUpYFxyXG4gKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbW9uYWQgZnJvbSBhIHZhbHVlIHdoaWNoIG9iZXlzIHRoZSBzdHJ1Y3R1cmUgb2YgdGhlIG1vbmFkIHN0YWNrIGkuZS4gXCJ3cmFwc1wiIHRoZSB2YWx1ZVxyXG4gKiBpbnRvIGEgbW9uYWRpYyBpbnRlcmZhY2UuXHJcbiAqXHJcbiAqICMjIFVzaW5nIG1vbmFkc1xyXG4gKlxyXG4gKiBBZ2FpbiB0aGVyZSBhcmUgbWFueSBtZXRob2RzIHRoYXQgeW91IHdvdWxkIHVzZSB0byBtYW5pcHVsYXRlIGEgbW9uYWQgd2hpY2ggYXJlIFt0eXBlLXNwZWNpZmljXShhcGkubWQpLiBcclxuICogSGVyZSBhcmUgdGhlIGdlbmVyaWMgb25lczpcclxuICpcclxuICogIyMjYG1vbmFkLm1hcChmKWBcclxuICpcclxuICogQXBwbGllcyBgZmAgdG8gdGhlIHZhbHVlIG9yIHZhbHVlcyB0aGF0IGFyZSBpbnNpZGUgdGhlIG1vbmFkIGFuZCB3cmFwcyB0aGUgcmVzdWx0aW5nIHZhbHVlIGluIGEgbmV3IG1vbmFkIGluc3RhbmNlLlxyXG4gKlxyXG4gKiAjIyNgbW9uYWQuY2hhaW4oZilgXHJcbiAqXHJcbiAqIEFwcGxpZXMgYGZgIHRvIHRoZSB2YWx1ZSBvciB2YWx1ZXMgdGhhdCBhcmUgaW5zaWRlIHRoZSBtb25hZCBhbmQgcmV0dXJucyBhIG5ldyBtb25hZCBpbnN0YW5jZVxyXG4gKlxyXG4gKiAjIyNgbW9uYWQudGFwKGYpYFxyXG4gKlxyXG4gKiBBcHBsaWVzIHRoZSBmIHRvIHRoZSBtb25hZCBhbmQgcmV0dXJucyB0aGUgcmVzdWx0LlxyXG4gKlxyXG4gKiAjIyNgbW9uYWQudmFsdWUoKWBcclxuICpcclxuICogUnVucyB0aGUgY29tcHV0YXRpb24gaW5zaWRlIHRoZSBtb25hZCBhbmQgcmV0dXJucyBpdHMgdmFsdWUsIGlmIGFwcGxpY2FibGUuXHJcbiAqXHJcbiAqIEZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgdGhlIFtGYW50YXN5IExhbmQgc3BlY10oaHR0cHM6Ly9naXRodWIuY29tL2ZhbnRhc3lsYW5kL2ZhbnRhc3ktbGFuZCkuXHJcbiAqXHJcbiAqICMjIFNvdXJjZVxyXG4gKi9cclxuY29uc3QgY3JlYXRlU3RhY2sgPSByZXF1aXJlKCcuL3N0YWNrJylcclxuXHJcbi8vIENoZWNrcyBpZiBhIGdpdmVuIHByb3BlcnR5IGlzIHBhcnQgb2YgdGhlIGdlbmVyYWwgbW9uYWQgZGVmaW5pdGlvbiBpbnRlcmZhY2VcclxuY29uc3QgaXNSZXNlcnZlck1vbmFkS2V5ID0gKGtleSkgPT4ga2V5ICE9PSAnbmFtZScgJiYga2V5ICE9PSAnbWFwJyAmJiBrZXkgIT09ICdvZicgJiYga2V5ICE9PSAnY2hhaW4nICYmIGtleSAhPT0gJ2xpZnQnICYmIGtleSAhPT0gJ3ZhbHVlJ1xyXG5cclxuLy8gTWFwcyB0aGUgdmFsdWVzIG9mIGEgZ2l2ZW4gb2JqIGV4Y2x1ZGluZyB0aGUgcmVzZXJ2ZWQgb25lcy5cclxuY29uc3QgbW9uYWRNYXBWYWxzID0gKGZ1bmssIG9iaikgPT4ge1xyXG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopXHJcbiAgICAuZmlsdGVyKGlzUmVzZXJ2ZXJNb25hZEtleSlcclxuICAgIC5yZWR1Y2UoKG5ld09iaiwga2V5KSA9PiB7XHJcbiAgICAgIG5ld09ialtrZXldID0gZnVuayhvYmpba2V5XSwgb2JqKVxyXG4gICAgICByZXR1cm4gbmV3T2JqXHJcbiAgICB9LCB7fSlcclxufVxyXG5cclxuLy8gVW53cmFwcyBhIHdyYXBwZWQgdmFsdWVcclxuY29uc3QgdW53cmFwID0gKHZhbCkgPT4ge1xyXG4gIGlmICghdmFsLmhhc093blByb3BlcnR5KCdfdmFsdWUnKSkge3Rocm93IEpTT04uc3RyaW5naWZ5KHZhbCkgKyAnIGlzIG5vdCBhIHdyYXBwZWQgdmFsdWUnfVxyXG4gIHJldHVybiB2YWwuX3ZhbHVlXHJcbn1cclxuXHJcbi8vIFdyYXBzIGEgdmFsdWUgaW4gYSBzcGVjaWZpZWQgcHJvdG90eXBlXHJcbmNvbnN0IHdyYXBWYWwgPSAocHJvdG8sIHZhbCkgPT4ge1xyXG4gIHZhciBvYmogPSBPYmplY3QuY3JlYXRlKHByb3RvKVxyXG4gIG9iai5fdmFsdWUgPSB2YWxcclxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShvYmopXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbWFrZSAoKSB7XHJcbiAgLy8gSW5pdGlsaXplIHRoZSBzdGFjayBjb21wb25lbnQsIHRoYXQgYWN0dWFsbHkgZG9lcyBtb3N0IG9mIHRoZSB3b3JrXHJcbiAgY29uc3Qgc3RhY2sgPSBjcmVhdGVTdGFjayhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3QgYmFzZVN0YWNrUHJvdG8gPSB7XHJcbiAgICBzdGFjazogc3RhY2ssXHJcbiAgICBwcm90b3R5cGU6IHRoaXMucHJvdG90eXBlLFxyXG4gICAgLy8gQWRkIGNoYWluIGZ1bmN0aW9uXHJcbiAgICBjaGFpbiAoZnVuaykge1xyXG4gICAgICBjb25zdCBmdW5rQW5kVW53cmFwID0gKHZhbCkgPT4gdW53cmFwKGZ1bmsodmFsKSlcclxuICAgICAgaWYgKCFwcm9jZXNzLmRlYnVnKSB7XHJcbiAgICAgICAgZnVua0FuZFVud3JhcC50b1N0cmluZyA9ICgpID0+ICd1bndyYXAoJyArIGZ1bmsudG9TdHJpbmcoKSArICcpJ1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBjcmVhdGUoc3RhY2subGFzdC5jaGFpbihmdW5rQW5kVW53cmFwLCB0aGlzLl92YWx1ZSkpXHJcbiAgICB9LFxyXG4gICAgbGlmdCAocHJvdG8sIHZhbCkge1xyXG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQocHJvdG8sIHZhbCkpXHJcbiAgICB9LFxyXG4gICAgLy8gQWRkICdtYXAnIGFuZCAnb2YnIGZ1bmN0aW9uc1xyXG4gICAgb2YgKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUoc3RhY2subGFzdC5vZih2YWx1ZSkpXHJcbiAgICB9LFxyXG4gICAgbWFwIChmdW5rKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IHRoaXMub2YoZnVuayh2YWwpKSlcclxuICAgIH0sXHJcbiAgICB0YXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIGZ1bmsodGhpcylcclxuICAgIH0sXHJcbiAgICB2YWx1ZSAoY2FsbGJhY2spIHtcclxuICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayAhPT0gdW5kZWZpbmVkID8gY2FsbGJhY2sgOiBhID0+IGFcclxuICAgICAgcmV0dXJuIHN0YWNrLmxhc3QudmFsdWUoY2FsbGJhY2ssIHRoaXMuX3ZhbHVlKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gUHJvbW90ZXMgYSBtZXRob2QgZnJvbSBhIG1vbmFkIGRlZmluaXRpb24gc28gaXQgY2FuIGJlIHVzZWQgZm9yIGNoYWluaW5nXHJcbiAgY29uc3QgdG9JbnN0YW5jZSA9IChmdW5rLCBvdXRlcikgPT4gZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcclxuICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZShzdGFjay5saWZ0KG91dGVyLm9yaWdpbmFsLCBmdW5rLmFwcGx5KG91dGVyLCBhcmdzLmNvbmNhdChbdmFsXSkpKSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICAvLyBQcm9tb3RlcyBhIG1ldGhvZCBmcm9tIGEgbW9uYWQgZGVmaW5pdGlvbiBzbyBpdCBjYW4gYmUgdXNlZCBhcyBhIHN0YXRpYyBtZXRob2RcclxuICBjb25zdCB0b0NvbnN0cnVjdG9yID0gKGZ1bmssIG91dGVyKSA9PiBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQob3V0ZXIub3JpZ2luYWwsIGZ1bmsuYXBwbHkob3V0ZXIsIGFyZ3VtZW50cykpKVxyXG4gIH1cclxuXHJcbiAgLy8gQXVnbWVudCB0aGUgc3RhY2sgcHJvdG90eXBlIHdpdGggaGVscGVyIG1ldGhvZHNcclxuICBjb25zdCBzdGFja1Byb3RvID0gT2JqZWN0LmFzc2lnbi5hcHBseShudWxsLCBbYmFzZVN0YWNrUHJvdG9dLmNvbmNhdChzdGFjay5fbWVtYmVycy5tYXAobW9uYWQgPT4gbW9uYWRNYXBWYWxzKHRvSW5zdGFuY2UsIG1vbmFkKSkpKVxyXG5cclxuICAvLyBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gY3JlYXRlcyBhIG5ldyBvYmplY3QgYW5kIHdyYXBzIGl0IGluIHRoZSBzdGFjayBwcm90b3R5cGVcclxuICBjb25zdCBjcmVhdGUgPSAodmFsKSA9PiB7XHJcbiAgICByZXR1cm4gd3JhcFZhbChzdGFja1Byb3RvLCB2YWwpXHJcbiAgfVxyXG5cclxuICAvLyBBZGQgcmVsZXZhbnQgbWV0aG9kcyBmcm9tIHRoZSBtb25hZGljIGludGVyZmFjZSB0byB0aGUgc3RhY2sgY29uc3RydWN0b3JcclxuICBjcmVhdGUub2YgPSBzdGFja1Byb3RvLm9mXHJcbiAgY3JlYXRlLmxpZnQgPSBzdGFja1Byb3RvLmxpZnRcclxuICBjcmVhdGUucHJvdG90eXBlID0gc3RhY2tQcm90b1xyXG5cclxuICAvLyBBdWdtZW50IHRoZSBzdGFjayBjb25zdHJ1Y3RvciB3aXRoIGhlbHBlciBtZXRob2RzXHJcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24uYXBwbHkobnVsbCwgW2NyZWF0ZV0uY29uY2F0KHN0YWNrLl9tZW1iZXJzLm1hcChtb25hZCA9PiBtb25hZE1hcFZhbHModG9Db25zdHJ1Y3RvciwgbW9uYWQpKSkpXHJcbn1cclxuXHJcbi8vIE9iamVjdC5hc3NpZ24gcG9seWZpbFxyXG5pZiAoIU9iamVjdC5hc3NpZ24pIHtcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoT2JqZWN0LCAnYXNzaWduJywge1xyXG4gICAgZW51bWVyYWJsZTogZmFsc2UsXHJcbiAgICBjb25maWd1cmFibGU6IHRydWUsXHJcbiAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgIHZhbHVlOiBmdW5jdGlvbiAodGFyZ2V0KSB7XHJcbiAgICAgICd1c2Ugc3RyaWN0J1xyXG4gICAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0ID09PSBudWxsKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNvbnZlcnQgZmlyc3QgYXJndW1lbnQgdG8gb2JqZWN0JylcclxuICAgICAgfVxyXG5cclxuICAgICAgdmFyIHRvID0gT2JqZWN0KHRhcmdldClcclxuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgbmV4dFNvdXJjZSA9IGFyZ3VtZW50c1tpXVxyXG4gICAgICAgIGlmIChuZXh0U291cmNlID09PSB1bmRlZmluZWQgfHwgbmV4dFNvdXJjZSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgY29udGludWVcclxuICAgICAgICB9XHJcbiAgICAgICAgbmV4dFNvdXJjZSA9IE9iamVjdChuZXh0U291cmNlKVxyXG5cclxuICAgICAgICB2YXIga2V5c0FycmF5ID0gT2JqZWN0LmtleXMobmV4dFNvdXJjZSlcclxuICAgICAgICBmb3IgKHZhciBuZXh0SW5kZXggPSAwLCBsZW4gPSBrZXlzQXJyYXkubGVuZ3RoOyBuZXh0SW5kZXggPCBsZW47IG5leHRJbmRleCsrKSB7XHJcbiAgICAgICAgICB2YXIgbmV4dEtleSA9IGtleXNBcnJheVtuZXh0SW5kZXhdXHJcbiAgICAgICAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobmV4dFNvdXJjZSwgbmV4dEtleSlcclxuICAgICAgICAgIGlmIChkZXNjICE9PSB1bmRlZmluZWQgJiYgZGVzYy5lbnVtZXJhYmxlKSB7XHJcbiAgICAgICAgICAgIHRvW25leHRLZXldID0gbmV4dFNvdXJjZVtuZXh0S2V5XVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdG9cclxuICAgIH1cclxuICB9KVxyXG59XHJcblxyXG4vKlxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL3dyYXBwZXIuanMpXHJcbiAqL1xyXG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiBDOi9wci9zb25uZS9saWIvd3JhcHBlci5qc1xuICoqLyIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qc1xuICoqIG1vZHVsZSBpZCA9IDJcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlU3RhY2sgKG1vbmFkU3RhY2spIHtcclxuICAvLyBHZW5lcmF0ZSBlcnJvcnNcclxuICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdGFjayBtZW1iZXInKVxyXG5cclxuICAvLyBBZGQgdGhlIElEIG1vbmFkIGF0IHRoZSBib3R0b20gb2YgdGhlIG1vbmFkIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2sgPSBbaWRQcm90b10uY29uY2F0KG1vbmFkU3RhY2spXHJcblxyXG4gIHN0YWNrLmZvckVhY2gobWVtYmVyID0+IHtcclxuICAgIGlmICh0eXBlb2YgbWVtYmVyICE9PSAnb2JqZWN0Jykge3Rocm93IG5ldyBFcnJvcignU3RhY2sgbWVtYmVycyBtdXN0IGJlIG9iamVjdHMnKX1cclxuICB9KVxyXG5cclxuICAvLyBQZXJmb3JtIHNvbWUgcHJlcHJvY2Vzc2luZyBvbiB0aGUgc3RhY2tcclxuICBjb25zdCBzdGFja1Byb2Nlc3NlZCA9IHByb2Nlc3NTdGFjayhzdGFjaylcclxuXHJcbiAgLy8gRGVmaW5lIHRoZSBsaWZ0IG9wZXJhdGlvbiB3aGljaCB0YWtlcyBhIHZhbHVlIG9mIGEgZ2l2ZW4gbGV2ZWwgb2YgdGhlIHN0YWNrIGFuZCBsaWZ0cyBpdCB0byB0aGUgbGFzdCBsZXZlbFxyXG4gIGNvbnN0IGxpZnQgPSAodmFsLCBsZXZlbCkgPT4ge1xyXG4gICAgLy8gR2V0IHRoZSBzdGFjayBwcm90b3R5cGVzIGZvciB0aGUgbmV4dCBsZXZlbFxyXG4gICAgY29uc3QgbmV4dExldmVsID0gbGV2ZWwgKyAxXHJcbiAgICBjb25zdCBuZXh0TWVtYmVyID0gc3RhY2tQcm9jZXNzZWRbbGV2ZWwgKyAxXVxyXG4gICAgLy8gRG8gbm90IGRvIGFueXRoaW5nIGlmIHRoZSB2YWx1ZSBpcyBhbHJlYWR5IGF0IHRoZSBsYXN0IGxldmVsLlxyXG4gICAgaWYgKG5leHRNZW1iZXIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAvLyBQZXJmb3JtIHRoZSBsaWZ0IG9wZXJhdGlvbiBhdCB0aGUgbmVjZXNzYXJ5IGxldmVsXHJcbiAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5IHRvIGdldCB0byB0aGUgbmV4dCBvbmVcclxuICAgICAgcmV0dXJuIGxpZnQobmV4dE1lbWJlci5saWZ0KHZhbCksIG5leHRMZXZlbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiB2YWxcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFRha2VzIGZ1bmsgYW5kIGZyb20gaXQgY3JlYXRlcyBhIHN0YWNrIG9wZXJhdGlvblxyXG4gIGNvbnN0IG9wZXJhdGlvbiA9IChmdW5rKSA9PiB7XHJcbiAgICByZXR1cm4gKHByb3RvLCB2YWwpID0+IHtcclxuICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBsZXZlbCBvZiB0aGUgdmFsdWUsIGdpdmVuIHRoZSBwcm90b1xyXG4gICAgICBjb25zdCBsZXZlbCA9IHN0YWNrLmluZGV4T2YocHJvdG8pXHJcbiAgICAgIC8vIFRocm93IGFuIGVycm9yIGlmIHRoZSB2YWx1ZSBpcyBpbnZhbGlkXHJcbiAgICAgIGlmIChsZXZlbCA9PT0gLTEpIHt0aHJvdyBlcnJvcn1cclxuICAgICAgcmV0dXJuIGZ1bmsodmFsLCBsZXZlbClcclxuICAgIH1cclxuICB9XHJcbiAgLy8gRGlzcGF0Y2hlcyBhbiBvcGVyYXRpb24gdG8gdGhlIGNvcnJlY3Qgc3RhY2sgbGV2ZWxcclxuICBjb25zdCBmcm9tU3RhY2sgPSAobmFtZSkgPT4ge1xyXG4gICAgcmV0dXJuICh2YWwsIGxldmVsKSA9PiBzdGFja1Byb2Nlc3NlZFtsZXZlbF1bbmFtZV0odmFsKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGxpZnQ6IG9wZXJhdGlvbihsaWZ0KSxcclxuICAgIG9mOiBvcGVyYXRpb24oZnJvbVN0YWNrKCdvZicpKSxcclxuICAgIGNoYWluOiBvcGVyYXRpb24oZnJvbVN0YWNrKCdjaGFpbicpKSxcclxuICAgIGxhc3Q6IHN0YWNrUHJvY2Vzc2VkIFtzdGFja1Byb2Nlc3NlZC5sZW5ndGggLSAxXSxcclxuICAgIGlkOiBpZFByb3RvLFxyXG4gICAgX21lbWJlcnM6IHN0YWNrUHJvY2Vzc2VkXHJcbiAgfVxyXG59XHJcblxyXG5jb25zdCBwcm9jZXNzU3RhY2sgPSAoYmFzZVN0YWNrKSA9PlxyXG4gIHN0YXRlTWFwKGJhc2VTdGFjaywgKGl0ZW0sIHN0YXRlKSA9PiB7XHJcbiAgICBjb25zdCBwcmV2SXRlbVByb2Nlc3NlZCA9IHN0YXRlIHx8IGlkUHJvdG9cclxuICAgIC8vIEFwcGx5IHRoZSBwcm9jZXNzaW5nIGZ1bmN0aW9uIG9uIGVhY2ggc3RhY2sgbWVtYmVyXHJcbiAgICBjb25zdCBpdGVtUHJvY2Vzc2VkID0gcHJvY2Vzc1Byb3RvTmV3KGl0ZW0sIHByZXZJdGVtUHJvY2Vzc2VkKVxyXG4gICAgcmV0dXJuIFsgaXRlbVByb2Nlc3NlZCxpdGVtUHJvY2Vzc2VkXVxyXG4gIH0pXHJcblxyXG4vLyBBIHN0YXRlZnVsIHZlcnNpb24gb2YgdGhlIG1hcCBmdW5jdGlvbjpcclxuLy8gZiBhY2NlcHRzIGFuIGFycmF5IGl0ZW0gYW5kIGEgc3RhdGUoZGVmYXVsdHMgdG8gYW4gb2JqZWN0KSBhbmQgcmV0dXJucyB0aGUgcHJvY2Vzc2VkIHZlcnNpb24gb2YgdGhlIGl0ZW0gcGx1cyBhIG5ldyBzdGF0ZVxyXG5jb25zdCBzdGF0ZU1hcCA9IChhcnIsIGYpID0+XHJcbiAgYXJyLnJlZHVjZSgoYXJyYXlBbmRTdGF0ZSwgaXRlbSkgPT4ge1xyXG4gICAgY29uc3QgaXRlbUFuZFN0YXRlID0gKGYoaXRlbSwgYXJyYXlBbmRTdGF0ZVsxXSkpXHJcbiAgICByZXR1cm4gW2FycmF5QW5kU3RhdGVbMF0uY29uY2F0KFtpdGVtQW5kU3RhdGVbMF1dKSwgaXRlbUFuZFN0YXRlWzFdIF1cclxuICB9LCBbW10sIHt9XSlbMF1cclxuXHJcbmNvbnN0IGNsb25lID0gKG9iaikgPT4gT2JqZWN0LmtleXMob2JqKS5yZWR1Y2UoKG5ld09iaiwga2V5KSA9PiB7XHJcbiAgbmV3T2JqW2tleV0gPSBvYmpba2V5XVxyXG4gIHJldHVybiBuZXdPYmpcclxufSwge30pXHJcblxyXG5jb25zdCBwcm9jZXNzUHJvdG9OZXcgPSAocHJvdG8sIG91dGVyKSA9PiB7XHJcbiAgY29uc3QgcHJvdG9Qcm9jZXNzZWQgPSBjbG9uZShwcm90bylcclxuICBwcm90b1Byb2Nlc3NlZC5uYW1lID0gcHJvdG8ubmFtZSArICcvJyArIG91dGVyLm5hbWVcclxuICBwcm90b1Byb2Nlc3NlZC5vdXRlciA9IG91dGVyXHJcbiAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgc28gd2UgY2FuIGRvIHR5cGVjaGVja3MgYW5kIHJvdXRlIG1ldGhvZCBjYWxsc1xyXG4gIHByb3RvUHJvY2Vzc2VkLm9yaWdpbmFsID0gcHJvdG9cclxuICByZXR1cm4gcHJvdG9Qcm9jZXNzZWRcclxufVxyXG5cclxuLy8gVGhlIGlkZW50aXR5IG1vbmFkLCB3aGljaCBsaWVzIGF0IHRoZSBib3R0b20gb2YgZWFjaCBzdGFja1xyXG5jb25zdCBpZFByb3RvID0ge1xyXG4gIG5hbWU6ICdyb290JyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gZnVuayh2YWwpXHJcbiAgfSxcclxuICBtYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH1cclxufVxyXG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiBDOi9wci9zb25uZS9saWIvc3RhY2suanNcbiAqKi8iLCIvKiAjIFR5cGVzIEFQSVxyXG4gKlxyXG4gKiBIZXJlIGlzIGEgbGlzdCBvZiBhbGwgbW9uYWQgdHJhbnNmb3JtZXJzIGFuZCB0aGUgbWV0aG9kcyB0aGF0IHRoZXkgYWRkIHRvIHRoZSB3cmFwcGVyIG9iamVjdC5cclxuICpcclxuLyogIyMgYGRhdGEubWF5YmVgXHJcbiAqXHJcbiAqIFRoZSBgbWF5YmVgIG1vbmFkIHRyYW5zZm9ybWVyIGF1dG9tYXRpY2FsbHkgY2hlY2tzIGlmIHlvdXIgdmFsdWUgaXMgdW5kZWZpbmVkIGFuZFxyXG4gKiBzdG9wcyB0aGUgY29tcHV0YXRpb24gaWYgaXQgaXMuXHJcbiAqXHJcbiAqICMjIyBgdmFsdWUuZ2V0KGtleSlgXHJcbiAqXHJcbiAqIEEgaGVscGVyIHRvIHNhZmVseSByZXRyaWV2ZSBhIHBvc3NpYmx5IHVuZGVmaW5lZCBwcm9wZXJ0eSBvZiB5b3VyIHZhbHVlLlxyXG4gKiBUaGUgdmFsdWUgaGFzIHRvIGJlIGEgSlMgb2JqZWN0LlxyXG4gKiBcclxuICogIyMjIGB2YWx1ZS5tYXliZU1hcChmKWBcclxuICogXHJcbiAqIENoYWlucyBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGBtYXliZWAgdmFsdWUgaW4gdGhlIGNvbXB1dGF0aW9uXHJcbiAqXHJcbiAqICMjIyBEZWZpbml0aW9uXHJcbiAqXHJcbiAqICFbTWF5YmVdKGltZy9tYXliZS5wbmcpXHJcbiAqXHJcbiAqICMjIyBTb3VyY2VcclxuICovXHJcblxyXG4vL1RPRE8gdXNlIHRoaXNcclxuY29uc3Qgbm90aGluZyA9IHttYXliZVZhbDp1bmRlZmluZWR9XHJcbmV4cG9ydHMubWF5YmUgPSB7XHJcbiAgbmFtZTogJ01heWJlJyxcclxuICAvLyAodmFsKSA9PiBNKHttYXliZVZhbDp2YWx9KVxyXG4gIG9mICh2YWwpIHsgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe21heWJlVmFsOiB2YWwgfSkgfSxcclxuICAvLyAodmFsID0+IE0oe21heWJlVmFsOnZhbH0pICwgTSh7bWF5YmVWYWw6dmFsfSkpID0+IE0oe21heWJlVmFsOnZhbH0pXHJcbiAgY2hhaW4gKGZ1bmssIG1NYXliZVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKG1heWJlVmFsKSA9PiB7XHJcbiAgICAgIHJldHVybiBtYXliZVZhbC5tYXliZVZhbCA9PT0gdW5kZWZpbmVkID8gbWF5YmVWYWwgOiBmdW5rKG1heWJlVmFsLm1heWJlVmFsKVxyXG4gICAgfSwgbU1heWJlVmFsKVxyXG4gIH0sXHJcbiAgLy8gKE0odmFsKSkgPT4gTSh7bWF5YmVWYWw6dmFsfSlcclxuICBsaWZ0IChtVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigodmFsKSA9PiB0aGlzLm91dGVyLm9mKHttYXliZVZhbDogdmFsfSksIG1WYWwpXHJcbiAgfSxcclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0oe21heWJlVmFsOnZhbH0pKSA9PiBvdGhlclZhbFxyXG4gIHZhbHVlIChmdW5rLCBtTWF5YmVWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChtYXliZVZhbCkgPT4ge1xyXG4gICAgICByZXR1cm4gbWF5YmVWYWwubWF5YmVWYWwgPT09IHVuZGVmaW5lZCA/IG1heWJlVmFsIDogZnVuayhtYXliZVZhbC5tYXliZVZhbClcclxuICAgIH0sIG1NYXliZVZhbClcclxuICB9LFxyXG4gIGdldCAoa2V5LCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm9mKHZhbFtrZXldKVxyXG4gIH0sXHJcbiAgbWF5YmVNYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub2YoZnVuayh2YWwpKVxyXG4gIH1cclxufVxyXG4vKiBcclxuICogW19WaWV3IGluIEdpdEh1Yl9dKC4uL2xpYi9kYXRhLmpzKVxyXG4gKi9cclxuXHJcbi8qICMjIGBkYXRhLmxpc3RgXHJcbiAqXHJcbiAqIFRoZSBgbGlzdGAgbW9uYWQgdHJhbnNmb3JtZXIgYWxsb3dzIHlvdSB0byBvcGVyYXRlIG9uIGEgbGlzdCBvZiB2YWx1ZXMuXHJcbiAqIGluc3RlYWQgb2Ygb24gYSBzaW5nbGUgdmFsdWUuXHJcbiAqXHJcbiAqICMjIyBgTGlzdC5mcm9tQXJyYXkodmFsKWBcclxuICpcclxuICogV3JhcHMgYW4gYXJyYXkgaW4gYSBsaXN0IG1vbmFkIHRyYW5zZm9ybWVyIGluc3RhbmNlLlxyXG4gKlxyXG4gKiAjIyMgYHZhbHVlcy5maWx0ZXIoZm4pYFxyXG4gKiBcclxuICogRmlsdGVycyBvdXQgdGhlIHZhbHVlcyB0aGF0IGRvbid0IG1hdGNoIHRoZSBwcmVkaWNhdGUuIFNhbWUgYXMgYEFycmF5LnByb3RvdHlwZS5maWx0ZXJgLlxyXG4gKiBcclxuICogX1RoZSBiZWhhdmlvdXIgb2YgYEFycmF5LnByb3RvdHlwZS5tYXBgIGlzIGNvdmVyZWQgYnkgdGhlIG1vbmFkIHRyYW5zZm9ybWVyIGBtYXBgIG1ldGhvZC5fXHJcbiAqXHJcbiAqICMjIyBTb3VyY2VcclxuICovXHJcblxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ0xpc3QnLFxyXG4gIC8vICh2YWwpID0+IE0oW3ZhbF0pXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbF0pXHJcbiAgfSxcclxuICAvLyAodmFsID0+IE0oW3ZhbF0pICwgTShbdmFsXSkpPT4gTShbdmFsXSlcclxuICBjaGFpbiAoZnVuaywgbUxpc3RWYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGxpc3RWYWwgPT4ge1xyXG4gICAgICByZXR1cm4gbGlzdFZhbC5sZW5ndGggPT09IDAgPyB0aGlzLm91dGVyLm9mKFtdKSA6IGxpc3RWYWxcclxuICAgICAgICAubWFwKGZ1bmspXHJcbiAgICAgICAgLnJlZHVjZSgoYWNjdW11bGF0ZWRWYWwsIG5ld1ZhbCkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oYWNjdW11bGF0ZWQgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbihfbmV3ID0+IFxyXG4gICAgICAgICAgICAgIHRoaXMub3V0ZXIub2YoYWNjdW11bGF0ZWQuY29uY2F0KF9uZXcpKSwgbmV3VmFsKVxyXG4gICAgICAgIH0sIGFjY3VtdWxhdGVkVmFsKVxyXG4gICAgICB9KVxyXG4gICAgfSwgbUxpc3RWYWwpXHJcbiAgfSxcclxuICAvLyAoTSh2YWwpKSA9PiBNKFt2YWxdKVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWx1ZSA9PiB0aGlzLm91dGVyLm9mKFtpbm5lclZhbHVlXSksIHZhbClcclxuICB9LFxyXG4gIC8vICgodmFsKSA9PiBvdGhlclZhbCwgTShbdmFsXSkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGxpc3QpID0+IHtcclxuICAgICAgcmV0dXJuIGxpc3QubWFwKGZ1bmspXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuICBmaWx0ZXIgKGZ1bmssIHZhbCkge1xyXG4gICAgaWYgKGZ1bmsodmFsKSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5vZih2YWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbXSlcclxuICAgIH1cclxuICB9LFxyXG4gIGZyb21BcnJheSAodmFsKSB7XHJcbiAgICBpZiAodmFsLmNvbmNhdCAmJiB2YWwubWFwICYmIHZhbC5yZWR1Y2UgJiYgdmFsLnNsaWNlKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHZhbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IHZhbCArICcgaXMgbm90IGEgbGlzdC4nXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbi8qIFxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL2RhdGEuanMpXHJcbiAqL1xyXG5cclxuLyogIyMgYGRhdGEud3JpdGVyYFxyXG4gKlxyXG4gKiBUaGUgd3JpdGVyIG1vbmFkIHRyYW5zZm9ybWVyIGF1Z21lbnRzIHRoZSB3cmFwcGVkIHZhbHVlIHdpdGggb25lIGFkZGl0aW9uYWwgdmFsdWVcclxuICogd2hpY2ggbWF5IGJlIHVzZWQgZm9yIHN0b3Jpbmcgc29tZSBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjb21wdXRhdGlvbi5cclxuICpcclxuICogVGhlIGFkZGl0aW9uYWwgdmFsdWUgbXVzdCBoYXZlIGEgYGNvbmNhdGAgbWV0aG9kLCBhcyBgU3RyaW5nYCBvciBgQXJyYXlgLlxyXG4gKiBcclxuICogIyMjIGB2YWx1ZS50ZWxsKHZhbClgXHJcbiAqIFxyXG4gKiBDb25jYXRzIGB2YWxgIHRvIHRoZSBhZGRpdGlvbmFsIHZhbHVlLlxyXG4gKlxyXG4gKiAjIyMgYHZhbHVlLmxpc3RlbihmKWBcclxuICpcclxuICogQ2FsbHMgYGZgIHdpdGggdGhlIGFkZGl0aW9uYWwgdmFsdWUgYXMgYW4gYXJndW1lbnQuIFxyXG4gKlxyXG4gKiAjIyMgRGVmaW5pdGlvblxyXG4gKlxyXG4gKiAhW1dyaXRlcl0oaW1nL3dyaXRlci5wbmcpXHJcbiAqXHJcbiAqICMjI1NvdXJjZVxyXG4gKi9cclxuXHJcbmNvbnN0IGNvbXB1dGVMb2cgPSAobG9nLCBuZXdMb2cpID0+IHtcclxuICBpZihsb2cgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuIG5ld0xvZ1xyXG4gIH0gZWxzZSB7XHJcbiAgICBpZiAobmV3TG9nID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgcmV0dXJuIGxvZ1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIGxvZy5jb25jYXQobmV3TG9nKVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0cy53cml0ZXIgPSB7XHJcbiAgbmFtZTogJ1dyaXRlcicsXHJcblxyXG4gIC8vICh2YWwpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbdmFsLCB1bmRlZmluZWRdKVxyXG4gIH0sXHJcblxyXG4gIC8vICh2YWwgPT4gTShbdmFsLCBsb2ddKSwgTShbdmFsLCBsb2ddKSkgPT4gTShbdmFsLCBsb2ddKVxyXG4gIGNoYWluIChmdW5rLCBtV3JpdGVyVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigod3JpdGVyVmFsKSA9PiB7XHJcbiAgICAgIGNvbnN0IHZhbCA9IHdyaXRlclZhbFswXVxyXG4gICAgICBjb25zdCBsb2cgPSB3cml0ZXJWYWxbMV0gXHJcbiAgICAgIGNvbnN0IG5ld01Xcml0ZXJWYWwgPSBmdW5rKHZhbClcclxuICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKG5ld1dyaXRlclZhbCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5ld1ZhbCA9IG5ld1dyaXRlclZhbFswXVxyXG4gICAgICAgIGNvbnN0IG5ld0xvZyA9IHR5cGVvZiBuZXdXcml0ZXJWYWxbMV0gPT09ICdmdW5jdGlvbicgPyBuZXdXcml0ZXJWYWxbMV0obG9nKSA6IG5ld1dyaXRlclZhbFsxXVxyXG4gICAgICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFtuZXdWYWwsIGNvbXB1dGVMb2cobG9nLCBuZXdMb2cpXSlcclxuICAgICAgfSwgbmV3TVdyaXRlclZhbClcclxuICAgIH0sIG1Xcml0ZXJWYWwpXHJcblxyXG4gIH0sXHJcblxyXG4gIC8vIChNKHZhbCkgPT4gTShbdmFsLCBsb2ddKVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2YoW3ZhbCwgdW5kZWZpbmVkXSksIG1WYWwpXHJcbiAgfSxcclxuXHJcbiAgLy8gKCh2YWwpID0+IGIsIE0oW3ZhbCwgbG9nXSkpID0+IGJcclxuICB2YWx1ZSAoZnVuaywgbVdyaXRlclZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKHdyaXRlclZhbCkgPT4ge1xyXG4gICAgICByZXR1cm4gZnVuayh3cml0ZXJWYWxbMF0pXHJcbiAgICB9LCBtV3JpdGVyVmFsKVxyXG4gIH0sXHJcblxyXG4gIHRlbGwgKG1lc3NhZ2UsIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoW3ZhbCwgbWVzc2FnZV0pXHJcbiAgfSxcclxuICBsaXN0ZW4gKGZ1bmssIHZhbCl7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbdmFsLCBmdW5rXSlcclxuICB9XHJcbn1cclxuLyogXHJcbiAqIFtfVmlldyBpbiBHaXRIdWJfXSguLi9saWIvZGF0YS5qcylcclxuICovXHJcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIEM6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzXG4gKiovIiwiLyogIyMgYGNvbXAuc3RhdGVgXHJcbiAqIFxyXG4gKiBUaGUgYHN0YXRlYCBtb25hZCB0cmFuc2Zvcm1lciBhbGxvd3MgeW91IHRvIGtlZXAgb25lIGFkZGl0aW9uYWwgc3RhdGUgdmFsdWVcclxuICogd2l0aCB5b3VyIGNvbXB1dGF0aW9uLlxyXG4gKlxyXG4gKiAjIyMgRGVmaW5pdGlvblxyXG4gKlxyXG4gKiAhW1N0YXRlXShpbWcvc3RhdGUucG5nKVxyXG4gKlxyXG4gKiAjIyNTb3VyY2VcclxuICovXHJcbmV4cG9ydHMuc3RhdGUgPSB7XHJcbiAgbmFtZTogJ1N0YXRlJyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihbdmFsLCBwcmV2U3RhdGVdKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHN0YXRlKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdGhpcy5vdXRlci5jaGFpbigocGFyYW1zKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbmV3VmFsID0gcGFyYW1zWzBdLCBuZXdTdGF0ZSA9IHBhcmFtc1sxXVxyXG4gICAgICAgIHJldHVybiBmdW5rKG5ld1ZhbCkobmV3U3RhdGUpXHJcbiAgICAgIH0sIHN0YXRlKHByZXZTdGF0ZSkpXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB0aGlzLm91dGVyLmNoYWluKChpbm5lclZhbHVlKSA9PiB0aGlzLm91dGVyLm9mKFtpbm5lclZhbHVlLCBwcmV2U3RhdGVdKSwgdmFsKVxyXG4gIH0sXHJcbiAgbG9hZCAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihbcHJldlN0YXRlLCBwcmV2U3RhdGVdKVxyXG4gIH0sXHJcbiAgc2F2ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZihbdmFsLCB2YWxdKVxyXG4gIH0sXHJcbiAgc3RhdGVmdWxNYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IHRoaXMub3V0ZXIub2YoZnVuayh2YWwsIHByZXZTdGF0ZSkpXHJcbiAgfSxcclxuICBzdGF0ZWZ1bENoYWluKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IGZ1bmsodmFsLCBwcmV2U3RhdGUpXHJcbiAgfSxcclxuICB2YWx1ZSAoZnVuaywgc3RhdGUpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChwYXJhbXMpID0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsocGFyYW1zWzBdKVxyXG4gICAgfSwgc3RhdGUoKSlcclxuICB9XHJcbn1cclxuXHJcbi8qIFxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL2NvbXAuanMpXHJcbiAqL1xyXG5cclxuLyogIyMgUmVmZXJlbmNlc1xyXG4gKiBcclxuICogQWxsIGltYWdlcywgdGFrZW4gZnJvbSBbdGhlIFdpa2lwZWRpYSBhcnRpY2xlIG9uIG1vbmFkIHRyYW5zZm9ybWVyc10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTW9uYWRfdHJhbnNmb3JtZXIpLlxyXG4gKi9cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL2NvbXAuanNcbiAqKi8iLCIvKiAjIEltcGxlbWVudGluZyBhIG1vbmFkIHRyYW5zZm9ybWVyXHJcbiAqXHJcbiAqIE1vbmFkIHRyYW5zZm9ybWVycyBhcmUgdHJpY2t5LCBhbmQgb25lIG9mIHRoZSByZWFzb25zIGZvciB0aGlzIGlzIHRoYXQgdGhleSByZXF1aXJlIGFuXHJcbiAqIGV4Y2Vzc2l2ZSBhbW91bnQgb2YgdHlwZSBqdWdnbGluZy4gWW91IGhhdmUgdG8gY29uc3RhbnRseSB3cmFwIHRoaW5ncyBpbiBib3hlcyBhbmQgdW53cmFwIHRoZW1cclxuICogYWdhaW4uIFxyXG4gKlxyXG4gKiBPbmUgb2YgdGhlIGFpbXMgb2YgdGhpcyBwYWNrYWdlIGlzIHRvIHJlZHVjZSB0aGUgYW1vdW50IG9mIHdyYXBwaW5nIGFuZCB1bndyYXBwaW5nIG5lZWRlZCBmb3JcclxuICogbWFraW5nIGEgbmV3IHRyYW5zZm9ybWVyIGFuZCB0byBwcm92aWRlIGFuIGVhc3kgd2F5IHRvIGRlZmluZSBhbmQgY29tYmluZSB0cmFuc2Zvcm1lcnMuIFxyXG4gKlxyXG4gKiBXaXRoIGl0LCBhbGwgaXQgdGFrZXMgdG8gaW1wbGVtZW50IGEgdHJhbnNmb3JtZXIgaXMgaW1wbGVtZW50IHRoZXNlIGZvdXIgZnVuY3Rpb25zOiBcclxuICogYG9mYCAoQUtBIGByZXR1cm5gKSwgYGNoYWluYCAoQUtBIGBmbGF0TWFwYCkgYGxpZnRgIGFuZCBgdmFsdWVgKEFLQSBgcnVuYClcclxuICpcclxuICogIyMgVGhlIHRyaXZpYWwgaW1wbGVtZW50YXRpb25cclxuICogXHJcbiAqIENvbnNpZGVyIHRoZSBpZGVudGl0eSBNb25hZCB0cmFuc2Zvcm1lci4gVGhpcyBpcyBhIG1vbmFkIHRyYW5zZm9ybWVyIHRoYXQgZG9lcyBub3RoaW5nOiBcclxuICogb3IgaW4gb3RoZXIgd29yZHMgaXQgcHJvZHVjZXMgYSBtb25hZCB3aGljaCBiZWhhdmVzIHRoZSBzYW1lIHdheSBhcyB0aGUgb25lIGl0IGlzIGdpdmVuIHRvIGl0XHJcbiAqIGFzIGFuIGFyZ3VtZW50LiBIZXJlIGlzIGhvdyB3b3VsZCB0aGUgaW1wbGVtZW50YXRpb24gb2YgdGhlc2UgbWV0aG9kcyBsb29rIGxpa2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZE1pbmltYWwgPSB7XHJcbiAgbmFtZTogJ2lkTWluaW1hbCcsXHJcbi8qXHJcbiAqIFRoZSBgb2ZgIGZ1bmN0aW9uIHRha2VzIGEgc2NhbGFyIHZhbHVlIGFuZCByZXR1cm5zIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRlbGVnYXRlIGV2ZXJ5dGhpbmcgdG8gdGhlIG91dGVyIG1vbmFkJ3MgYG9mYCBtZXRob2QuXHJcbiAqIFdlIGFjY2VzcyB0aGUgb3V0ZXIgbW9uYWQgd2l0aCBgdGhpcy5vdXRlcmAuIFxyXG4gKi9cclxuICAvLyAodmFsKSA9PiBNKHZhbClcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZih2YWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIGBjaGFpbmAgaXMgdGhlIGhlYXJ0IG9mIGFueSBtb25hZCBvciBtb25hZCB0cmFuc2Zvcm1lci5cclxuICpcclxuICogSW4gdGhpcyBjYXNlIHdlIGltcGxlbWVudCBpdCBieSBqdXN0IGNhbGxpbmcgdGhlIGBjaGFpbmAgZnVuY3Rpb24gb2YgdGhlIGhvc3QgbW9uYWQgKHVzaW5nIFxyXG4gKiBgdGhpcy5vdXRlci5jaGFpbmApIHdpdGggdGhlIGZ1bmN0aW9uIGdpdmVuIHRvIHVzIGFzIGFuIGFyZ3VtZW50LlxyXG4gKi9cclxuICAvLyAodmFsID0+IE0odmFsKSAsIE0odmFsKSkgPT4gTSh2YWwpXHJcbiAgY2hhaW4gKGZuLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGZuLCB2YWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIFRoZSBgbGlmdGAgZnVuY3Rpb24gaXMga2luZGEgbGlrZSBgb2ZgLCBidXQgaXQgYWNjZXB0cyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWRcclxuICogaW5zdGVhZCBvZiBhICdwbGFpbicgdmFsdWUuXHJcbiAqL1xyXG4gIC8vIChNKHZhbCkpID0+IE0odmFsKVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbFxyXG4gIH0sXHJcbi8qIFxyXG4gKiBIYXZpbmcgYm90aCAnbGlmdCcgYW5kICdvZicgZW5hYmxlcyB1cyB0byBjb252ZXJ0IGFueSB2YWx1ZSBjcmVhdGVkIGJ5IG9uZSBtb25hZCB0cmFuc2Zvcm1lclxyXG4gKiB0byBhIGEgdmFsdWUgdGhhdCBob2xkcyBhbGwgZWxlbWVudHMgb2YgdGhlIHN0YWNrXHJcbiAqXHJcbiAqIEZpbmFsbHkgdGhlIGB2YWx1ZWAgZnVuY3Rpb24gcHJvdmlkZXMgYSB3YXkgdG8gZ2V0ICd0aGUgdmFsdWUgYmFjaydcclxuICogV2hhdCBpdCBkb2VzIGlzIHRvIHVud3JhcCBhIHByZXZpb3VzbHktd3JhcHBlZCBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRpZG4ndCBkbyBhbnkgd3JhcHBpbmcsIHNvIHdlIGRvbid0IGhhdmUgdG8gZG8gYW55IHVud3JhcHBpbmcgZWl0aGVyLlxyXG4gKi9cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0odmFsKSkgPT4gb3RoZXJWYWxcclxuICB2YWx1ZSAoZm4sIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoZm4sIHZhbClcclxuICB9XHJcbn1cclxuXHJcbi8qICMgTWFuaXB1bGF0aW5nIHRoZSB2YWx1ZVxyXG4gKiBcclxuICogQWxsIG1vbmFkIHRyYW5zZm9ybWVycyBkbyB0aGUgc2FtZSB0aGluZyAoZ2l2ZW4gYSBtb25hZCBgQWAsIHRoZXkgcHJvZHVjZSBhXHJcbiAqIG1vbmFkIGBCKEEpYCB3aGljaCBzb21laG93IGF1Z21lbnRzIGBBYCksIGJ1dCB0aGVyZSBpcyBubyBnZW5lcmFsIGZvcm11bGEgZm9yIGRvaW5nIGl0LlxyXG4gKiBcclxuICogU2ltcGxlciBtb25hZHMgY2FuIGJlIGltcGxlbWVudGVkIGp1c3QgYnkgbWFuaXB1bGF0aW5nIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGhvc3QgbW9uYWQuXHJcbiAqXHJcbiAqIE91ciBuZXh0IGltcGxlbWVudGF0aW9uIG9mIElEIHdpbGwganVzdCB3cmFwIHRoZSB1bmRlcmx5aW5nIHZhbHVlICh3aGljaCB3ZSBjYWxsZWQgQSlcclxuICogaW4gYSBwbGFpbiBvYmplY3QuXHJcbiAqXHJcbiAqIFNvIGBNKEEpYCB3b3VsZCBiZWNvbWUgYE0gKHtpZFZhbDpBfSlgIHdoZW4gd2Ugd3JhcCBpdCBhbmQgd2lsbCBiZSBiYWNrIHRvIGBNKEEpYCB3aGVuIHdlXHJcbiAqIHVud3JhcCBpdC5cclxuICpcclxuICogSGVyZSBpcyBob3cgdGhpcyBpbXBsZW1lbnRhdGlvbiB3b3VsZCBsb29rIGxpa2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZCA9IHtcclxuICBuYW1lOiAnSWQnLFxyXG5cclxuLypcclxuICogVGhlIGBvZmAgZnVuY3Rpb24gdGFrZXMgYSBzY2FsYXIgdmFsdWUgYW5kIHJldHVybnMgYW4gaW5zdGFuY2Ugb2YgdGhlIG91dGVyIG1vbmFkLlxyXG4gKiBJbiB0aGlzIGNhc2Ugd2UgZGVsZWdhdGUgZXZlcnl0aGluZyB0byB0aGUgb3V0ZXIgbW9uYWQncyBgb2ZgIG1ldGhvZC5cclxuICogV2UgYWNjZXNzIHRoZSBvdXRlciBtb25hZCB3aXRoIGB0aGlzLm91dGVyYC4gXHJcbiAqL1xyXG5cclxuICAvLyAodmFsKSA9PiBNKHtpZFZhbDp2YWx9KVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsIH0pXHJcbiAgfSxcclxuLyogXHJcbiAqXHJcbiAqIGNoYWluIGp1c3QgY2FsbHMgdGhlIGBjaGFpbmAgZnVuY3Rpb24gb2YgdGhlIGhvc3QgbW9uYWQgbGlrZSBpbiB0aGUgcHJldmlvdXMgZXhhbXBsZS5cclxuICogVGhlIGRpZmZlcmVuY2UgaXMgdGhhdCBpdCBhcHBsaWVzIHNvbWUgdHJhbnNmb3JtYXRpb24gdG8gdGhlIHZhbHVlIGluIG9yZGVyIHRvIGZpdCBcclxuICogdGhlIG5ldyBjb250ZXh0LiBcclxuICovXHJcbiAgLy8gKHZhbCA9PiBNKHtpZFZhbDp2YWx9KSAsIE0oe2lkVmFsOnZhbH0pKSA9PiBNKHtpZFZhbDp2YWx9KVxyXG4gIGNoYWluIChmbiwgbUlkVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigoaWRWYWwpID0+IHtcclxuICAgICAgcmV0dXJuIGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgfSwgbUlkVmFsKVxyXG4gIH0sXHJcbi8qIFxyXG4gKiBUaGUgYGxpZnRgIGZ1bmN0aW9uIHVzZXMgYGNoYWluYCArIGBvZmAgKHdoaWNoIGlzIHRoZSBzYW1lIGFzIGBtYXBgKSB0byBnbyB0byB0aGUgaG9zdCBtb25hZFxyXG4gKiBhbmQgbW9kaWZ5IHRoZSB2YWx1ZSBpbnNpZGUgaXQuXHJcbiAqL1xyXG4gIC8vIChNKHZhbCkpID0+IE0oe2lkVmFsOnZhbH0pXHJcbiAgbGlmdCAobVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKHZhbCkgPT4gdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbH0pLCBtVmFsKVxyXG4gIH0sXHJcbi8qXHJcbiAqIExhc3RseSB3ZSBoYXZlIHRoZSBgdmFsdWVgIGZ1bmN0aW9uIChvciB0aGUgaW50ZXJwcmV0ZXIpLCB3aGljaCB1bndyYXBzIGEgcHJldmlvdXNseS13cmFwcGVkXHJcbiAqIHZhbHVlLlxyXG4gKi9cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0oe2lkVmFsOnZhbH0pKSA9PiBvdGhlclZhbFxyXG4gIHZhbHVlIChmbiwgbUlkVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci52YWx1ZSgoaWRWYWwpPT4ge1xyXG4gICAgICByZXR1cm4gZm4oaWRWYWwuaWRWYWwpXHJcbiAgICB9LCBtSWRWYWwpXHJcbiAgfVxyXG59XHJcblxyXG4vKlxyXG4gKiBOb3RpY2UgdGhhdCB3ZSBhcmUgYWx3YXlzIHJldHVybmluZyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWQuXHJcbiAqXHJcbiAqIFRoYXQgaXMsIGlmIHlvdSBhcmUgdG8gYXBwbHkgdGhlIHRyYW5zZm9ybWF0aW9uIHNldmVyYWwgdGltZXMsXHJcbiAqIHRoZSB2YWx1ZXMgbmVzdCBpbnNpZGUgTTogTSh7aWRWYWw6e2lkVmFsOiBhfX0pXHJcbiAqXHJcbiAqIEhvd2V2ZXIgbm90IGFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgYXJlIGxpa2UgdGhhdC5cclxuICpcclxuICogIyMgQSBtb3JlIGNvbXBsZXggc3RydWN0dXJlXHJcbiAqXHJcbiAqIFNvIGZhciB3ZSBoYXZlIHNlZW4gbW9uYWQgdHJhbnNmb3JtZXJzIHdoaWNoIG9ubHkgZGVhbCB3aXRoIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGdpdmVuXHJcbiAqIG1vbmFkIEEuIEhvd2V2ZXIgbm90IGFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgYXJlIGxpa2UgdGhhdC4gXHJcbiAqXHJcbiAqIFRoZXJlIGFyZSBtb25hZCB0cmFuc2Zvcm1lcnMgd2hpY2ggYWRkIGFkZGl0aW9uYWwgc3RydWN0dXJlIHRvIHRoZSBtb25hZCBpdHNlbGYuXHJcbiAqIEV4YW1wbGVzIG9mIHRoZSBmaXJzdCB0eXBlIGFyZSBhbGwgdHJhbnNmb3JtZXJzIHRoYXQgd2UgaGF2ZSBzZWVuIHNvIGZhci5cclxuICogQW4gZXhhbXBsZSBvZiB0aGUgc2Vjb25kIHR5cGUgaXMgdGhlICdTdGF0ZScgbW9uYWQsIHdoaWNoIGdpdmVuIHRoZSBzYW1lIHZhbHVlIGBNKEEpYCwgd2lsbCBcclxuICogcHJvZHVjZSBzb21ldGhpbmcgbGlrZSBgKCkgPT57IE0oW0EsIFN0YXRlXSkgfWAuIFRoYXQgaXMsIHRoZSB0cmFuc2Zvcm1lciBhZGRzIHRoZSBzdGF0ZVxyXG4gKiB2YWx1ZSB0byB0aGUgJ2hvc3QnIG1vbmFkIGBNYCwgYW5kIHRoZW4gaXQgd3JhcHMgdGhlIG1vbmFkIGl0c2VsZiBpbiBhIGZ1bmN0aW9uLlxyXG4gKlxyXG4gKiBOb3cgY29uc2lkZXIgYW4gYWx0ZXJuYXRpdmUsIGEgbGl0dGxlIG1vcmUgY29tcGxleCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSUQgbW9uYWQuIE9uZVxyXG4gKiB3aGljaCB3cmFwcyB0aGUgTSBtb25hZCBpbnRvIGFub3RoZXIgcGxhaW4gb2JqZWN0LCBzbyB0aGUgdmFsdWUgb2YgTShBKSBiZWNvbWVzXHJcbiAqIGB7aWRDb250YWluZXI6IE0oe2lkVmFsOmF9KX1gLiBOb3RpY2UgdGhhdCB0aGUgdHJhbnNmb3JtZXIgY29uc2lzdHMgb2YgdHdvIHBhcnRzOiBvbmUgd2hpY2ggXHJcbiAqIHdyYXBzIGFyb3VuZCB0aGUgaG9zdCBtb25hZCwgYW5kIG9uZSB3aGljaCB3cmFwcyBhcm91bmQgdGhlIHZhbHVlIGluIGl0LlxyXG4gKi9cclxuXHJcbmV4cG9ydHMuaWRXcmFwcGVkID0ge1xyXG4gIG5hbWU6ICdJZFdyYXBwZWQnLFxyXG5cclxuICAvLyAodmFsKSA9PiB7aWRDb250YWluZXI6IE0oe2lkVmFsOmF9KX1cclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZENvbnRhaW5lcjogdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbH0pXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLy8gKGEgPT4ge2lkQ29udGFpbmVyOk0oe2lkVmFsOmF9KX0sIHtpZENvbnRhaW5lcjpNKHtpZFZhbDphfSl9KSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfVxyXG4gIGNoYWluIChmbiwgaWRDb250YWluZXJNSWRWYWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLmNoYWluKChpZFZhbCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgICAgIHJldHVybiB2YWwuaWRDb250YWluZXJcclxuICAgICAgfSwgaWRDb250YWluZXJNSWRWYWwuaWRDb250YWluZXIpXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLy8gKE0odmFsKSkgPT4ge2lkQ29udGFpbmVyOk0oe2lkVmFsOnZhbH0pfVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWx9KSwgbVZhbClcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIHtpZENvbnRhaW5lcjogTSh7aWRWYWw6dmFsfSkpfT0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZuLCBpZENvbnRhaW5lck1JZFZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGlkVmFsKT0+IHtcclxuICAgICAgcmV0dXJuIGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgfSwgaWRDb250YWluZXJNSWRWYWwuaWRDb250YWluZXIpXHJcbiAgfVxyXG59XHJcblxyXG4vKiBUaGUga2V5IGRpZmZlcmVuY2UgaXMgdGhhdCB3aXRoIHRoaXMgbW9uYWQgbmVzdGluZyBoYXBwZW5zIGJvdGggaW5zaWRlIHRoZSBob3N0IG1vbmFkIGFuZFxyXG4gKiBvdXRzaWRlIG9mIGl0LiBJZiB3ZSBhcHBseSB0aGUgdHJhbnNmb3JtYXRpb24gdHdvIHRpbWVzIHRoZSB2YWx1ZSBiZWNvbWVzOlxyXG4gKiBge2lkQ29udGFpbmVyOntpZENvbnRhaW5lcjpNKHtpZFZhbDp7aWRWYWw6YX19KX19YC5cclxuICovXHJcblxyXG4vKlxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL2lkLmpzKVxyXG4gKi9cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL2lkLmpzXG4gKiovIiwiXHJcbmNvbnN0IFRhc2sgPSByZXF1aXJlKCdkYXRhLnRhc2snKVxyXG5cclxuZXhwb3J0cy50YXNrID0ge1xyXG4gIC8vICh2YWwpID0+IFRhc2sodmFsKVxyXG4gIG9mOiBUYXNrLm9mLFxyXG4gIC8vICh2YWwgPT4gVGFzayh2YWwpLCBUYXNrKHZhbCkpID0+IFRhc2sodmFsKVxyXG4gIGNoYWluKGZuLCB0YXNrKSB7XHJcbiAgICByZXR1cm4gdGFzay5jaGFpbihmbikgICAgIFxyXG4gIH0sXHJcbiAgLy8gKHZhbCkgPT4gVGFzayh2YWwpXHJcbiAgbGlmdDogVGFzay5vZixcclxuXHJcbiAgLy8gKCh2YWwpID0+IG90aGVyVmFsLCBUYXNrKHZhbCkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUoZm4sIHRhc2spIHtcclxuICAgIHRhc2suZm9yaygoYSk9PmEsIGZuKVxyXG4gIH0sXHJcbiAgZnJvbVRhc2soZm4pIHtcclxuICAgIHJldHVybiBuZXcgVGFzayhmbilcclxuICB9LFxyXG4gIGNvbnQgKGZuLCB2YWwpIHtcclxuICAgIHJldHVybiBuZXcgVGFzayhmbih2YWwpKVxyXG4gIH0sXHJcbiAgcmVqZWN0ZWQ6IFRhc2sucmVqZWN0ZWRcclxufVxyXG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiBDOi9wci9zb25uZS9saWIvYmFzZS5qc1xuICoqLyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi90YXNrJyk7XG5cblxuXG4vKioqKioqKioqKioqKioqKipcbiAqKiBXRUJQQUNLIEZPT1RFUlxuICoqIC4vfi9kYXRhLnRhc2svbGliL2luZGV4LmpzXG4gKiogbW9kdWxlIGlkID0gOFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbi8qKlxuICogQSBoZWxwZXIgZm9yIGRlbGF5aW5nIHRoZSBleGVjdXRpb24gb2YgYSBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKiBAc3VtbWFyeSAoQW55Li4uIC0+IEFueSkgLT4gVm9pZFxuICovXG52YXIgZGVsYXllZCA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnPyAgc2V0SW1tZWRpYXRlXG4gICAgICAgICAgICA6IHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJz8gICAgICAgcHJvY2Vzcy5uZXh0VGlja1xuICAgICAgICAgICAgOiAvKiBvdGhlcndpc2UgKi8gICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXRcblxuLyoqXG4gKiBAbW9kdWxlIGxpYi90YXNrXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gVGFzaztcblxuLy8gLS0gSW1wbGVtZW50YXRpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogVGhlIGBUYXNrW86xLCDOsl1gIHN0cnVjdHVyZSByZXByZXNlbnRzIHZhbHVlcyB0aGF0IGRlcGVuZCBvbiB0aW1lLiBUaGlzXG4gKiBhbGxvd3Mgb25lIHRvIG1vZGVsIHRpbWUtYmFzZWQgZWZmZWN0cyBleHBsaWNpdGx5LCBzdWNoIHRoYXQgb25lIGNhbiBoYXZlXG4gKiBmdWxsIGtub3dsZWRnZSBvZiB3aGVuIHRoZXkncmUgZGVhbGluZyB3aXRoIGRlbGF5ZWQgY29tcHV0YXRpb25zLCBsYXRlbmN5LFxuICogb3IgYW55dGhpbmcgdGhhdCBjYW4gbm90IGJlIGNvbXB1dGVkIGltbWVkaWF0ZWx5LlxuICpcbiAqIEEgY29tbW9uIHVzZSBmb3IgdGhpcyBzdHJ1Y3R1cmUgaXMgdG8gcmVwbGFjZSB0aGUgdXN1YWwgQ29udGludWF0aW9uLVBhc3NpbmdcbiAqIFN0eWxlIGZvcm0gb2YgcHJvZ3JhbW1pbmcsIGluIG9yZGVyIHRvIGJlIGFibGUgdG8gY29tcG9zZSBhbmQgc2VxdWVuY2VcbiAqIHRpbWUtZGVwZW5kZW50IGVmZmVjdHMgdXNpbmcgdGhlIGdlbmVyaWMgYW5kIHBvd2VyZnVsIG1vbmFkaWMgb3BlcmF0aW9ucy5cbiAqXG4gKiBAY2xhc3NcbiAqIEBzdW1tYXJ5XG4gKiAoKM6xIOKGkiBWb2lkKSwgKM6yIOKGkiBWb2lkKSDihpIgVm9pZCksIChWb2lkIOKGkiBWb2lkKSDihpIgVGFza1vOsSwgzrJdXG4gKlxuICogVGFza1vOsSwgzrJdIDw6IENoYWluW86yXVxuICogICAgICAgICAgICAgICAsIE1vbmFkW86yXVxuICogICAgICAgICAgICAgICAsIEZ1bmN0b3JbzrJdXG4gKiAgICAgICAgICAgICAgICwgQXBwbGljYXRpdmVbzrJdXG4gKiAgICAgICAgICAgICAgICwgU2VtaWdyb3VwW86yXVxuICogICAgICAgICAgICAgICAsIE1vbm9pZFvOsl1cbiAqICAgICAgICAgICAgICAgLCBTaG93XG4gKi9cbmZ1bmN0aW9uIFRhc2soY29tcHV0YXRpb24sIGNsZWFudXApIHtcbiAgdGhpcy5mb3JrID0gY29tcHV0YXRpb247XG5cbiAgdGhpcy5jbGVhbnVwID0gY2xlYW51cCB8fCBmdW5jdGlvbigpIHt9O1xufVxuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBuZXcgYFRhc2tbzrEsIM6yXWAgY29udGFpbmluZyB0aGUgc2luZ2xlIHZhbHVlIGDOsmAuXG4gKlxuICogYM6yYCBjYW4gYmUgYW55IHZhbHVlLCBpbmNsdWRpbmcgYG51bGxgLCBgdW5kZWZpbmVkYCwgb3IgYW5vdGhlclxuICogYFRhc2tbzrEsIM6yXWAgc3RydWN0dXJlLlxuICpcbiAqIEBzdW1tYXJ5IM6yIOKGkiBUYXNrW86xLCDOsl1cbiAqL1xuVGFzay5wcm90b3R5cGUub2YgPSBmdW5jdGlvbiBfb2YoYikge1xuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24oXywgcmVzb2x2ZSkge1xuICAgIHJldHVybiByZXNvbHZlKGIpO1xuICB9KTtcbn07XG5cblRhc2sub2YgPSBUYXNrLnByb3RvdHlwZS5vZjtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgbmV3IGBUYXNrW86xLCDOsl1gIGNvbnRhaW5pbmcgdGhlIHNpbmdsZSB2YWx1ZSBgzrFgLlxuICpcbiAqIGDOsWAgY2FuIGJlIGFueSB2YWx1ZSwgaW5jbHVkaW5nIGBudWxsYCwgYHVuZGVmaW5lZGAsIG9yIGFub3RoZXJcbiAqIGBUYXNrW86xLCDOsl1gIHN0cnVjdHVyZS5cbiAqXG4gKiBAc3VtbWFyeSDOsSDihpIgVGFza1vOsSwgzrJdXG4gKi9cblRhc2sucHJvdG90eXBlLnJlamVjdGVkID0gZnVuY3Rpb24gX3JlamVjdGVkKGEpIHtcbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCkge1xuICAgIHJldHVybiByZWplY3QoYSk7XG4gIH0pO1xufTtcblxuVGFzay5yZWplY3RlZCA9IFRhc2sucHJvdG90eXBlLnJlamVjdGVkO1xuXG4vLyAtLSBGdW5jdG9yIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBUcmFuc2Zvcm1zIHRoZSBzdWNjZXNzZnVsIHZhbHVlIG9mIHRoZSBgVGFza1vOsSwgzrJdYCB1c2luZyBhIHJlZ3VsYXIgdW5hcnlcbiAqIGZ1bmN0aW9uLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6yIOKGkiDOsykg4oaSIFRhc2tbzrEsIM6zXVxuICovXG5UYXNrLnByb3RvdHlwZS5tYXAgPSBmdW5jdGlvbiBfbWFwKGYpIHtcbiAgdmFyIGZvcmsgPSB0aGlzLmZvcms7XG4gIHZhciBjbGVhbnVwID0gdGhpcy5jbGVhbnVwO1xuXG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihyZWplY3QsIHJlc29sdmUpIHtcbiAgICByZXR1cm4gZm9yayhmdW5jdGlvbihhKSB7XG4gICAgICByZXR1cm4gcmVqZWN0KGEpO1xuICAgIH0sIGZ1bmN0aW9uKGIpIHtcbiAgICAgIHJldHVybiByZXNvbHZlKGYoYikpO1xuICAgIH0pO1xuICB9LCBjbGVhbnVwKTtcbn07XG5cbi8vIC0tIENoYWluIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgdGhlIHN1Y2Nlc2Z1bCB2YWx1ZSBvZiB0aGUgYFRhc2tbzrEsIM6yXWAgdXNpbmcgYSBmdW5jdGlvbiB0byBhXG4gKiBtb25hZC5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+ICjOsiDihpIgVGFza1vOsSwgzrNdKSDihpIgVGFza1vOsSwgzrNdXG4gKi9cblRhc2sucHJvdG90eXBlLmNoYWluID0gZnVuY3Rpb24gX2NoYWluKGYpIHtcbiAgdmFyIGZvcmsgPSB0aGlzLmZvcms7XG4gIHZhciBjbGVhbnVwID0gdGhpcy5jbGVhbnVwO1xuXG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihyZWplY3QsIHJlc29sdmUpIHtcbiAgICByZXR1cm4gZm9yayhmdW5jdGlvbihhKSB7XG4gICAgICByZXR1cm4gcmVqZWN0KGEpO1xuICAgIH0sIGZ1bmN0aW9uKGIpIHtcbiAgICAgIHJldHVybiBmKGIpLmZvcmsocmVqZWN0LCByZXNvbHZlKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vLyAtLSBBcHBseSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBcHBseXMgdGhlIHN1Y2Nlc3NmdWwgdmFsdWUgb2YgdGhlIGBUYXNrW86xLCAozrIg4oaSIM6zKV1gIHRvIHRoZSBzdWNjZXNzZnVsXG4gKiB2YWx1ZSBvZiB0aGUgYFRhc2tbzrEsIM6yXWBcbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgKM6yIOKGkiDOsyldID0+IFRhc2tbzrEsIM6yXSDihpIgVGFza1vOsSwgzrNdXG4gKi9cblxuVGFzay5wcm90b3R5cGUuYXAgPSBmdW5jdGlvbiBfYXAoZjIpIHtcbiAgcmV0dXJuIHRoaXMuY2hhaW4oZnVuY3Rpb24oZikge1xuICAgIHJldHVybiBmMi5tYXAoZik7XG4gIH0pO1xufTtcblxuLy8gLS0gU2VtaWdyb3VwIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFNlbGVjdHMgdGhlIGVhcmxpZXIgb2YgdGhlIHR3byB0YXNrcyBgVGFza1vOsSwgzrJdYFxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gVGFza1vOsSwgzrJdIOKGkiBUYXNrW86xLCDOsl1cbiAqL1xuXG5UYXNrLnByb3RvdHlwZS5jb25jYXQgPSBmdW5jdGlvbiBfY29uY2F0KHRoYXQpIHtcbiAgdmFyIGZvcmtUaGlzID0gdGhpcy5mb3JrO1xuICB2YXIgZm9ya1RoYXQgPSB0aGF0LmZvcms7XG4gIHZhciBjbGVhbnVwVGhpcyA9IHRoaXMuY2xlYW51cDtcbiAgdmFyIGNsZWFudXBUaGF0ID0gdGhhdC5jbGVhbnVwO1xuXG4gIGZ1bmN0aW9uIGNsZWFudXBCb3RoKHN0YXRlKSB7XG4gICAgY2xlYW51cFRoaXMoc3RhdGVbMF0pO1xuICAgIGNsZWFudXBUaGF0KHN0YXRlWzFdKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihyZWplY3QsIHJlc29sdmUpIHtcbiAgICB2YXIgZG9uZSA9IGZhbHNlO1xuICAgIHZhciBhbGxTdGF0ZTtcbiAgICB2YXIgdGhpc1N0YXRlID0gZm9ya1RoaXMoZ3VhcmQocmVqZWN0KSwgZ3VhcmQocmVzb2x2ZSkpO1xuICAgIHZhciB0aGF0U3RhdGUgPSBmb3JrVGhhdChndWFyZChyZWplY3QpLCBndWFyZChyZXNvbHZlKSk7XG5cbiAgICByZXR1cm4gYWxsU3RhdGUgPSBbdGhpc1N0YXRlLCB0aGF0U3RhdGVdO1xuXG4gICAgZnVuY3Rpb24gZ3VhcmQoZikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgaWYgKCFkb25lKSB7XG4gICAgICAgICAgZG9uZSA9IHRydWU7XG4gICAgICAgICAgZGVsYXllZChmdW5jdGlvbigpeyBjbGVhbnVwQm90aChhbGxTdGF0ZSkgfSlcbiAgICAgICAgICByZXR1cm4gZih4KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9XG4gIH0sIGNsZWFudXBCb3RoKTtcblxufTtcblxuLy8gLS0gTW9ub2lkIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFJldHVybnMgYSBUYXNrIHRoYXQgd2lsbCBuZXZlciByZXNvbHZlXG4gKlxuICogQHN1bW1hcnkgVm9pZCDihpIgVGFza1vOsSwgX11cbiAqL1xuVGFzay5lbXB0eSA9IGZ1bmN0aW9uIF9lbXB0eSgpIHtcbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKCkge30pO1xufTtcblxuVGFzay5wcm90b3R5cGUuZW1wdHkgPSBUYXNrLmVtcHR5O1xuXG4vLyAtLSBTaG93IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBSZXR1cm5zIGEgdGV4dHVhbCByZXByZXNlbnRhdGlvbiBvZiB0aGUgYFRhc2tbzrEsIM6yXWBcbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+IFZvaWQg4oaSIFN0cmluZ1xuICovXG5UYXNrLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIF90b1N0cmluZygpIHtcbiAgcmV0dXJuICdUYXNrJztcbn07XG5cbi8vIC0tIEV4dHJhY3RpbmcgYW5kIHJlY292ZXJpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgYSBmYWlsdXJlIHZhbHVlIGludG8gYSBuZXcgYFRhc2tbzrEsIM6yXWAuIERvZXMgbm90aGluZyBpZiB0aGVcbiAqIHN0cnVjdHVyZSBhbHJlYWR5IGNvbnRhaW5zIGEgc3VjY2Vzc2Z1bCB2YWx1ZS5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+ICjOsSDihpIgVGFza1vOsywgzrJdKSDihpIgVGFza1vOsywgzrJdXG4gKi9cblRhc2sucHJvdG90eXBlLm9yRWxzZSA9IGZ1bmN0aW9uIF9vckVsc2UoZikge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiBmKGEpLmZvcmsocmVqZWN0LCByZXNvbHZlKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShiKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vLyAtLSBGb2xkcyBhbmQgZXh0ZW5kZWQgdHJhbnNmb3JtYXRpb25zIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDYXRhbW9ycGhpc20uIFRha2VzIHR3byBmdW5jdGlvbnMsIGFwcGxpZXMgdGhlIGxlZnRtb3N0IG9uZSB0byB0aGUgZmFpbHVyZVxuICogdmFsdWUsIGFuZCB0aGUgcmlnaHRtb3N0IG9uZSB0byB0aGUgc3VjY2Vzc2Z1bCB2YWx1ZSwgZGVwZW5kaW5nIG9uIHdoaWNoIG9uZVxuICogaXMgcHJlc2VudC5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+ICjOsSDihpIgzrMpLCAozrIg4oaSIM6zKSDihpIgVGFza1vOtCwgzrNdXG4gKi9cblRhc2sucHJvdG90eXBlLmZvbGQgPSBmdW5jdGlvbiBfZm9sZChmLCBnKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZihhKSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZyhiKSk7XG4gICAgfSk7XG4gIH0sIGNsZWFudXApO1xufTtcblxuLyoqXG4gKiBDYXRhbW9ycGhpc20uXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiB7IFJlamVjdGVkOiDOsSDihpIgzrMsIFJlc29sdmVkOiDOsiDihpIgzrMgfSDihpIgVGFza1vOtCwgzrNdXG4gKi9cblRhc2sucHJvdG90eXBlLmNhdGEgPSBmdW5jdGlvbiBfY2F0YShwYXR0ZXJuKSB7XG4gIHJldHVybiB0aGlzLmZvbGQocGF0dGVybi5SZWplY3RlZCwgcGF0dGVybi5SZXNvbHZlZCk7XG59O1xuXG4vKipcbiAqIFN3YXBzIHRoZSBkaXNqdW5jdGlvbiB2YWx1ZXMuXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiBWb2lkIOKGkiBUYXNrW86yLCDOsV1cbiAqL1xuVGFzay5wcm90b3R5cGUuc3dhcCA9IGZ1bmN0aW9uIF9zd2FwKCkge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZXNvbHZlKGEpO1xuICAgIH0sIGZ1bmN0aW9uKGIpIHtcbiAgICAgIHJldHVybiByZWplY3QoYik7XG4gICAgfSk7XG4gIH0sIGNsZWFudXApO1xufTtcblxuLyoqXG4gKiBNYXBzIGJvdGggc2lkZXMgb2YgdGhlIGRpc2p1bmN0aW9uLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiDOsyksICjOsiDihpIgzrQpIOKGkiBUYXNrW86zLCDOtF1cbiAqL1xuVGFzay5wcm90b3R5cGUuYmltYXAgPSBmdW5jdGlvbiBfYmltYXAoZiwgZykge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZWplY3QoZihhKSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZyhiKSk7XG4gICAgfSk7XG4gIH0sIGNsZWFudXApO1xufTtcblxuLyoqXG4gKiBNYXBzIHRoZSBsZWZ0IHNpZGUgb2YgdGhlIGRpc2p1bmN0aW9uIChmYWlsdXJlKS5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+ICjOsSDihpIgzrMpIOKGkiBUYXNrW86zLCDOsl1cbiAqL1xuVGFzay5wcm90b3R5cGUucmVqZWN0ZWRNYXAgPSBmdW5jdGlvbiBfcmVqZWN0ZWRNYXAoZikge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZWplY3QoZihhKSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlc29sdmUoYik7XG4gICAgfSk7XG4gIH0sIGNsZWFudXApO1xufTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RhdGEudGFzay9saWIvdGFzay5qc1xuICoqIG1vZHVsZSBpZCA9IDlcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsInZhciBuZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MvYnJvd3Nlci5qcycpLm5leHRUaWNrO1xudmFyIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5O1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGltbWVkaWF0ZUlkcyA9IHt9O1xudmFyIG5leHRJbW1lZGlhdGVJZCA9IDA7XG5cbi8vIERPTSBBUElzLCBmb3IgY29tcGxldGVuZXNzXG5cbmV4cG9ydHMuc2V0VGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRUaW1lb3V0LCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFyVGltZW91dCk7XG59O1xuZXhwb3J0cy5zZXRJbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFRpbWVvdXQoYXBwbHkuY2FsbChzZXRJbnRlcnZhbCwgd2luZG93LCBhcmd1bWVudHMpLCBjbGVhckludGVydmFsKTtcbn07XG5leHBvcnRzLmNsZWFyVGltZW91dCA9XG5leHBvcnRzLmNsZWFySW50ZXJ2YWwgPSBmdW5jdGlvbih0aW1lb3V0KSB7IHRpbWVvdXQuY2xvc2UoKTsgfTtcblxuZnVuY3Rpb24gVGltZW91dChpZCwgY2xlYXJGbikge1xuICB0aGlzLl9pZCA9IGlkO1xuICB0aGlzLl9jbGVhckZuID0gY2xlYXJGbjtcbn1cblRpbWVvdXQucHJvdG90eXBlLnVucmVmID0gVGltZW91dC5wcm90b3R5cGUucmVmID0gZnVuY3Rpb24oKSB7fTtcblRpbWVvdXQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX2NsZWFyRm4uY2FsbCh3aW5kb3csIHRoaXMuX2lkKTtcbn07XG5cbi8vIERvZXMgbm90IHN0YXJ0IHRoZSB0aW1lLCBqdXN0IHNldHMgdXAgdGhlIG1lbWJlcnMgbmVlZGVkLlxuZXhwb3J0cy5lbnJvbGwgPSBmdW5jdGlvbihpdGVtLCBtc2Vjcykge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gbXNlY3M7XG59O1xuXG5leHBvcnRzLnVuZW5yb2xsID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG4gIGl0ZW0uX2lkbGVUaW1lb3V0ID0gLTE7XG59O1xuXG5leHBvcnRzLl91bnJlZkFjdGl2ZSA9IGV4cG9ydHMuYWN0aXZlID0gZnVuY3Rpb24oaXRlbSkge1xuICBjbGVhclRpbWVvdXQoaXRlbS5faWRsZVRpbWVvdXRJZCk7XG5cbiAgdmFyIG1zZWNzID0gaXRlbS5faWRsZVRpbWVvdXQ7XG4gIGlmIChtc2VjcyA+PSAwKSB7XG4gICAgaXRlbS5faWRsZVRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gb25UaW1lb3V0KCkge1xuICAgICAgaWYgKGl0ZW0uX29uVGltZW91dClcbiAgICAgICAgaXRlbS5fb25UaW1lb3V0KCk7XG4gICAgfSwgbXNlY3MpO1xuICB9XG59O1xuXG4vLyBUaGF0J3Mgbm90IGhvdyBub2RlLmpzIGltcGxlbWVudHMgaXQgYnV0IHRoZSBleHBvc2VkIGFwaSBpcyB0aGUgc2FtZS5cbmV4cG9ydHMuc2V0SW1tZWRpYXRlID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gc2V0SW1tZWRpYXRlIDogZnVuY3Rpb24oZm4pIHtcbiAgdmFyIGlkID0gbmV4dEltbWVkaWF0ZUlkKys7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzLmxlbmd0aCA8IDIgPyBmYWxzZSA6IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICBpbW1lZGlhdGVJZHNbaWRdID0gdHJ1ZTtcblxuICBuZXh0VGljayhmdW5jdGlvbiBvbk5leHRUaWNrKCkge1xuICAgIGlmIChpbW1lZGlhdGVJZHNbaWRdKSB7XG4gICAgICAvLyBmbi5jYWxsKCkgaXMgZmFzdGVyIHNvIHdlIG9wdGltaXplIGZvciB0aGUgY29tbW9uIHVzZS1jYXNlXG4gICAgICAvLyBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL2NhbGwtYXBwbHktc2VndVxuICAgICAgaWYgKGFyZ3MpIHtcbiAgICAgICAgZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbi5jYWxsKG51bGwpO1xuICAgICAgfVxuICAgICAgLy8gUHJldmVudCBpZHMgZnJvbSBsZWFraW5nXG4gICAgICBleHBvcnRzLmNsZWFySW1tZWRpYXRlKGlkKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpZDtcbn07XG5cbmV4cG9ydHMuY2xlYXJJbW1lZGlhdGUgPSB0eXBlb2YgY2xlYXJJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IGNsZWFySW1tZWRpYXRlIDogZnVuY3Rpb24oaWQpIHtcbiAgZGVsZXRlIGltbWVkaWF0ZUlkc1tpZF07XG59O1xuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzXG4gKiogbW9kdWxlIGlkID0gMTBcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyJdLCJzb3VyY2VSb290IjoiIn0=