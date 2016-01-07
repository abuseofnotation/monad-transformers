
const Task = require('data.task')

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
  fromTask(fn) {
    return new Task(fn)
  },
  cont (fn, val) {
    return new Task(fn(val))
  },
  rejected: Task.rejected
}
