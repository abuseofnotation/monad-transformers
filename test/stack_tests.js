var combinatorics = require('js-combinatorics')
var createStack = require('../lib/stack')
var comp = require('../lib/comp')

var fooWrapped = {
  name: 'fooWrapped',
  of (val, proto) { 
    return {foocont:proto.of({fooVal: val })}
  },
  chain (funk, val, proto) {
    if(val.foocont === undefined){throw "Invalid input"}
    return {
      foocont:proto.chain((innerfoo) => {
        const val = funk(innerfoo.fooVal)
        if(val.foocont === undefined){ throw "Invalid input"}
        return val.foocont
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
    if(val.barcont === undefined){throw "Invalid input"}
    return {
      barcont:proto.chain((innerbar) => {
        const val = funk(innerbar.barVal)
        if(val.barcont === undefined){ throw "Invalid input"}
        return val.barcont
      }, val.barcont)
    }
  },
  lift (val, proto) {
    return {barcont:proto.chain((innerValue) => proto.of({barVal: innerValue}), val)}
  }

}


var bazWrapped = {
  name: 'bazWrapped',
  of (val, proto) { 
    return {bazcont:proto.of({bazVal: val })}
  },
  chain (funk, val, proto) {
    if(val.bazcont === undefined){throw "Invalid input"}
    return {
      bazcont:proto.chain((innerbaz) => {
        const val = funk(innerbaz.bazVal)
        if(val.bazcont === undefined){ throw "Invalid input"}
        return val.bazcont
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

const testTwo = (one, two) => {
  return (test) =>{
    const stack = createStack([one, two])
    const oneVal = stack.of(one, 5)
    const twoVal = stack.of(two, 5)
    const onetwoVal = stack.of(two, 5)
    test.deepEqual(stack.lift(two, twoVal), twoVal, "Lift does nothing for values of the inner type")

    test.deepEqual(stack.lift(one, oneVal), onetwoVal, "Lift works for the outer value of stacks of two items.")
    test.done()
  }
}
const testThree = (one, two, three) =>
  (test) => {
    const stack = createStack([one, two, three])
    const oneVal = stack.of(one, 5)
    const onetwoVal = stack.of(two, 5)
    const onetwothreeVal = stack.of(three, 5)
    test.deepEqual(stack.lift(one, oneVal), onetwothreeVal, "Lift works for the outer value of stacks of three items.")
    test.deepEqual(stack.lift(two, onetwoVal), onetwothreeVal, "Lift works for the middle value of stacks of three items.")


    // lift . return = return
    // test.deepEqual( stack.lift(one,stack.of(one,5)), stack.of(one,5), "First law")
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
