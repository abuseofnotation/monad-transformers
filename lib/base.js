
const Task = require('data.task')

// A monad definition that wires a 'data.task' instance as a base for a transformer stack
exports.task = {
  // (val) => Task(val)
  of: Task.of,
  // (val => Task(val), Task(val)) => Task(val)
  chain(fn, task) {
    return task.chain(fn)     
  },
  // (val) => Task(val)
  lift: Task.of,

  // ((val) => otherVal, Task(val)) => otherVal
  value (fn, task) {
    task.fork((a)=>a, fn)
  },
  run (fn, task) {
    task.fork((a)=>a, fn)
  },
  fold (value, val) {
    return value(val)
  },
  fromTask(fn) {
    if(typeof fn !== 'function') {throw fn + ' is not a function'}
    return new Task(fn)
  },
  cont (fn, val) {
    const fnVal = fn(val)
    if(typeof fnVal !== 'function') {throw fnVal + ' is not a function'}
    return new Task(fnVal)
  },
  rejected: Task.rejected
}

// The identity monad, which is used by default as a base
exports.id = {
  name: 'root',
  of (val) {
    return val
  },
  chain (funk, val) {
    return funk(val)
  },
  map (funk, val) {
    return funk(val)
  },
  value (funk, val) {
    return funk(val)
  },
  run (funk, val) {
    return funk(val)
  },
  fold (value, val) {
    return value(val)
  }
}
