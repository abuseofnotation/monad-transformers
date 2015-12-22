if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const mtl = require('../lib/main')

const eventualIncrement = (val) => 
  (reject, resolve) => {
    setTimeout(() => resolve(val+1), 10)
  }

exports.advanced = {

  of (test) {
    mtl.advanced.of(3)
      .map((val) => val + 1)
      .value((val) => {
        test.equal(val, 4)
        test.done()
      })
  },
  fromTask (test) {
    mtl.advanced.fromTask((reject, resolve) => {
      setTimeout(() => resolve(3), 10)
    })
      .map((val) => val + 1)
      .value((val) => {
        test.equal(val, 4)
        test.done()
      })
  },
  error (test) {
    mtl.advanced.fromTask((reject, resolve) => {
      setTimeout(()=>reject(3), 10)
    })
      .map((val) => val + 1)
      .rejectedMap((a) => {
        test.equal(a, 3)
        test.done()
      })
      .value()

  },
  stateIntegration (test) {
    mtl.advanced.fromTask((reject, resolve) => {
      setTimeout(()=>resolve(3), 10)
    })
    .save()
    .rejectedMap(a => {
      test.ok(false)
      return a
    })
    .chainAsync((val) => eventualIncrement(val))
    .mapStateful((val, state) => {
      test.equal(state, 3)
      test.equal(val, 4)
      return [val, state]
    })
    .chain((val) => {
      return mtl.advanced.rejected()
    })
    .rejectedMap(a => {
      test.done()
    })
    .value()
  }
  
}
