
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
  value(fn, task) {
    debugger
    task.fork((a)=>a, fn)
  },
  rejectedMap(fn, val) {
    return new Task.of(val).rejectedMap(fn)
  },
  fromTask(fn) {
    debugger
    return new Task(fn)
  },
  rejected: Task.rejected
}
