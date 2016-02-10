if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const mtl = require('../lib/main')
const eventualIncrement = (val) => 
  (reject, resolve) => {
    setTimeout(() => resolve(val+1), 10)
  }

//mtl.advanced = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.state)
exports.advanced = {
  of (test) {
    mtl.advanced.of(3)
      .map((val) => val + 1)
      .value((val) => {
        test.equal(val, 4)
        test.done()
      })
  },
  fromContinuation (test) {
    mtl.advanced.fromContinuation((reject, resolve) => {
      setTimeout(() => resolve(3), 10)
    })
      .map((val) => val + 1)
      .value((val) => {
        test.equal(val, 4)
        test.done()
      })
  },
  error (test) {
    mtl.advanced.fromContinuation((reject, resolve) => {
      setTimeout(()=>reject(3), 10)
    })
      .map((val) => val + 1)
      .value({onTaskError:(a) => {
        test.equal(a, 3)
        test.done()}
      })

  },
  stateIntegration (test) {
    mtl.advanced.fromContinuation((reject, resolve) => {
      setTimeout(()=>resolve(3), 10)
    })
    .saveState()
    .cont((val) => eventualIncrement(val))
    .statefulMap((val, state) => {
      test.equal(state, 3)
      test.equal(val, 4)
      return [val, state]
    })
    .chain((val) => {
      return mtl.advanced.rejected()
    })
    .value({onTaskError:a => {test.done()}
    })
  }
}



