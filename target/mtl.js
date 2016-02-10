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
	var createStack = __webpack_require__(1);
	mtl.make = function () {
	  return createStack(Array.prototype.slice.call(arguments)).constructor;
	};
	
	/* ## Monad transformer definitions
	 * 
	 * The library contains four [monad transformer definitions](api.md), distributed in two packages:
	 * `data` and `comp`. It also contains three versions of the identity monad transformer, useful
	 * as a reference when implementing [custom monad transformers](implementing-transformer.md).
	 *
	 */
	mtl.data = __webpack_require__(10);
	mtl.comp = __webpack_require__(11);
	mtl.id = __webpack_require__(12);
	
	/* ## Base monads
	 * 
	 * When stacking monad transformers, a you must place one plain monad at the bottom of the stack.
	 * This monad serves as the stack's base. 
	 *
	 * By default, the package uses the identity monad as a base but it also defines a wrapper which
	 * allow you to use the [Task monad from Folktale](https://github.com/folktale/data.task) as a base.
	 */
	
	mtl.base = __webpack_require__(2);
	
	/* ## Predefined stacks
	 * 
	 * The library features five predefined monad stacks.
	 *
	 */
	mtl.simple = mtl.make(mtl.data.maybe, mtl.data.writer);
	mtl.stateful = mtl.make(mtl.data.maybe, mtl.data.writer, mtl.comp.state);
	mtl.list = mtl.make(mtl.data.list, mtl.data.maybe, mtl.data.writer);
	mtl.statelist = mtl.make(mtl.data.list, mtl.data.maybe, mtl.data.writer, mtl.comp.state);
	
	mtl.advanced = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.state);
	
	/*
	 * ## Helpers
	 *
	 * Some helper functions that we want to keep handy:
	 */
	var helpers = __webpack_require__(8);
	mtl.curry = helpers.curry;
	mtl.compose = helpers.compose;
	
	module.exports = mtl;
	/*
	 * [_View in GitHub_](../lib/main.js)
	 */

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }
	
	var base = __webpack_require__(2);
	var assign = __webpack_require__(7);
	var helpers = __webpack_require__(8);
	var wrapper = __webpack_require__(9);
	
	module.exports = function createStack(monadStack) {
	  // Generate errors
	  var error = new Error('The first argument must be a stack member');
	
	  // Add the ID monad at the bottom of the monad stack
	  var stack = [base.id].concat(monadStack);
	
	  //Verify input
	  stack.forEach(function (member) {
	    if ((typeof member === 'undefined' ? 'undefined' : _typeof(member)) !== 'object') {
	      throw new Error('Stack members must be objects');
	    }
	  });
	
	  // Perform some preprocessing on the stack
	  return processStack(stack).slice(-1)[0];
	};
	
	// Applies the processing function on each stack member,
	// passing the previous (outer) member as an argument
	var processStack = function processStack(baseStack) {
	  return helpers.statefulMap(baseStack, function (item, state) {
	    var itemProcessed = addConstructor(processProtoNew(item, state));
	    return [itemProcessed, itemProcessed];
	  });
	};
	
	var convertOuterFunction = function convertOuterFunction(funk, object) {
	  return function () {
	    return this.lift(funk.apply(object, arguments));
	  };
	};
	var asyncCompose = function asyncCompose(thisRun, outerRun) {
	  thisRun = thisRun || function (fn, val) {
	    return fn(val);
	  };
	  outerRun = outerRun || function (fn, val) {
	    return fn(val);
	  };
	  return function (fn, val) {
	    return thisRun.call(this, outerRun.bind(this, fn), val);
	  };
	};
	var addConstructor = function addConstructor(object) {
	  object.constructor = wrapper(object);
	  return object;
	};
	
	// Adds context to a stack member
	var processProtoNew = function processProtoNew(proto, outerProto) {
	  return assign({}, proto, {
	    fold: asyncCompose(outerProto.fold, proto.fold),
	    run: asyncCompose(proto.run, outerProto.run),
	    outer: outerProto,
	    name: proto.name + '/' + outerProto.name
	  }, helpers.monadMapVals(convertOuterFunction, outerProto));
	};

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var Task = __webpack_require__(3);
	var idFunc = function idFunc(a) {
	  return a;
	};
	
	// A monad definition that wires a 'data.task' instance as a base for a transformer stack
	exports.task = {
	  name: "Data.Task",
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
	  run: function run(fn, task) {
	    task.fork(function (err) {
	      return fn({ taskError: err });
	    }, function (val) {
	      return fn({ taskSuccess: val });
	    });
	  },
	  fold: function fold(value, val) {
	    return val.hasOwnProperty('taskSuccess') ? value(val.taskSuccess) : (this.onTaskError || idFunc)(val.taskError);
	  },
	  fromContinuation: function fromContinuation(fn) {
	    if (typeof fn !== 'function') {
	      throw fn + ' is not a function';
	    }
	    return new Task(fn);
	  },
	  fromTask: function fromTask(task) {
	    return task;
	  },
	  cont: function cont(fn, val) {
	    var fnVal = fn(val);
	    if (typeof fnVal !== 'function') {
	      throw fnVal + ' is not a function';
	    }
	    return new Task(fnVal);
	  },
	
	  rejected: Task.rejected
	};
	
	// The identity monad, which is used by default as a base
	exports.id = {
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
	  },
	  run: function run(funk, val) {
	    return funk(val);
	  },
	  fold: function fold(value, val) {
	    return value(val);
	  }
	};

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(4);


/***/ },
/* 4 */
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
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(5).setImmediate, __webpack_require__(6)))

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate, clearImmediate) {var nextTick = __webpack_require__(6).nextTick;
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
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(5).setImmediate, __webpack_require__(5).clearImmediate))

/***/ },
/* 6 */
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
/* 7 */
/***/ function(module, exports) {

	/* eslint-disable no-unused-vars */
	'use strict';
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;
	
	function toObject(val) {
		if (val === null || val === undefined) {
			throw new TypeError('Object.assign cannot be called with null or undefined');
		}
	
		return Object(val);
	}
	
	module.exports = Object.assign || function (target, source) {
		var from;
		var to = toObject(target);
		var symbols;
	
		for (var s = 1; s < arguments.length; s++) {
			from = Object(arguments[s]);
	
			for (var key in from) {
				if (hasOwnProperty.call(from, key)) {
					to[key] = from[key];
				}
			}
	
			if (Object.getOwnPropertySymbols) {
				symbols = Object.getOwnPropertySymbols(from);
				for (var i = 0; i < symbols.length; i++) {
					if (propIsEnumerable.call(from, symbols[i])) {
						to[symbols[i]] = from[symbols[i]];
					}
				}
			}
		}
	
		return to;
	};


/***/ },
/* 8 */
/***/ function(module, exports) {

	"use strict";
	
	exports.curry = function curry(funk, initial_arguments) {
		var context = this;
		return function () {
			var all_arguments = (initial_arguments || []).concat(Array.prototype.slice.call(arguments, 0));
			return all_arguments.length >= funk.length ? funk.apply(context, all_arguments) : curry(funk, all_arguments);
		};
	};
	
	exports.compose = function () {
		//Convert functions to an array and flip them (for right-to-left execution)
		var functions = Array.prototype.slice.call(arguments).reverse();
		//Check if input is OK:
		functions.forEach(function (funk) {
			if (typeof funk !== "function") {
				throw new TypeError(funk + " is not a function");
			}
		});
		//Return the function which composes them
		return function () {
			//Take the initial input
			var input = arguments;
			var context;
			return functions.reduce(function (return_result, funk, i) {
				//If this is the first iteration, apply the arguments that the user provided
				//else use the return result from the previous function
				return i === 0 ? funk.apply(context, input) : funk(return_result);
				//return (i ===0?funk.apply(context, input): funk.apply(context, [return_result]))
			}, undefined);
		};
	};
	//
	//combines an array of async functions with signature into one functions.
	// [ (callback, value) => () ] => (value) => ()
	exports.asyncCompose = function (functions, self) {
		return functions.reduce(function (f, newF) {
			return function (val) {
				return newF.call(self, f, val);
			};
		});
	};
	var baseMonadFunctions = ['of', 'chain', 'lift'];
	
	var optionalMonadFunctions = ['fold', 'run', 'value', 'map', 'outer', 'name'];
	
	var isIn = function isIn(arr) {
		return function (val) {
			return arr.indexOf(val) === -1;
		};
	};
	
	// Checks if a given property is part of the general monad definition interface
	var isReserverMonadKey = isIn(baseMonadFunctions.concat(optionalMonadFunctions));
	
	// Maps the values of a given obj excluding the reserved ones.
	exports.monadMapVals = function (funk, obj) {
		return Object.keys(obj).filter(isReserverMonadKey).reduce(function (newObj, key) {
			newObj[key] = funk(obj[key], obj);
			return newObj;
		}, {});
	};
	
	// A stateful version of the map function:
	// f accepts an array item and a state (defaults to an object) and returns the processed version of the item plus a new state
	exports.statefulMap = function (arr, f) {
		return arr.reduce(function (arrayAndState, item) {
			var itemAndState = f(item, arrayAndState[1]);
			return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1]];
		}, [[], {}])[0];
	};

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }
	
	/* # The object wrapper
	 *
	 * This library provides a module which allows you to combine several monad transformer definitions
	 * and create a object-oriented wrapper for using the resulting monad.
	 * 
	 * ## Creating a monad constructor
	 *
	 * You can create a monad constructor using the `mtl.make` function:
	 *
	 * ###`mtl.make([baseMonad], monadTransformer1, monadTransformer2)`
	 *
	 * ####`baseMonad - monadDefinition`
	 *
	 * Optionally you can pass the definition of the monad that would sit at the bottom of the stack, 
	 * as a first argument of the `make` function.
	 *
	 * The parameter is optional. By default, the package uses the identity monad as a base.
	 *
	 * ####`monadTransformer<1-n> - monadTransformerDefinition`
	 *
	 * Pass the definitions of the monad transformers which would augment the base monad. 
	 * Note that monad transformations are usually not commutative so the order in which the arguments
	 * are placed matters.
	 */
	
	var assign = __webpack_require__(7);
	var helpers = __webpack_require__(8);
	var idFunc = function idFunc(a) {
	  return a;
	};
	
	// Promotes a function from a monad definition to a monad stack method, so it can be used for chaining
	var promoteToMethod = function promoteToMethod(funk, monadDefinition) {
	  return function () {
	    var _this = this;
	
	    var args = Array.prototype.slice.call(arguments);
	    return this.chain(function (val) {
	      return _this.constructor(funk.apply(monadDefinition, args.concat([val])));
	    });
	  };
	};
	
	// Promotes a function from a monad definition to a stack constructor
	var promoteToConstructor = function promoteToConstructor(funk, monadDefinition) {
	  return function () {
	    return this(funk.apply(monadDefinition, arguments));
	  };
	};
	
	/*
	 * The function returns an `objectWrapper` which allows you instantiate monads from all kinds of values.
	 */
	
	module.exports = function (stack) {
	  var monad = assign(Object.create(monadWrapperProto), helpers.monadMapVals(promoteToMethod, stack));
	  var constructor = function constructor(val) {
	    var object = Object.create(monad);
	    object._value = val;
	    return object;
	  };
	  monad.stack = stack;
	  monad.constructor = assign(constructor, helpers.monadMapVals(promoteToConstructor, stack));
	  monad.constructor.of = monad.of.bind(monad);
	  monad.constructor.prototype = monad;
	  return monad.constructor;
	};
	
	/*
	 * ## Creating monads
	 *
	 * Monads are generally created using [type-specific methods](api.md) like `fromArray` (for stacks that include the
	 * list transformation, or `fromState` (for stateful computations) but several generic methods are also provided.
	 *
	 * ### `objectWrapper.of(value)`
	 *
	 * Constructs a monad from a plain non-monadic value.
	 */
	
	var monadWrapperProto = {
	  of: function of(value) {
	    return this.constructor(this.stack.of(value));
	  },
	
	  /* ### `objectWrapper(value)`
	   *
	   * Constructs a monad from a value which obeys the structure of the monad stack i.e. it "wraps" the value
	   * into a monadic interface.
	   *
	   * ## Using monads
	   *
	   * Again there are many methods that you would use to manipulate a monad which are [type-specific](api.md). 
	   * Here are the generic ones:
	   *
	   * ###`monad.chain(f)`
	   *
	   * Applies `f` to the value or values that are inside the monad and returns a new wrapped object
	   *
	   */
	  chain: function chain(f) {
	    var _this2 = this;
	
	    var fUnwrap = function fUnwrap(val) {
	      var newVal = f.call(_this2.constructor, val, _this2.constructor);
	      if (!newVal.hasOwnProperty('_value')) {
	        throw JSON.stringify(newVal) + ' is not a wrapped value';
	      }
	      if (newVal.stack.name !== _this2.stack.name) {
	        throw _this2.stack.name + ' is not the same as ' + newVal.stack.name;
	      }
	      return newVal._value;
	    };
	    return this.constructor(this.stack.chain(fUnwrap, this._value));
	  },
	
	  /*
	   * ###`monad.map(f)`
	   *
	   * Applies `f` to the value or values that are inside the monad and wraps the resulting value in a new monad instance.
	   *
	   */
	  map: function map(funk) {
	    var _this3 = this;
	
	    return this.chain(function (val) {
	      return _this3.of(funk(val));
	    });
	  },
	
	  /*
	   * ###`monad.tap(f)`
	   *
	   * Applies the f to the monad and returns the result.
	   *
	   */
	  tap: function tap(funk) {
	    return funk(this);
	  },
	
	  /* ###`monad.run()`
	   *
	   * Runs the computation inside the monad and calls the callback with the resulting value.
	   * Does not unwrap the value.
	   *
	   */
	  run: function run(callback, environment) {
	    return this.stack.run.call(environment, callback || idFunc, this._value);
	  },
	
	  /* ###`monad.value()`
	   *
	   * Runs the computation inside the monad and calls the callback with the resulting value.
	   * Unwraps the value using the `fold` functions.
	   *
	   */
	  value: function value(callbacks, environment) {
	    var stack = this.stack;
	    return this.run(function (val) {
	      return stack.fold.call(callbacks, function (val) {
	        if (typeof callbacks === 'function') {
	          callbacks(val);
	        } else if ((typeof callbacks === 'undefined' ? 'undefined' : _typeof(callbacks)) === 'object' && typeof callbacks.onValue === 'function') {
	          callbacks.onValue(val);
	        }
	        return val;
	      }, val);
	    }, environment);
	  },
	
	  /* 
	   * ###`monad.ap()`
	   *
	   * Applies a wrapped function to a wrapped value.
	   * Same as `<@>` in Haskell.
	   */
	  ap: function ap(val) {
	    return this.chain(function (f) {
	      return val.map(f);
	    });
	  },
	
	  /* 
	   * ###`monad.andThen()`
	   *
	   * Same as `chain` but accepts a wrapped value instead a function that returns one.
	   * Same as `>>>` in Haskell.
	   */
	  andThen: function andThen(monad) {
	    return this.chain(function (_) {
	      return monad;
	    });
	  },
	
	  /* 
	   * ###`monad.debug()`
	   *
	   * A shortcut for inserting a breakpoint in the computation.
	   */
	  debug: function debug() {
	    debugger;
	    return this;
	  }
	};
	
	/*
	 * For more information, see the [Fantasy Land spec](https://github.com/fantasyland/fantasy-land).
	 *
	 * [_View in GitHub_](../lib/wrapper.js)
	 */

/***/ },
/* 10 */
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
	 * ### `value.maybeGet(key)`
	 *
	 * A helper to safely retrieve a possibly undefined property of your wrapped value.
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
	
	var idFunc = function idFunc(a) {
	  return a;
	};
	exports.maybe = {
	  // Standard functions
	  name: 'Maybe',
	  // (val) => M({value:val})
	  of: function of(val) {
	    return this.outer.of({ value: val, something: true });
	  },
	
	  // (val => M({value:val}) , M({value:val})) => M({value:val})
	  chain: function chain(funk, mMaybeVal) {
	    var _this = this;
	
	    return this.outer.chain(function (value) {
	      return value.something ? funk(value.value) : _this.outer.of(value);
	    }, mMaybeVal);
	  },
	
	  // (M(val)) => M({value:val})
	  lift: function lift(mVal) {
	    var _this2 = this;
	
	    return this.outer.chain(function (val) {
	      return _this2.outer.of({ value: val, something: true });
	    }, mVal);
	  },
	  fold: function fold(value, maybe) {
	    return maybe.something ? value(maybe.value) : (this.onNothing || idFunc)();
	  },
	
	  // Custom functions
	  maybeGet: function maybeGet(key, val) {
	    return val[key] !== undefined ? this.of(val[key]) : this.outer.of({ something: false });
	  },
	  nothing: function nothing() {
	    return this.outer.of({ something: false });
	  },
	  maybeMap: function maybeMap(funk, val) {
	    var value = funk(val);
	    return value !== undefined ? this.of(value) : this.outer.of({ something: false });
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
	  // Standard functions
	  // (val) => M([val])
	  of: function of(val) {
	    return this.outer.of([val]);
	  },
	
	  // (val => M([val]) , M([val]))=> M([val])
	  chain: function chain(funk, mListVal) {
	    var _this3 = this;
	
	    return this.outer.chain(function (listVal) {
	      return listVal.length === 0 ? _this3.outer.of([]) : listVal.map(funk).reduce(function (accumulatedVal, newVal) {
	        return _this3.outer.chain(function (accumulated) {
	          return _this3.outer.chain(function (_new) {
	            return _this3.outer.of(accumulated.concat(_new));
	          }, newVal);
	        }, accumulatedVal);
	      });
	    }, mListVal);
	  },
	
	  // (M(val)) => M([val])
	  lift: function lift(val) {
	    var _this4 = this;
	
	    return this.outer.chain(function (innerValue) {
	      return _this4.outer.of([innerValue]);
	    }, val);
	  },
	
	  // ((val) => otherVal, M([val])) => otherVal
	  value: function value(funk, val) {
	    return this.outer.value(function (list) {
	      return list.map(funk);
	    }, val);
	  },
	  fold: function fold(value, list) {
	    return list.map(value);
	  },
	
	  // Custom functions
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
	 * The additional value must be an object that has a `concat` method (as String or Array).
	 * 
	 * ### `value.tell(val)`
	 * 
	 * Concats `val` to the current log value.
	 *
	 * ### `value.tellMap(f)`
	 *
	 * Calls `f` with the current value as an argument and then concats the result to the current log value.
	 *
	 * ### Definition
	 *
	 * ![Writer](img/writer.png)
	 *
	 * ###Source
	 */
	
	var concatLog = function concatLog(log, newLog) {
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
	  // Standard functions
	  // (val) => M([val, log])
	  of: function of(val) {
	    return this.outer.of({ value: val, writer: undefined });
	  },
	
	  // (val => M([val, log]), M([val, log])) => M([val, log])
	  chain: function chain(funk, mWriterVal) {
	    var _this5 = this;
	
	    return this.outer.chain(function (writerVal) {
	      var val = writerVal.value,
	          log = writerVal.writer;
	      var newMWriterVal = funk(val);
	      return _this5.outer.chain(function (newWriterVal) {
	        var newVal = newWriterVal.value,
	            newLog = newWriterVal.writer;
	        return _this5.outer.of({ value: newVal, writer: concatLog(log, newLog) });
	      }, newMWriterVal);
	    }, mWriterVal);
	  },
	
	  // (M(val) => M([val, log])
	  lift: function lift(mVal) {
	    var _this6 = this;
	
	    return this.outer.chain(function (val) {
	      return _this6.outer.of({ value: val, writer: undefined });
	    }, mVal);
	  },
	
	  // ((val) => b, M([val, log])) => b
	  fold: function fold(value, writerVal) {
	    (this.onWriterLog || idFunc)(writerVal.writer);
	    return value(writerVal.value);
	  },
	
	  // Custom functions
	  tell: function tell(message, val) {
	    return this.outer.of({ value: val, writer: message });
	  },
	  tellMap: function tellMap(fn, val) {
	    return this.outer.of({ value: val, writer: fn(val) });
	  }
	};
	/* 
	 * [_View in GitHub_](../lib/data.js)
	 */

/***/ },
/* 11 */
/***/ function(module, exports) {

	'use strict';
	
	/* ## `comp.state`
	 * 
	 * The `state` monad transformer allows you to keep one additional mutable state value
	 * with your computation.
	 *
	 * ### `value.save()`
	 *
	 * Saves the return value of the function in the state, overwriting the previous one.
	 *
	 * ### `value.load()`
	 *
	 * Returns the current state.
	 *
	 * ### `value.statefulMap(f)`
	 *
	 * Maps over the current value and state with `f`.
	 * The function should return an array containing two elements - the new value and the new state.
	 *
	 * ### Definition
	 *
	 * ![State](img/state.png)
	 *
	 * ###Source
	 */
	var idFunc = function idFunc(a) {
	  return a;
	};
	
	exports.state = {
	  name: 'State',
	  //Standard functions:
	  of: function of(val) {
	    var _this = this;
	
	    return function (prevState) {
	      return _this.outer.of({ value: val, state: prevState });
	    };
	  },
	  chain: function chain(funk, state) {
	    var _this2 = this;
	
	    return function (prevState) {
	      return _this2.outer.chain(function (params) {
	        var newVal = params.value,
	            newState = params.state;
	        return funk(newVal)(newState);
	      }, state(prevState));
	    };
	  },
	  lift: function lift(val) {
	    var _this3 = this;
	
	    return function (prevState) {
	      return _this3.outer.chain(function (innerValue) {
	        return _this3.outer.of({ value: innerValue, state: prevState });
	      }, val);
	    };
	  },
	  run: function run(f, state) {
	    return f(state());
	  },
	  fold: function fold(value, params) {
	    (this.onState || idFunc)(params.state);
	    return value(params.value);
	  },
	
	  //Custom functions:
	  loadState: function loadState(val) {
	    var _this4 = this;
	
	    return function (prevState) {
	      return _this4.outer.of({ value: prevState, state: prevState });
	    };
	  },
	  saveState: function saveState(val) {
	    var _this5 = this;
	
	    return function (prevState) {
	      return _this5.outer.of({ value: val, state: val });
	    };
	  },
	  statefulMap: function statefulMap(funk, val) {
	    var _this6 = this;
	
	    return function (prevState) {
	      var stateTuple = funk(val, prevState);
	      return _this6.outer.of({ value: stateTuple[0], state: stateTuple[1] });
	    };
	  },
	  setState: function setState(newState, val) {
	    var _this7 = this;
	
	    return function (prevState) {
	      return _this7.outer.of({ value: val, state: newState });
	    };
	  },
	  mapState: function mapState(funk, val) {
	    var _this8 = this;
	
	    return function (prevState) {
	      return _this8.outer.of({ value: val, state: funk(prevState, val) });
	    };
	  }
	};
	
	/* ## `comp.reader`
	 * 
	 * The `reader` monad transformer allows you to specify an immutable configuration for your function
	 * which you can use to tweek the way it behaves.
	 *
	 * ### Definition
	 *
	 * ![State](img/writer.png)
	 *
	 * ###Source
	 */
	exports.reader = {
	  name: 'Reader',
	  //Standard functions:
	  of: function of(val) {
	    var _this9 = this;
	
	    return function (env) {
	      return _this9.outer.of(val);
	    };
	  },
	  chain: function chain(funk, reader) {
	    var _this10 = this;
	
	    return function (env) {
	      return _this10.outer.chain(function (val) {
	        return funk(val)(env);
	      }, reader(env));
	    };
	  },
	  lift: function lift(val) {
	    return function (env) {
	      return val;
	    };
	  },
	  run: function run(f, reader) {
	    return f(reader(this.environment));
	  },
	  fold: function fold(value, val) {
	    return value(val);
	  },
	
	  //Custom functions:
	  readerMap: function readerMap(f, val) {
	    var _this11 = this;
	
	    return function (environment) {
	      return _this11.outer.of(f(val, environment));
	    };
	  },
	  loadEnvironment: function loadEnvironment(val) {
	    var _this12 = this;
	
	    return function (environment) {
	      return _this12.outer.of(environment);
	    };
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
/* 12 */
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
	 * It does this by defining a monad transformer definition format, which allows you to specify 
	 * your transformer only by specifying its transformations on the values. 
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
	  },
	  fold: function fold(value, val) {
	    return value(val);
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
	  },
	  fold: function fold(value, idVal) {
	    return value(idVal.idVal);
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
	  },
	  run: function run(fn, idContainerMIdVal) {
	    return fn(idContainerMIdVal.idContainer);
	  },
	  fold: function fold(value, idVal) {
	    return value(idVal.idVal);
	  }
	};
	
	/* The key difference is that with this monad nesting happens both inside the host monad and
	 * outside of it. If we apply the transformation two times the value becomes:
	 * `{idContainer:{idContainer:M({idVal:{idVal:a}})}}`.
	 */
	
	/*
	 * [_View in GitHub_](../lib/id.js)
	 */

/***/ }
/******/ ]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZDEwZjhjMTlkYmJlYTY0N2I3NzAiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9tYWluLmpzIiwid2VicGFjazovLy9DOi9wci9zb25uZS9saWIvc3RhY2suanMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9iYXNlLmpzIiwid2VicGFjazovLy8uL34vZGF0YS50YXNrL2xpYi9pbmRleC5qcyIsIndlYnBhY2s6Ly8vLi9+L2RhdGEudGFzay9saWIvdGFzay5qcyIsIndlYnBhY2s6Ly8vKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwid2VicGFjazovLy8od2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3Byb2Nlc3MvYnJvd3Nlci5qcyIsIndlYnBhY2s6Ly8vLi9+L29iamVjdC1hc3NpZ24vaW5kZXguanMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9oZWxwZXJzLmpzIiwid2VicGFjazovLy9DOi9wci9zb25uZS9saWIvd3JhcHBlci5qcyIsIndlYnBhY2s6Ly8vQzovcHIvc29ubmUvbGliL2RhdGEuanMiLCJ3ZWJwYWNrOi8vL0M6L3ByL3Nvbm5lL2xpYi9jb21wLmpzIiwid2VicGFjazovLy9DOi9wci9zb25uZS9saWIvaWQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHVCQUFlO0FBQ2Y7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUM1QkEsS0FBTSxHQUFHLEdBQUcsRUFBRTtBQUNkLEtBQU0sV0FBVyxHQUFHLG1CQUFPLENBQUMsQ0FBUyxDQUFDO0FB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QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBRzs7QUFFSDtBQUNBOztBQUVBO0FBQ0E7QUFDQSxHOzs7Ozs7O0FDM0VBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSx3QkFBdUIsc0JBQXNCO0FBQzdDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQXFCO0FBQ3JCOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQSw0QkFBMkI7QUFDM0I7QUFDQTtBQUNBO0FBQ0EsNkJBQTRCLFVBQVU7Ozs7Ozs7QUMxRnRDO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsaUJBQWdCLHNCQUFzQjtBQUN0Qzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxtQkFBa0Isb0JBQW9CO0FBQ3RDO0FBQ0E7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QixZQUFPO0FBQ0wsa0JBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFDLEtBQUssRUFBSztBQUN2QyxhQUFNLEdBQUcsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztBQUMzQixnQkFBTyxHQUFHLENBQUMsV0FBVztRQUN2QixFQUFFLGlCQUFpQixDQUFDLFdBQVcsQ0FBQztNQUNsQztJQUNGOzs7QUFHRCxPQUFJLGdCQUFFLElBQUksRUFBRTs7O0FBQ1YsWUFBTztBQUNMLGtCQUFXLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBQyxHQUFHO2dCQUFLLE9BQUssS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsQ0FBQztRQUFBLEVBQUUsSUFBSSxDQUFDO01BQzFFO0lBQ0Y7OztBQUdELFFBQUssaUJBQUUsRUFBRSxFQUFFLGlCQUFpQixFQUFFO0FBQzVCLFlBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBQyxLQUFLLEVBQUk7QUFDaEMsY0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztNQUN2QixFQUFFLGlCQUFpQixDQUFDLFdBQVcsQ0FBQztJQUNsQztBQUNELE1BQUcsZUFBRSxFQUFFLEVBQUUsaUJBQWlCLEVBQUU7QUFDMUIsWUFBTyxFQUFFLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDO0lBQ3pDO0FBQ0QsT0FBSSxnQkFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFO0FBQ2xCLFlBQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7SUFDMUI7RUFDRiIsImZpbGUiOiJtdGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSlcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcblxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0ZXhwb3J0czoge30sXG4gXHRcdFx0aWQ6IG1vZHVsZUlkLFxuIFx0XHRcdGxvYWRlZDogZmFsc2VcbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubG9hZGVkID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuIFx0Ly8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4gXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXygwKTtcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIHdlYnBhY2svYm9vdHN0cmFwIGQxMGY4YzE5ZGJiZWE2NDdiNzcwXG4gKiovIiwiLyogI092ZXJ2aWV3XHJcbiAqXHJcbiAqIFRoZSBwYWNrYWdlIGNvbnNpc3RzIG9mIHRoZSBmb2xsb3dpbmcgY29tcG9uZW50czpcclxuICogXHJcbiAqICMjIE9iamVjdCB3cmFwcGVyXHJcbiAqIFxyXG4gKiBUaGUgW29iamVjdCB3cmFwcGVyXSh3cmFwcGVyLm1kKSwgZXhwb3NlZCB2aWEgdGhlIGBtdGwubWFrZWAgZnVuY3Rpb24sIGNvbWJpbmVzIG9uZSBvciBzZXZlcmFsIG1vbmFkIFxyXG4gKiB0cmFuc2Zvcm1lciBkZWZpbml0aW9ucyBhbmQgbWl4ZXMgdGhlbSBpbnRvIG9uZSBcclxuICogW0ZhbnRhc3kgTGFuZCBjb21wbGlhbnRdKGh0dHBzOi8vZ2l0aHViLmNvbS9mYW50YXN5bGFuZC9mYW50YXN5LWxhbmQpIG1vbmFkLlxyXG4gKi9cclxuY29uc3QgbXRsID0ge31cclxuY29uc3QgY3JlYXRlU3RhY2sgPSByZXF1aXJlKCcuL3N0YWNrJylcclxubXRsLm1ha2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgcmV0dXJuIGNyZWF0ZVN0YWNrKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpLmNvbnN0cnVjdG9yXHJcbn1cclxuXHJcbi8qICMjIE1vbmFkIHRyYW5zZm9ybWVyIGRlZmluaXRpb25zXHJcbiAqIFxyXG4gKiBUaGUgbGlicmFyeSBjb250YWlucyBmb3VyIFttb25hZCB0cmFuc2Zvcm1lciBkZWZpbml0aW9uc10oYXBpLm1kKSwgZGlzdHJpYnV0ZWQgaW4gdHdvIHBhY2thZ2VzOlxyXG4gKiBgZGF0YWAgYW5kIGBjb21wYC4gSXQgYWxzbyBjb250YWlucyB0aHJlZSB2ZXJzaW9ucyBvZiB0aGUgaWRlbnRpdHkgbW9uYWQgdHJhbnNmb3JtZXIsIHVzZWZ1bFxyXG4gKiBhcyBhIHJlZmVyZW5jZSB3aGVuIGltcGxlbWVudGluZyBbY3VzdG9tIG1vbmFkIHRyYW5zZm9ybWVyc10oaW1wbGVtZW50aW5nLXRyYW5zZm9ybWVyLm1kKS5cclxuICpcclxuICovXHJcbm10bC5kYXRhID0gcmVxdWlyZSgnLi9kYXRhJylcclxubXRsLmNvbXAgPSByZXF1aXJlKCcuL2NvbXAnKVxyXG5tdGwuaWQgPSByZXF1aXJlKCcuL2lkJylcclxuXHJcblxyXG4vKiAjIyBCYXNlIG1vbmFkc1xyXG4gKiBcclxuICogV2hlbiBzdGFja2luZyBtb25hZCB0cmFuc2Zvcm1lcnMsIGEgeW91IG11c3QgcGxhY2Ugb25lIHBsYWluIG1vbmFkIGF0IHRoZSBib3R0b20gb2YgdGhlIHN0YWNrLlxyXG4gKiBUaGlzIG1vbmFkIHNlcnZlcyBhcyB0aGUgc3RhY2sncyBiYXNlLiBcclxuICpcclxuICogQnkgZGVmYXVsdCwgdGhlIHBhY2thZ2UgdXNlcyB0aGUgaWRlbnRpdHkgbW9uYWQgYXMgYSBiYXNlIGJ1dCBpdCBhbHNvIGRlZmluZXMgYSB3cmFwcGVyIHdoaWNoXHJcbiAqIGFsbG93IHlvdSB0byB1c2UgdGhlIFtUYXNrIG1vbmFkIGZyb20gRm9sa3RhbGVdKGh0dHBzOi8vZ2l0aHViLmNvbS9mb2xrdGFsZS9kYXRhLnRhc2spIGFzIGEgYmFzZS5cclxuICovXHJcblxyXG5tdGwuYmFzZSA9IHJlcXVpcmUoJy4vYmFzZScpXHJcblxyXG4vKiAjIyBQcmVkZWZpbmVkIHN0YWNrc1xyXG4gKiBcclxuICogVGhlIGxpYnJhcnkgZmVhdHVyZXMgZml2ZSBwcmVkZWZpbmVkIG1vbmFkIHN0YWNrcy5cclxuICpcclxuICovXHJcbm10bC5zaW1wbGUgPSBtdGwubWFrZShtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyKVxyXG5tdGwuc3RhdGVmdWwgPSBtdGwubWFrZShtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyLCBtdGwuY29tcC5zdGF0ZSlcclxubXRsLmxpc3QgPSBtdGwubWFrZShtdGwuZGF0YS5saXN0LCBtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyKVxyXG5tdGwuc3RhdGVsaXN0ID0gbXRsLm1ha2UobXRsLmRhdGEubGlzdCwgbXRsLmRhdGEubWF5YmUsIG10bC5kYXRhLndyaXRlciwgbXRsLmNvbXAuc3RhdGUpXHJcblxyXG5tdGwuYWR2YW5jZWQgPSBtdGwubWFrZShtdGwuYmFzZS50YXNrLCBtdGwuZGF0YS5tYXliZSwgbXRsLmRhdGEud3JpdGVyLCBtdGwuY29tcC5zdGF0ZSlcclxuXHJcbi8qXHJcbiAqICMjIEhlbHBlcnNcclxuICpcclxuICogU29tZSBoZWxwZXIgZnVuY3Rpb25zIHRoYXQgd2Ugd2FudCB0byBrZWVwIGhhbmR5OlxyXG4gKi9cclxuY29uc3QgaGVscGVycyA9IHJlcXVpcmUoJy4vaGVscGVycycpXHJcbm10bC5jdXJyeSA9IGhlbHBlcnMuY3VycnlcclxubXRsLmNvbXBvc2UgPSBoZWxwZXJzLmNvbXBvc2VcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbXRsXHJcbi8qXHJcbiAqIFtfVmlldyBpbiBHaXRIdWJfXSguLi9saWIvbWFpbi5qcylcclxuICovXHJcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIEM6L3ByL3Nvbm5lL2xpYi9tYWluLmpzXG4gKiovIiwiY29uc3QgYmFzZSA9IHJlcXVpcmUoJy4vYmFzZScpXHJcbmNvbnN0IGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKVxyXG5jb25zdCBoZWxwZXJzID0gcmVxdWlyZSgnLi9oZWxwZXJzJylcclxuY29uc3Qgd3JhcHBlciA9IHJlcXVpcmUoJy4vd3JhcHBlcicpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZVN0YWNrIChtb25hZFN0YWNrKSB7XHJcbiAgLy8gR2VuZXJhdGUgZXJyb3JzXHJcbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1RoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RhY2sgbWVtYmVyJylcclxuXHJcbiAgLy8gQWRkIHRoZSBJRCBtb25hZCBhdCB0aGUgYm90dG9tIG9mIHRoZSBtb25hZCBzdGFja1xyXG4gIGNvbnN0IHN0YWNrID0gW2Jhc2UuaWRdLmNvbmNhdChtb25hZFN0YWNrKVxyXG5cclxuICAvL1ZlcmlmeSBpbnB1dFxyXG4gIHN0YWNrLmZvckVhY2gobWVtYmVyID0+IHtcclxuICAgIGlmICh0eXBlb2YgbWVtYmVyICE9PSAnb2JqZWN0Jykge3Rocm93IG5ldyBFcnJvcignU3RhY2sgbWVtYmVycyBtdXN0IGJlIG9iamVjdHMnKX1cclxuICB9KVxyXG5cclxuICAvLyBQZXJmb3JtIHNvbWUgcHJlcHJvY2Vzc2luZyBvbiB0aGUgc3RhY2tcclxuICByZXR1cm4gcHJvY2Vzc1N0YWNrKHN0YWNrKS5zbGljZSgtMSlbMF1cclxufVxyXG5cclxuLy8gQXBwbGllcyB0aGUgcHJvY2Vzc2luZyBmdW5jdGlvbiBvbiBlYWNoIHN0YWNrIG1lbWJlcixcclxuLy8gcGFzc2luZyB0aGUgcHJldmlvdXMgKG91dGVyKSBtZW1iZXIgYXMgYW4gYXJndW1lbnRcclxuY29uc3QgcHJvY2Vzc1N0YWNrID0gKGJhc2VTdGFjaykgPT5cclxuICBoZWxwZXJzLnN0YXRlZnVsTWFwKGJhc2VTdGFjaywgKGl0ZW0sIHN0YXRlKSA9PiB7XHJcbiAgICBjb25zdCBpdGVtUHJvY2Vzc2VkID0gYWRkQ29uc3RydWN0b3IocHJvY2Vzc1Byb3RvTmV3KGl0ZW0sIHN0YXRlKSlcclxuICAgIHJldHVybiBbaXRlbVByb2Nlc3NlZCxpdGVtUHJvY2Vzc2VkXVxyXG4gIH0pXHJcblxyXG5jb25zdCBjb252ZXJ0T3V0ZXJGdW5jdGlvbiA9IChmdW5rLCBvYmplY3QpID0+IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiB0aGlzLmxpZnQoZnVuay5hcHBseShvYmplY3QsIGFyZ3VtZW50cykpXHJcbn1cclxuY29uc3QgYXN5bmNDb21wb3NlID0gKHRoaXNSdW4sIG91dGVyUnVuKSA9PiB7XHJcbiAgdGhpc1J1biA9IHRoaXNSdW4gfHwgZnVuY3Rpb24oZm4sIHZhbCkge3JldHVybiBmbih2YWwpfVxyXG4gIG91dGVyUnVuID0gb3V0ZXJSdW4gfHwgZnVuY3Rpb24oZm4sIHZhbCkge3JldHVybiBmbih2YWwpfVxyXG4gIHJldHVybiBmdW5jdGlvbihmbiwgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpc1J1bi5jYWxsKHRoaXMsIG91dGVyUnVuLmJpbmQodGhpcywgZm4pLCB2YWwpXHJcbiAgfVxyXG59XHJcbmNvbnN0IGFkZENvbnN0cnVjdG9yID0gKG9iamVjdCkgPT4ge1xyXG4gIG9iamVjdC5jb25zdHJ1Y3RvciA9IHdyYXBwZXIob2JqZWN0KVxyXG4gIHJldHVybiBvYmplY3RcclxufVxyXG5cclxuLy8gQWRkcyBjb250ZXh0IHRvIGEgc3RhY2sgbWVtYmVyXHJcbmNvbnN0IHByb2Nlc3NQcm90b05ldyA9IChwcm90bywgb3V0ZXJQcm90bykgPT5cclxuICBhc3NpZ24oe30sIHByb3RvLCB7XHJcbiAgICBmb2xkOiBhc3luY0NvbXBvc2Uob3V0ZXJQcm90by5mb2xkLCBwcm90by5mb2xkKSxcclxuICAgIHJ1bjogYXN5bmNDb21wb3NlKHByb3RvLnJ1biwgb3V0ZXJQcm90by5ydW4pLFxyXG4gICAgb3V0ZXI6IG91dGVyUHJvdG8sXHJcbiAgICBuYW1lOiBwcm90by5uYW1lICsgJy8nICsgb3V0ZXJQcm90by5uYW1lXHJcbiAgfSwgaGVscGVycy5tb25hZE1hcFZhbHMoY29udmVydE91dGVyRnVuY3Rpb24sIG91dGVyUHJvdG8pKVxyXG5cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL3N0YWNrLmpzXG4gKiovIiwiXHJcbmNvbnN0IFRhc2sgPSByZXF1aXJlKCdkYXRhLnRhc2snKVxyXG5jb25zdCBpZEZ1bmMgPSBhID0+IGFcclxuXHJcbi8vIEEgbW9uYWQgZGVmaW5pdGlvbiB0aGF0IHdpcmVzIGEgJ2RhdGEudGFzaycgaW5zdGFuY2UgYXMgYSBiYXNlIGZvciBhIHRyYW5zZm9ybWVyIHN0YWNrXHJcbmV4cG9ydHMudGFzayA9IHtcclxuICBuYW1lOiBcIkRhdGEuVGFza1wiLFxyXG4gIC8vICh2YWwpID0+IFRhc2sodmFsKVxyXG4gIG9mOiBUYXNrLm9mLFxyXG4gIC8vICh2YWwgPT4gVGFzayh2YWwpLCBUYXNrKHZhbCkpID0+IFRhc2sodmFsKVxyXG4gIGNoYWluKGZuLCB0YXNrKSB7XHJcbiAgICByZXR1cm4gdGFzay5jaGFpbihmbikgICAgIFxyXG4gIH0sXHJcbiAgLy8gKHZhbCkgPT4gVGFzayh2YWwpXHJcbiAgbGlmdDogVGFzay5vZixcclxuXHJcbiAgLy8gKCh2YWwpID0+IG90aGVyVmFsLCBUYXNrKHZhbCkpID0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZuLCB0YXNrKSB7XHJcbiAgICB0YXNrLmZvcmsoKGEpPT5hLCBmbilcclxuICB9LFxyXG4gIHJ1biAoZm4sIHRhc2spIHtcclxuICAgIHRhc2suZm9yaygoZXJyKT0+IGZuKHt0YXNrRXJyb3I6ZXJyfSksICh2YWwpPT4gZm4oe3Rhc2tTdWNjZXNzOnZhbH0pIClcclxuICB9LFxyXG4gIGZvbGQgKHZhbHVlLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWwuaGFzT3duUHJvcGVydHkoJ3Rhc2tTdWNjZXNzJykgPyB2YWx1ZSh2YWwudGFza1N1Y2Nlc3MpOiAodGhpcy5vblRhc2tFcnJvciB8fCBpZEZ1bmMpKHZhbC50YXNrRXJyb3IpXHJcbiAgfSxcclxuICBmcm9tQ29udGludWF0aW9uKGZuKSB7XHJcbiAgICBpZih0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHt0aHJvdyBmbiArICcgaXMgbm90IGEgZnVuY3Rpb24nfVxyXG4gICAgcmV0dXJuIG5ldyBUYXNrKGZuKVxyXG4gIH0sXHJcbiAgZnJvbVRhc2sodGFzaykge1xyXG4gICAgcmV0dXJuIHRhc2tcclxuICB9LFxyXG4gIGNvbnQgKGZuLCB2YWwpIHtcclxuICAgIGNvbnN0IGZuVmFsID0gZm4odmFsKVxyXG4gICAgaWYodHlwZW9mIGZuVmFsICE9PSAnZnVuY3Rpb24nKSB7dGhyb3cgZm5WYWwgKyAnIGlzIG5vdCBhIGZ1bmN0aW9uJ31cclxuICAgIHJldHVybiBuZXcgVGFzayhmblZhbClcclxuICB9LFxyXG4gIHJlamVjdGVkOiBUYXNrLnJlamVjdGVkXHJcbn1cclxuXHJcbi8vIFRoZSBpZGVudGl0eSBtb25hZCwgd2hpY2ggaXMgdXNlZCBieSBkZWZhdWx0IGFzIGEgYmFzZVxyXG5leHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdyb290JyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gZnVuayh2YWwpXHJcbiAgfSxcclxuICBtYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgdmFsdWUgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmsodmFsKVxyXG4gIH0sXHJcbiAgcnVuIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9LFxyXG4gIGZvbGQgKHZhbHVlLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWx1ZSh2YWwpXHJcbiAgfVxyXG59XHJcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIEM6L3ByL3Nvbm5lL2xpYi9iYXNlLmpzXG4gKiovIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3Rhc2snKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2RhdGEudGFzay9saWIvaW5kZXguanNcbiAqKiBtb2R1bGUgaWQgPSAzXG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIndXNlIHN0cmljdCc7XG5cblxuLyoqXG4gKiBBIGhlbHBlciBmb3IgZGVsYXlpbmcgdGhlIGV4ZWN1dGlvbiBvZiBhIGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqIEBzdW1tYXJ5IChBbnkuLi4gLT4gQW55KSAtPiBWb2lkXG4gKi9cbnZhciBkZWxheWVkID0gdHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gJ3VuZGVmaW5lZCc/ICBzZXRJbW1lZGlhdGVcbiAgICAgICAgICAgIDogdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnPyAgICAgICBwcm9jZXNzLm5leHRUaWNrXG4gICAgICAgICAgICA6IC8qIG90aGVyd2lzZSAqLyAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dFxuXG4vKipcbiAqIEBtb2R1bGUgbGliL3Rhc2tcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBUYXNrO1xuXG4vLyAtLSBJbXBsZW1lbnRhdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBUaGUgYFRhc2tbzrEsIM6yXWAgc3RydWN0dXJlIHJlcHJlc2VudHMgdmFsdWVzIHRoYXQgZGVwZW5kIG9uIHRpbWUuIFRoaXNcbiAqIGFsbG93cyBvbmUgdG8gbW9kZWwgdGltZS1iYXNlZCBlZmZlY3RzIGV4cGxpY2l0bHksIHN1Y2ggdGhhdCBvbmUgY2FuIGhhdmVcbiAqIGZ1bGwga25vd2xlZGdlIG9mIHdoZW4gdGhleSdyZSBkZWFsaW5nIHdpdGggZGVsYXllZCBjb21wdXRhdGlvbnMsIGxhdGVuY3ksXG4gKiBvciBhbnl0aGluZyB0aGF0IGNhbiBub3QgYmUgY29tcHV0ZWQgaW1tZWRpYXRlbHkuXG4gKlxuICogQSBjb21tb24gdXNlIGZvciB0aGlzIHN0cnVjdHVyZSBpcyB0byByZXBsYWNlIHRoZSB1c3VhbCBDb250aW51YXRpb24tUGFzc2luZ1xuICogU3R5bGUgZm9ybSBvZiBwcm9ncmFtbWluZywgaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBjb21wb3NlIGFuZCBzZXF1ZW5jZVxuICogdGltZS1kZXBlbmRlbnQgZWZmZWN0cyB1c2luZyB0aGUgZ2VuZXJpYyBhbmQgcG93ZXJmdWwgbW9uYWRpYyBvcGVyYXRpb25zLlxuICpcbiAqIEBjbGFzc1xuICogQHN1bW1hcnlcbiAqICgozrEg4oaSIFZvaWQpLCAozrIg4oaSIFZvaWQpIOKGkiBWb2lkKSwgKFZvaWQg4oaSIFZvaWQpIOKGkiBUYXNrW86xLCDOsl1cbiAqXG4gKiBUYXNrW86xLCDOsl0gPDogQ2hhaW5bzrJdXG4gKiAgICAgICAgICAgICAgICwgTW9uYWRbzrJdXG4gKiAgICAgICAgICAgICAgICwgRnVuY3RvclvOsl1cbiAqICAgICAgICAgICAgICAgLCBBcHBsaWNhdGl2ZVvOsl1cbiAqICAgICAgICAgICAgICAgLCBTZW1pZ3JvdXBbzrJdXG4gKiAgICAgICAgICAgICAgICwgTW9ub2lkW86yXVxuICogICAgICAgICAgICAgICAsIFNob3dcbiAqL1xuZnVuY3Rpb24gVGFzayhjb21wdXRhdGlvbiwgY2xlYW51cCkge1xuICB0aGlzLmZvcmsgPSBjb21wdXRhdGlvbjtcblxuICB0aGlzLmNsZWFudXAgPSBjbGVhbnVwIHx8IGZ1bmN0aW9uKCkge307XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIG5ldyBgVGFza1vOsSwgzrJdYCBjb250YWluaW5nIHRoZSBzaW5nbGUgdmFsdWUgYM6yYC5cbiAqXG4gKiBgzrJgIGNhbiBiZSBhbnkgdmFsdWUsIGluY2x1ZGluZyBgbnVsbGAsIGB1bmRlZmluZWRgLCBvciBhbm90aGVyXG4gKiBgVGFza1vOsSwgzrJdYCBzdHJ1Y3R1cmUuXG4gKlxuICogQHN1bW1hcnkgzrIg4oaSIFRhc2tbzrEsIM6yXVxuICovXG5UYXNrLnByb3RvdHlwZS5vZiA9IGZ1bmN0aW9uIF9vZihiKSB7XG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihfLCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIHJlc29sdmUoYik7XG4gIH0pO1xufTtcblxuVGFzay5vZiA9IFRhc2sucHJvdG90eXBlLm9mO1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBuZXcgYFRhc2tbzrEsIM6yXWAgY29udGFpbmluZyB0aGUgc2luZ2xlIHZhbHVlIGDOsWAuXG4gKlxuICogYM6xYCBjYW4gYmUgYW55IHZhbHVlLCBpbmNsdWRpbmcgYG51bGxgLCBgdW5kZWZpbmVkYCwgb3IgYW5vdGhlclxuICogYFRhc2tbzrEsIM6yXWAgc3RydWN0dXJlLlxuICpcbiAqIEBzdW1tYXJ5IM6xIOKGkiBUYXNrW86xLCDOsl1cbiAqL1xuVGFzay5wcm90b3R5cGUucmVqZWN0ZWQgPSBmdW5jdGlvbiBfcmVqZWN0ZWQoYSkge1xuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0KSB7XG4gICAgcmV0dXJuIHJlamVjdChhKTtcbiAgfSk7XG59O1xuXG5UYXNrLnJlamVjdGVkID0gVGFzay5wcm90b3R5cGUucmVqZWN0ZWQ7XG5cbi8vIC0tIEZ1bmN0b3IgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgdGhlIHN1Y2Nlc3NmdWwgdmFsdWUgb2YgdGhlIGBUYXNrW86xLCDOsl1gIHVzaW5nIGEgcmVndWxhciB1bmFyeVxuICogZnVuY3Rpb24uXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiAozrIg4oaSIM6zKSDihpIgVGFza1vOsSwgzrNdXG4gKi9cblRhc2sucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uIF9tYXAoZikge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZWplY3QoYSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZihiKSk7XG4gICAgfSk7XG4gIH0sIGNsZWFudXApO1xufTtcblxuLy8gLS0gQ2hhaW4gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogVHJhbnNmb3JtcyB0aGUgc3VjY2VzZnVsIHZhbHVlIG9mIHRoZSBgVGFza1vOsSwgzrJdYCB1c2luZyBhIGZ1bmN0aW9uIHRvIGFcbiAqIG1vbmFkLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6yIOKGkiBUYXNrW86xLCDOs10pIOKGkiBUYXNrW86xLCDOs11cbiAqL1xuVGFzay5wcm90b3R5cGUuY2hhaW4gPSBmdW5jdGlvbiBfY2hhaW4oZikge1xuICB2YXIgZm9yayA9IHRoaXMuZm9yaztcbiAgdmFyIGNsZWFudXAgPSB0aGlzLmNsZWFudXA7XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHJldHVybiBmb3JrKGZ1bmN0aW9uKGEpIHtcbiAgICAgIHJldHVybiByZWplY3QoYSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIGYoYikuZm9yayhyZWplY3QsIHJlc29sdmUpO1xuICAgIH0pO1xuICB9LCBjbGVhbnVwKTtcbn07XG5cbi8vIC0tIEFwcGx5IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEFwcGx5cyB0aGUgc3VjY2Vzc2Z1bCB2YWx1ZSBvZiB0aGUgYFRhc2tbzrEsICjOsiDihpIgzrMpXWAgdG8gdGhlIHN1Y2Nlc3NmdWxcbiAqIHZhbHVlIG9mIHRoZSBgVGFza1vOsSwgzrJdYFxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCAozrIg4oaSIM6zKV0gPT4gVGFza1vOsSwgzrJdIOKGkiBUYXNrW86xLCDOs11cbiAqL1xuXG5UYXNrLnByb3RvdHlwZS5hcCA9IGZ1bmN0aW9uIF9hcChmMikge1xuICByZXR1cm4gdGhpcy5jaGFpbihmdW5jdGlvbihmKSB7XG4gICAgcmV0dXJuIGYyLm1hcChmKTtcbiAgfSk7XG59O1xuXG4vLyAtLSBTZW1pZ3JvdXAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogU2VsZWN0cyB0aGUgZWFybGllciBvZiB0aGUgdHdvIHRhc2tzIGBUYXNrW86xLCDOsl1gXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiBUYXNrW86xLCDOsl0g4oaSIFRhc2tbzrEsIM6yXVxuICovXG5cblRhc2sucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIF9jb25jYXQodGhhdCkge1xuICB2YXIgZm9ya1RoaXMgPSB0aGlzLmZvcms7XG4gIHZhciBmb3JrVGhhdCA9IHRoYXQuZm9yaztcbiAgdmFyIGNsZWFudXBUaGlzID0gdGhpcy5jbGVhbnVwO1xuICB2YXIgY2xlYW51cFRoYXQgPSB0aGF0LmNsZWFudXA7XG5cbiAgZnVuY3Rpb24gY2xlYW51cEJvdGgoc3RhdGUpIHtcbiAgICBjbGVhbnVwVGhpcyhzdGF0ZVswXSk7XG4gICAgY2xlYW51cFRoYXQoc3RhdGVbMV0pO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBUYXNrKGZ1bmN0aW9uKHJlamVjdCwgcmVzb2x2ZSkge1xuICAgIHZhciBkb25lID0gZmFsc2U7XG4gICAgdmFyIGFsbFN0YXRlO1xuICAgIHZhciB0aGlzU3RhdGUgPSBmb3JrVGhpcyhndWFyZChyZWplY3QpLCBndWFyZChyZXNvbHZlKSk7XG4gICAgdmFyIHRoYXRTdGF0ZSA9IGZvcmtUaGF0KGd1YXJkKHJlamVjdCksIGd1YXJkKHJlc29sdmUpKTtcblxuICAgIHJldHVybiBhbGxTdGF0ZSA9IFt0aGlzU3RhdGUsIHRoYXRTdGF0ZV07XG5cbiAgICBmdW5jdGlvbiBndWFyZChmKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oeCkge1xuICAgICAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgICBkb25lID0gdHJ1ZTtcbiAgICAgICAgICBkZWxheWVkKGZ1bmN0aW9uKCl7IGNsZWFudXBCb3RoKGFsbFN0YXRlKSB9KVxuICAgICAgICAgIHJldHVybiBmKHgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgfSwgY2xlYW51cEJvdGgpO1xuXG59O1xuXG4vLyAtLSBNb25vaWQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogUmV0dXJucyBhIFRhc2sgdGhhdCB3aWxsIG5ldmVyIHJlc29sdmVcbiAqXG4gKiBAc3VtbWFyeSBWb2lkIOKGkiBUYXNrW86xLCBfXVxuICovXG5UYXNrLmVtcHR5ID0gZnVuY3Rpb24gX2VtcHR5KCkge1xuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24oKSB7fSk7XG59O1xuXG5UYXNrLnByb3RvdHlwZS5lbXB0eSA9IFRhc2suZW1wdHk7XG5cbi8vIC0tIFNob3cgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFJldHVybnMgYSB0ZXh0dWFsIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBgVGFza1vOsSwgzrJdYFxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gVm9pZCDihpIgU3RyaW5nXG4gKi9cblRhc2sucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gX3RvU3RyaW5nKCkge1xuICByZXR1cm4gJ1Rhc2snO1xufTtcblxuLy8gLS0gRXh0cmFjdGluZyBhbmQgcmVjb3ZlcmluZyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogVHJhbnNmb3JtcyBhIGZhaWx1cmUgdmFsdWUgaW50byBhIG5ldyBgVGFza1vOsSwgzrJdYC4gRG9lcyBub3RoaW5nIGlmIHRoZVxuICogc3RydWN0dXJlIGFscmVhZHkgY29udGFpbnMgYSBzdWNjZXNzZnVsIHZhbHVlLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiBUYXNrW86zLCDOsl0pIOKGkiBUYXNrW86zLCDOsl1cbiAqL1xuVGFzay5wcm90b3R5cGUub3JFbHNlID0gZnVuY3Rpb24gX29yRWxzZShmKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIGYoYSkuZm9yayhyZWplY3QsIHJlc29sdmUpO1xuICAgIH0sIGZ1bmN0aW9uKGIpIHtcbiAgICAgIHJldHVybiByZXNvbHZlKGIpO1xuICAgIH0pO1xuICB9LCBjbGVhbnVwKTtcbn07XG5cbi8vIC0tIEZvbGRzIGFuZCBleHRlbmRlZCB0cmFuc2Zvcm1hdGlvbnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIENhdGFtb3JwaGlzbS4gVGFrZXMgdHdvIGZ1bmN0aW9ucywgYXBwbGllcyB0aGUgbGVmdG1vc3Qgb25lIHRvIHRoZSBmYWlsdXJlXG4gKiB2YWx1ZSwgYW5kIHRoZSByaWdodG1vc3Qgb25lIHRvIHRoZSBzdWNjZXNzZnVsIHZhbHVlLCBkZXBlbmRpbmcgb24gd2hpY2ggb25lXG4gKiBpcyBwcmVzZW50LlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiDOsyksICjOsiDihpIgzrMpIOKGkiBUYXNrW860LCDOs11cbiAqL1xuVGFzay5wcm90b3R5cGUuZm9sZCA9IGZ1bmN0aW9uIF9mb2xkKGYsIGcpIHtcbiAgdmFyIGZvcmsgPSB0aGlzLmZvcms7XG4gIHZhciBjbGVhbnVwID0gdGhpcy5jbGVhbnVwO1xuXG4gIHJldHVybiBuZXcgVGFzayhmdW5jdGlvbihyZWplY3QsIHJlc29sdmUpIHtcbiAgICByZXR1cm4gZm9yayhmdW5jdGlvbihhKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShmKGEpKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShnKGIpKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vKipcbiAqIENhdGFtb3JwaGlzbS5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+IHsgUmVqZWN0ZWQ6IM6xIOKGkiDOsywgUmVzb2x2ZWQ6IM6yIOKGkiDOsyB9IOKGkiBUYXNrW860LCDOs11cbiAqL1xuVGFzay5wcm90b3R5cGUuY2F0YSA9IGZ1bmN0aW9uIF9jYXRhKHBhdHRlcm4pIHtcbiAgcmV0dXJuIHRoaXMuZm9sZChwYXR0ZXJuLlJlamVjdGVkLCBwYXR0ZXJuLlJlc29sdmVkKTtcbn07XG5cbi8qKlxuICogU3dhcHMgdGhlIGRpc2p1bmN0aW9uIHZhbHVlcy5cbiAqXG4gKiBAc3VtbWFyeSBAVGFza1vOsSwgzrJdID0+IFZvaWQg4oaSIFRhc2tbzrIsIM6xXVxuICovXG5UYXNrLnByb3RvdHlwZS5zd2FwID0gZnVuY3Rpb24gX3N3YXAoKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUoYSk7XG4gICAgfSwgZnVuY3Rpb24oYikge1xuICAgICAgcmV0dXJuIHJlamVjdChiKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vKipcbiAqIE1hcHMgYm90aCBzaWRlcyBvZiB0aGUgZGlzanVuY3Rpb24uXG4gKlxuICogQHN1bW1hcnkgQFRhc2tbzrEsIM6yXSA9PiAozrEg4oaSIM6zKSwgKM6yIOKGkiDOtCkg4oaSIFRhc2tbzrMsIM60XVxuICovXG5UYXNrLnByb3RvdHlwZS5iaW1hcCA9IGZ1bmN0aW9uIF9iaW1hcChmLCBnKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlamVjdChmKGEpKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShnKGIpKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG4vKipcbiAqIE1hcHMgdGhlIGxlZnQgc2lkZSBvZiB0aGUgZGlzanVuY3Rpb24gKGZhaWx1cmUpLlxuICpcbiAqIEBzdW1tYXJ5IEBUYXNrW86xLCDOsl0gPT4gKM6xIOKGkiDOsykg4oaSIFRhc2tbzrMsIM6yXVxuICovXG5UYXNrLnByb3RvdHlwZS5yZWplY3RlZE1hcCA9IGZ1bmN0aW9uIF9yZWplY3RlZE1hcChmKSB7XG4gIHZhciBmb3JrID0gdGhpcy5mb3JrO1xuICB2YXIgY2xlYW51cCA9IHRoaXMuY2xlYW51cDtcblxuICByZXR1cm4gbmV3IFRhc2soZnVuY3Rpb24ocmVqZWN0LCByZXNvbHZlKSB7XG4gICAgcmV0dXJuIGZvcmsoZnVuY3Rpb24oYSkge1xuICAgICAgcmV0dXJuIHJlamVjdChmKGEpKTtcbiAgICB9LCBmdW5jdGlvbihiKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShiKTtcbiAgICB9KTtcbiAgfSwgY2xlYW51cCk7XG59O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vZGF0YS50YXNrL2xpYi90YXNrLmpzXG4gKiogbW9kdWxlIGlkID0gNFxuICoqIG1vZHVsZSBjaHVua3MgPSAwXG4gKiovIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07XG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAod2VicGFjaykvfi9ub2RlLWxpYnMtYnJvd3Nlci9+L3RpbWVycy1icm93c2VyaWZ5L21haW4uanNcbiAqKiBtb2R1bGUgaWQgPSA1XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogKHdlYnBhY2spL34vbm9kZS1saWJzLWJyb3dzZXIvfi9wcm9jZXNzL2Jyb3dzZXIuanNcbiAqKiBtb2R1bGUgaWQgPSA2XG4gKiogbW9kdWxlIGNodW5rcyA9IDBcbiAqKi8iLCIvKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xuJ3VzZSBzdHJpY3QnO1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBwcm9wSXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuZnVuY3Rpb24gdG9PYmplY3QodmFsKSB7XG5cdGlmICh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QuYXNzaWduIGNhbm5vdCBiZSBjYWxsZWQgd2l0aCBudWxsIG9yIHVuZGVmaW5lZCcpO1xuXHR9XG5cblx0cmV0dXJuIE9iamVjdCh2YWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCwgc291cmNlKSB7XG5cdHZhciBmcm9tO1xuXHR2YXIgdG8gPSB0b09iamVjdCh0YXJnZXQpO1xuXHR2YXIgc3ltYm9scztcblxuXHRmb3IgKHZhciBzID0gMTsgcyA8IGFyZ3VtZW50cy5sZW5ndGg7IHMrKykge1xuXHRcdGZyb20gPSBPYmplY3QoYXJndW1lbnRzW3NdKTtcblxuXHRcdGZvciAodmFyIGtleSBpbiBmcm9tKSB7XG5cdFx0XHRpZiAoaGFzT3duUHJvcGVydHkuY2FsbChmcm9tLCBrZXkpKSB7XG5cdFx0XHRcdHRvW2tleV0gPSBmcm9tW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRcdHN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKGZyb20pO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwcm9wSXNFbnVtZXJhYmxlLmNhbGwoZnJvbSwgc3ltYm9sc1tpXSkpIHtcblx0XHRcdFx0XHR0b1tzeW1ib2xzW2ldXSA9IGZyb21bc3ltYm9sc1tpXV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqXG4gKiogV0VCUEFDSyBGT09URVJcbiAqKiAuL34vb2JqZWN0LWFzc2lnbi9pbmRleC5qc1xuICoqIG1vZHVsZSBpZCA9IDdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMFxuICoqLyIsImV4cG9ydHMuY3VycnkgPSBmdW5jdGlvbiBjdXJyeShmdW5rLCBpbml0aWFsX2FyZ3VtZW50cyl7XHJcblx0dmFyIGNvbnRleHQgPSB0aGlzXHJcblx0cmV0dXJuIGZ1bmN0aW9uKCl7ICBcclxuXHRcdHZhciBhbGxfYXJndW1lbnRzID0gKGluaXRpYWxfYXJndW1lbnRzfHxbXSkuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCkpXHJcblx0XHRyZXR1cm4gYWxsX2FyZ3VtZW50cy5sZW5ndGg+PWZ1bmsubGVuZ3RoP2Z1bmsuYXBwbHkoY29udGV4dCwgYWxsX2FyZ3VtZW50cyk6Y3VycnkoZnVuaywgYWxsX2FyZ3VtZW50cylcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydHMuY29tcG9zZSA9IGZ1bmN0aW9uKCl7XHJcblx0Ly9Db252ZXJ0IGZ1bmN0aW9ucyB0byBhbiBhcnJheSBhbmQgZmxpcCB0aGVtIChmb3IgcmlnaHQtdG8tbGVmdCBleGVjdXRpb24pXHJcblx0dmFyIGZ1bmN0aW9ucyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykucmV2ZXJzZSgpXHJcblx0Ly9DaGVjayBpZiBpbnB1dCBpcyBPSzpcclxuXHRmdW5jdGlvbnMuZm9yRWFjaChmdW5jdGlvbihmdW5rKXtpZih0eXBlb2YgZnVuayAhPT0gXCJmdW5jdGlvblwiKXt0aHJvdyBuZXcgVHlwZUVycm9yKGZ1bmsrXCIgaXMgbm90IGEgZnVuY3Rpb25cIiApfX0pXHJcblx0Ly9SZXR1cm4gdGhlIGZ1bmN0aW9uIHdoaWNoIGNvbXBvc2VzIHRoZW1cclxuXHRyZXR1cm4gZnVuY3Rpb24oKXtcclxuXHRcdC8vVGFrZSB0aGUgaW5pdGlhbCBpbnB1dFxyXG5cdFx0dmFyIGlucHV0ID0gYXJndW1lbnRzXHJcblx0XHR2YXIgY29udGV4dFxyXG5cdFx0cmV0dXJuIGZ1bmN0aW9ucy5yZWR1Y2UoZnVuY3Rpb24ocmV0dXJuX3Jlc3VsdCwgZnVuaywgaSl7IFxyXG5cdFx0XHQvL0lmIHRoaXMgaXMgdGhlIGZpcnN0IGl0ZXJhdGlvbiwgYXBwbHkgdGhlIGFyZ3VtZW50cyB0aGF0IHRoZSB1c2VyIHByb3ZpZGVkXHJcblx0XHRcdC8vZWxzZSB1c2UgdGhlIHJldHVybiByZXN1bHQgZnJvbSB0aGUgcHJldmlvdXMgZnVuY3Rpb25cclxuXHRcdFx0cmV0dXJuIChpID09PTA/ZnVuay5hcHBseShjb250ZXh0LCBpbnB1dCk6IGZ1bmsocmV0dXJuX3Jlc3VsdCkpXHJcblx0XHRcdC8vcmV0dXJuIChpID09PTA/ZnVuay5hcHBseShjb250ZXh0LCBpbnB1dCk6IGZ1bmsuYXBwbHkoY29udGV4dCwgW3JldHVybl9yZXN1bHRdKSlcclxuXHRcdH0sIHVuZGVmaW5lZClcclxuXHR9XHJcbn1cclxuLy9cclxuLy9jb21iaW5lcyBhbiBhcnJheSBvZiBhc3luYyBmdW5jdGlvbnMgd2l0aCBzaWduYXR1cmUgaW50byBvbmUgZnVuY3Rpb25zLlxyXG4vLyBbIChjYWxsYmFjaywgdmFsdWUpID0+ICgpIF0gPT4gKHZhbHVlKSA9PiAoKVxyXG5leHBvcnRzLmFzeW5jQ29tcG9zZSA9IChmdW5jdGlvbnMsIHNlbGYpID0+IGZ1bmN0aW9ucy5yZWR1Y2UoKGYsIG5ld0YpID0+IHtcclxuICByZXR1cm4gKHZhbCkgPT4gbmV3Ri5jYWxsKHNlbGYsIGYsIHZhbClcclxufSlcclxuY29uc3QgYmFzZU1vbmFkRnVuY3Rpb25zID0gWydvZicsICdjaGFpbicsICdsaWZ0J11cclxuXHJcbmNvbnN0IG9wdGlvbmFsTW9uYWRGdW5jdGlvbnMgPSBbJ2ZvbGQnLCAncnVuJywgJ3ZhbHVlJywgJ21hcCcsICdvdXRlcicsICduYW1lJ11cclxuXHJcbmNvbnN0IGlzSW4gPSAoYXJyKSA9PiAodmFsKSA9PiBhcnIuaW5kZXhPZih2YWwpID09PSAtMVxyXG5cclxuLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gcHJvcGVydHkgaXMgcGFydCBvZiB0aGUgZ2VuZXJhbCBtb25hZCBkZWZpbml0aW9uIGludGVyZmFjZVxyXG5jb25zdCBpc1Jlc2VydmVyTW9uYWRLZXkgPSBpc0luKGJhc2VNb25hZEZ1bmN0aW9ucy5jb25jYXQob3B0aW9uYWxNb25hZEZ1bmN0aW9ucykpXHJcblxyXG4vLyBNYXBzIHRoZSB2YWx1ZXMgb2YgYSBnaXZlbiBvYmogZXhjbHVkaW5nIHRoZSByZXNlcnZlZCBvbmVzLlxyXG5leHBvcnRzLm1vbmFkTWFwVmFscyA9IChmdW5rLCBvYmopID0+IHtcclxuICByZXR1cm4gT2JqZWN0LmtleXMob2JqKVxyXG4gICAgLmZpbHRlcihpc1Jlc2VydmVyTW9uYWRLZXkpXHJcbiAgICAucmVkdWNlKChuZXdPYmosIGtleSkgPT4ge1xyXG4gICAgICBuZXdPYmpba2V5XSA9IGZ1bmsob2JqW2tleV0sIG9iailcclxuICAgICAgcmV0dXJuIG5ld09ialxyXG4gICAgfSwge30pXHJcbn1cclxuXHJcbi8vIEEgc3RhdGVmdWwgdmVyc2lvbiBvZiB0aGUgbWFwIGZ1bmN0aW9uOlxyXG4vLyBmIGFjY2VwdHMgYW4gYXJyYXkgaXRlbSBhbmQgYSBzdGF0ZSAoZGVmYXVsdHMgdG8gYW4gb2JqZWN0KSBhbmQgcmV0dXJucyB0aGUgcHJvY2Vzc2VkIHZlcnNpb24gb2YgdGhlIGl0ZW0gcGx1cyBhIG5ldyBzdGF0ZVxyXG5leHBvcnRzLnN0YXRlZnVsTWFwID0gKGFyciwgZikgPT5cclxuICBhcnIucmVkdWNlKChhcnJheUFuZFN0YXRlLCBpdGVtKSA9PiB7XHJcbiAgICBjb25zdCBpdGVtQW5kU3RhdGUgPSAoZihpdGVtLCBhcnJheUFuZFN0YXRlWzFdKSlcclxuICAgIHJldHVybiBbYXJyYXlBbmRTdGF0ZVswXS5jb25jYXQoW2l0ZW1BbmRTdGF0ZVswXV0pLCBpdGVtQW5kU3RhdGVbMV0gXVxyXG4gIH0sIFtbXSwge31dKVswXVxyXG5cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL2hlbHBlcnMuanNcbiAqKi8iLCIvKiAjIFRoZSBvYmplY3Qgd3JhcHBlclxyXG4gKlxyXG4gKiBUaGlzIGxpYnJhcnkgcHJvdmlkZXMgYSBtb2R1bGUgd2hpY2ggYWxsb3dzIHlvdSB0byBjb21iaW5lIHNldmVyYWwgbW9uYWQgdHJhbnNmb3JtZXIgZGVmaW5pdGlvbnNcclxuICogYW5kIGNyZWF0ZSBhIG9iamVjdC1vcmllbnRlZCB3cmFwcGVyIGZvciB1c2luZyB0aGUgcmVzdWx0aW5nIG1vbmFkLlxyXG4gKiBcclxuICogIyMgQ3JlYXRpbmcgYSBtb25hZCBjb25zdHJ1Y3RvclxyXG4gKlxyXG4gKiBZb3UgY2FuIGNyZWF0ZSBhIG1vbmFkIGNvbnN0cnVjdG9yIHVzaW5nIHRoZSBgbXRsLm1ha2VgIGZ1bmN0aW9uOlxyXG4gKlxyXG4gKiAjIyNgbXRsLm1ha2UoW2Jhc2VNb25hZF0sIG1vbmFkVHJhbnNmb3JtZXIxLCBtb25hZFRyYW5zZm9ybWVyMilgXHJcbiAqXHJcbiAqICMjIyNgYmFzZU1vbmFkIC0gbW9uYWREZWZpbml0aW9uYFxyXG4gKlxyXG4gKiBPcHRpb25hbGx5IHlvdSBjYW4gcGFzcyB0aGUgZGVmaW5pdGlvbiBvZiB0aGUgbW9uYWQgdGhhdCB3b3VsZCBzaXQgYXQgdGhlIGJvdHRvbSBvZiB0aGUgc3RhY2ssIFxyXG4gKiBhcyBhIGZpcnN0IGFyZ3VtZW50IG9mIHRoZSBgbWFrZWAgZnVuY3Rpb24uXHJcbiAqXHJcbiAqIFRoZSBwYXJhbWV0ZXIgaXMgb3B0aW9uYWwuIEJ5IGRlZmF1bHQsIHRoZSBwYWNrYWdlIHVzZXMgdGhlIGlkZW50aXR5IG1vbmFkIGFzIGEgYmFzZS5cclxuICpcclxuICogIyMjI2Btb25hZFRyYW5zZm9ybWVyPDEtbj4gLSBtb25hZFRyYW5zZm9ybWVyRGVmaW5pdGlvbmBcclxuICpcclxuICogUGFzcyB0aGUgZGVmaW5pdGlvbnMgb2YgdGhlIG1vbmFkIHRyYW5zZm9ybWVycyB3aGljaCB3b3VsZCBhdWdtZW50IHRoZSBiYXNlIG1vbmFkLiBcclxuICogTm90ZSB0aGF0IG1vbmFkIHRyYW5zZm9ybWF0aW9ucyBhcmUgdXN1YWxseSBub3QgY29tbXV0YXRpdmUgc28gdGhlIG9yZGVyIGluIHdoaWNoIHRoZSBhcmd1bWVudHNcclxuICogYXJlIHBsYWNlZCBtYXR0ZXJzLlxyXG4gKi9cclxuXHJcbmNvbnN0IGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKVxyXG5jb25zdCBoZWxwZXJzID0gcmVxdWlyZSgnLi9oZWxwZXJzJylcclxuY29uc3QgaWRGdW5jID0gYSA9PiBhXHJcblxyXG4vLyBQcm9tb3RlcyBhIGZ1bmN0aW9uIGZyb20gYSBtb25hZCBkZWZpbml0aW9uIHRvIGEgbW9uYWQgc3RhY2sgbWV0aG9kLCBzbyBpdCBjYW4gYmUgdXNlZCBmb3IgY2hhaW5pbmdcclxuY29uc3QgcHJvbW90ZVRvTWV0aG9kID0gKGZ1bmssIG1vbmFkRGVmaW5pdGlvbikgPT4gZnVuY3Rpb24gKCkge1xyXG4gIGNvbnN0IGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXHJcbiAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IoZnVuay5hcHBseShtb25hZERlZmluaXRpb24sIGFyZ3MuY29uY2F0KFt2YWxdKSkpXHJcbiAgfSlcclxufVxyXG5cclxuLy8gUHJvbW90ZXMgYSBmdW5jdGlvbiBmcm9tIGEgbW9uYWQgZGVmaW5pdGlvbiB0byBhIHN0YWNrIGNvbnN0cnVjdG9yXHJcbmNvbnN0IHByb21vdGVUb0NvbnN0cnVjdG9yID0gKGZ1bmssIG1vbmFkRGVmaW5pdGlvbikgPT4gZnVuY3Rpb24gKCkge1xyXG4gIHJldHVybiB0aGlzKGZ1bmsuYXBwbHkobW9uYWREZWZpbml0aW9uLCBhcmd1bWVudHMpKVxyXG59XHJcblxyXG4vKlxyXG4gKiBUaGUgZnVuY3Rpb24gcmV0dXJucyBhbiBgb2JqZWN0V3JhcHBlcmAgd2hpY2ggYWxsb3dzIHlvdSBpbnN0YW50aWF0ZSBtb25hZHMgZnJvbSBhbGwga2luZHMgb2YgdmFsdWVzLlxyXG4gKi9cclxuIFxyXG5tb2R1bGUuZXhwb3J0cyA9IChzdGFjaykgPT4geyBcclxuICBjb25zdCBtb25hZCA9IGFzc2lnbihPYmplY3QuY3JlYXRlKG1vbmFkV3JhcHBlclByb3RvKSwgaGVscGVycy5tb25hZE1hcFZhbHMocHJvbW90ZVRvTWV0aG9kLCBzdGFjaykpXHJcbiAgY29uc3QgY29uc3RydWN0b3IgPSAodmFsKSA9PiB7XHJcbiAgICB2YXIgb2JqZWN0ID0gT2JqZWN0LmNyZWF0ZShtb25hZClcclxuICAgIG9iamVjdC5fdmFsdWUgPSB2YWxcclxuICAgIHJldHVybiBvYmplY3RcclxuICB9XHJcbiAgbW9uYWQuc3RhY2sgPSBzdGFja1xyXG4gIG1vbmFkLmNvbnN0cnVjdG9yID0gYXNzaWduKGNvbnN0cnVjdG9yLCBoZWxwZXJzLm1vbmFkTWFwVmFscyhwcm9tb3RlVG9Db25zdHJ1Y3Rvciwgc3RhY2spKVxyXG4gIG1vbmFkLmNvbnN0cnVjdG9yLm9mID0gbW9uYWQub2YuYmluZChtb25hZClcclxuICBtb25hZC5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBtb25hZFxyXG4gIHJldHVybiBtb25hZC5jb25zdHJ1Y3RvclxyXG59XHJcblxyXG4vKlxyXG4gKiAjIyBDcmVhdGluZyBtb25hZHNcclxuICpcclxuICogTW9uYWRzIGFyZSBnZW5lcmFsbHkgY3JlYXRlZCB1c2luZyBbdHlwZS1zcGVjaWZpYyBtZXRob2RzXShhcGkubWQpIGxpa2UgYGZyb21BcnJheWAgKGZvciBzdGFja3MgdGhhdCBpbmNsdWRlIHRoZVxyXG4gKiBsaXN0IHRyYW5zZm9ybWF0aW9uLCBvciBgZnJvbVN0YXRlYCAoZm9yIHN0YXRlZnVsIGNvbXB1dGF0aW9ucykgYnV0IHNldmVyYWwgZ2VuZXJpYyBtZXRob2RzIGFyZSBhbHNvIHByb3ZpZGVkLlxyXG4gKlxyXG4gKiAjIyMgYG9iamVjdFdyYXBwZXIub2YodmFsdWUpYFxyXG4gKlxyXG4gKiBDb25zdHJ1Y3RzIGEgbW9uYWQgZnJvbSBhIHBsYWluIG5vbi1tb25hZGljIHZhbHVlLlxyXG4gKi9cclxuXHJcbmNvbnN0IG1vbmFkV3JhcHBlclByb3RvID0ge1xyXG4gIG9mICh2YWx1ZSkge1xyXG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IodGhpcy5zdGFjay5vZih2YWx1ZSkpXHJcbiAgfSxcclxuXHJcbi8qICMjIyBgb2JqZWN0V3JhcHBlcih2YWx1ZSlgXHJcbiAqXHJcbiAqIENvbnN0cnVjdHMgYSBtb25hZCBmcm9tIGEgdmFsdWUgd2hpY2ggb2JleXMgdGhlIHN0cnVjdHVyZSBvZiB0aGUgbW9uYWQgc3RhY2sgaS5lLiBpdCBcIndyYXBzXCIgdGhlIHZhbHVlXHJcbiAqIGludG8gYSBtb25hZGljIGludGVyZmFjZS5cclxuICpcclxuICogIyMgVXNpbmcgbW9uYWRzXHJcbiAqXHJcbiAqIEFnYWluIHRoZXJlIGFyZSBtYW55IG1ldGhvZHMgdGhhdCB5b3Ugd291bGQgdXNlIHRvIG1hbmlwdWxhdGUgYSBtb25hZCB3aGljaCBhcmUgW3R5cGUtc3BlY2lmaWNdKGFwaS5tZCkuIFxyXG4gKiBIZXJlIGFyZSB0aGUgZ2VuZXJpYyBvbmVzOlxyXG4gKlxyXG4gKiAjIyNgbW9uYWQuY2hhaW4oZilgXHJcbiAqXHJcbiAqIEFwcGxpZXMgYGZgIHRvIHRoZSB2YWx1ZSBvciB2YWx1ZXMgdGhhdCBhcmUgaW5zaWRlIHRoZSBtb25hZCBhbmQgcmV0dXJucyBhIG5ldyB3cmFwcGVkIG9iamVjdFxyXG4gKlxyXG4gKi9cclxuICBjaGFpbiAoZikge1xyXG4gICAgY29uc3QgZlVud3JhcCA9ICh2YWwpID0+IHtcclxuICAgICAgY29uc3QgbmV3VmFsID0gZi5jYWxsKHRoaXMuY29uc3RydWN0b3IsIHZhbCwgdGhpcy5jb25zdHJ1Y3RvcilcclxuICAgICAgaWYgKCFuZXdWYWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7dGhyb3cgSlNPTi5zdHJpbmdpZnkobmV3VmFsKSArICcgaXMgbm90IGEgd3JhcHBlZCB2YWx1ZSd9XHJcbiAgICAgIGlmIChuZXdWYWwuc3RhY2submFtZSAhPT0gdGhpcy5zdGFjay5uYW1lKSB7dGhyb3cgYCR7dGhpcy5zdGFjay5uYW1lfSBpcyBub3QgdGhlIHNhbWUgYXMgJHtuZXdWYWwuc3RhY2submFtZX1gfVxyXG4gICAgICByZXR1cm4gbmV3VmFsLl92YWx1ZVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IodGhpcy5zdGFjay5jaGFpbihmVW53cmFwLCB0aGlzLl92YWx1ZSkpXHJcbiAgfSxcclxuLypcclxuICogIyMjYG1vbmFkLm1hcChmKWBcclxuICpcclxuICogQXBwbGllcyBgZmAgdG8gdGhlIHZhbHVlIG9yIHZhbHVlcyB0aGF0IGFyZSBpbnNpZGUgdGhlIG1vbmFkIGFuZCB3cmFwcyB0aGUgcmVzdWx0aW5nIHZhbHVlIGluIGEgbmV3IG1vbmFkIGluc3RhbmNlLlxyXG4gKlxyXG4gKi9cclxuICBtYXAgKGZ1bmspIHtcclxuICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IHRoaXMub2YoZnVuayh2YWwpKSlcclxuICB9LFxyXG5cclxuLypcclxuICogIyMjYG1vbmFkLnRhcChmKWBcclxuICpcclxuICogQXBwbGllcyB0aGUgZiB0byB0aGUgbW9uYWQgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cclxuICpcclxuICovXHJcbiAgdGFwIChmdW5rKSB7XHJcbiAgICByZXR1cm4gZnVuayh0aGlzKVxyXG4gIH0sXHJcblxyXG4vKiAjIyNgbW9uYWQucnVuKClgXHJcbiAqXHJcbiAqIFJ1bnMgdGhlIGNvbXB1dGF0aW9uIGluc2lkZSB0aGUgbW9uYWQgYW5kIGNhbGxzIHRoZSBjYWxsYmFjayB3aXRoIHRoZSByZXN1bHRpbmcgdmFsdWUuXHJcbiAqIERvZXMgbm90IHVud3JhcCB0aGUgdmFsdWUuXHJcbiAqXHJcbiAqL1xyXG4gIHJ1biAoY2FsbGJhY2ssIGVudmlyb25tZW50KSB7XHJcbiAgICByZXR1cm4gdGhpcy5zdGFjay5ydW4uY2FsbChlbnZpcm9ubWVudCwgY2FsbGJhY2t8fGlkRnVuYywgdGhpcy5fdmFsdWUpXHJcbiAgfSxcclxuXHJcbi8qICMjI2Btb25hZC52YWx1ZSgpYFxyXG4gKlxyXG4gKiBSdW5zIHRoZSBjb21wdXRhdGlvbiBpbnNpZGUgdGhlIG1vbmFkIGFuZCBjYWxscyB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgcmVzdWx0aW5nIHZhbHVlLlxyXG4gKiBVbndyYXBzIHRoZSB2YWx1ZSB1c2luZyB0aGUgYGZvbGRgIGZ1bmN0aW9ucy5cclxuICpcclxuICovXHJcbiAgdmFsdWUgKGNhbGxiYWNrcywgZW52aXJvbm1lbnQpIHtcclxuICAgIGNvbnN0IHN0YWNrID0gdGhpcy5zdGFja1xyXG4gICAgcmV0dXJuIHRoaXMucnVuKCh2YWwpID0+IHtcclxuICAgICAgcmV0dXJuIHN0YWNrLmZvbGQuY2FsbChjYWxsYmFja3MsICh2YWwpID0+IHtcclxuICAgICAgICBpZih0eXBlb2YgY2FsbGJhY2tzID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICBjYWxsYmFja3ModmFsKVxyXG4gICAgICAgIH1lbHNlIGlmICh0eXBlb2YgY2FsbGJhY2tzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgY2FsbGJhY2tzLm9uVmFsdWUgPT09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgICAgY2FsbGJhY2tzLm9uVmFsdWUodmFsKVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdmFsXHJcbiAgICAgIH0sIHZhbClcclxuICAgIH0sIGVudmlyb25tZW50KVxyXG4gIH0sXHJcbi8qIFxyXG4gKiAjIyNgbW9uYWQuYXAoKWBcclxuICpcclxuICogQXBwbGllcyBhIHdyYXBwZWQgZnVuY3Rpb24gdG8gYSB3cmFwcGVkIHZhbHVlLlxyXG4gKiBTYW1lIGFzIGA8QD5gIGluIEhhc2tlbGwuXHJcbiAqL1xyXG4gIGFwICh2YWwpIHsgXHJcbiAgICByZXR1cm4gdGhpcy5jaGFpbihmID0+IHZhbC5tYXAoZikpXHJcbiAgfSxcclxuLyogXHJcbiAqICMjI2Btb25hZC5hbmRUaGVuKClgXHJcbiAqXHJcbiAqIFNhbWUgYXMgYGNoYWluYCBidXQgYWNjZXB0cyBhIHdyYXBwZWQgdmFsdWUgaW5zdGVhZCBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBvbmUuXHJcbiAqIFNhbWUgYXMgYD4+PmAgaW4gSGFza2VsbC5cclxuICovXHJcbiAgYW5kVGhlbiAobW9uYWQpIHtcclxuICAgIHJldHVybiB0aGlzLmNoYWluKChfKSA9PiBtb25hZClcclxuICB9LFxyXG4vKiBcclxuICogIyMjYG1vbmFkLmRlYnVnKClgXHJcbiAqXHJcbiAqIEEgc2hvcnRjdXQgZm9yIGluc2VydGluZyBhIGJyZWFrcG9pbnQgaW4gdGhlIGNvbXB1dGF0aW9uLlxyXG4gKi9cclxuICBkZWJ1ZyAoKSB7XHJcbiAgICBkZWJ1Z2dlclxyXG4gICAgcmV0dXJuIHRoaXNcclxuICB9XHJcbn1cclxuXHJcbi8qXHJcbiAqIEZvciBtb3JlIGluZm9ybWF0aW9uLCBzZWUgdGhlIFtGYW50YXN5IExhbmQgc3BlY10oaHR0cHM6Ly9naXRodWIuY29tL2ZhbnRhc3lsYW5kL2ZhbnRhc3ktbGFuZCkuXHJcbiAqXHJcbiAqIFtfVmlldyBpbiBHaXRIdWJfXSguLi9saWIvd3JhcHBlci5qcylcclxuICovXHJcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIEM6L3ByL3Nvbm5lL2xpYi93cmFwcGVyLmpzXG4gKiovIiwiLyogIyBUeXBlcyBBUElcclxuICpcclxuICogSGVyZSBpcyBhIGxpc3Qgb2YgYWxsIG1vbmFkIHRyYW5zZm9ybWVycyBhbmQgdGhlIG1ldGhvZHMgdGhhdCB0aGV5IGFkZCB0byB0aGUgd3JhcHBlciBvYmplY3QuXHJcbiAqXHJcbi8qICMjIGBkYXRhLm1heWJlYFxyXG4gKlxyXG4gKiBUaGUgYG1heWJlYCBtb25hZCB0cmFuc2Zvcm1lciBhdXRvbWF0aWNhbGx5IGNoZWNrcyBpZiB5b3VyIHZhbHVlIGlzIHVuZGVmaW5lZCBhbmRcclxuICogc3RvcHMgdGhlIGNvbXB1dGF0aW9uIGlmIGl0IGlzLlxyXG4gKlxyXG4gKiAjIyMgYHZhbHVlLm1heWJlR2V0KGtleSlgXHJcbiAqXHJcbiAqIEEgaGVscGVyIHRvIHNhZmVseSByZXRyaWV2ZSBhIHBvc3NpYmx5IHVuZGVmaW5lZCBwcm9wZXJ0eSBvZiB5b3VyIHdyYXBwZWQgdmFsdWUuXHJcbiAqIFxyXG4gKiAjIyMgYHZhbHVlLm1heWJlTWFwKGYpYFxyXG4gKiBcclxuICogQ2hhaW5zIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYG1heWJlYCB2YWx1ZSBpbiB0aGUgY29tcHV0YXRpb25cclxuICpcclxuICogIyMjIERlZmluaXRpb25cclxuICpcclxuICogIVtNYXliZV0oaW1nL21heWJlLnBuZylcclxuICpcclxuICogIyMjIFNvdXJjZVxyXG4gKi9cclxuXHJcbmNvbnN0IGlkRnVuYyA9IGEgPT4gYVxyXG5leHBvcnRzLm1heWJlID0ge1xyXG4gIC8vIFN0YW5kYXJkIGZ1bmN0aW9uc1xyXG4gIG5hbWU6ICdNYXliZScsXHJcbiAgLy8gKHZhbCkgPT4gTSh7dmFsdWU6dmFsfSlcclxuICBvZiAodmFsKSB7IHJldHVybiB0aGlzLm91dGVyLm9mKHt2YWx1ZTogdmFsLCBzb21ldGhpbmc6dHJ1ZSB9KSB9LFxyXG4gIC8vICh2YWwgPT4gTSh7dmFsdWU6dmFsfSkgLCBNKHt2YWx1ZTp2YWx9KSkgPT4gTSh7dmFsdWU6dmFsfSlcclxuICBjaGFpbiAoZnVuaywgbU1heWJlVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigodmFsdWUpID0+IHtcclxuICAgICAgcmV0dXJuIHZhbHVlLnNvbWV0aGluZyA/IGZ1bmsodmFsdWUudmFsdWUpIDogdGhpcy5vdXRlci5vZih2YWx1ZSkgXHJcbiAgICB9LCBtTWF5YmVWYWwpXHJcbiAgfSxcclxuICAvLyAoTSh2YWwpKSA9PiBNKHt2YWx1ZTp2YWx9KVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe3ZhbHVlOiB2YWwsIHNvbWV0aGluZzogdHJ1ZX0pLCBtVmFsKVxyXG4gIH0sXHJcbiAgZm9sZCAodmFsdWUsIG1heWJlKSB7XHJcbiAgICAgIHJldHVybiBtYXliZS5zb21ldGhpbmcgPyB2YWx1ZShtYXliZS52YWx1ZSkgOiAodGhpcy5vbk5vdGhpbmcgfHwgaWRGdW5jICkoKSBcclxuICB9LFxyXG4gIC8vIEN1c3RvbSBmdW5jdGlvbnNcclxuICBtYXliZUdldCAoa2V5LCB2YWwpIHtcclxuICAgIHJldHVybiB2YWxba2V5XSAhPT0gdW5kZWZpbmVkID8gdGhpcy5vZih2YWxba2V5XSkgOiB0aGlzLm91dGVyLm9mKHtzb21ldGhpbmc6IGZhbHNlfSlcclxuICB9LFxyXG4gIG5vdGhpbmcgKCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe3NvbWV0aGluZzogZmFsc2V9KVxyXG4gIH0sXHJcbiAgbWF5YmVNYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgY29uc3QgdmFsdWUgPSBmdW5rKHZhbClcclxuICAgIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkID8gdGhpcy5vZih2YWx1ZSkgOiB0aGlzLm91dGVyLm9mKHtzb21ldGhpbmc6IGZhbHNlfSlcclxuICB9XHJcbn1cclxuLyogXHJcbiAqIFtfVmlldyBpbiBHaXRIdWJfXSguLi9saWIvZGF0YS5qcylcclxuICovXHJcblxyXG4vKiAjIyBgZGF0YS5saXN0YFxyXG4gKlxyXG4gKiBUaGUgYGxpc3RgIG1vbmFkIHRyYW5zZm9ybWVyIGFsbG93cyB5b3UgdG8gb3BlcmF0ZSBvbiBhIGxpc3Qgb2YgdmFsdWVzLlxyXG4gKiBpbnN0ZWFkIG9mIG9uIGEgc2luZ2xlIHZhbHVlLlxyXG4gKlxyXG4gKiAjIyMgYExpc3QuZnJvbUFycmF5KHZhbClgXHJcbiAqXHJcbiAqIFdyYXBzIGFuIGFycmF5IGluIGEgbGlzdCBtb25hZCB0cmFuc2Zvcm1lciBpbnN0YW5jZS5cclxuICpcclxuICogIyMjIGB2YWx1ZXMuZmlsdGVyKGZuKWBcclxuICogXHJcbiAqIEZpbHRlcnMgb3V0IHRoZSB2YWx1ZXMgdGhhdCBkb24ndCBtYXRjaCB0aGUgcHJlZGljYXRlLiBTYW1lIGFzIGBBcnJheS5wcm90b3R5cGUuZmlsdGVyYC5cclxuICogXHJcbiAqIF9UaGUgYmVoYXZpb3VyIG9mIGBBcnJheS5wcm90b3R5cGUubWFwYCBpcyBjb3ZlcmVkIGJ5IHRoZSBtb25hZCB0cmFuc2Zvcm1lciBgbWFwYCBtZXRob2QuX1xyXG4gKlxyXG4gKiAjIyMgU291cmNlXHJcbiAqL1xyXG5cclxuZXhwb3J0cy5saXN0ID0ge1xyXG4gIG5hbWU6ICdMaXN0JyxcclxuICAvLyBTdGFuZGFyZCBmdW5jdGlvbnNcclxuICAvLyAodmFsKSA9PiBNKFt2YWxdKVxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWxdKVxyXG4gIH0sXHJcbiAgLy8gKHZhbCA9PiBNKFt2YWxdKSAsIE0oW3ZhbF0pKT0+IE0oW3ZhbF0pXHJcbiAgY2hhaW4gKGZ1bmssIG1MaXN0VmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbihsaXN0VmFsID0+IHtcclxuICAgICAgcmV0dXJuIGxpc3RWYWwubGVuZ3RoID09PSAwID8gdGhpcy5vdXRlci5vZihbXSkgOiBsaXN0VmFsXHJcbiAgICAgICAgLm1hcChmdW5rKVxyXG4gICAgICAgIC5yZWR1Y2UoKGFjY3VtdWxhdGVkVmFsLCBuZXdWYWwpID0+IHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGFjY3VtdWxhdGVkID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oX25ldyA9PiBcclxuICAgICAgICAgICAgICB0aGlzLm91dGVyLm9mKGFjY3VtdWxhdGVkLmNvbmNhdChfbmV3KSksIG5ld1ZhbClcclxuICAgICAgICB9LCBhY2N1bXVsYXRlZFZhbClcclxuICAgICAgfSlcclxuICAgIH0sIG1MaXN0VmFsKVxyXG4gIH0sXHJcbiAgLy8gKE0odmFsKSkgPT4gTShbdmFsXSlcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGlubmVyVmFsdWUgPT4gdGhpcy5vdXRlci5vZihbaW5uZXJWYWx1ZV0pLCB2YWwpXHJcbiAgfSxcclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0oW3ZhbF0pKSA9PiBvdGhlclZhbFxyXG4gIHZhbHVlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnZhbHVlKChsaXN0KSA9PiB7XHJcbiAgICAgIHJldHVybiBsaXN0Lm1hcChmdW5rKVxyXG4gICAgfSwgdmFsKVxyXG4gIH0sXHJcbiAgZm9sZCAodmFsdWUsIGxpc3QpIHtcclxuICAgIHJldHVybiBsaXN0Lm1hcCh2YWx1ZSlcclxuICB9LFxyXG4gIC8vIEN1c3RvbSBmdW5jdGlvbnNcclxuICBmaWx0ZXIgKGZ1bmssIHZhbCkge1xyXG4gICAgaWYgKGZ1bmsodmFsKSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5vZih2YWwpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5vdXRlci5vZihbXSlcclxuICAgIH1cclxuICB9LFxyXG4gIGZyb21BcnJheSAodmFsKSB7XHJcbiAgICBpZiAodmFsLmNvbmNhdCAmJiB2YWwubWFwICYmIHZhbC5yZWR1Y2UgJiYgdmFsLnNsaWNlKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHZhbClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IHZhbCArICcgaXMgbm90IGEgbGlzdC4nXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbi8qIFxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL2RhdGEuanMpXHJcbiAqL1xyXG5cclxuLyogIyMgYGRhdGEud3JpdGVyYFxyXG4gKlxyXG4gKiBUaGUgd3JpdGVyIG1vbmFkIHRyYW5zZm9ybWVyIGF1Z21lbnRzIHRoZSB3cmFwcGVkIHZhbHVlIHdpdGggb25lIGFkZGl0aW9uYWwgdmFsdWVcclxuICogd2hpY2ggbWF5IGJlIHVzZWQgZm9yIHN0b3Jpbmcgc29tZSBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjb21wdXRhdGlvbi5cclxuICpcclxuICogVGhlIGFkZGl0aW9uYWwgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3QgdGhhdCBoYXMgYSBgY29uY2F0YCBtZXRob2QgKGFzIFN0cmluZyBvciBBcnJheSkuXHJcbiAqIFxyXG4gKiAjIyMgYHZhbHVlLnRlbGwodmFsKWBcclxuICogXHJcbiAqIENvbmNhdHMgYHZhbGAgdG8gdGhlIGN1cnJlbnQgbG9nIHZhbHVlLlxyXG4gKlxyXG4gKiAjIyMgYHZhbHVlLnRlbGxNYXAoZilgXHJcbiAqXHJcbiAqIENhbGxzIGBmYCB3aXRoIHRoZSBjdXJyZW50IHZhbHVlIGFzIGFuIGFyZ3VtZW50IGFuZCB0aGVuIGNvbmNhdHMgdGhlIHJlc3VsdCB0byB0aGUgY3VycmVudCBsb2cgdmFsdWUuXHJcbiAqXHJcbiAqICMjIyBEZWZpbml0aW9uXHJcbiAqXHJcbiAqICFbV3JpdGVyXShpbWcvd3JpdGVyLnBuZylcclxuICpcclxuICogIyMjU291cmNlXHJcbiAqL1xyXG5cclxuY29uc3QgY29uY2F0TG9nID0gKGxvZywgbmV3TG9nKSA9PiB7XHJcbiAgaWYobG9nID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBuZXdMb2dcclxuICB9IGVsc2Uge1xyXG4gICAgaWYgKG5ld0xvZyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiBsb2dcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiBsb2cuY29uY2F0KG5ld0xvZylcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydHMud3JpdGVyID0ge1xyXG4gIG5hbWU6ICdXcml0ZXInLFxyXG4gIC8vIFN0YW5kYXJkIGZ1bmN0aW9uc1xyXG4gIC8vICh2YWwpID0+IE0oW3ZhbCwgbG9nXSlcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZih7dmFsdWU6IHZhbCwgd3JpdGVyOiB1bmRlZmluZWR9KVxyXG4gIH0sXHJcblxyXG4gIC8vICh2YWwgPT4gTShbdmFsLCBsb2ddKSwgTShbdmFsLCBsb2ddKSkgPT4gTShbdmFsLCBsb2ddKVxyXG4gIGNoYWluIChmdW5rLCBtV3JpdGVyVmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5jaGFpbigod3JpdGVyVmFsKSA9PiB7XHJcbiAgICAgIGNvbnN0IHZhbCA9IHdyaXRlclZhbC52YWx1ZSwgbG9nID0gd3JpdGVyVmFsLndyaXRlclxyXG4gICAgICBjb25zdCBuZXdNV3JpdGVyVmFsID0gZnVuayh2YWwpXHJcbiAgICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChuZXdXcml0ZXJWYWwpID0+IHtcclxuICAgICAgICBjb25zdCBuZXdWYWwgPSBuZXdXcml0ZXJWYWwudmFsdWUsIG5ld0xvZyA9IG5ld1dyaXRlclZhbC53cml0ZXJcclxuICAgICAgICByZXR1cm4gdGhpcy5vdXRlci5vZih7dmFsdWU6IG5ld1ZhbCwgd3JpdGVyOiBjb25jYXRMb2cobG9nLCBuZXdMb2cpfSlcclxuICAgICAgfSwgbmV3TVdyaXRlclZhbClcclxuICAgIH0sIG1Xcml0ZXJWYWwpXHJcblxyXG4gIH0sXHJcbiAgLy8gKE0odmFsKSA9PiBNKFt2YWwsIGxvZ10pXHJcbiAgbGlmdCAobVZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKHZhbCkgPT4gdGhpcy5vdXRlci5vZih7dmFsdWU6IHZhbCwgd3JpdGVyOiB1bmRlZmluZWR9KSwgbVZhbClcclxuICB9LFxyXG4gIC8vICgodmFsKSA9PiBiLCBNKFt2YWwsIGxvZ10pKSA9PiBiXHJcbiAgZm9sZCAodmFsdWUsIHdyaXRlclZhbCkge1xyXG4gICAgKHRoaXMub25Xcml0ZXJMb2cgfHwgaWRGdW5jKSh3cml0ZXJWYWwud3JpdGVyKVxyXG4gICAgcmV0dXJuIHZhbHVlKHdyaXRlclZhbC52YWx1ZSlcclxuICB9LFxyXG4gIC8vIEN1c3RvbSBmdW5jdGlvbnNcclxuICB0ZWxsIChtZXNzYWdlLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHt2YWx1ZTogdmFsLCB3cml0ZXI6bWVzc2FnZX0pXHJcbiAgfSxcclxuICB0ZWxsTWFwIChmbiwgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZih7dmFsdWU6IHZhbCwgd3JpdGVyOiBmbih2YWwpfSlcclxuICB9XHJcbn1cclxuLyogXHJcbiAqIFtfVmlldyBpbiBHaXRIdWJfXSguLi9saWIvZGF0YS5qcylcclxuICovXHJcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIEM6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzXG4gKiovIiwiLyogIyMgYGNvbXAuc3RhdGVgXHJcbiAqIFxyXG4gKiBUaGUgYHN0YXRlYCBtb25hZCB0cmFuc2Zvcm1lciBhbGxvd3MgeW91IHRvIGtlZXAgb25lIGFkZGl0aW9uYWwgbXV0YWJsZSBzdGF0ZSB2YWx1ZVxyXG4gKiB3aXRoIHlvdXIgY29tcHV0YXRpb24uXHJcbiAqXHJcbiAqICMjIyBgdmFsdWUuc2F2ZSgpYFxyXG4gKlxyXG4gKiBTYXZlcyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiBpbiB0aGUgc3RhdGUsIG92ZXJ3cml0aW5nIHRoZSBwcmV2aW91cyBvbmUuXHJcbiAqXHJcbiAqICMjIyBgdmFsdWUubG9hZCgpYFxyXG4gKlxyXG4gKiBSZXR1cm5zIHRoZSBjdXJyZW50IHN0YXRlLlxyXG4gKlxyXG4gKiAjIyMgYHZhbHVlLnN0YXRlZnVsTWFwKGYpYFxyXG4gKlxyXG4gKiBNYXBzIG92ZXIgdGhlIGN1cnJlbnQgdmFsdWUgYW5kIHN0YXRlIHdpdGggYGZgLlxyXG4gKiBUaGUgZnVuY3Rpb24gc2hvdWxkIHJldHVybiBhbiBhcnJheSBjb250YWluaW5nIHR3byBlbGVtZW50cyAtIHRoZSBuZXcgdmFsdWUgYW5kIHRoZSBuZXcgc3RhdGUuXHJcbiAqXHJcbiAqICMjIyBEZWZpbml0aW9uXHJcbiAqXHJcbiAqICFbU3RhdGVdKGltZy9zdGF0ZS5wbmcpXHJcbiAqXHJcbiAqICMjI1NvdXJjZVxyXG4gKi9cclxuY29uc3QgaWRGdW5jID0gYT0+YVxyXG5cclxuZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIC8vU3RhbmRhcmQgZnVuY3Rpb25zOlxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKHt2YWx1ZTogdmFsLCBzdGF0ZTogcHJldlN0YXRlfSlcclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCBzdGF0ZSkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+XHJcbiAgICAgIHRoaXMub3V0ZXIuY2hhaW4oKHBhcmFtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IG5ld1ZhbCA9IHBhcmFtcy52YWx1ZSwgbmV3U3RhdGUgPSBwYXJhbXMuc3RhdGVcclxuICAgICAgICByZXR1cm4gZnVuayhuZXdWYWwpKG5ld1N0YXRlKVxyXG4gICAgICB9LCBzdGF0ZShwcmV2U3RhdGUpKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdGhpcy5vdXRlci5jaGFpbigoaW5uZXJWYWx1ZSkgPT4gdGhpcy5vdXRlci5vZih7dmFsdWU6IGlubmVyVmFsdWUsIHN0YXRlOiBwcmV2U3RhdGV9KSwgdmFsKVxyXG4gIH0sXHJcbiAgcnVuIChmLCBzdGF0ZSkge1xyXG4gICAgcmV0dXJuIGYoc3RhdGUoKSlcclxuICB9LFxyXG4gIGZvbGQgKHZhbHVlLCBwYXJhbXMpIHtcclxuICAgICh0aGlzLm9uU3RhdGUgfHwgaWRGdW5jKShwYXJhbXMuc3RhdGUpXHJcbiAgICByZXR1cm4gdmFsdWUocGFyYW1zLnZhbHVlKVxyXG4gIH0sXHJcbiAgLy9DdXN0b20gZnVuY3Rpb25zOlxyXG4gIGxvYWRTdGF0ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gdGhpcy5vdXRlci5vZih7dmFsdWU6IHByZXZTdGF0ZSwgc3RhdGU6IHByZXZTdGF0ZX0pXHJcbiAgfSxcclxuICBzYXZlU3RhdGUgKHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IHRoaXMub3V0ZXIub2Yoe3ZhbHVlOnZhbCwgc3RhdGU6IHZhbH0pXHJcbiAgfSxcclxuICBzdGF0ZWZ1bE1hcCAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4ge1xyXG4gICAgICBjb25zdCBzdGF0ZVR1cGxlID0gZnVuayh2YWwsIHByZXZTdGF0ZSlcclxuICAgICAgcmV0dXJuIHRoaXMub3V0ZXIub2Yoe3ZhbHVlOiBzdGF0ZVR1cGxlWzBdLCBzdGF0ZTogc3RhdGVUdXBsZVsxXX0pXHJcbiAgICB9XHJcbiAgfSxcclxuICBzZXRTdGF0ZSAobmV3U3RhdGUsIHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IHRoaXMub3V0ZXIub2Yoe3ZhbHVlOnZhbCwgc3RhdGU6IG5ld1N0YXRlfSlcclxuICB9LFxyXG4gIG1hcFN0YXRlIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKHt2YWx1ZTp2YWwsIHN0YXRlOiBmdW5rKHByZXZTdGF0ZSwgdmFsKX0pXHJcbiAgfVxyXG59XHJcblxyXG4vKiAjIyBgY29tcC5yZWFkZXJgXHJcbiAqIFxyXG4gKiBUaGUgYHJlYWRlcmAgbW9uYWQgdHJhbnNmb3JtZXIgYWxsb3dzIHlvdSB0byBzcGVjaWZ5IGFuIGltbXV0YWJsZSBjb25maWd1cmF0aW9uIGZvciB5b3VyIGZ1bmN0aW9uXHJcbiAqIHdoaWNoIHlvdSBjYW4gdXNlIHRvIHR3ZWVrIHRoZSB3YXkgaXQgYmVoYXZlcy5cclxuICpcclxuICogIyMjIERlZmluaXRpb25cclxuICpcclxuICogIVtTdGF0ZV0oaW1nL3dyaXRlci5wbmcpXHJcbiAqXHJcbiAqICMjI1NvdXJjZVxyXG4gKi9cclxuZXhwb3J0cy5yZWFkZXIgPSB7XHJcbiAgbmFtZTogJ1JlYWRlcicsXHJcbiAgLy9TdGFuZGFyZCBmdW5jdGlvbnM6XHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIChlbnYpID0+IHRoaXMub3V0ZXIub2YodmFsKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHJlYWRlcikge1xyXG4gICAgcmV0dXJuIChlbnYpID0+XHJcbiAgICAgIHRoaXMub3V0ZXIuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICAgIHJldHVybiBmdW5rKHZhbCkoZW52KVxyXG4gICAgICB9LCByZWFkZXIoZW52KSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIChlbnYpID0+IHZhbFxyXG4gIH0sXHJcbiAgcnVuIChmLCByZWFkZXIpIHtcclxuICAgIHJldHVybiBmKHJlYWRlcih0aGlzLmVudmlyb25tZW50KSlcclxuICB9LFxyXG4gIGZvbGQgKHZhbHVlLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWx1ZSh2YWwpXHJcbiAgfSxcclxuICAvL0N1c3RvbSBmdW5jdGlvbnM6XHJcbiAgcmVhZGVyTWFwIChmLCB2YWwpIHtcclxuICAgIHJldHVybiAoZW52aXJvbm1lbnQpID0+IHRoaXMub3V0ZXIub2YoZih2YWwsIGVudmlyb25tZW50KSlcclxuICB9LFxyXG4gIGxvYWRFbnZpcm9ubWVudCh2YWwpIHtcclxuICAgIHJldHVybiAoZW52aXJvbm1lbnQpID0+IHRoaXMub3V0ZXIub2YoZW52aXJvbm1lbnQpXHJcbiAgfVxyXG59XHJcbi8qIFxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL2NvbXAuanMpXHJcbiAqL1xyXG5cclxuLyogIyMgUmVmZXJlbmNlc1xyXG4gKiBcclxuICogQWxsIGltYWdlcywgdGFrZW4gZnJvbSBbdGhlIFdpa2lwZWRpYSBhcnRpY2xlIG9uIG1vbmFkIHRyYW5zZm9ybWVyc10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTW9uYWRfdHJhbnNmb3JtZXIpLlxyXG4gKi9cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL2NvbXAuanNcbiAqKi8iLCIvKiAjIEltcGxlbWVudGluZyBhIG1vbmFkIHRyYW5zZm9ybWVyXHJcbiAqXHJcbiAqIE1vbmFkIHRyYW5zZm9ybWVycyBhcmUgdHJpY2t5LCBhbmQgb25lIG9mIHRoZSByZWFzb25zIGZvciB0aGlzIGlzIHRoYXQgdGhleSByZXF1aXJlIGFuXHJcbiAqIGV4Y2Vzc2l2ZSBhbW91bnQgb2YgdHlwZSBqdWdnbGluZy4gWW91IGhhdmUgdG8gY29uc3RhbnRseSB3cmFwIHRoaW5ncyBpbiBib3hlcyBhbmQgdW53cmFwIHRoZW1cclxuICogYWdhaW4uIFxyXG4gKlxyXG4gKiBPbmUgb2YgdGhlIGFpbXMgb2YgdGhpcyBwYWNrYWdlIGlzIHRvIHJlZHVjZSB0aGUgYW1vdW50IG9mIHdyYXBwaW5nIGFuZCB1bndyYXBwaW5nIG5lZWRlZCBmb3JcclxuICogbWFraW5nIGEgbmV3IHRyYW5zZm9ybWVyIGFuZCB0byBwcm92aWRlIGFuIGVhc3kgd2F5IHRvIGRlZmluZSBhbmQgY29tYmluZSB0cmFuc2Zvcm1lcnMuIFxyXG4gKlxyXG4gKiBJdCBkb2VzIHRoaXMgYnkgZGVmaW5pbmcgYSBtb25hZCB0cmFuc2Zvcm1lciBkZWZpbml0aW9uIGZvcm1hdCwgd2hpY2ggYWxsb3dzIHlvdSB0byBzcGVjaWZ5IFxyXG4gKiB5b3VyIHRyYW5zZm9ybWVyIG9ubHkgYnkgc3BlY2lmeWluZyBpdHMgdHJhbnNmb3JtYXRpb25zIG9uIHRoZSB2YWx1ZXMuIFxyXG4gKiBXaXRoIGl0LCBhbGwgaXQgdGFrZXMgdG8gaW1wbGVtZW50IGEgdHJhbnNmb3JtZXIgaXMgaW1wbGVtZW50IHRoZXNlIGZvdXIgZnVuY3Rpb25zOiBcclxuICogYG9mYCAoQUtBIGByZXR1cm5gKSwgYGNoYWluYCAoQUtBIGBmbGF0TWFwYCkgYGxpZnRgIGFuZCBgdmFsdWVgKEFLQSBgcnVuYClcclxuICpcclxuICogIyMgVGhlIHRyaXZpYWwgaW1wbGVtZW50YXRpb25cclxuICogXHJcbiAqIENvbnNpZGVyIHRoZSBpZGVudGl0eSBNb25hZCB0cmFuc2Zvcm1lci4gVGhpcyBpcyBhIG1vbmFkIHRyYW5zZm9ybWVyIHRoYXQgZG9lcyBub3RoaW5nOiBcclxuICogb3IgaW4gb3RoZXIgd29yZHMgaXQgcHJvZHVjZXMgYSBtb25hZCB3aGljaCBiZWhhdmVzIHRoZSBzYW1lIHdheSBhcyB0aGUgb25lIGl0IGlzIGdpdmVuIHRvIGl0XHJcbiAqIGFzIGFuIGFyZ3VtZW50LiBIZXJlIGlzIGhvdyB3b3VsZCB0aGUgaW1wbGVtZW50YXRpb24gb2YgdGhlc2UgbWV0aG9kcyBsb29rIGxpa2U6XHJcbiAqL1xyXG5cclxuZXhwb3J0cy5pZE1pbmltYWwgPSB7XHJcbiAgbmFtZTogJ2lkTWluaW1hbCcsXHJcbi8qXHJcbiAqIFRoZSBgb2ZgIGZ1bmN0aW9uIHRha2VzIGEgc2NhbGFyIHZhbHVlIGFuZCByZXR1cm5zIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRlbGVnYXRlIGV2ZXJ5dGhpbmcgdG8gdGhlIG91dGVyIG1vbmFkJ3MgYG9mYCBtZXRob2QuXHJcbiAqIFdlIGFjY2VzcyB0aGUgb3V0ZXIgbW9uYWQgd2l0aCBgdGhpcy5vdXRlcmAuIFxyXG4gKi9cclxuICAvLyAodmFsKSA9PiBNKHZhbClcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZih2YWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIGBjaGFpbmAgaXMgdGhlIGhlYXJ0IG9mIGFueSBtb25hZCBvciBtb25hZCB0cmFuc2Zvcm1lci5cclxuICpcclxuICogSW4gdGhpcyBjYXNlIHdlIGltcGxlbWVudCBpdCBieSBqdXN0IGNhbGxpbmcgdGhlIGBjaGFpbmAgZnVuY3Rpb24gb2YgdGhlIGhvc3QgbW9uYWQgKHVzaW5nIFxyXG4gKiBgdGhpcy5vdXRlci5jaGFpbmApIHdpdGggdGhlIGZ1bmN0aW9uIGdpdmVuIHRvIHVzIGFzIGFuIGFyZ3VtZW50LlxyXG4gKi9cclxuICAvLyAodmFsID0+IE0odmFsKSAsIE0odmFsKSkgPT4gTSh2YWwpXHJcbiAgY2hhaW4gKGZuLCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKGZuLCB2YWwpXHJcbiAgfSxcclxuLyogXHJcbiAqIFRoZSBgbGlmdGAgZnVuY3Rpb24gaXMga2luZGEgbGlrZSBgb2ZgLCBidXQgaXQgYWNjZXB0cyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWRcclxuICogaW5zdGVhZCBvZiBhICdwbGFpbicgdmFsdWUuXHJcbiAqL1xyXG4gIC8vIChNKHZhbCkpID0+IE0odmFsKVxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbFxyXG4gIH0sXHJcbi8qIFxyXG4gKiBIYXZpbmcgYm90aCAnbGlmdCcgYW5kICdvZicgZW5hYmxlcyB1cyB0byBjb252ZXJ0IGFueSB2YWx1ZSBjcmVhdGVkIGJ5IG9uZSBtb25hZCB0cmFuc2Zvcm1lclxyXG4gKiB0byBhIGEgdmFsdWUgdGhhdCBob2xkcyBhbGwgZWxlbWVudHMgb2YgdGhlIHN0YWNrXHJcbiAqXHJcbiAqIEZpbmFsbHkgdGhlIGB2YWx1ZWAgZnVuY3Rpb24gcHJvdmlkZXMgYSB3YXkgdG8gZ2V0ICd0aGUgdmFsdWUgYmFjaydcclxuICogV2hhdCBpdCBkb2VzIGlzIHRvIHVud3JhcCBhIHByZXZpb3VzbHktd3JhcHBlZCBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRpZG4ndCBkbyBhbnkgd3JhcHBpbmcsIHNvIHdlIGRvbid0IGhhdmUgdG8gZG8gYW55IHVud3JhcHBpbmcgZWl0aGVyLlxyXG4gKi9cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIE0odmFsKSkgPT4gb3RoZXJWYWxcclxuICB2YWx1ZSAoZm4sIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoZm4sIHZhbClcclxuICB9LFxyXG4gIGZvbGQgKHZhbHVlLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWx1ZSh2YWwpXHJcbiAgfVxyXG59XHJcblxyXG4vKiAjIE1hbmlwdWxhdGluZyB0aGUgdmFsdWVcclxuICogXHJcbiAqIEFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgZG8gdGhlIHNhbWUgdGhpbmcgKGdpdmVuIGEgbW9uYWQgYEFgLCB0aGV5IHByb2R1Y2UgYVxyXG4gKiBtb25hZCBgQihBKWAgd2hpY2ggc29tZWhvdyBhdWdtZW50cyBgQWApLCBidXQgdGhlcmUgaXMgbm8gZ2VuZXJhbCBmb3JtdWxhIGZvciBkb2luZyBpdC5cclxuICogXHJcbiAqIFNpbXBsZXIgbW9uYWRzIGNhbiBiZSBpbXBsZW1lbnRlZCBqdXN0IGJ5IG1hbmlwdWxhdGluZyB0aGUgdmFsdWUgaW5zaWRlIHRoZSBob3N0IG1vbmFkLlxyXG4gKlxyXG4gKiBPdXIgbmV4dCBpbXBsZW1lbnRhdGlvbiBvZiBJRCB3aWxsIGp1c3Qgd3JhcCB0aGUgdW5kZXJseWluZyB2YWx1ZSAod2hpY2ggd2UgY2FsbGVkIEEpXHJcbiAqIGluIGEgcGxhaW4gb2JqZWN0LlxyXG4gKlxyXG4gKiBTbyBgTShBKWAgd291bGQgYmVjb21lIGBNICh7aWRWYWw6QX0pYCB3aGVuIHdlIHdyYXAgaXQgYW5kIHdpbGwgYmUgYmFjayB0byBgTShBKWAgd2hlbiB3ZVxyXG4gKiB1bndyYXAgaXQuXHJcbiAqXHJcbiAqIEhlcmUgaXMgaG93IHRoaXMgaW1wbGVtZW50YXRpb24gd291bGQgbG9vayBsaWtlOlxyXG4gKi9cclxuXHJcbmV4cG9ydHMuaWQgPSB7XHJcbiAgbmFtZTogJ0lkJyxcclxuXHJcbi8qXHJcbiAqIFRoZSBgb2ZgIGZ1bmN0aW9uIHRha2VzIGEgc2NhbGFyIHZhbHVlIGFuZCByZXR1cm5zIGFuIGluc3RhbmNlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICogSW4gdGhpcyBjYXNlIHdlIGRlbGVnYXRlIGV2ZXJ5dGhpbmcgdG8gdGhlIG91dGVyIG1vbmFkJ3MgYG9mYCBtZXRob2QuXHJcbiAqIFdlIGFjY2VzcyB0aGUgb3V0ZXIgbW9uYWQgd2l0aCBgdGhpcy5vdXRlcmAuIFxyXG4gKi9cclxuXHJcbiAgLy8gKHZhbCkgPT4gTSh7aWRWYWw6dmFsfSlcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbCB9KVxyXG4gIH0sXHJcbi8qIFxyXG4gKlxyXG4gKiBjaGFpbiBqdXN0IGNhbGxzIHRoZSBgY2hhaW5gIGZ1bmN0aW9uIG9mIHRoZSBob3N0IG1vbmFkIGxpa2UgaW4gdGhlIHByZXZpb3VzIGV4YW1wbGUuXHJcbiAqIFRoZSBkaWZmZXJlbmNlIGlzIHRoYXQgaXQgYXBwbGllcyBzb21lIHRyYW5zZm9ybWF0aW9uIHRvIHRoZSB2YWx1ZSBpbiBvcmRlciB0byBmaXQgXHJcbiAqIHRoZSBuZXcgY29udGV4dC4gXHJcbiAqL1xyXG4gIC8vICh2YWwgPT4gTSh7aWRWYWw6dmFsfSkgLCBNKHtpZFZhbDp2YWx9KSkgPT4gTSh7aWRWYWw6dmFsfSlcclxuICBjaGFpbiAoZm4sIG1JZFZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlkVmFsKSA9PiB7XHJcbiAgICAgIHJldHVybiBmbihpZFZhbC5pZFZhbClcclxuICAgIH0sIG1JZFZhbClcclxuICB9LFxyXG4vKiBcclxuICogVGhlIGBsaWZ0YCBmdW5jdGlvbiB1c2VzIGBjaGFpbmAgKyBgb2ZgICh3aGljaCBpcyB0aGUgc2FtZSBhcyBgbWFwYCkgdG8gZ28gdG8gdGhlIGhvc3QgbW9uYWRcclxuICogYW5kIG1vZGlmeSB0aGUgdmFsdWUgaW5zaWRlIGl0LlxyXG4gKi9cclxuICAvLyAoTSh2YWwpKSA9PiBNKHtpZFZhbDp2YWx9KVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWx9KSwgbVZhbClcclxuICB9LFxyXG4vKlxyXG4gKiBMYXN0bHkgd2UgaGF2ZSB0aGUgYHZhbHVlYCBmdW5jdGlvbiAob3IgdGhlIGludGVycHJldGVyKSwgd2hpY2ggdW53cmFwcyBhIHByZXZpb3VzbHktd3JhcHBlZFxyXG4gKiB2YWx1ZS5cclxuICovXHJcbiAgLy8gKCh2YWwpID0+IG90aGVyVmFsLCBNKHtpZFZhbDp2YWx9KSkgPT4gb3RoZXJWYWxcclxuICB2YWx1ZSAoZm4sIG1JZFZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGlkVmFsKT0+IHtcclxuICAgICAgcmV0dXJuIGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgfSwgbUlkVmFsKVxyXG4gIH0sXHJcbiAgZm9sZCAodmFsdWUsIGlkVmFsKSB7XHJcbiAgICByZXR1cm4gdmFsdWUoaWRWYWwuaWRWYWwpXHJcbiAgfVxyXG59XHJcblxyXG4vKlxyXG4gKiBOb3RpY2UgdGhhdCB3ZSBhcmUgYWx3YXlzIHJldHVybmluZyBhbiBpbnN0YW5jZSBvZiB0aGUgb3V0ZXIgbW9uYWQuXHJcbiAqXHJcbiAqIFRoYXQgaXMsIGlmIHlvdSBhcmUgdG8gYXBwbHkgdGhlIHRyYW5zZm9ybWF0aW9uIHNldmVyYWwgdGltZXMsXHJcbiAqIHRoZSB2YWx1ZXMgbmVzdCBpbnNpZGUgTTogTSh7aWRWYWw6e2lkVmFsOiBhfX0pXHJcbiAqXHJcbiAqIEhvd2V2ZXIgbm90IGFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgYXJlIGxpa2UgdGhhdC5cclxuICpcclxuICogIyMgQSBtb3JlIGNvbXBsZXggc3RydWN0dXJlXHJcbiAqXHJcbiAqIFNvIGZhciB3ZSBoYXZlIHNlZW4gbW9uYWQgdHJhbnNmb3JtZXJzIHdoaWNoIG9ubHkgZGVhbCB3aXRoIHRoZSB2YWx1ZSBpbnNpZGUgdGhlIGdpdmVuXHJcbiAqIG1vbmFkIEEuIEhvd2V2ZXIgbm90IGFsbCBtb25hZCB0cmFuc2Zvcm1lcnMgYXJlIGxpa2UgdGhhdC4gXHJcbiAqXHJcbiAqIFRoZXJlIGFyZSBtb25hZCB0cmFuc2Zvcm1lcnMgd2hpY2ggYWRkIGFkZGl0aW9uYWwgc3RydWN0dXJlIHRvIHRoZSBtb25hZCBpdHNlbGYuXHJcbiAqIEV4YW1wbGVzIG9mIHRoZSBmaXJzdCB0eXBlIGFyZSBhbGwgdHJhbnNmb3JtZXJzIHRoYXQgd2UgaGF2ZSBzZWVuIHNvIGZhci5cclxuICogQW4gZXhhbXBsZSBvZiB0aGUgc2Vjb25kIHR5cGUgaXMgdGhlICdTdGF0ZScgbW9uYWQsIHdoaWNoIGdpdmVuIHRoZSBzYW1lIHZhbHVlIGBNKEEpYCwgd2lsbCBcclxuICogcHJvZHVjZSBzb21ldGhpbmcgbGlrZSBgKCkgPT57IE0oW0EsIFN0YXRlXSkgfWAuIFRoYXQgaXMsIHRoZSB0cmFuc2Zvcm1lciBhZGRzIHRoZSBzdGF0ZVxyXG4gKiB2YWx1ZSB0byB0aGUgJ2hvc3QnIG1vbmFkIGBNYCwgYW5kIHRoZW4gaXQgd3JhcHMgdGhlIG1vbmFkIGl0c2VsZiBpbiBhIGZ1bmN0aW9uLlxyXG4gKlxyXG4gKiBOb3cgY29uc2lkZXIgYW4gYWx0ZXJuYXRpdmUsIGEgbGl0dGxlIG1vcmUgY29tcGxleCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSUQgbW9uYWQuIE9uZVxyXG4gKiB3aGljaCB3cmFwcyB0aGUgTSBtb25hZCBpbnRvIGFub3RoZXIgcGxhaW4gb2JqZWN0LCBzbyB0aGUgdmFsdWUgb2YgTShBKSBiZWNvbWVzXHJcbiAqIGB7aWRDb250YWluZXI6IE0oe2lkVmFsOmF9KX1gLiBOb3RpY2UgdGhhdCB0aGUgdHJhbnNmb3JtZXIgY29uc2lzdHMgb2YgdHdvIHBhcnRzOiBvbmUgd2hpY2ggXHJcbiAqIHdyYXBzIGFyb3VuZCB0aGUgaG9zdCBtb25hZCwgYW5kIG9uZSB3aGljaCB3cmFwcyBhcm91bmQgdGhlIHZhbHVlIGluIGl0LlxyXG4gKi9cclxuXHJcbmV4cG9ydHMuaWRXcmFwcGVkID0ge1xyXG4gIG5hbWU6ICdJZFdyYXBwZWQnLFxyXG5cclxuICAvLyAodmFsKSA9PiB7aWRDb250YWluZXI6IE0oe2lkVmFsOmF9KX1cclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZENvbnRhaW5lcjogdGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbH0pXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLy8gKGEgPT4ge2lkQ29udGFpbmVyOk0oe2lkVmFsOmF9KX0sIHtpZENvbnRhaW5lcjpNKHtpZFZhbDphfSl9KSA9PiB7aWRDb250YWluZXI6TSh7aWRWYWw6YX0pfVxyXG4gIGNoYWluIChmbiwgaWRDb250YWluZXJNSWRWYWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLmNoYWluKChpZFZhbCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgICAgIHJldHVybiB2YWwuaWRDb250YWluZXJcclxuICAgICAgfSwgaWRDb250YWluZXJNSWRWYWwuaWRDb250YWluZXIpXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLy8gKE0odmFsKSkgPT4ge2lkQ29udGFpbmVyOk0oe2lkVmFsOnZhbH0pfVxyXG4gIGxpZnQgKG1WYWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOiB0aGlzLm91dGVyLmNoYWluKCh2YWwpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiB2YWx9KSwgbVZhbClcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvLyAoKHZhbCkgPT4gb3RoZXJWYWwsIHtpZENvbnRhaW5lcjogTSh7aWRWYWw6dmFsfSkpfT0+IG90aGVyVmFsXHJcbiAgdmFsdWUgKGZuLCBpZENvbnRhaW5lck1JZFZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIudmFsdWUoKGlkVmFsKT0+IHtcclxuICAgICAgcmV0dXJuIGZuKGlkVmFsLmlkVmFsKVxyXG4gICAgfSwgaWRDb250YWluZXJNSWRWYWwuaWRDb250YWluZXIpXHJcbiAgfSxcclxuICBydW4gKGZuLCBpZENvbnRhaW5lck1JZFZhbCkge1xyXG4gICAgcmV0dXJuIGZuKGlkQ29udGFpbmVyTUlkVmFsLmlkQ29udGFpbmVyKVxyXG4gIH0sXHJcbiAgZm9sZCAodmFsdWUsIGlkVmFsKSB7XHJcbiAgICByZXR1cm4gdmFsdWUoaWRWYWwuaWRWYWwpXHJcbiAgfVxyXG59XHJcblxyXG4vKiBUaGUga2V5IGRpZmZlcmVuY2UgaXMgdGhhdCB3aXRoIHRoaXMgbW9uYWQgbmVzdGluZyBoYXBwZW5zIGJvdGggaW5zaWRlIHRoZSBob3N0IG1vbmFkIGFuZFxyXG4gKiBvdXRzaWRlIG9mIGl0LiBJZiB3ZSBhcHBseSB0aGUgdHJhbnNmb3JtYXRpb24gdHdvIHRpbWVzIHRoZSB2YWx1ZSBiZWNvbWVzOlxyXG4gKiBge2lkQ29udGFpbmVyOntpZENvbnRhaW5lcjpNKHtpZFZhbDp7aWRWYWw6YX19KX19YC5cclxuICovXHJcblxyXG4vKlxyXG4gKiBbX1ZpZXcgaW4gR2l0SHViX10oLi4vbGliL2lkLmpzKVxyXG4gKi9cclxuXG5cblxuLyoqIFdFQlBBQ0sgRk9PVEVSICoqXG4gKiogQzovcHIvc29ubmUvbGliL2lkLmpzXG4gKiovIl0sInNvdXJjZVJvb3QiOiIifQ==