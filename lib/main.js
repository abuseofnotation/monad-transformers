const mtl = {}
mtl.base = require('./base')
mtl.id = require('./id')
mtl.data = require('./data')
mtl.comp = require('./comp')
mtl.make = require('./wrapper')
module.exports = mtl


mtl.simple = mtl.make(mtl.data.maybe, mtl.data.writer)
mtl.stateful = mtl.make(mtl.data.maybe, mtl.data.writer, mtl.comp.state)
mtl.list = mtl.make(mtl.data.list, mtl.data.maybe, mtl.data.writer)
mtl.statelist = mtl.make(mtl.data.list, mtl.data.maybe, mtl.data.writer, mtl.comp.state)

mtl.advanced = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.state)
mtl.advanced.prototype.rejectedMap = function(fn) {
  return mtl.advanced(() => this._value().rejectedMap(fn))
}
