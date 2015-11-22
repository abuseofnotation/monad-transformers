exports.state = {
    name: 'State',
    of: function (val) {
        var _this = this;
        return function (prevState) { return _this.outer.of([val, prevState]); };
    },
    chain: function (funk, val) {
        var _this = this;
        return function (prevState) {
            return _this.outer.chain(function (params) {
                var newVal = params[0], newState = params[1];
                return funk(newVal)(newState);
            }, val(prevState));
        };
    },
    lift: function (val) {
        var _this = this;
        return function (prevState) {
            return _this.outer.chain(function (innerValue) { return _this.outer.of([innerValue, prevState]); }, val);
        };
    },
    load: function (val) {
        var _this = this;
        return function (prevState) { return _this.outer.of([prevState, prevState]); };
    },
    save: function (val) {
        var _this = this;
        return function (prevState) { return _this.outer.of([val, val]); };
    },
    mapState: function (funk, val) {
        var _this = this;
        return function (prevState) { return _this.outer.of(funk(val, prevState)); };
    },
    run: function (funk, state) {
        return this.outer.run(function (params) {
            return funk(params[0]);
        }, state());
    }
};
exports.list = {
    name: 'List',
    of: function (val) {
        return this.outer.of([val]);
    },
    chain: function (funk, val) {
        var _this = this;
        return this.outer.chain(function (innerVal) {
            return innerVal.reduce(function (accumulatedVal, newVal) {
                return _this.outer.chain(function (accumulated) {
                    return _this.outer.chain(function (_new) { return _this.outer.of(accumulated.concat(_new)); }, funk(newVal));
                }, accumulatedVal);
            }, _this.outer.of([]));
        }, val);
    },
    lift: function (val) {
        var _this = this;
        return this.outer.chain(function (innerValue) { return _this.outer.of([innerValue]); }, val);
    },
    run: function (funk, val) {
        return this.outer.run(function (list) {
            return list.map(funk);
        }, val);
    },
    filter: function (funk, val) {
        if (funk(val)) {
            return this.of(val);
        }
        else {
            return this.outer.of([]);
        }
    },
    fromArray: function (val) {
        if (val.concat && val.map && val.reduce && val.slice) {
            return this.outer.of(val);
        }
        else {
            throw val + " is not a list.";
        }
    }
};
exports.maybe = {
    name: 'Maybe',
    of: function (val) { return this.outer.of({ maybeVal: val }); },
    chain: function (funk, val) {
        return this.outer.chain(function (innerMaybe) {
            return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
        }, val);
    },
    lift: function (val) {
        var _this = this;
        return this.outer.chain(function (innerValue) { return _this.outer.of({ maybeVal: innerValue }); }, val);
    },
    run: function (funk, val) {
        return this.outer.run(function (innerMaybe) {
            return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal);
        }, val);
    },
    get: function (key, val) {
        return this.of(val[key]);
    },
    chainMaybe: function (funk, val) {
        return this.outer.of(funk(val));
    }
};
exports.idWrapped = {
    name: 'idWrapped',
    of: function (val) {
        return { idContainer: this.outer.of({ idVal: val }) };
    },
    chain: function (funk, val) {
        return {
            idContainer: this.outer.chain(function (innerId) {
                var val = funk(innerId.idVal);
                return val.idContainer;
            }, val.idContainer)
        };
    },
    lift: function (val) {
        var _this = this;
        return { idContainer: this.outer.chain(function (innerValue) { return _this.outer.of({ idVal: innerValue }); }, val) };
    },
    run: function (funk, val) {
        return this.outer.run(function (innerId) {
            return funk(innerId.idVal);
        }, val.idContainer);
    }
};
exports.id = {
    name: 'ID',
    of: function (val) {
        return this.outer.of({ idVal: val });
    },
    chain: function (funk, val) {
        return this.outer.chain(function (innerId) {
            return funk(innerId.idVal);
        }, val);
    },
    lift: function (val) {
        var _this = this;
        return this.outer.chain(function (innerValue) { return _this.outer.of({ idVal: innerValue }); }, val);
    },
    run: function (funk, val) {
        return this.outer.run(function (innerId) {
            return funk(innerId.idVal);
        }, val);
    }
};
exports.prim = require('./prim');
exports.data = require('./data');
exports.comp = require('./comp');
var createStack = require('./stack');
var unwrap = function (val) {
    if (!val.hasOwnProperty('_value')) {
        throw JSON.stringify(val) + ' is not a wrapped value';
    }
    return val._value;
};
var wrapVal = function (proto, val) {
    var obj = Object.create(proto);
    obj._value = val;
    return Object.freeze(obj);
};
exports.make = function make_monad(outer, inner) {
    function create(val) {
        return wrapVal(stackProto, val);
    }
    var monadDefinitions = Array.prototype.slice.call(arguments);
    var stack = createStack(monadDefinitions);
    var stackProto = {
        prototype: stackProto,
        stack: stack,
        chain: function (funk) {
            var funkAndUnwrap = function (val) { return unwrap(funk(val)); };
            if (!process.debug) {
                funkAndUnwrap.toString = function () { return 'unwrap(' + funk.toString() + ')'; };
            }
            return create(stack.last.chain(funkAndUnwrap, this._value));
        },
        lift: function (proto, val) {
            return create(stack.lift(proto, val));
        },
        of: function (value) {
            return create(stack.last.of(value));
        },
        map: function (funk) {
            var _this = this;
            return this.chain(function (val) { return _this.of(funk(val)); });
        },
        run: function () {
            return stack.last.run(function (a) { return a; }, this._value);
        }
    };
    var extend = function (outer) {
        Object.keys(outer)
            .filter(function (key) { return (typeof outer[key] === 'function' && key !== 'map' && key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'run'); })
            .forEach(function (key) {
            stackProto[key] = function () {
                var args = Array.prototype.slice.call(arguments);
                return this.chain(function (val) {
                    return create(stack.lift(outer.original, outer[key].apply(outer, args.concat([val]))));
                });
            };
            create[key] = function () {
                return create(stack.lift(outer.original, outer[key].apply(outer, arguments)));
            };
        });
    };
    stack._members.forEach(extend);
    create.of = stackProto.of;
    create.lift = stackProto.lift;
    return create;
};
module.exports = function createStack(monadStack) {
    var error = new Error('The first argument must be a stack member');
    var stack = [idProto].concat(monadStack);
    stack.forEach(function (member) {
        if (typeof member !== 'object') {
            throw 'Stack members must be objects';
        }
    });
    var stackProcessed = processStack(stack);
    var lift = function (val, level) {
        var nextLevel = level + 1;
        var nextMember = stackProcessed[level + 1];
        if (nextMember !== undefined) {
            return lift(nextMember.lift(val), nextLevel);
        }
        else {
            return val;
        }
    };
    var operation = function (funk) {
        return function (proto, val) {
            var level = stack.indexOf(proto);
            if (level === -1) {
                throw error;
            }
            return funk(val, level);
        };
    };
    var fromStack = function (name) {
        return function (val, level) { return stackProcessed[level][name](val); };
    };
    return {
        lift: operation(lift),
        of: operation(fromStack('of')),
        chain: operation(fromStack('chain')),
        last: stackProcessed[stackProcessed.length - 1],
        id: idProto,
        _members: stackProcessed,
        run: function (val) {
            return stackProcessed[stackProcessed.length - 1].run(val);
        }
    };
};
var processStack = function (baseStack) {
    return stateMap(baseStack, function (item, state) {
        var prevItemProcessed = state.prevItemProcessed || idProto;
        var itemProcessed = processProtoNew(item, prevItemProcessed);
        return [
            itemProcessed,
            {
                prevItemProcessed: itemProcessed,
            }
        ];
    });
};
var stateMap = function (arr, f) {
    return arr.reduce(function (arrayAndState, item) {
        var itemAndState = (f(item, arrayAndState[1]));
        return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1]];
    }, [[], {}])[0];
};
var clone = function (obj) { return Object.keys(obj).reduce(function (newObj, key) {
    newObj[key] = obj[key];
    return newObj;
}, {}); };
var processProtoNew = function (proto, outer) {
    var protoProcessed = clone(proto);
    protoProcessed.name = proto.name + '/' + outer.name,
        protoProcessed.outer = outer;
    protoProcessed.original = proto;
    return protoProcessed;
};
var idProto = {
    name: 'root',
    of: function (val) {
        return val;
    },
    chain: function (funk, val) {
        return funk(val);
    },
    map: function (funk, val) {
        return funk(val);
    },
    run: function (funk, val) {
        return funk(val);
    }
};
//# sourceMappingURL=target.js.map
