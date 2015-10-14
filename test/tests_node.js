exports.basic = require("./basic")
if (global.v8debug) {
  global.v8debug.Debug.setBreakOnException()
}
global.tests = module.exports
