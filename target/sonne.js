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
    return { maybeValue: val[key] };
  }
};
exports.list = {
  name: 'list',
  of: function of(val) {
    console.log(val);return val.constructor === Array ? val : [val];
  },
  map: function map(funk, val) {
    return val.map(funk);
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

// Unwraps a value and wraps it again in a specified prototype
var wrapIn = function wrapIn(proto, val) {
  var obj = Object.create(proto);
  obj._value = val;
  return obj;
};

exports.make = function make_monad(outer, inner) {
  function create(value) {
    var obj = Object.create(stackProto);
    obj._value = value;
    return Object.freeze(obj);
  }

  // Create the prototype of the outer monad
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

  // Add variants of 'chain' which works in an inner and outer values
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJEOi9wci9zb25uZS9saWIvY29tcC5qcyIsIkQ6L3ByL3Nvbm5lL2xpYi9kYXRhLmpzIiwiRDovcHIvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsT0FBTyxDQUFDLE9BQU8sR0FBRztBQUNoQixNQUFJLEVBQUUsU0FBUztBQUNmLElBQUUsRUFBRSxZQUFVLEdBQUcsRUFBRTtBQUFDLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFBRSxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQTtLQUFDLENBQUE7R0FBRTtBQUN0RSxLQUFHLEVBQUUsYUFBVSxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQ3hCLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFDeEIsU0FBRyxDQUFDLFVBQVUsS0FBSyxFQUFFO0FBQ25CLGVBQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO09BQzVCLENBQUMsQ0FBQTtLQUNILENBQUE7R0FDRjs7QUFFRCxNQUFJLEVBQUUsY0FBVSxHQUFHLEVBQUUsVUFBVSxFQUFFO0FBQy9CLFdBQU8sVUFBVSxPQUFPLEVBQUU7QUFDeEIsU0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ2Ysa0JBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxZQUFZLEVBQUU7QUFDckMsc0JBQVksQ0FBQyxVQUFVLEtBQUssRUFBRTtBQUM1QixtQkFBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsWUFBWTtBQUFDLHFCQUFPLEtBQUssQ0FBQTthQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtXQUN2RCxDQUFDLENBQUE7U0FDSCxFQUFFLENBQUMsQ0FBQyxDQUFBO09BRU4sQ0FBQyxDQUFBO0tBQ0gsQ0FB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LENBQUUsR0FBRyxVQUFDLEdBQUc7V0FBSyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztHQUFBLENBQUE7OztBQUdyRixZQUFVLENBQUcsT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLElBQUksRUFBRTtBQUNwRCxXQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBQyxHQUFHO2FBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUFBLENBQUMsQ0FBQTtHQUNqRCxDQUFBO0FBQ0QsWUFBVSxDQUFHLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsVUFBVSxJQUFJLEVBQUU7QUFDcEQsV0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsR0FBRzthQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7S0FBQSxDQUFDLENBQUE7R0FDakQsQ0FBQTs7O0FBR0QsWUFBVSxDQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxLQUFLLENBQUE7QUFDakMsWUFBVSxDQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxLQUFLLENBQUE7OztBQUdqQyxRQUFNLENBQUMsRUFBRSxHQUFHLFVBQVUsQ0FBQyxFQUFFLENBQUE7QUFDekIsUUFBTSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsVUFBVSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLENBQUE7QUFDbkUsUUFBTSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLEdBQUcsVUFBVSxDQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFFLENBQUE7OztBQUduRSxTQUFPLE1BQU0sQ0FBQTtDQUNkLENBQUE7OztBQzdGRDtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydHMucHJvbWlzZSA9IHtcclxuICBuYW1lOiAncHJvbWlzZScsXHJcbiAgb2Y6IGZ1bmN0aW9uICh2YWwpIHtyZXR1cm4gZnVuY3Rpb24gKHJlc29sdmUpIHsgcmV0dXJuIHJlc29sdmUodmFsKX0gfSxcclxuICBtYXA6IGZ1bmN0aW9uIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAocmVzb2x2ZSkge1xyXG4gICAgICB2YWwoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUoZnVuayh2YWx1ZSkpXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgZmxhdDogZnVuY3Rpb24gKHZhbCwgaW5uZXJNb25hZCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChyZXNvbHZlKSB7XHJcbiAgICAgIHZhbChmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgIGlubmVyTW9uYWQubWFwKGZ1bmN0aW9uIChpbm5lclByb21pc2UpIHtcclxuICAgICAgICAgIGlubmVyUHJvbWlzZShmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShpbm5lck1vbmFkLm1hcChmdW5jdGlvbiAoKSB7cmV0dXJuIHZhbHVlfSwgaSkpXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH0sIGkpXHJcblxyXG4gICAgICB9KVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJRCcsXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4ge2lkVmFsOiB2YWwgfSB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVySWQpIHtcclxuICAgICAgcmV0dXJuIGZ1bmsoaW5uZXJJZC5pZFZhbClcclxuICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oZnVuY3Rpb24gKGlubmVyVmFsdWUpIHtyZXR1cm4gdmFsLm9mKHtpZFZhbDogaW5uZXJWYWx1ZX0pfSlcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydHMubWF5YmUgPSB7XHJcbiAgbmFtZTogJ01heWJlJyxcclxuICBvZiAodmFsKSB7IHJldHVybiB7bWF5YmVWYWw6IHZhbCB9IH0sXHJcbiAgY2hhaW4gKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5jaGFpbihmdW5jdGlvbiAoaW5uZXJNYXliZSkge1xyXG4gICAgICB2YWxcclxuICAgICAgcmV0dXJuIGlubmVyTWF5YmUubWF5YmVWYWwgPT09IHVuZGVmaW5lZCA/IGlubmVyTWF5YmUgOiBmdW5rKGlubmVyTWF5YmUubWF5YmVWYWwpXHJcbiAgICB9KVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsLmNoYWluKGZ1bmN0aW9uIChpbm5lclZhbHVlKSB7cmV0dXJuIHZhbC5vZih7bWF5YmVWYWw6IGlubmVyVmFsdWV9KX0pXHJcbiAgfSxcclxuICBub3RoaW5nICgpIHsgcmV0dXJuIHttYXliZVZhbHVlOiB1bmRlZmluZWR9fSxcclxuICBnZXQgKGtleSwgdmFsKSB7IHJldHVybiB7bWF5YmVWYWx1ZTogdmFsW2tleV19fVxyXG59XHJcbmV4cG9ydHMubGlzdCA9IHtcclxuICBuYW1lOiAnbGlzdCcsXHJcbiAgb2YgKHZhbCkge2NvbnNvbGUubG9nKHZhbCk7IHJldHVybiB2YWwuY29uc3RydWN0b3IgPT09IEFycmF5ID8gdmFsIDogW3ZhbF0gfSxcclxuICBtYXAgKGZ1bmssIHZhbCkge1xyXG4gICAgcmV0dXJuIHZhbC5tYXAoZnVuaylcclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwsIGlubmVyTW9uYWQpIHtcclxuICAgIHJldHVybiBpbm5lck1vbmFkLmNoYWluKGZ1bmN0aW9uIChpbm5lckxpc3QpIHtcclxuICAgICAgcmV0dXJuIGlubmVyTGlzdC5yZWR1Y2UoKGxpc3QsIHZhbCkgPT4gbGlzdC5jb25jYXQoZnVuayh2YWwpKSlcclxuICAgIH0sIHZhbCwgaW5uZXJNb25hZC5pbm5lcilcclxuICB9XHJcbn1cclxuIiwiZXhwb3J0cy5wcmltID0gcmVxdWlyZSgnLi9wcmltJylcclxuZXhwb3J0cy5kYXRhID0gcmVxdWlyZSgnLi9kYXRhJylcclxuZXhwb3J0cy5jb21wID0gcmVxdWlyZSgnLi9jb21wJylcclxuXHJcbmNvbnN0IGlkUHJvdG8gPSB7XHJcbiAgLy8gVGhlICdvZicgZnVuY3Rpb24gd3JhcHMgYSB2YWx1ZSBpbiBhIG1vbmFkLlxyXG4gIC8vIEluIHRoZSBjYXNlIG9mIHRoZSBpZGVudGl0eSBtb25hZCwgd2UgZG9uJ3QgZG8gYW55dGhpbmcsIHNvIHdlIGRvbid0IHJlYWxseVxyXG4gIC8vIG5lZWQgdG8gd3JhcCBpdC5cclxuICBvZiAodmFsKSB7XHJcbiAgICByZXR1cm4gdmFsXHJcbiAgfSxcclxuICAvLyBpZGVudGl0eSBtb25hZCdzIGNoYWluIGltcGxlbWVudGF0aW9uLlxyXG4gIC8vIFNpbmNlIG5vIHBhY2tpbmcgYW5kIHVucGFja2luZyB0YWtlcyBwbGFjZSxcclxuICAvLyBhbGwgd2UgaGF2ZSB0byBkbyBpcyB0byBhcHBseSB0aGUgZnVuY3Rpb25cclxuICBjaGFpbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIGZ1bmsodGhpcy5fdmFsdWUpXHJcbiAgfVxyXG59XHJcblxyXG4vLyBVbndyYXBzIGEgd3JhcHBlZCB2YWx1ZVxyXG5jb25zdCB1bndyYXAgPSAodmFsKSA9PiB7XHJcbiAgaWYgKCF2YWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpKSB7dGhyb3cgSlNPTi5zdHJpbmdpZnkodmFsKSArICcgaXMgbm90IGEgd3JhcHBlZCB2YWx1ZSd9XHJcbiAgcmV0dXJuIHZhbC5fdmFsdWVcclxufVxyXG5cclxuLy8gVW53cmFwcyBhIHZhbHVlIGFuZCB3cmFwcyBpdCBhZ2FpbiBpbiBhIHNwZWNpZmllZCBwcm90b3R5cGVcclxuY29uc3Qgd3JhcEluID0gKHByb3RvLCB2YWwpID0+IHtcclxuICB2YXIgb2JqID0gT2JqZWN0LmNyZWF0ZShwcm90bylcclxuICBvYmouX3ZhbHVlID0gdmFsXHJcbiAgcmV0dXJuIG9ialxyXG59XHJcblxyXG5leHBvcnRzLm1ha2UgPSBmdW5jdGlvbiBtYWtlX21vbmFkIChvdXRlciwgaW5uZXIpIHtcclxuICBmdW5jdGlvbiBjcmVhdGUgKHZhbHVlKSB7XHJcbiAgICB2YXIgb2JqID0gT2JqZWN0LmNyZWF0ZShzdGFja1Byb3RvKVxyXG4gICAgb2JqLl92YWx1ZSA9IHZhbHVlXHJcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZShvYmopXHJcbiAgfVxyXG5cclxuICAvLyBDcmVhdGUgdGhlIHByb3RvdHlwZSBvZiB0aGUgb3V0ZXIgbW9uYWRcclxuICBjb25zdCBvdXRlclByb3RvID0ge1xyXG4gICAgb2Y6IG91dGVyLm9mLFxyXG4gICAgLy8gSGVyZSB3ZSBqdXN0IHRha2UgdGhlICdjaGFpbicgZnVuY3Rpb24gZnJvbSB0aGUgbW9uYWQncyBkZWZpbml0aW9uLFxyXG4gICAgLy8gYW5kIGFwcGx5IGl0IHRvIHRoZSB2YWx1ZSwgcGxhY2VkIGluIHRoZSBvYmplY3QncyAnX3ZhbHVlJyBwcm9wZXJ0eVxyXG4gICAgLy8gV2hlbiB3ZSBzdGFjayBtb25hZCB0cmFuc2Zvcm1lciBtdXN0IGhhdmUgYSByZWFsIGF0IHRoZSBib3R0b20uXHJcbiAgICAvLyBUaGF0IGlzIHdoeSB3ZSB3cmFwIG91ciB2YWx1ZSBpbiBhbiBJRCBtb25hZFxyXG4gICAgY2hhaW4gKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIG91dGVyLmNoYWluKGZ1bmssIHdyYXBJbihpZFByb3RvLCB0aGlzLl92YWx1ZSkpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgdmFyIHN0YWNrUHJvdG8gPSB7XHJcbiAgICBwcm90b3R5cGU6IHN0YWNrUHJvdG8sXHJcblxyXG4gICAgLy8gQWRkIGNoYWluIGZ1bmN0aW9uXHJcbiAgICBjaGFpbiAoZnVuaykge1xyXG4gICAgICBjb25zdCBmdW5rQW5kVW53cmFwID0gKHZhbCkgPT4gdW53cmFwKGZ1bmsodmFsKSlcclxuICAgICAgcmV0dXJuIGNyZWF0ZShpbm5lci5jaGFpbihmdW5rQW5kVW53cmFwLCB3cmFwSW4ob3V0ZXJQcm90bywgdGhpcy5fdmFsdWUpKSlcclxuICAgIH0sXHJcblxyXG4gICAgLy8gQWRkICdtYXAnIGFuZCAnb2YnIGZ1bmN0aW9uc1xyXG4gICAgb2YgKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUob3V0ZXIub2YoaW5uZXIub2YodmFsdWUpKSlcclxuICAgIH0sXHJcbiAgICBtYXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gTGlmdHMgYSB2YWx1ZSBmcm9tIHRoZSBvdXRlciB0eXBlIHRvIGEgZnVsbCBzdGFja1xyXG4gIGNvbnN0IGxpZnRPdXRlciA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0gPSAodmFsKSA9PiBjcmVhdGUoaW5uZXIubGlmdCh3cmFwSW4ob3V0ZXJQcm90bywgdmFsKSkpXHJcbiAgY29uc3QgbGlmdElubmVyID0gc3RhY2tQcm90byBbICdsaWZ0JyArIGlubmVyLm5hbWUgXSA9ICh2YWwpID0+IGNyZWF0ZShvdXRlci5vZih2YWwpKVxyXG5cclxuICAvLyBBZGQgdmFyaWFudHMgb2YgJ2NoYWluJyB3aGljaCB3b3JrcyBpbiBhbiBpbm5lciBhbmQgb3V0ZXIgdmFsdWVzXHJcbiAgc3RhY2tQcm90byBbICdjaGFpbicgKyBpbm5lci5uYW1lIF0gPSBmdW5jdGlvbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gbGlmdElubmVyKGZ1bmsodmFsKSkpXHJcbiAgfVxyXG4gIHN0YWNrUHJvdG8gWyAnY2hhaW4nICsgb3V0ZXIubmFtZSBdID0gZnVuY3Rpb24gKGZ1bmspIHtcclxuICAgIHJldHVybiB0aGlzLmNoYWluKCh2YWwpID0+IGxpZnRPdXRlcihmdW5rKHZhbCkpKVxyXG4gIH1cclxuXHJcbiAgLy8gQWRkIGFsaWFzZXMgdG8gdGhlIG1vbmFkcyB0aGVtc2VsdmVzXHJcbiAgc3RhY2tQcm90byBbIGlubmVyLm5hbWUgXSA9IGlubmVyXHJcbiAgc3RhY2tQcm90byBbIG91dGVyLm5hbWUgXSA9IG91dGVyXHJcblxyXG4gIC8vIEFkZCByZWxldmFudCBwcm90b3R5cGUgcHJvcGVydGllcyB0byB0aGUgY29uc3RydWN0b3JcclxuICBjcmVhdGUub2YgPSBzdGFja1Byb3RvLm9mXHJcbiAgY3JlYXRlIFsgJ2xpZnQnICsgb3V0ZXIubmFtZSBdID0gc3RhY2tQcm90byBbICdsaWZ0JyArIG91dGVyLm5hbWUgXVxyXG4gIGNyZWF0ZSBbICdsaWZ0JyArIGlubmVyLm5hbWUgXSA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBpbm5lci5uYW1lIF1cclxuXHJcbiAgLy8gU3RhY2sgY29uc3RydWN0b3JcclxuICByZXR1cm4gY3JlYXRlXHJcbn1cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJaUlzSW1acGJHVWlPaUpFT2k5d2NpOXpiMjV1WlM5c2FXSXZjSEpwYlM1cWN5SXNJbk52ZFhKalpYTkRiMjUwWlc1MElqcGJYWDA9Il19
