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

},{}]},{},[1,2,3,4])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2NvbXAuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2RhdGEuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsT0FBTyxDQUFDLE9BQU8sR0FBRztBQUNoQixNQUFJLEVBQUUsU0FBUztBQUNmLElBQUUsRUFBRSxZQUFVLEdBQUcsRUFBRTtBQUFDLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFBRSxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQTtLQUFDLENBQUE7R0FBRTtBQUN0RSxLQUFHLEVBQUUsYUFBVSxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQ3hCLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFDeEIsU0FBRyxDQUFDLFVBQVUsS0FBSyxFQUFFO0FBQ25CLGVBQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO09BQzVCLENBQUMsQ0FBQTtLQUNILENBQUE7R0FDRjs7QUFFRCxNQUFJLEVBQUUsY0FBVSxHQUFHLEVBQUUsVUFBVSxFQUFFO0FBQy9CLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFDeEIsU0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ2Ysa0JBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxZQUFZLEVBQUU7QUFDckMsc0JBQVksQ0FBQyxVQUFVLEtBQUssRUFBRTtBQUM1QixtQkFBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsWUFBWTtBQUFDLHFCQUFPLEtBQUssQ0FBQTthQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtXQUN2RCxDQUFDLENBQUE7U0FDSCxFQUFFLENBQUMsQ0FB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Q0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtTQUN2RSxDQUFDLENBQUE7T0FDSCxDQUFBO0tBQ0YsQ0FBQyxDQUFBO0dBQ0wsQ0FBQTtBQUNELFFBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUNiLFFBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTs7QUFFYixZQUFVLENBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLEtBQUssQ0FBQTtBQUNqQyxZQUFVLENBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLEtBQUssQ0FBQTs7O0FBR2pDLFFBQU0sQ0FBQyxFQUFFLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQTtBQUN6QixRQUFNLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsQ0FBQTtBQUNuRSxRQUFNLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsQ0FBQTs7O0FBR25FLFNBQU8sTUFBTSxDQUFBO0NBQ2QsQ0FBQTs7O0FDN0dEO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5wcm9taXNlID0ge1xyXG4gIG5hbWU6ICdwcm9taXNlJyxcclxuICBvZjogZnVuY3Rpb24gKHZhbCkge3JldHVybiBmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXR1cm4gcmVzb2x2ZSh2YWwpfSB9LFxyXG4gIG1hcDogZnVuY3Rpb24gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChyZXNvbHZlKSB7XHJcbiAgICAgIHZhbChmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICByZXR1cm4gcmVzb2x2ZShmdW5rKHZhbHVlKSlcclxuICAgICAgfSlcclxuICAgIH1cclxuICB9LFxyXG5cclxuICBmbGF0OiBmdW5jdGlvbiAodmFsLCBpbm5lck1vbmFkKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHJlc29sdmUpIHtcclxuICAgICAgdmFsKGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgaW5uZXJNb25hZC5tYXAoZnVuY3Rpb24gKGlubmVyUHJvbWlzZSkge1xyXG4gICAgICAgICAgaW5uZXJQcm9taXNlKGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICByZXNvbHZlKGlubmVyTW9uYWQubWFwKGZ1bmN0aW9uICgpIHtyZXR1cm4gdmFsdWV9LCBpKSlcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfSwgaSlcclxuXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiIsImV4cG9ydHMuaWQgPSB7XHJcbiAgbmFtZTogJ0lEJyxcclxuICBvZiAodmFsKSB7IHJldHVybiB7aWRWYWw6IHZhbCB9IH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJJZCkge1xyXG4gICAgICByZXR1cm4gZnVuayhpbm5lcklkLmlkVmFsKVxyXG4gICAgfSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJWYWx1ZSkge3JldHVybiB2YWwub2Yoe2lkVmFsOiBpbm5lclZhbHVlfSl9KVxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0cy5tYXliZSA9IHtcclxuICBuYW1lOiAnTWF5YmUnLFxyXG4gIG9mICh2YWwpIHsgcmV0dXJuIHttYXliZVZhbDogdmFsIH0gfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdmFsLmNoYWluKGZ1bmN0aW9uIChpbm5lck1heWJlKSB7XHJcbiAgICAgIHJldHVybiBpbm5lck1heWJlLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBpbm5lck1heWJlIDogZnVuayhpbm5lck1heWJlLm1heWJlVmFsKVxyXG4gICAgfSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJWYWx1ZSkge3JldHVybiB2YWwub2Yoe21heWJlVmFsOiBpbm5lclZhbHVlfSl9KVxyXG4gIH0sXHJcbiAgbm90aGluZyAoKSB7IHJldHVybiB7bWF5YmVWYWx1ZTogdW5kZWZpbmVkfX0sXHJcbiAgZ2V0IChrZXksIHZhbCkgeyByZXR1cm4ge21heWJlVmFsOiB2YWxba2V5XX19XHJcbn1cclxuZXhwb3J0cy5saXN0ID0ge1xyXG4gIG5hbWU6ICdMaXN0JyxcclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsLmNvbnN0cnVjdG9yID09PSBBcnJheSA/IHZhbCA6IFt2YWxdXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gdmFsLmNoYWluKGZ1bmN0aW9uIChpbm5lckxpc3QpIHtcclxuICAgICAgdmFsXHJcbiAgICAgIGRlYnVnZ2VyXHJcbiAgICAgIHJldHVybiBpbm5lckxpc3QucmVkdWNlKChsaXN0LCB2YWwpID0+IGxpc3QuY29uY2F0KGZ1bmsodmFsKSksIFtdKVxyXG4gICAgfSlcclxuICB9LFxyXG4gIGxpZnQgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJWYWx1ZSkge1xyXG4gICAgICBkZWJ1Z2dlclxyXG4gICAgICByZXR1cm4gdmFsLm9mKFtpbm5lclZhbHVlXSlcclxuICAgIH0pXHJcbiAgfVxyXG59XHJcbiIsImV4cG9ydHMucHJpbSA9IHJlcXVpcmUoJy4vcHJpbScpXHJcbmV4cG9ydHMuZGF0YSA9IHJlcXVpcmUoJy4vZGF0YScpXHJcbmV4cG9ydHMuY29tcCA9IHJlcXVpcmUoJy4vY29tcCcpXHJcblxyXG5jb25zdCBpZFByb3RvID0ge1xyXG4gIC8vIFRoZSAnb2YnIGZ1bmN0aW9uIHdyYXBzIGEgdmFsdWUgaW4gYSBtb25hZC5cclxuICAvLyBJbiB0aGUgY2FzZSBvZiB0aGUgaWRlbnRpdHkgbW9uYWQsIHdlIGRvbid0IGRvIGFueXRoaW5nLCBzbyB3ZSBkb24ndCByZWFsbHlcclxuICAvLyBuZWVkIHRvIHdyYXAgaXQuXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbFxyXG4gIH0sXHJcbiAgLy8gaWRlbnRpdHkgbW9uYWQncyBjaGFpbiBpbXBsZW1lbnRhdGlvbi5cclxuICAvLyBTaW5jZSBubyBwYWNraW5nIGFuZCB1bnBhY2tpbmcgdGFrZXMgcGxhY2UsXHJcbiAgLy8gYWxsIHdlIGhhdmUgdG8gZG8gaXMgdG8gYXBwbHkgdGhlIGZ1bmN0aW9uXHJcbiAgY2hhaW4gKGZ1bmspIHtcclxuICAgIHJldHVybiBmdW5rKHRoaXMuX3ZhbHVlKVxyXG4gIH1cclxufVxyXG5cclxuLy8gVW53cmFwcyBhIHdyYXBwZWQgdmFsdWVcclxuY29uc3QgdW53cmFwID0gKHZhbCkgPT4ge1xyXG4gIGlmICghdmFsLmhhc093blByb3BlcnR5KCdfdmFsdWUnKSkge3Rocm93IEpTT04uc3RyaW5naWZ5KHZhbCkgKyAnIGlzIG5vdCBhIHdyYXBwZWQgdmFsdWUnfVxyXG4gIHJldHVybiB2YWwuX3ZhbHVlXHJcbn1cclxuXHJcbi8vIFdyYXBzIGEgdmFsdWUgaW4gYSBzcGVjaWZpZWQgcHJvdG90eXBlXHJcbmNvbnN0IHdyYXBJbiA9IChwcm90bywgdmFsKSA9PiB7XHJcbiAgdmFyIG9iaiA9IE9iamVjdC5jcmVhdGUocHJvdG8pXHJcbiAgb2JqLl92YWx1ZSA9IHZhbFxyXG4gIHJldHVybiBPYmplY3QuZnJlZXplKG9iailcclxufVxyXG5cclxuZXhwb3J0cy5tYWtlID0gZnVuY3Rpb24gbWFrZV9tb25hZCAob3V0ZXIsIGlubmVyKSB7XHJcbiAgLy8gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGNyZWF0ZXMgYSBuZXcgb2JqZWN0IGFuZCB3cmFwcyBpdCBpbiB0aGUgc3RhY2sgcHJvdG90eXBlXHJcbiAgZnVuY3Rpb24gY3JlYXRlICh2YWwpIHtcclxuICAgIHJldHVybiB3cmFwSW4oc3RhY2tQcm90bywgdmFsKVxyXG4gIH1cclxuXHJcbiAgLy8gRGVmaW5lIHRoZSBwcm90b3R5cGUgb2YgdGhlIG91dGVyIG1vbmFkLlxyXG4gIGNvbnN0IG91dGVyUHJvdG8gPSB7XHJcbiAgICBvZjogb3V0ZXIub2YsXHJcbiAgICAvLyBIZXJlIHdlIGp1c3QgdGFrZSB0aGUgJ2NoYWluJyBmdW5jdGlvbiBmcm9tIHRoZSBtb25hZCdzIGRlZmluaXRpb24sXHJcbiAgICAvLyBhbmQgYXBwbHkgaXQgdG8gdGhlIHZhbHVlLCBwbGFjZWQgaW4gdGhlIG9iamVjdCdzICdfdmFsdWUnIHByb3BlcnR5XHJcbiAgICAvLyBXaGVuIHdlIHN0YWNrIG1vbmFkIHRyYW5zZm9ybWVyIG11c3QgaGF2ZSBhIHJlYWwgYXQgdGhlIGJvdHRvbS5cclxuICAgIC8vIFRoYXQgaXMgd2h5IHdlIHdyYXAgb3VyIHZhbHVlIGluIGFuIElEIG1vbmFkXHJcbiAgICBjaGFpbiAoZnVuaykge1xyXG4gICAgICByZXR1cm4gb3V0ZXIuY2hhaW4oZnVuaywgd3JhcEluKGlkUHJvdG8sIHRoaXMuX3ZhbHVlKSlcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIERlZmluZSB0aGUgcHJvdG90eXBlIG9mIHRoZSByZXN1bHRpbmcgbW9uYWQgc3RhY2tcclxuICBjb25zdCBzdGFja1Byb3RvID0ge1xyXG4gICAgcHJvdG90eXBlOiBzdGFja1Byb3RvLFxyXG5cclxuICAgIC8vIEFkZCBjaGFpbiBmdW5jdGlvblxyXG4gICAgY2hhaW4gKGZ1bmspIHtcclxuICAgICAgY29uc3QgZnVua0FuZFVud3JhcCA9ICh2YWwpID0+IHVud3JhcChmdW5rKHZhbCkpXHJcbiAgICAgIHJldHVybiBjcmVhdGUoaW5uZXIuY2hhaW4oZnVua0FuZFVud3JhcCwgd3JhcEluKG91dGVyUHJvdG8sIHRoaXMuX3ZhbHVlKSkpXHJcbiAgICB9LFxyXG5cclxuICAgIC8vIEFkZCAnbWFwJyBhbmQgJ29mJyBmdW5jdGlvbnNcclxuICAgIG9mICh2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gY3JlYXRlKG91dGVyLm9mKGlubmVyLm9mKHZhbHVlKSkpXHJcbiAgICB9LFxyXG4gICAgbWFwIChmdW5rKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IHRoaXMub2YoZnVuayh2YWwpKSlcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIExpZnRzIGEgdmFsdWUgZnJvbSB0aGUgb3V0ZXIgdHlwZSB0byBhIGZ1bGwgc3RhY2tcclxuICBjb25zdCBsaWZ0T3V0ZXIgPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgb3V0ZXIubmFtZSBdID0gKHZhbCkgPT4gY3JlYXRlKGlubmVyLmxpZnQod3JhcEluKG91dGVyUHJvdG8sIHZhbCkpKVxyXG4gIGNvbnN0IGxpZnRJbm5lciA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBpbm5lci5uYW1lIF0gPSAodmFsKSA9PiBjcmVhdGUob3V0ZXIub2YodmFsKSlcclxuXHJcbiAgLy8gQWRkIHZhcmlhbnRzIG9mICdjaGFpbicgY29tcG9zZWQgd2l0aCBsaWZ0LCB3aGljaCB3b3JrIGluIGlubmVyIGFuZCBvdXRlciB2YWx1ZXNcclxuICBzdGFja1Byb3RvIFsgJ2NoYWluJyArIGlubmVyLm5hbWUgXSA9IGZ1bmN0aW9uIChmdW5rKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiBsaWZ0SW5uZXIoZnVuayh2YWwpKSlcclxuICB9XHJcbiAgc3RhY2tQcm90byBbICdjaGFpbicgKyBvdXRlci5uYW1lIF0gPSBmdW5jdGlvbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gbGlmdE91dGVyKGZ1bmsodmFsKSkpXHJcbiAgfVxyXG5cclxuICAvLyBVc2luZyB0aGUgbGlmdCBvcGVyYXRpb25zLCBsaWZ0IGFsbCBtb25hZCBoZWxwZXJzIGFuZCBhc3NpZ24gdGhlbSB0byB0aGUgc3RhY2sgb2JqZWN0OlxyXG4gIGNvbnN0IGV4dGVuZCA9IChvdXRlcikgPT4ge1xyXG4gICAgT2JqZWN0LmtleXMob3V0ZXIpXHJcbiAgICAgIC5maWx0ZXIoKGtleSkgPT4gKGtleSAhPT0gJ29mJyAmJiBrZXkgIT09ICdjaGFpbicgJiYga2V5ICE9PSAnbGlmdCcpKVxyXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB7XHJcbiAgICAgICAgc3RhY2tQcm90b1trZXldID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcclxuXHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB7XHJcbiAgICAgICAgICAgIGFyZ3MucHVzaCh2YWwpXHJcbiAgICAgICAgICAgIHJldHVybiBzdGFja1Byb3RvWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0ob3V0ZXJba2V5XS5hcHBseShudWxsLCBhcmdzKSlcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gIH1cclxuICBleHRlbmQob3V0ZXIpXHJcbiAgZXh0ZW5kKGlubmVyKVxyXG4gIC8vIEFkZCBhbGlhc2VzIHRvIHRoZSBtb25hZHMgdGhlbXNlbHZlc1xyXG4gIHN0YWNrUHJvdG8gWyBpbm5lci5uYW1lIF0gPSBpbm5lclxyXG4gIHN0YWNrUHJvdG8gWyBvdXRlci5uYW1lIF0gPSBvdXRlclxyXG5cclxuICAvLyBBZGQgcmVsZXZhbnQgcHJvdG90eXBlIHByb3BlcnRpZXMgdG8gdGhlIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZSBbICdsaWZ0JyArIG91dGVyLm5hbWUgXSA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBvdXRlci5uYW1lIF1cclxuICBjcmVhdGUgWyAnbGlmdCcgKyBpbm5lci5uYW1lIF0gPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdXHJcblxyXG4gIC8vIFN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgcmV0dXJuIGNyZWF0ZVxyXG59XHJcbiIsIlwidXNlIHN0cmljdFwiO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYlhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWlJc0ltWnBiR1VpT2lKak9pOW5hWFF0Y0hKdmFtVmpkSE12YzI5dWJtVXZiR2xpTDNCeWFXMHVhbk1pTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2VzExOSJdfQ==
