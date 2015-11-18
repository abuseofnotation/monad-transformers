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
  chain: function chain(funk, val) {
    var _this2 = this;

    return function (prevState) {
      return _this2.outer.chain(function (params) {
        var newVal = params[0],
            newState = params[1];
        return funk(newVal)(newState);
      }, val(prevState));
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
  run: function run(funk, state) {
    return this.outer.run(function (params) {
      return funk(params[0]);
    }, state());
  }
};
exports.list = {
  name: 'List',
  of: function of(val) {
    return this.outer.of([val]);
  },
  chain: function chain(funk, val) {
    var _this6 = this;

    return this.outer.chain(function (innerVal) {
      var a = innerVal.map(funk);
      return a.reduce(function (arr, i) {
        return _this6.outer.chain(function (a) {
          return arr.concat(a);
        }, i);
      });
    }, val);
  },
  lift: function lift(val) {
    var _this7 = this;

    return this.outer.chain(function (innerValue) {
      return _this7.outer.of([innerValue]);
    }, val);
  },
  run: function run(funk, val) {
    return this.outer.run(function (list) {
      return list.map(funk);
    }, val);
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
  run: function run(funk, val) {
    return this.outer.run(function (innerMaybe) {
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

},{}],3:[function(require,module,exports){
'use strict';

exports.idWrapped = {
  name: 'idWrapped',
  of: function of(val) {
    return { idContainer: this.outer.of({ idVal: val }) };
  },
  chain: function chain(funk, val) {
    return {
      idContainer: this.outer.chain(function (innerId) {
        var val = funk(innerId.idVal);
        return val.idContainer;
      }, val.idContainer)
    };
  },
  lift: function lift(val) {
    var _this = this;

    return { idContainer: this.outer.chain(function (innerValue) {
        return _this.outer.of({ idVal: innerValue });
      }, val) };
  },
  run: function run(funk, val) {
    return this.outer.run(function (innerId) {
      return funk(innerId.idVal).idContainer;
    }, val.idContainer);
  }
};
exports.id = {
  name: 'ID',
  of: function of(val) {
    return this.outer.of({ idVal: val });
  },
  chain: function chain(funk, val) {
    return this.outer.chain(function (innerId) {
      return funk(innerId.idVal);
    }, val);
  },
  lift: function lift(val) {
    var _this2 = this;

    return this.outer.chain(function (innerValue) {
      return _this2.outer.of({ idVal: innerValue });
    }, val);
  },
  run: function run(funk, val) {
    return this.outer.run(function (innerId) {
      return funk(innerId.idVal);
    }, val);
  }
};

},{}],4:[function(require,module,exports){
(function (process){
'use strict';

exports.prim = require('./prim');
exports.data = require('./data');
exports.comp = require('./comp');

var createStack = require('./stack');

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

exports.make = function make_monad(outer, inner) {
  // The constructor function creates a new object and wraps it in the stack prototype
  function create(val) {
    return wrapVal(stackProto, val);
  }

  var monadDefinitions = Array.prototype.slice.call(arguments);

  var stack = createStack(monadDefinitions);

  // Define the prototype of the resulting monad stack
  var stackProto = {
    prototype: stackProto,
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
    run: function run() {
      return stack.last.run(function (a) {
        return a;
      }, this._value);
    }
  };
  // Using the lift operations, lift all monad helpers and assign them to the stack object:
  var extend = function extend(outer) {
    Object.keys(outer).filter(function (key) {
      return typeof outer[key] === 'function' && key !== 'map' && key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'run';
    }).forEach(function (key) {
      stackProto['chain' + outer.name] = function (funk) {
        return this.chain(function (val) {
          var result = funk(val);
          var f = create(stack.to(outer, result));
          return f;
        });
      };
      stackProto[key] = function () {
        var args = Array.prototype.slice.call(arguments);
        return this.chain(function (val) {
          return create(stack.lift(outer.original, outer[key].apply(outer, args.concat([val]))));
        });
      };
    });
  };
  stack._members.forEach(extend);

  // Add relevant prototype properties to the constructor
  create.of = stackProto.of;
  create.lift = stackProto.lift;

  // Stack constructor
  return create;
};

}).call(this,require('_process'))

},{"./comp":1,"./data":2,"./prim":5,"./stack":6,"_process":7}],5:[function(require,module,exports){
"use strict";

},{}],6:[function(require,module,exports){
'use strict';

module.exports = function createStack(monadStack) {
  // Generate errors
  var error = new Error('The first argument must be a stack member');

  // Add the ID monad at the bottom of the monad stack
  var stack = [idProto].concat(monadStack);

  stack.forEach(function (member) {
    if (typeof member !== 'object') {
      throw 'Stack members must be objects';
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
        //console.log(JSON.stringify(nextLevel.lift(val), 0, 4))
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

  // Takes funk and from it creates a stack operation,
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
  //Dispatches an operation to the correct stack level
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
    _members: stackProcessed,
    run: function run(val) {
      return stackProcessed[stackProcessed.length - 1].run(val);
    }
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
  protoProcessed.name = proto.name + '/' + outer.name, protoProcessed.outer = outer;
  // Save the original so we can do typechecks and route method calls
  protoProcessed.original = proto;
  return protoProcessed;
};

// The identity monad, which lies at the bottom of each stack
var idProto = {
  name: 'root',
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
  },
  map: function map(funk, val) {
    return funk(val);
  },
  run: function run(funk, val) {
    return funk(val);
  }
};

},{}],7:[function(require,module,exports){
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

},{}]},{},[1,2,3,4,5,6])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJDOi9wci9zb25uZS9saWIvY29tcC5qcyIsIkM6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzIiwiQzovcHIvc29ubmUvbGliL2lkLmpzIiwiQzovcHIvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyIsIkM6L3ByL3Nvbm5lL2xpYi9zdGFjay5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLE9BQU8sQ0FBQyxLQUFLLEdBQUc7QUFDZCxNQUFJLEVBQUUsT0FBTztBQUNiLElBQUUsRUFBQyxZQUFDLEdBQUcsRUFBRTs7O0FBQ1AsV0FBTyxVQUFDLFNBQVM7YUFBSyxNQUFLLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7S0FBQSxDQUFBO0dBQ3REO0FBQ0QsT0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTs7O0FBQ2hCLFdBQU8sVUFBQyxTQUFTO2FBQ2YsT0FBSyxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQUMsTUFBTSxFQUFLO0FBQzNCLFlBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFBRSxRQUFRLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlDLGVBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO09BQzlCLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQUEsQ0FBQTtHQUNyQjtBQUNELE1BQUksRUFBQyxjQUFDLEdBQUcsRUFBRTs7O0FBQ1QsV0FBTyxVQUFDLFNBQVM7YUFD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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiB0aGlzLm91dGVyLm9mKFt2YWwsIHByZXZTdGF0ZV0pXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdGhpcy5vdXRlci5jaGFpbigocGFyYW1zKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbmV3VmFsID0gcGFyYW1zWzBdLCBuZXdTdGF0ZSA9IHBhcmFtc1sxXVxyXG4gICAgICAgIHJldHVybiBmdW5rKG5ld1ZhbCkobmV3U3RhdGUpXHJcbiAgICAgIH0sIHZhbChwcmV2U3RhdGUpKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdGhpcy5vdXRlci5jaGFpbigoaW5uZXJWYWx1ZSkgPT4gdGhpcy5vdXRlci5vZihbaW5uZXJWYWx1ZSwgcHJldlN0YXRlXSksIHZhbClcclxuICB9LFxyXG4gIGxvYWQgKHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IHRoaXMub3V0ZXIub2YoW3ByZXZTdGF0ZSwgcHJldlN0YXRlXSlcclxuICB9LFxyXG4gIHNhdmUgKHZhbCkge1xyXG4gICAgcmV0dXJuIChwcmV2U3RhdGUpID0+IHRoaXMub3V0ZXIub2YoW3ZhbCwgdmFsXSlcclxuICB9LFxyXG4gIHJ1biAoZnVuaywgc3RhdGUpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLnJ1bigocGFyYW1zKT0+e1xyXG4gICAgICByZXR1cm4gZnVuayhwYXJhbXNbMF0pXHJcbiAgICB9LCBzdGF0ZSgpKVxyXG4gIH1cclxufVxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ0xpc3QnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKFt2YWxdKVxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWwgPT4ge1xyXG4gICAgICBjb25zdCBhID0gaW5uZXJWYWwubWFwKGZ1bmspXHJcbiAgICAgIHJldHVybiBhLnJlZHVjZSgoYXJyLCBpKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oYT0+YXJyLmNvbmNhdChhKSwgaSlcclxuICAgICAgfSlcclxuICAgIH0sIHZhbClcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oaW5uZXJWYWx1ZSA9PiB0aGlzLm91dGVyLm9mKFtpbm5lclZhbHVlXSksIHZhbCkgIFxyXG4gIH0sXHJcbiAgcnVuIChmdW5rLCB2YWwpe1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIucnVuKChsaXN0KT0+e1xyXG4gICAgICByZXR1cm4gbGlzdC5tYXAoZnVuaylcclxuICAgIH0sIHZhbClcclxuICB9XHJcblxyXG59XHJcbiIsImV4cG9ydHMubWF5YmUgPSB7XHJcbiAgbmFtZTogJ01heWJlJyxcclxuICBvZiAodmFsKSB7IHJldHVybiB0aGlzLm91dGVyLm9mKHttYXliZVZhbDogdmFsIH0pIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyTWF5YmUpID0+IHtcclxuICAgICAgcmV0dXJuIGlubmVyTWF5YmUubWF5YmVWYWwgPT09IHVuZGVmaW5lZCA/IGlubmVyTWF5YmUgOiBmdW5rKGlubmVyTWF5YmUubWF5YmVWYWwpXHJcbiAgICB9LCB2YWwpXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm91dGVyLmNoYWluKChpbm5lclZhbHVlKSA9PiB0aGlzLm91dGVyLm9mKHttYXliZVZhbDogaW5uZXJWYWx1ZX0pLCB2YWwpXHJcbiAgfSxcclxuICBydW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIucnVuKChpbm5lck1heWJlKT0+e1xyXG4gICAgICByZXR1cm4gaW5uZXJNYXliZS5tYXliZVZhbCA9PT0gdW5kZWZpbmVkID8gaW5uZXJNYXliZSA6IGZ1bmsoaW5uZXJNYXliZS5tYXliZVZhbClcclxuICAgIH0sIHZhbClcclxuICB9LFxyXG4gIGdldCAoa2V5LCB2YWwpIHtcclxuICAgIHJldHVybiB0aGlzLm9mKHZhbFtrZXldKVxyXG4gIH0sXHJcbiAgY2hhaW5NYXliZShmdW5rLCB2YWwpe1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIub2YoZnVuayh2YWwpKVxyXG4gIH1cclxufVxyXG4iLCJcclxuZXhwb3J0cy5pZFdyYXBwZWQgPSB7XHJcbiAgbmFtZTogJ2lkV3JhcHBlZCcsXHJcbiAgb2YgKHZhbCkgeyBcclxuICAgIHJldHVybiB7aWRDb250YWluZXI6dGhpcy5vdXRlci5vZih7aWRWYWw6IHZhbCB9KX1cclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIGlkQ29udGFpbmVyOnRoaXMub3V0ZXIuY2hhaW4oKGlubmVySWQpID0+IHtcclxuICAgICAgICBjb25zdCB2YWwgPSBmdW5rKGlubmVySWQuaWRWYWwpXHJcbiAgICAgICAgcmV0dXJuIHZhbC5pZENvbnRhaW5lclxyXG4gICAgICB9LCB2YWwuaWRDb250YWluZXIpXHJcbiAgICB9XHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB7aWRDb250YWluZXI6dGhpcy5vdXRlci5jaGFpbigoaW5uZXJWYWx1ZSkgPT4gdGhpcy5vdXRlci5vZih7aWRWYWw6IGlubmVyVmFsdWV9KSwgdmFsKX1cclxuICB9LFxyXG4gIHJ1biAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5ydW4oKGlubmVySWQpPT4ge1xyXG4gICAgICByZXR1cm4gZnVuayhpbm5lcklkLmlkVmFsKS5pZENvbnRhaW5lclxyXG4gICAgfSwgdmFsLmlkQ29udGFpbmVyKVxyXG4gIH1cclxufVxyXG5leHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJRCcsXHJcbiAgb2YgKHZhbCkgeyBcclxuICAgIHJldHVybiB0aGlzLm91dGVyLm9mKHtpZFZhbDogdmFsIH0pIFxyXG4gIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVySWQpID0+IHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0sIHZhbClcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0ZXIuY2hhaW4oKGlubmVyVmFsdWUpID0+IHRoaXMub3V0ZXIub2Yoe2lkVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICB9LFxyXG4gIHJ1biAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdGhpcy5vdXRlci5ydW4oKGlubmVySWQpPT4ge1xyXG4gICAgICByZXR1cm4gZnVuayhpbm5lcklkLmlkVmFsKVxyXG4gICAgfSwgdmFsKVxyXG4gIH1cclxufVxyXG5cclxuIiwiZXhwb3J0cy5wcmltID0gcmVxdWlyZSgnLi9wcmltJylcclxuZXhwb3J0cy5kYXRhID0gcmVxdWlyZSgnLi9kYXRhJylcclxuZXhwb3J0cy5jb21wID0gcmVxdWlyZSgnLi9jb21wJylcclxuXHJcbmNvbnN0IGNyZWF0ZVN0YWNrID0gcmVxdWlyZSgnLi9zdGFjaycpXHJcblxyXG4vLyBVbndyYXBzIGEgd3JhcHBlZCB2YWx1ZVxyXG5jb25zdCB1bndyYXAgPSAodmFsKSA9PiB7XHJcbiAgaWYgKCF2YWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7dGhyb3cgSlNPTi5zdHJpbmdpZnkodmFsKSArICcgaXMgbm90IGEgd3JhcHBlZCB2YWx1ZSd9XHJcbiAgcmV0dXJuIHZhbC5fdmFsdWVcclxufVxyXG5cclxuLy8gV3JhcHMgYSB2YWx1ZSBpbiBhIHNwZWNpZmllZCBwcm90b3R5cGVcclxuY29uc3Qgd3JhcFZhbCA9IChwcm90bywgdmFsKSA9PiB7XHJcbiAgdmFyIG9iaiA9IE9iamVjdC5jcmVhdGUocHJvdG8pXHJcbiAgb2JqLl92YWx1ZSA9IHZhbFxyXG4gIHJldHVybiBPYmplY3QuZnJlZXplKG9iailcclxufVxyXG5cclxuXHJcbmV4cG9ydHMubWFrZSA9IGZ1bmN0aW9uIG1ha2VfbW9uYWQgKG91dGVyLCBpbm5lcikge1xyXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IG9iamVjdCBhbmQgd3JhcHMgaXQgaW4gdGhlIHN0YWNrIHByb3RvdHlwZVxyXG4gIGZ1bmN0aW9uIGNyZWF0ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gd3JhcFZhbChzdGFja1Byb3RvLCB2YWwpXHJcbiAgfVxyXG4gIFxyXG4gIGNvbnN0IG1vbmFkRGVmaW5pdGlvbnMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXHJcblxyXG4gIGNvbnN0IHN0YWNrID0gY3JlYXRlU3RhY2sobW9uYWREZWZpbml0aW9ucylcclxuXHJcbiAgLy8gRGVmaW5lIHRoZSBwcm90b3R5cGUgb2YgdGhlIHJlc3VsdGluZyBtb25hZCBzdGFja1xyXG4gIGNvbnN0IHN0YWNrUHJvdG8gPSB7XHJcbiAgICBwcm90b3R5cGU6IHN0YWNrUHJvdG8sXHJcbiAgICBzdGFjazpzdGFjayxcclxuICAgIC8vIEFkZCBjaGFpbiBmdW5jdGlvblxyXG4gICAgY2hhaW4gKGZ1bmspIHtcclxuICAgICAgY29uc3QgZnVua0FuZFVud3JhcCA9ICh2YWwpID0+IHVud3JhcChmdW5rKHZhbCkpXHJcbiAgICAgIGlmKCFwcm9jZXNzLmRlYnVnKXtcclxuICAgICAgICBmdW5rQW5kVW53cmFwLnRvU3RyaW5nID0gKCkgPT4gJ3Vud3JhcCgnKyBmdW5rLnRvU3RyaW5nKCkgKyAnKSdcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxhc3QuY2hhaW4oZnVua0FuZFVud3JhcCwgdGhpcy5fdmFsdWUpKVxyXG4gICAgfSxcclxuICAgIGxpZnQocHJvdG8sIHZhbCl7XHJcbiAgICAgIHJldHVybiBjcmVhdGUoc3RhY2subGlmdChwcm90byx2YWwpKVxyXG4gICAgfSxcclxuICAgIC8vIEFkZCAnbWFwJyBhbmQgJ29mJyBmdW5jdGlvbnNcclxuICAgIG9mICh2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxhc3Qub2YodmFsdWUpKVxyXG4gICAgfSxcclxuICAgIG1hcCAoZnVuaykge1xyXG4gICAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB0aGlzLm9mKGZ1bmsodmFsKSkpXHJcbiAgICB9LFxyXG4gICAgcnVuICgpIHtcclxuICAgICAgcmV0dXJuIHN0YWNrLmxhc3QucnVuKGE9PmEsdGhpcy5fdmFsdWUpXHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIFVzaW5nIHRoZSBsaWZ0IG9wZXJhdGlvbnMsIGxpZnQgYWxsIG1vbmFkIGhlbHBlcnMgYW5kIGFzc2lnbiB0aGVtIHRvIHRoZSBzdGFjayBvYmplY3Q6XHJcbiAgY29uc3QgZXh0ZW5kID0gKG91dGVyKSA9PiB7XHJcbiAgICBPYmplY3Qua2V5cyhvdXRlcilcclxuICAgICAgLmZpbHRlcigoa2V5KSA9PiAodHlwZW9mIG91dGVyW2tleV0gPT09ICdmdW5jdGlvbicgJiYga2V5ICE9PSAnbWFwJyAmJiBrZXkgIT09ICdvZicgJiYga2V5ICE9PSAnY2hhaW4nICYmIGtleSAhPT0gJ2xpZnQnICYmIGtleSAhPT0gJ3J1bicpKVxyXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB7XHJcbiAgICAgICAgc3RhY2tQcm90b1snY2hhaW4nKyBvdXRlci5uYW1lXSA9IGZ1bmN0aW9uKGZ1bmspe1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT57XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGZ1bmsodmFsKVxyXG4gICAgICAgICAgICBjb25zdCBmID0gIGNyZWF0ZShzdGFjay50byhvdXRlciwgcmVzdWx0KSlcclxuICAgICAgICAgICAgcmV0dXJuIGZcclxuXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuICAgICAgICBzdGFja1Byb3RvW2tleV0gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICBjb25zdCBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlKHN0YWNrLmxpZnQob3V0ZXIub3JpZ2luYWwsIG91dGVyW2tleV0uYXBwbHkob3V0ZXIsIGFyZ3MuY29uY2F0KFt2YWxdKSkpKVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgfVxyXG4gIHN0YWNrLl9tZW1iZXJzLmZvckVhY2goZXh0ZW5kKVxyXG5cclxuICAvLyBBZGQgcmVsZXZhbnQgcHJvdG90eXBlIHByb3BlcnRpZXMgdG8gdGhlIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZS5saWZ0ID0gc3RhY2tQcm90by5saWZ0XHJcblxyXG4gIC8vIFN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgcmV0dXJuIGNyZWF0ZVxyXG59XHJcblxyXG4iLCJcInVzZSBzdHJpY3RcIjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklpSXNJbVpwYkdVaU9pSkRPaTl3Y2k5emIyNXVaUzlzYVdJdmNISnBiUzVxY3lJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYlhYMD0iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZVN0YWNrIChtb25hZFN0YWNrKSB7XHJcbiAgLy8gR2VuZXJhdGUgZXJyb3JzXHJcbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1RoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RhY2sgbWVtYmVyJylcclxuXHJcbiAgLy8gQWRkIHRoZSBJRCBtb25hZCBhdCB0aGUgYm90dG9tIG9mIHRoZSBtb25hZCBzdGFja1xyXG4gIGNvbnN0IHN0YWNrID0gW2lkUHJvdG9dLmNvbmNhdChtb25hZFN0YWNrKVxyXG4gIFxyXG4gIHN0YWNrLmZvckVhY2gobWVtYmVyID0+IHtcclxuICAgIGlmKHR5cGVvZiBtZW1iZXIgIT09ICdvYmplY3QnKSB7dGhyb3cgJ1N0YWNrIG1lbWJlcnMgbXVzdCBiZSBvYmplY3RzJ31cclxuICB9KVxyXG5cclxuICAvLyBQZXJmb3JtIHNvbWUgcHJlcHJvY2Vzc2luZyBvbiB0aGUgc3RhY2tcclxuICBjb25zdCBzdGFja1Byb2Nlc3NlZCA9IHByb2Nlc3NTdGFjayhzdGFjaylcclxuXHJcbiAgLy8gRGVmaW5lIHRoZSBsaWZ0IG9wZXJhdGlvbiB3aGljaCB0YWtlcyBhIHZhbHVlIG9mIGEgZ2l2ZW4gbGV2ZWwgb2YgdGhlIHN0YWNrIGFuZCBsaWZ0cyBpdCB0byB0aGUgbGFzdCBsZXZlbFxyXG4gIGNvbnN0IGxpZnQgPSAodmFsLCBsZXZlbCkgPT4ge1xyXG4gICAgLy8gR2V0IHRoZSBzdGFjayBwcm90b3R5cGVzIGZvciB0aGUgcHJldmlvdXMgYW5kIHRoZSBuZXh0IGxldmVsXHJcbiAgICBjb25zdCBuZXh0TGV2ZWwgPSBsZXZlbCArIDFcclxuICAgIGNvbnN0IG5leHRNZW1iZXIgPSBzdGFja1Byb2Nlc3NlZFtsZXZlbCArIDFdXHJcbiAgICAvLyBEbyBub3QgZG8gYW55dGhpbmcgaWYgdGhlIHZhbHVlIGlzIGFscmVhZHkgYXQgdGhlIGxhc3QgbGV2ZWwuXHJcbiAgICBpZiAobmV4dE1lbWJlciAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIC8vIFBlcmZvcm0gdGhlIGxpZnQgb3BlcmF0aW9uIGF0IHRoZSBuZWNlc3NhcnkgbGV2ZWxcclxuICAgICAgLy8gQ2FsbCB0aGUgZnVuY3Rpb24gcmVjdXJzaXZlbHkgdG8gZ2V0IHRvIHRoZSBuZXh0IG9uZVxyXG4gICAgICAvL2NvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KG5leHRMZXZlbC5saWZ0KHZhbCksIDAsIDQpKVxyXG4gICAgICByZXR1cm4gbGlmdChuZXh0TWVtYmVyLmxpZnQodmFsKSwgbmV4dExldmVsKVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIHZhbFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gVGFrZXMgZnVuayBhbmQgZnJvbSBpdCBjcmVhdGVzIGEgc3RhY2sgb3BlcmF0aW9uLCBcclxuICBjb25zdCBvcGVyYXRpb24gPSAoZnVuaykgPT4ge1xyXG4gICAgcmV0dXJuIChwcm90bywgdmFsKSA9PiB7XHJcbiAgICAgIC8vIERldGVybWluZSB0aGUgbGV2ZWwgb2YgdGhlIHZhbHVlLCBnaXZlbiB0aGUgcHJvdG9cclxuICAgICAgY29uc3QgbGV2ZWwgPSBzdGFjay5pbmRleE9mKHByb3RvKVxyXG4gICAgICAvLyBUaHJvdyBhbiBlcnJvciBpZiB0aGUgdmFsdWUgaXMgaW52YWxpZFxyXG4gICAgICBpZiAobGV2ZWwgPT09IC0xKSB7dGhyb3cgZXJyb3J9XHJcbiAgICAgIHJldHVybiBmdW5rKHZhbCwgbGV2ZWwpXHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vRGlzcGF0Y2hlcyBhbiBvcGVyYXRpb24gdG8gdGhlIGNvcnJlY3Qgc3RhY2sgbGV2ZWxcclxuICBjb25zdCBmcm9tU3RhY2sgPSAobmFtZSkgPT4ge1xyXG4gICAgcmV0dXJuICh2YWwsIGxldmVsKSA9PiBzdGFja1Byb2Nlc3NlZFtsZXZlbF1bbmFtZV0odmFsKVxyXG4gIH1cclxuXHJcblxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgbGlmdDogb3BlcmF0aW9uKGxpZnQpLFxyXG4gICAgb2Y6IG9wZXJhdGlvbihmcm9tU3RhY2soJ29mJykpLFxyXG4gICAgY2hhaW46IG9wZXJhdGlvbihmcm9tU3RhY2soJ2NoYWluJykpLFxyXG4gICAgbGFzdDogc3RhY2tQcm9jZXNzZWRbc3RhY2tQcm9jZXNzZWQubGVuZ3RoLTFdLFxyXG4gICAgaWQ6IGlkUHJvdG8sXHJcbiAgICBfbWVtYmVyczogc3RhY2tQcm9jZXNzZWQsXHJcbiAgICBydW4gKHZhbCkge1xyXG4gICAgICByZXR1cm4gc3RhY2tQcm9jZXNzZWRbc3RhY2tQcm9jZXNzZWQubGVuZ3RoLTFdLnJ1bih2YWwpXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5jb25zdCBwcm9jZXNzU3RhY2sgPSAoYmFzZVN0YWNrKSA9PlxyXG4gIHN0YXRlTWFwKGJhc2VTdGFjaywgKGl0ZW0sIHN0YXRlKSA9PiB7XHJcbiAgICBjb25zdCBwcmV2SXRlbVByb2Nlc3NlZCA9IHN0YXRlLnByZXZJdGVtUHJvY2Vzc2VkIHx8IGlkUHJvdG9cclxuICAgIC8vIEFwcGx5IHRoZSBwcm9jZXNzaW5nIGZ1bmN0aW9uIG9uIGVhY2ggc3RhY2sgbWVtYmVyXHJcbiAgICBjb25zdCBpdGVtUHJvY2Vzc2VkID0gcHJvY2Vzc1Byb3RvTmV3KGl0ZW0sIHByZXZJdGVtUHJvY2Vzc2VkKVxyXG4gICAgcmV0dXJuIFtcclxuICAgICAgICBpdGVtUHJvY2Vzc2VkLFxyXG4gICAgICB7XHJcbiAgICAgICAgcHJldkl0ZW1Qcm9jZXNzZWQ6IGl0ZW1Qcm9jZXNzZWQsXHJcbiAgICAgIH1cclxuICAgIF1cclxuICB9KVxyXG5cclxuLy8gQSBzdGF0ZWZ1bCB2ZXJzaW9uIG9mIHRoZSBtYXAgZnVuY3Rpb246XHJcbi8vIGYgYWNjZXB0cyBhbiBhcnJheSBpdGVtIGFuZCBhIHN0YXRlKGRlZmF1bHRzIHRvIGFuIG9iamVjdCkgYW5kIHJldHVybnMgdGhlIHByb2Nlc3NlZCB2ZXJzaW9uIG9mIHRoZSBpdGVtIHBsdXMgYSBuZXcgc3RhdGVcclxuY29uc3Qgc3RhdGVNYXAgPSAoYXJyLCBmKSA9PlxyXG4gIGFyci5yZWR1Y2UoKGFycmF5QW5kU3RhdGUsIGl0ZW0pID0+IHtcclxuICAgIGNvbnN0IGl0ZW1BbmRTdGF0ZSA9IChmKGl0ZW0sIGFycmF5QW5kU3RhdGVbMV0pKVxyXG4gICAgcmV0dXJuIFthcnJheUFuZFN0YXRlWzBdLmNvbmNhdChbaXRlbUFuZFN0YXRlWzBdXSksIGl0ZW1BbmRTdGF0ZVsxXSBdXHJcbiAgfSwgW1tdLCB7fV0pWzBdXHJcblxyXG5jb25zdCBjbG9uZSA9IChvYmopID0+IE9iamVjdC5rZXlzKG9iaikucmVkdWNlKChuZXdPYmosIGtleSkgPT57XHJcbiAgbmV3T2JqW2tleV0gPSBvYmpba2V5XVxyXG4gIHJldHVybiBuZXdPYmpcclxufSwge30pXHJcblxyXG5jb25zdCBwcm9jZXNzUHJvdG9OZXcgPSAocHJvdG8sIG91dGVyKSA9PiB7XHJcbiAgY29uc3QgcHJvdG9Qcm9jZXNzZWQgPSBjbG9uZShwcm90bylcclxuICBwcm90b1Byb2Nlc3NlZC5uYW1lID0gIHByb3RvLm5hbWUgKyAnLycgKyBvdXRlci5uYW1lLFxyXG4gIHByb3RvUHJvY2Vzc2VkLm91dGVyID0gIG91dGVyXHJcbiAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgc28gd2UgY2FuIGRvIHR5cGVjaGVja3MgYW5kIHJvdXRlIG1ldGhvZCBjYWxsc1xyXG4gIHByb3RvUHJvY2Vzc2VkLm9yaWdpbmFsID0gcHJvdG9cclxuICByZXR1cm4gcHJvdG9Qcm9jZXNzZWRcclxufVxyXG5cclxuLy8gVGhlIGlkZW50aXR5IG1vbmFkLCB3aGljaCBsaWVzIGF0IHRoZSBib3R0b20gb2YgZWFjaCBzdGFja1xyXG5jb25zdCBpZFByb3RvID0ge1xyXG4gIG5hbWU6ICdyb290JyxcclxuICAvLyBUaGUgJ29mJyBmdW5jdGlvbiB3cmFwcyBhIHZhbHVlIGluIGEgbW9uYWQuXHJcbiAgLy8gSW4gdGhlIGNhc2Ugb2YgdGhlIGlkZW50aXR5IG1vbmFkLCB3ZSBkb24ndCBkbyBhbnl0aGluZywgc28gd2UgZG9uJ3QgcmVhbGx5XHJcbiAgLy8gbmVlZCB0byB3cmFwIGl0LlxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWxcclxuICB9LFxyXG4gIC8vIGlkZW50aXR5IG1vbmFkJ3MgY2hhaW4gaW1wbGVtZW50YXRpb24uXHJcbiAgLy8gU2luY2Ugbm8gcGFja2luZyBhbmQgdW5wYWNraW5nIHRha2VzIHBsYWNlLFxyXG4gIC8vIGFsbCB3ZSBoYXZlIHRvIGRvIGlzIHRvIGFwcGx5IHRoZSBmdW5jdGlvblxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9LFxyXG4gIG1hcCAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gZnVuayh2YWwpXHJcbiAgfSxcclxuICBydW4oZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gZnVuayh2YWwpXHJcbiAgfVxyXG59XHJcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIl19
