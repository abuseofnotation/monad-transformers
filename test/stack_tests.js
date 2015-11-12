var combinatorics = require('js-combinatorics')
var createStack = require('../lib/stack')
var comp = require('../lib/comp')

var fooWrapped = {
  name: 'fooWrapped',
  of (val, proto) { 
    return {foocont:proto.of({fooVal: val })}
  },
  chain (funk, val, proto) {
    return {
      foocont:proto.chain((innerfoo) => {
        return funk(innerfoo.fooVal).foocont
      }, val.foocont)
    }
  },
  lift (val, proto) {
    return {foocont:proto.chain((innerValue) => proto.of({fooVal: innerValue}), val)}
  }
}

var barWrapped = {
  name: 'barWrapped',
  of (val, proto) { 
    return {barcont:proto.of({barVal: val })}
  },
  chain (funk, val, proto) {
    return {
      barcont:proto.chain((innerbar) => {
        return funk(innerbar.barVal).barcont
      }, val.barcont)
    }
  },
  lift (val, proto) {
    debugger
    return {barcont:proto.chain((innerValue) => proto.of({barVal: innerValue}), val)}
  }
}


var bazWrapped = {
  name: 'bazWrapped',
  of (val, proto) { 
    return {bazcont:proto.of({bazVal: val })}
  },
  chain (funk, val, proto) {
    return {
      bazcont:proto.chain((innerbaz) => {
        return funk(innerbaz.bazVal).bazcont
      }, val.bazcont)
    }
  },
  lift (val, proto) {
    return {bazcont:proto.chain((innerValue) => proto.of({bazVal: innerValue}), val)}
  }
}

var foo = {
  name: 'foo',
  of (val, proto) { return proto.of({fooVal: val }) },
  chain (funk, val, proto) {
    return proto.chain((innerfoo) => {
      return funk(innerfoo.fooVal)
    }, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({fooVal: innerValue}), val)
  },
  wrap (val, proto) {
    return proto.of(val)
  }
}

var bar = {
  name: 'bar',
  of (val, proto) { return proto.of({barVal: val }) },
  chain (funk, val, proto) {
    return proto.chain((innerbar) => {
      return funk(innerbar.barVal)
    }, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({barVal: innerValue}), val)
  },
  wrap (val, proto) {
    return proto.of(val)
  }
}

var baz = {
  name: 'baz',
  of (val, proto) { return proto.of({bazVal: val }) },
  chain (funk, val, proto) {
    return proto.chain((innerbaz) => {
      return funk(innerbaz.bazVal)
    }, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({bazVal: innerValue}), val)
  },
  wrap (val, proto) {
    return proto.of(val)
  }
}

const testTwo = (fooWrapped, barWrapped) => {
  return (test) =>{
    const stack = createStack([fooWrapped, barWrapped])
    const fooWrappedVal = stack.of(fooWrapped, 5)
    const barWrappedVal = stack.of(barWrapped, 5)
    const fooWrappedbarWrappedVal = stack.of(barWrapped, 5)
    test.deepEqual(stack.lift(barWrapped, barWrappedVal), barWrappedVal, "Lift does nothing for values of the inner type")

    test.deepEqual(stack.lift(fooWrapped, fooWrappedVal), fooWrappedbarWrappedVal, "Lift works for the outer value of stacks of two items.")
    test.done()
  }
}
const testThree = (fooWrapped, barWrapped, bazWrapped) =>
  (test) => {
    const stack = createStack([fooWrapped, barWrapped, bazWrapped])
    const fooWrappedVal = stack.of(fooWrapped, 5)
    const barWrappedVal = stack.of(barWrapped, 5)
    const bazWrappedVal = stack.of(bazWrapped, 5)
    const fooWrappedbarWrappedVal = stack.of(barWrapped, 5)
    const fooWrappedbarWrappedbazWrappedVal = stack.of(bazWrapped, 5)
//    test.deepEqual(stack.lift(fooWrapped, fooWrappedVal), fooWrappedbarWrappedbazWrappedVal, "Lift works for the outer value of stacks of three items.")
    test.deepEqual(stack.lift(barWrapped, fooWrappedbarWrappedVal), fooWrappedbarWrappedbazWrappedVal, "Lift works for the middle value of stacks of three items.")

    test.done()
  }

const monads = [foo, bar, baz, fooWrapped, barWrapped, bazWrapped, comp.list]

const stacks = combinatorics.permutation(monads, 3).toArray()
/*const stacks = [
  [fooWrapped, comp.list, foo]
]
*/
module.exports = stacks.reduce((obj,stack) => {
  obj[stack.map(s=>s.name).join('')] = testThree.apply(null, stack)
  return obj
}, {})
