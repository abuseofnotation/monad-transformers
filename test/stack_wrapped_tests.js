var createStack = require('../lib/stack')
var comp = require('../lib/comp')
module.exports = {
  dev(test){
    const stack = createStack([fooWrapped, barWrapped])
    const fooWrappedVal = stack.of(fooWrapped, 5)
    const barWrappedVal = stack.of(barWrapped, 5)
    const fooWrappedbarWrappedVal = stack.of(barWrapped, 5)
    debugger
    test.deepEqual(stack.lift(barWrapped, barWrappedVal), barWrappedVal, "Lift does nothing for values of the inner type")

    test.deepEqual(stack.lift(fooWrapped, fooWrappedVal), fooWrappedbarWrappedVal, "Lift works for the outer value of stacks of two items.")
    test.done()
  },
  stackThreeWrapped (test){
    const stack = createStack([fooWrapped, barWrapped, bazWrapped])
    const fooWrappedVal = stack.of(fooWrapped, 5)
    const barWrappedVal = stack.of(barWrapped, 5)
    const bazWrappedVal = stack.of(bazWrapped, 5)
    const fooWrappedbarWrappedVal = stack.of(barWrapped, 5)
    const fooWrappedbarWrappedbazWrappedVal = stack.of(bazWrapped, 5)
    test.deepEqual(stack.lift(fooWrapped, fooWrappedVal), fooWrappedbarWrappedbazWrappedVal, "Lift works for the outer value of stacks of three items.")
    test.deepEqual(stack.lift(barWrapped, fooWrappedbarWrappedVal), fooWrappedbarWrappedbazWrappedVal, "Lift works for the middle value of stacks of three items.")

    test.deepEqual(stack.last.chain((a) =>  fooWrappedbarWrappedbazWrappedVal, fooWrappedbarWrappedbazWrappedVal), fooWrappedbarWrappedbazWrappedVal, "Chain works for stacks of three items")
    test.deepEqual(stack.last.map((a) => a, fooWrappedbarWrappedbazWrappedVal), fooWrappedbarWrappedbazWrappedVal, "Map works for stacks of three items")
    test.done()
  }
}

var fooWrapped = {
  name: 'foo',
  of (val, proto) { 
    return {foocont:proto.of({fooVal: val })}
  },
  chain (funk, val, proto) {
    debugger
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
  name: 'bar',
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
    return {barcont:proto.chain((innerValue) => proto.of({barVal: innerValue}), val)}
  }
}


var bazWrapped = {
  name: 'baz',
  of (val, proto) { 
    return {bazcont:proto.of({bazVal: val })}
  },
  chain (funk, val, proto) {
    return {
      bazcont:proto.chain((innerfoo) => {
        return funk(innerbaz.fooVal).bazcont
      }, val.bazcont)
    }
  },
  lift (val, proto) {
    return {bazcont:proto.chain((innerValue) => proto.of({fooVal: innerValue}), val)}
  }
}

var foo = {
  name: 'foo',
  of (val) { return {fooVal: val } },
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
