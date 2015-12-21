if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const mtl = require('../lib/main')

exports.asyncStack = {

  of (test) {
    mtl.async.of(3)
      .map((val) => val + 1)
      .value((val) => {
        test.equal(val, 4)
        test.done()
      })
  },
  fromTask (test) {
    mtl.async.fromTask((reject, resolve) => {
      setTimeout(()=>resolve(3), 10)
    })
      .map((val) => val + 1)
      .value((val) => {
        test.equal(val, 4)
        test.done()
      })
  }
  
}
