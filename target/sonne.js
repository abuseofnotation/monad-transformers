(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports.state = {
  name: 'State',
  of: function of(val) {
    return function (prevState) {
      return [val, prevState];
    };
  },
  chain: function chain(funk, val) {
    return function (prevState) {
      return val(prevState).chain(function (params) {
        var val = params[0],
            newState = params[1];
        return [funk(val), newState];
      });
    };
  },
  lift: function lift(val) {
    return function (prevState) {
      return val.chain(function (innerValue) {
        return [innerValue, prevState];
      });
    };
  },
  load: function load(val) {
    return function (prevState) {
      return [prevState, prevState];
    };
  },
  save: function save(val) {
    return function (prevState) {
      return [val, val];
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
  chain: function chain(funk, val, proto) {
    return proto.chain(function (innerId) {
      return funk(innerId.idVal);
    }, val);
  },
  lift: function lift(val, proto) {
    return proto.chain(function (innerValue) {
      return val.of({ idVal: innerValue });
    }, val);
  }
};

exports.maybe = {
  name: 'Maybe',
  of: function of(val) {
    return { maybeVal: val };
  },
  chain: function chain(funk, val, proto) {
    debugger;
    return proto.chain(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
    }, val);
  },
  lift: function lift(val, proto) {
    return proto.chain(function (innerValue) {
      return val.of({ maybeVal: innerValue });
    }, val);
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
      return innerList.reduce(function (list, val) {
        return list.concat(funk(val));
      }, []);
    });
  },
  lift: function lift(val) {
    return val.chain(function (innerValue) {
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
  chain: function chain(funk, val) {
    return funk(val);
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
    // When we stack monad transformers, we must have a real monad at the bottom.
    // That is why we wrap our value in an ID monad
    chain: function chain(funk, val) {
      return outer.chain(funk, val, idProto);
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
      return create(inner.chain(funkAndUnwrap, this._value, outerProto));
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
    return create(inner.lift(val, outerProto));
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2NvbXAuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL2RhdGEuanMiLCJjOi9naXQtcHJvamVjdHMvc29ubmUvbGliL21haW4uanMiLCJsaWIvcHJpbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsT0FBTyxDQUFDLEtBQUssR0FBRztBQUNkLE1BQUksRUFBRSxPQUFPO0FBQ2IsSUFBRSxFQUFDLFlBQUMsR0FBRyxFQUFFO0FBQ1AsV0FBTyxVQUFDLFNBQVM7YUFBSyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUM7S0FBQSxDQUFBO0dBQ3ZDO0FBQ0QsT0FBSyxFQUFDLGVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUNoQixXQUFPLFVBQUMsU0FBUzthQUNmLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBQyxNQUFNLEVBQUs7QUFDL0IsWUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUFFLFFBQVEsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDM0MsZUFBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQTtPQUM3QixDQUFDO0tBQUEsQ0FBQTtHQUNMO0FBQ0QsTUFBSSxFQUFDLGNBQUMsR0FBRyxFQUFFO0FBQ1QsV0FBTyxVQUFDLFNBQVM7YUFDZixHQUFHLENBQUMsS0FBSyxDQUFDLFVBQUMsVUFBVTtlQUFLLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQztPQUFBLENBQUM7S0FBQSxDQUFBO0dBQ3JEO0FBQ0QsTUFBSSxFQUFDLGNBQUMsR0FBRyxFQUFFO0FBQ1QsV0FBTyxVQUFDLFNBQVM7YUFBSyxDQUFDLFNBQVMsRUFB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QUFBO0tBQ0YsQ0FBQyxDQUFBO0dBQ0wsQ0FBQTtBQUNELFFBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUNiLFFBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTs7QUFFYixZQUFVLENBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLEtBQUssQ0FBQTtBQUNqQyxZQUFVLENBQUcsS0FBSyxDQUFDLElBQUksQ0FBRSxHQUFHLEtBQUssQ0FBQTs7O0FBR2pDLFFBQU0sQ0FBQyxFQUFFLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQTtBQUN6QixRQUFNLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsQ0FBQTtBQUNuRSxRQUFNLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsR0FBRyxVQUFVLENBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUUsQ0FBQTs7O0FBR25FLFNBQU8sTUFBTSxDQUFBO0NBQ2QsQ0FBQTs7O0FDN0dEO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5zdGF0ZSA9IHtcclxuICBuYW1lOiAnU3RhdGUnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PiBbdmFsLCBwcmV2U3RhdGVdXHJcbiAgfSxcclxuICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT5cclxuICAgICAgdmFsKHByZXZTdGF0ZSkuY2hhaW4oKHBhcmFtcykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbCA9IHBhcmFtc1swXSwgbmV3U3RhdGUgPSBwYXJhbXNbMV1cclxuICAgICAgICByZXR1cm4gW2Z1bmsodmFsKSwgbmV3U3RhdGVdXHJcbiAgICAgIH0pXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiAocHJldlN0YXRlKSA9PlxyXG4gICAgICB2YWwuY2hhaW4oKGlubmVyVmFsdWUpID0+IFtpbm5lclZhbHVlLCBwcmV2U3RhdGVdKVxyXG4gIH0sXHJcbiAgbG9hZCAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gW3ByZXZTdGF0ZSwgcHJldlN0YXRlXVxyXG4gIH0sXHJcbiAgc2F2ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gKHByZXZTdGF0ZSkgPT4gW3ZhbCwgdmFsXVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLmlkID0ge1xyXG4gIG5hbWU6ICdJRCcsXHJcbiAgb2YgKHZhbCkgeyByZXR1cm4ge2lkVmFsOiB2YWwgfSB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwsIHByb3RvKSB7XHJcbiAgICByZXR1cm4gcHJvdG8uY2hhaW4oKGlubmVySWQpID0+IGZ1bmsoaW5uZXJJZC5pZFZhbCksIHZhbClcclxuICB9LFxyXG4gIGxpZnQgKHZhbCwgcHJvdG8pIHtcclxuICAgIHJldHVybiBwcm90by5jaGFpbigoaW5uZXJWYWx1ZSkgPT4gdmFsLm9mKHtpZFZhbDogaW5uZXJWYWx1ZX0pLCB2YWwpXHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnRzLm1heWJlID0ge1xyXG4gIG5hbWU6ICdNYXliZScsXHJcbiAgb2YgKHZhbCkge1xyXG4gICAgcmV0dXJuIHttYXliZVZhbDogdmFsIH1cclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwsIHByb3RvKSB7XHJcbiAgICBkZWJ1Z2dlclxyXG4gICAgcmV0dXJuIHByb3RvLmNoYWluKChpbm5lck1heWJlKSA9PlxyXG4gICAgICBpbm5lck1heWJlLm1heWJlVmFsID09PSB1bmRlZmluZWQgPyBpbm5lck1heWJlIDogZnVuayhpbm5lck1heWJlLm1heWJlVmFsKSwgdmFsKVxyXG4gIH0sXHJcbiAgbGlmdCAodmFsLCBwcm90bykge1xyXG4gICAgcmV0dXJuIHByb3RvLmNoYWluKChpbm5lclZhbHVlKSA9PiB2YWwub2Yoe21heWJlVmFsOiBpbm5lclZhbHVlfSksIHZhbClcclxuICB9LFxyXG4gIGdldCAoa2V5LCB2YWwpIHtcclxuICAgIHJldHVybiB7bWF5YmVWYWw6IHZhbFtrZXldfVxyXG4gIH1cclxufVxyXG5leHBvcnRzLmxpc3QgPSB7XHJcbiAgbmFtZTogJ0xpc3QnLFxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY29uc3RydWN0b3IgPT09IEFycmF5ID8gdmFsIDogW3ZhbF1cclxuICB9LFxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oKGlubmVyTGlzdCkgPT5cclxuICAgICAgaW5uZXJMaXN0LnJlZHVjZSgobGlzdCwgdmFsKSA9PiBsaXN0LmNvbmNhdChmdW5rKHZhbCkpLCBbXSkpXHJcbiAgfSxcclxuICBsaWZ0ICh2YWwpIHtcclxuICAgIHJldHVybiB2YWwuY2hhaW4oKGlubmVyVmFsdWUpID0+XHJcbiAgICAgIHZhbC5vZihbaW5uZXJWYWx1ZV0pKVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnRzLnByaW0gPSByZXF1aXJlKCcuL3ByaW0nKVxyXG5leHBvcnRzLmRhdGEgPSByZXF1aXJlKCcuL2RhdGEnKVxyXG5leHBvcnRzLmNvbXAgPSByZXF1aXJlKCcuL2NvbXAnKVxyXG5cclxuY29uc3QgaWRQcm90byA9IHtcclxuICAvLyBUaGUgJ29mJyBmdW5jdGlvbiB3cmFwcyBhIHZhbHVlIGluIGEgbW9uYWQuXHJcbiAgLy8gSW4gdGhlIGNhc2Ugb2YgdGhlIGlkZW50aXR5IG1vbmFkLCB3ZSBkb24ndCBkbyBhbnl0aGluZywgc28gd2UgZG9uJ3QgcmVhbGx5XHJcbiAgLy8gbmVlZCB0byB3cmFwIGl0LlxyXG4gIG9mICh2YWwpIHtcclxuICAgIHJldHVybiB2YWxcclxuICB9LFxyXG4gIC8vIGlkZW50aXR5IG1vbmFkJ3MgY2hhaW4gaW1wbGVtZW50YXRpb24uXHJcbiAgLy8gU2luY2Ugbm8gcGFja2luZyBhbmQgdW5wYWNraW5nIHRha2VzIHBsYWNlLFxyXG4gIC8vIGFsbCB3ZSBoYXZlIHRvIGRvIGlzIHRvIGFwcGx5IHRoZSBmdW5jdGlvblxyXG4gIGNoYWluIChmdW5rLCB2YWwpIHtcclxuICAgIHJldHVybiBmdW5rKHZhbClcclxuICB9XHJcbn1cclxuXHJcbi8vIFVud3JhcHMgYSB3cmFwcGVkIHZhbHVlXHJcbmNvbnN0IHVud3JhcCA9ICh2YWwpID0+IHtcclxuICBpZiAoIXZhbC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJykpIHt0aHJvdyBKU09OLnN0cmluZ2lmeSh2YWwpICsgJyBpcyBub3QgYSB3cmFwcGVkIHZhbHVlJ31cclxuICByZXR1cm4gdmFsLl92YWx1ZVxyXG59XHJcblxyXG4vLyBXcmFwcyBhIHZhbHVlIGluIGEgc3BlY2lmaWVkIHByb3RvdHlwZVxyXG5jb25zdCB3cmFwSW4gPSAocHJvdG8sIHZhbCkgPT4ge1xyXG4gIHZhciBvYmogPSBPYmplY3QuY3JlYXRlKHByb3RvKVxyXG4gIG9iai5fdmFsdWUgPSB2YWxcclxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShvYmopXHJcbn1cclxuXHJcbmV4cG9ydHMubWFrZSA9IGZ1bmN0aW9uIG1ha2VfbW9uYWQgKG91dGVyLCBpbm5lcikge1xyXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IG9iamVjdCBhbmQgd3JhcHMgaXQgaW4gdGhlIHN0YWNrIHByb3RvdHlwZVxyXG4gIGZ1bmN0aW9uIGNyZWF0ZSAodmFsKSB7XHJcbiAgICByZXR1cm4gd3JhcEluKHN0YWNrUHJvdG8sIHZhbClcclxuICB9XHJcblxyXG4gIC8vIERlZmluZSB0aGUgcHJvdG90eXBlIG9mIHRoZSBvdXRlciBtb25hZC5cclxuICBjb25zdCBvdXRlclByb3RvID0ge1xyXG4gICAgb2Y6IG91dGVyLm9mLFxyXG4gICAgLy8gSGVyZSB3ZSBqdXN0IHRha2UgdGhlICdjaGFpbicgZnVuY3Rpb24gZnJvbSB0aGUgbW9uYWQncyBkZWZpbml0aW9uLFxyXG4gICAgLy8gYW5kIGFwcGx5IGl0IHRvIHRoZSB2YWx1ZSwgcGxhY2VkIGluIHRoZSBvYmplY3QncyAnX3ZhbHVlJyBwcm9wZXJ0eVxyXG4gICAgLy8gV2hlbiB3ZSBzdGFjayBtb25hZCB0cmFuc2Zvcm1lcnMsIHdlIG11c3QgaGF2ZSBhIHJlYWwgbW9uYWQgYXQgdGhlIGJvdHRvbS5cclxuICAgIC8vIFRoYXQgaXMgd2h5IHdlIHdyYXAgb3VyIHZhbHVlIGluIGFuIElEIG1vbmFkXHJcbiAgICBjaGFpbiAoZnVuaywgdmFsKSB7XHJcbiAgICAgIHJldHVybiBvdXRlci5jaGFpbihmdW5rLCB2YWwsIGlkUHJvdG8pXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBEZWZpbmUgdGhlIHByb3RvdHlwZSBvZiB0aGUgcmVzdWx0aW5nIG1vbmFkIHN0YWNrXHJcbiAgY29uc3Qgc3RhY2tQcm90byA9IHtcclxuICAgIHByb3RvdHlwZTogc3RhY2tQcm90byxcclxuXHJcbiAgICAvLyBBZGQgY2hhaW4gZnVuY3Rpb25cclxuICAgIGNoYWluIChmdW5rKSB7XHJcbiAgICAgIGNvbnN0IGZ1bmtBbmRVbndyYXAgPSAodmFsKSA9PiB1bndyYXAoZnVuayh2YWwpKVxyXG4gICAgICByZXR1cm4gY3JlYXRlKGlubmVyLmNoYWluKGZ1bmtBbmRVbndyYXAsIHRoaXMuX3ZhbHVlLCBvdXRlclByb3RvKSlcclxuICAgIH0sXHJcblxyXG4gICAgLy8gQWRkICdtYXAnIGFuZCAnb2YnIGZ1bmN0aW9uc1xyXG4gICAgb2YgKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiBjcmVhdGUob3V0ZXIub2YoaW5uZXIub2YodmFsdWUpKSlcclxuICAgIH0sXHJcbiAgICBtYXAgKGZ1bmspIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gdGhpcy5vZihmdW5rKHZhbCkpKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gTGlmdHMgYSB2YWx1ZSBmcm9tIHRoZSBvdXRlciB0eXBlIHRvIGEgZnVsbCBzdGFja1xyXG4gIGNvbnN0IGxpZnRPdXRlciA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0gPSAodmFsKSA9PiBjcmVhdGUoaW5uZXIubGlmdCh2YWwsIG91dGVyUHJvdG8pKVxyXG4gIGNvbnN0IGxpZnRJbm5lciA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBpbm5lci5uYW1lIF0gPSAodmFsKSA9PiBjcmVhdGUob3V0ZXIub2YodmFsKSlcclxuXHJcbiAgLy8gQWRkIHZhcmlhbnRzIG9mICdjaGFpbicgY29tcG9zZWQgd2l0aCBsaWZ0LCB3aGljaCB3b3JrIGluIGlubmVyIGFuZCBvdXRlciB2YWx1ZXNcclxuICBzdGFja1Byb3RvIFsgJ2NoYWluJyArIGlubmVyLm5hbWUgXSA9IGZ1bmN0aW9uIChmdW5rKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiBsaWZ0SW5uZXIoZnVuayh2YWwpKSlcclxuICB9XHJcbiAgc3RhY2tQcm90byBbICdjaGFpbicgKyBvdXRlci5uYW1lIF0gPSBmdW5jdGlvbiAoZnVuaykge1xyXG4gICAgcmV0dXJuIHRoaXMuY2hhaW4oKHZhbCkgPT4gbGlmdE91dGVyKGZ1bmsodmFsKSkpXHJcbiAgfVxyXG5cclxuICAvLyBVc2luZyB0aGUgbGlmdCBvcGVyYXRpb25zLCBsaWZ0IGFsbCBtb25hZCBoZWxwZXJzIGFuZCBhc3NpZ24gdGhlbSB0byB0aGUgc3RhY2sgb2JqZWN0OlxyXG4gIGNvbnN0IGV4dGVuZCA9IChvdXRlcikgPT4ge1xyXG4gICAgT2JqZWN0LmtleXMob3V0ZXIpXHJcbiAgICAgIC5maWx0ZXIoKGtleSkgPT4gKGtleSAhPT0gJ29mJyAmJiBrZXkgIT09ICdjaGFpbicgJiYga2V5ICE9PSAnbGlmdCcpKVxyXG4gICAgICAuZm9yRWFjaCgoa2V5KSA9PiB7XHJcbiAgICAgICAgc3RhY2tQcm90b1trZXldID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgY29uc3QgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcclxuXHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5jaGFpbigodmFsKSA9PiB7XHJcbiAgICAgICAgICAgIGFyZ3MucHVzaCh2YWwpXHJcbiAgICAgICAgICAgIHJldHVybiBzdGFja1Byb3RvWyAnbGlmdCcgKyBvdXRlci5uYW1lIF0ob3V0ZXJba2V5XS5hcHBseShudWxsLCBhcmdzKSlcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gIH1cclxuICBleHRlbmQob3V0ZXIpXHJcbiAgZXh0ZW5kKGlubmVyKVxyXG4gIC8vIEFkZCBhbGlhc2VzIHRvIHRoZSBtb25hZHMgdGhlbXNlbHZlc1xyXG4gIHN0YWNrUHJvdG8gWyBpbm5lci5uYW1lIF0gPSBpbm5lclxyXG4gIHN0YWNrUHJvdG8gWyBvdXRlci5uYW1lIF0gPSBvdXRlclxyXG5cclxuICAvLyBBZGQgcmVsZXZhbnQgcHJvdG90eXBlIHByb3BlcnRpZXMgdG8gdGhlIGNvbnN0cnVjdG9yXHJcbiAgY3JlYXRlLm9mID0gc3RhY2tQcm90by5vZlxyXG4gIGNyZWF0ZSBbICdsaWZ0JyArIG91dGVyLm5hbWUgXSA9IHN0YWNrUHJvdG8gWyAnbGlmdCcgKyBvdXRlci5uYW1lIF1cclxuICBjcmVhdGUgWyAnbGlmdCcgKyBpbm5lci5uYW1lIF0gPSBzdGFja1Byb3RvIFsgJ2xpZnQnICsgaW5uZXIubmFtZSBdXHJcblxyXG4gIC8vIFN0YWNrIGNvbnN0cnVjdG9yXHJcbiAgcmV0dXJuIGNyZWF0ZVxyXG59XHJcbiIsIlwidXNlIHN0cmljdFwiO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYlhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWlJc0ltWnBiR1VpT2lKak9pOW5hWFF0Y0hKdmFtVmpkSE12YzI5dWJtVXZiR2xpTDNCeWFXMHVhbk1pTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2VzExOSJdfQ==
