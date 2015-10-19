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
      val;
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
  name: 'list',
  of: function of(val) {
    console.log(val);return val.constructor === Array ? val : [val];
  },
  chain: function chain(funk, val, innerMonad) {
    return innerMonad.chain(function (innerList) {
      return innerList.reduce(function (list, val) {
        return list.concat(funk(val));
      });
    }, val, innerMonad.inner);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJEOi9wci9zb25uZS9saWIvY29tcC5qcyIsIkQ6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzIiwiRDovcHIvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsT0FBTyxDQUFDLE9BQU8sR0FBRztBQUNoQixNQUFJLEVBQUUsU0FBUztBQUNmLElBQUUsRUFBRSxZQUFVLEdBQUcsRUFBRTtBQUFDLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFBRSxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQTtLQUFDLENBQUE7R0FBRTtBQUN0RSxLQUFHLEVBQUUsYUFBVSxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQ3hCLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFDeEIsU0FBRyxDQUFDLFVBQVUsS0FBSyxFQUFFO0FBQ25CLGVBQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO09BQzVCLENBQUMsQ0FBQTtLQUNILENBQUE7R0FDRjs7QUFFRCxNQUFJLEVBQUUsY0FBVSxHQUFHLEVBQUUsVUFBVSxFQUFFO0FBQy9CLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFDeEIsU0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ2Ysa0JBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxZQUFZLEVBQUU7QUFDckMsc0JBQVksQ0FBQyxVQUFVLEtBQUssRUFBRTtBQUM1QixtQkFBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsWUFBWTtBQUFDLHFCQUFPLEtBQUssQ0FBQTthQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtXQUN2RCxDQUFDLENBQUE7U0FDSCxFQUFFLENBQUMsQ0FBQyxDQUFBO09BRU4sQ0FBQyxDQUFBO0tBQ0gsQ0FB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S0FBSyxDQUFDLENBQUE7O0FBRWIsWUFBVSxDQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxLQUFLLENBQUE7QUFDakMsWUFBVSxDQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxLQUFLLENBQUE7OztBQUdqQyxRQUFNLENBQUMsRUFBRSxHQUFHLFVBQVUsQ0FBQyxFQUFFLENBQUE7QUFDekIsUUFBTSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsVUFBVSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLENBQUE7QUFDbkUsUUFBTSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsVUFBVSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLENBQUE7OztBQUduRSxTQUFPLE1BQU0sQ0FBQTtDQUNkLENBQUE7OztBQzdHRDtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydHMucHJvbWlzZSA9IHtcclxuICBuYW1lOiAncHJvbWlzZScsXHJcbiAgb2Y6IGZ1bmN0aW9uICh2YWwpIHtyZXR1cm4gZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUodmFsKX0gfSxcclxuICBtYXA6IGZ1bmN0aW9uIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAocmVzb2x2ZSkge1xyXG4gICAgICB2YWwoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoZnVuayh2YWx1ZSkpXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgZmxhdDogZnVuY3Rpb24gKHZhbCwgaW5uZXJNb25hZCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChyZXNvbHZlKSB7XHJcbiAgICAgIHZhbChmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgIGlubmVyTW9uYWQubWFwKGZ1bmN0aW9uIChpbm5lclByb21pc2UpIHtcclxuICAgICAgICAgIGlubmVyUHJvbWlzZShmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShpbm5lck1vbmFkLm1hcChmdW5jdGlvbiAoKSB7cmV0dXJuIHZhbHVlfSwgaSkpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH0sIGkpXHJcblxyXG4gICAgICB9KVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJRCcsXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4ge2lkVmFsOiB2YWwgfSB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVySWQpIHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVyVmFsdWUpIHtyZXR1cm4gdmFsLm9mKHtpZFZhbDogaW5uZXJWYWx1ZX0pfSlcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydHMubWF5YmUgPSB7XHJcbiAgbmFtZTogJ01heWJlJyxcclxuICBvZiAodmFsKSB7IHJldHVybiB7bWF5YmVWYWw6IHZhbCB9IH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJNYXliZSkge1xyXG4gICAgICB2YWxcclxuICAgICAgcmV0dXJuIGlubmVyTWF5YmUubWF5YmVWYWwgPT09IHVuZGVmaW5lZCA/IGlubmVyTWF5YmUgOiBmdW5rKGlubmVyTWF5YmUubWF5YmVWYWwpXHJcbiAgICB9KVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsLmNoYWluKGZ1bmN0aW9uIChpbm5lclZhbHVlKSB7cmV0dXJuIHZhbC5vZih7bWF5YmVWYWw6IGlubmVyVmFsdWV9KX0pXHJcbiAgfSxcclxuICBub3RoaW5nICgpIHsgcmV0dXJuIHttYXliZVZhbHVlOiB1bmRlZmluZWR9fSxcclxuICBnZXQgKGtleSwgdmFsKSB7IHJldHVybiB7bWF5YmVWYWw6IHZhbFtrZXldfX1cclxufVxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ2xpc3QnLFxyXG4gIG9mICh2YWwpIHtjb25zb2xlLmxvZyh2YWwpOyByZXR1cm4gdmFsLmNvbnN0cnVjdG9yID09PSBBcnJheSA/IHZhbCA6IFt2YWxdIH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCwgaW5uZXJNb25hZCkge1xyXG4gICAgcmV0dXJuIGlubmVyTW9uYWQuY2hhaW4oZnVuY3Rpb24gKGlubmVyTGlzdCkge1xyXG4gICAgICByZXR1cm4gaW5uZXJMaXN0LnJlZHVjZSgobGlzdCwgdmFsKSA9PiBsaXN0LmNvbmNhdChmdW5rKHZhbCkpKVxyXG4gICAgfSwgdmFsLCBpbm5lck1vbmFkLmlubmVyKVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLnByaW0gPSByZXF1aXJlKCcuL3ByaW0nKVxyXG5leHBvcnRzLmRhdGEgPSByZXF1aXJlKCcuL2RhdGEnKVxyXG5leHBvcnRzLmNvbXAgPSByZXF1aXJlKCcuL2NvbXAnKVxyXG5cclxuY29uc3QgaWRQcm90byA9IHtcclxuICAvLyBUaGUgJ29mJyBmdW5jdGlvbiB3cmFwcyBhIHZhbHVlIGluIGEgbW9uYWQuXHJcbiAgLy8gSW4gdGhlIGNhc2Ugb2YgdGhlIGlkZW50aXR5IG1vbmFkLCB3ZSBkb24ndCBkbyBhbnl0aGluZywgc28gd2UgZG9uJ3QgcmVhbGx5XHJcbiAgLy8gbmVlZCB0byB3cmFwIGl0LlxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWxcclxuICB9LFxyXG4gIC8vIGlkZW50aXR5IG1vbmFkJ3MgY2hhaW4gaW1wbGVtZW50YXRpb24uXHJcbiAgLy8gU2luY2Ugbm8gcGFja2luZyBhbmQgdW5wYWNraW5nIHRha2VzIHBsYWNlLFxyXG4gIC8vIGFsbCB3ZSBoYXZlIHRvIGRvIGlzIHRvIGFwcGx5IHRoZSBmdW5jdGlvblxyXG4gIGNoYWluIChmdW5rKSB7XHJcbiAgICByZXR1cm4gZnVuayh0aGlzLl92YWx1ZSlcclxuICB9XHJcbn1cclxuXHJcbi8vIFVud3JhcHMgYSB3cmFwcGVkIHZhbHVlXHJcbmNvbnN0IHVud3JhcCA9ICh2YWwpID0+IHtcclxuICBpZiAoIXZhbC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJykpIHt0aHJvdyBKU09OLnN0cmluZ2lmeSh2YWwpICsgJyBpcyBub3QgYSB3cmFwcGVkIHZhbHVlJ31cclxuICByZXR1cm4gdmFsLl92YWx1ZVxyXG59XHJcblxyXG4vLyBXcmFwcyBhIHZhbHVlIGluIGEgc3BlY2lmaWVkIHByb3RvdHlwZVxyXG5jb25zdCB3cmFwSW4gPSAocHJvdG8sIHZhbCkgPT4ge1xyXG4gIHZhciBvYmogPSBPYmplY3QuY3JlYXRlKHByb3RvKVxyXG4gIG9iai5fdmFsdWUgPSB2YWxcclxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShvYmopXHJcbn1cclxuXHJcbmV4cG9ydHMubWFrZSA9IGZ1bmN0aW9uIG1ha2VfbW9uYWQgKG91dGVyLCBpbm5lcikge1xyXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IG9iamVjdCBhbmQgd3JhcHMgaXQgaW4gdGhlIHN0YWNrIHByb3RvdHlwZVxyXG4gIGZ1bmN0aW9uIGNyZWF0ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gd3JhcEluKHN0YWNrUHJvdG8sIHZhbClcclxuICB9XHJcblxyXG4gIC8vIERlZmluZSB0aGUgcHJvdG90eXBlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICBjb25zdCBvdXRlclByb3RvID0ge1xyXG4gICAgb2Y6IG91dGVyLm9mLFxyXG4gICAgLy8gSGVyZSB3ZSBqdXN0IHRha2UgdGhlICdjaGFpbicgZnVuY3Rpb24gZnJvbSB0aGUgbW9uYWQncyBkZWZpbml0aW9uLFxyXG4gICAgLy8gYW5kIGFwcGx5IGl0IHRvIHRoZSB2YWx1ZSwgcGxhY2VkIGluIHRoZSBvYmplY3QncyAnX3ZhbHVlJyBwcm9wZXJ0eVxyXG4gICAgLy8gV2hlbiB3ZSBzdGFjayBtb25hZCB0cmFuc2Zvcm1lciBtdXN0IGhhdmUgYSByZWFsIGF0IHRoZSBib3R0b20uXHJcbiAgICAvLyBUaGF0IGlzIHdoeSB3ZSB3cmFwIG91ciB2YWx1ZSBpbiBhbiBJRCBtb25hZFxyXG4gICAgY2hhaW4gKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIG91dGVyLmNoYWluKGZ1bmssIHdyYXBJbihpZFByb3RvLCB0aGlzLl92YWx1ZSkpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IHtcclxuICAgIHByb3RvdHlwZTogc3RhY2tQcm90byxcclxuXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICByZXR1cm4gY3JlYXRlKGlubmVyLmNoYWluKGZ1bmtBbmRVbndyYXAsIHdyYXBJbihvdXRlclByb3RvLCB0aGlzLl92YWx1ZSkpKVxyXG4gICAgfSxcclxuXHJcbiAgICAvLyBBZGQgJ21hcCcgYW5kICdvZicgZnVuY3Rpb25zXHJcbiAgICBvZiAodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZShvdXRlci5vZihpbm5lci5vZih2YWx1ZSkpKVxyXG4gICAgfSxcclxuICAgIG1hcCAoZnVuaykge1xyXG4gICAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB0aGlzLm9mKGZ1bmsodmFsKSkpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBMaWZ0cyBhIHZhbHVlIGZyb20gdGhlIG91dGVyIHR5cGUgdG8gYSBmdWxsIHN0YWNrXHJcbiAgY29uc3QgbGlmdE91dGVyID0gc3RhY2tQcm90byBbICdsaWZ0JyArIG91dGVyLm5hbWUgXSA9ICh2YWwpID0+IGNyZWF0ZShpbm5lci5saWZ0KHdyYXBJbihvdXRlclByb3RvLCB2YWwpKSlcclxuICBjb25zdCBsaWZ0SW5uZXIgPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdID0gKHZhbCkgPT4gY3JlYXRlKG91dGVyLm9mKHZhbCkpXHJcblxyXG4gIC8vIEFkZCB2YXJpYW50cyBvZiAnY2hhaW4nIGNvbXBvc2VkIHdpdGggbGlmdCwgd2hpY2ggd29yayBpbiBpbm5lciBhbmQgb3V0ZXIgdmFsdWVzXHJcbiAgc3RhY2tQcm90byBbICdjaGFpbicgKyBpbm5lci5uYW1lIF0gPSBmdW5jdGlvbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gbGlmdElubmVyKGZ1bmsodmFsKSkpXHJcbiAgfVxyXG4gIHN0YWNrUHJvdG8gWyAnY2hhaW4nICsgb3V0ZXIubmFtZSBdID0gZnVuY3Rpb24gKGZ1bmspIHtcclxuICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IGxpZnRPdXRlcihmdW5rKHZhbCkpKVxyXG4gIH1cclxuXHJcbiAgLy8gVXNpbmcgdGhlIGxpZnQgb3BlcmF0aW9ucywgbGlmdCBhbGwgbW9uYWQgaGVscGVycyBhbmQgYXNzaWduIHRoZW0gdG8gdGhlIHN0YWNrIG9iamVjdDpcclxuICBjb25zdCBleHRlbmQgPSAob3V0ZXIpID0+IHtcclxuICAgIE9iamVjdC5rZXlzKG91dGVyKVxyXG4gICAgICAuZmlsdGVyKChrZXkpID0+IChrZXkgIT09ICdvZicgJiYga2V5ICE9PSAnY2hhaW4nICYmIGtleSAhPT0gJ2xpZnQnKSlcclxuICAgICAgLmZvckVhY2goKGtleSkgPT4ge1xyXG4gICAgICAgIHN0YWNrUHJvdG9ba2V5XSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXHJcblxyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4ge1xyXG4gICAgICAgICAgICBhcmdzLnB1c2godmFsKVxyXG4gICAgICAgICAgICByZXR1cm4gc3RhY2tQcm90b1sgJ2xpZnQnICsgb3V0ZXIubmFtZSBdKG91dGVyW2tleV0uYXBwbHkobnVsbCwgYXJncykpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICB9XHJcbiAgZXh0ZW5kKG91dGVyKVxyXG4gIGV4dGVuZChpbm5lcilcclxuICAvLyBBZGQgYWxpYXNlcyB0byB0aGUgbW9uYWRzIHRoZW1zZWx2ZXNcclxuICBzdGFja1Byb3RvIFsgaW5uZXIubmFtZSBdID0gaW5uZXJcclxuICBzdGFja1Byb3RvIFsgb3V0ZXIubmFtZSBdID0gb3V0ZXJcclxuXHJcbiAgLy8gQWRkIHJlbGV2YW50IHByb3RvdHlwZSBwcm9wZXJ0aWVzIHRvIHRoZSBjb25zdHJ1Y3RvclxyXG4gIGNyZWF0ZS5vZiA9IHN0YWNrUHJvdG8ub2ZcclxuICBjcmVhdGUgWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0gPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgb3V0ZXIubmFtZSBdXHJcbiAgY3JlYXRlIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdID0gc3RhY2tQcm90byBbICdsaWZ0JyArIGlubmVyLm5hbWUgXVxyXG5cclxuICAvLyBTdGFjayBjb25zdHJ1Y3RvclxyXG4gIHJldHVybiBjcmVhdGVcclxufVxyXG4iLCJcInVzZSBzdHJpY3RcIjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklpSXNJbVpwYkdVaU9pSkVPaTl3Y2k5emIyNXVaUzlzYVdJdmNISnBiUzVxY3lJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYlhYMD0iXX0=
