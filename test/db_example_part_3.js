/* 
 * # Example Part 3 - Side effects
 *
 * _Creating custom monads._
 *
 * The monadic functions that we used so far were really cool and all, but they were just functions, albeit
 * asynchronous. They only received input at the beginning and did not place any output until the end.
 * Technically they were not pure (because they accessed and modified external resources), but they were
 * pretty close.
 * 
 * Now we are going to do something different - a procedure that is in constant connection with the outside
 * world. We are going to do dynamic IO.
 *
 * Now in the previous example we handled side effects using the "Reader" monad. 
 * Aside from the fact that we were abusing the monad (the environment in `Reader` is supposed
 * to be immutable). This approach wasn't bad
 * at all - outside of the function we could specify what part of the environment it was permitted to 
 * touch, and from inside the function we could regulate which parts of the code had access to 
 * it. For example functions we call using `map` cannot touch the environment (unless we loaded it 
 * beforehand using `loadEnvironment`).
 * 
 * For our next task - IO - we also have an environment on which we act on - the `process`object in node.
 * so we will once again use `Reader`, 
 *
 * Only we are going to modify it just a little bit, so it fits our needs exactly.
 *
 * We are going to start with the original implementation:
 */
const mtl = require("../lib/main.js")
process.stdin.setEncoding('utf8');
const util = require('util');
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const reader = {
  name: 'Reader',
  //Standard functions:
  of (val) {
    return (env) => this.outer.of(val)
  },
  chain (funk, reader) {
    return (env) =>
      this.outer.chain((val) => {
        return funk(val)(env)
      }, reader(env))
  },
  lift (val) {
    return (env) => val
  },
  run (f, reader) {
    return f(reader(this.environment))
  },
  fold (value, val) {
    return value(val)
  },
  //Custom functions:
  readerMap (f, val) {
    return (environment) => this.outer.of(f(val, environment))
  },
  loadEnvironment(val) {
    return (environment) => this.outer.of(environment)
  }
}

/*
 * The core of the definition are a bunch of standard functions which define things like, how to "wrap"
 * a plain normal values in a `Reader` (`of` and `lift`),
 * how to `run` an already-created `Reader` and most importantly, how to apply a function which takes a
 * normal plain value and returns an instance of `Reader` to an already-created `Reader`(`chain`), but
 * it also contains a couple of custom functions, (helpers if you will), 
 * These are the ones we actually use.
 *
 * Let's see how far can we go by keeping the standard functionality as-is and only define a new set
 * of helpers, which are more DOM-friendly.
 *
 * So let's begin by copying the reader monad:
 */
var dom = reader
/*
 * Change the name, so we don't confuse the two monads while debugging:
 */
dom.name = 'StdinStdout'
/*
 * And lastly, we are also going to patch the `run` method so our new monad uses the `process`
 * global variable as its environment. We are leaving the possibility to mock our `process`
 * object if we want to.
 */
dom.run = function run (f, reader) {
  return f(reader(this.process || global.process))
}
/*
 * The standars `Reader` helpers provide direct access to the environment to the functions we compose.
 * Which is OK if the environment is immutable - our users can see it but they cannot touch it - but
 * not OK in the current case, because we prefer to keep our side effects inside the monad's
 * implementation. So let's just remove them and start from scratch:
 */
delete dom.readerMap
delete dom.loadEnvironment
/* 
 * If we wanted to keep them, we would have to change their names, again to avoid conflicts
 * with the original `Reader`.
 *
 * Our IO  monad transformer is done, all we have to do is define some helpers that will make it
 * more usable. We will keep it simple - one method to write in the standard output and one to read
 * from the standard input.
 *
 * The writing part is trivial.
 *
 */
dom.write = function (f, val) {
  return (process) => {
    process.stdout.write(f(val))//Perform side effect
    return this.outer.of(val)//Return val
  }
}
/*
 * The reading part is a bit harder, because the input is asynchronous.
 * So how do we "return" the input if it is not there yet? 
 * One way to do it is to return a continuation instead and then
 * handle this continuation externaly using the task monad. 
 *
 * It will look like this:
 */
dom.promptFor = function (f,val) {
  return (process) => {
    process.stdout.write(f(val))
    return this.outer.of((error, success) => {
      process.stdin.resume()
      process.stdin.on('data', function (text) {
        process.stdin.pause()
        success(util.inspect(text))
      })
    })
  }
}
/* 
 * And it can be used like this:
 */
const m = mtl.make(mtl.base.task, dom)

const getUsername = () =>
  m.of()
    .promptFor(()=> 'Username: ')
    .chain((usernameContinuation) => m.fromContinuation(usernameContinuation))
    .write((username) => `Your username is "${username}"`)

/* 
 * By now you probably know that although the second step is redundant it 
 * has to be there in order for 
 * our transformations to act independently of one another, and to be usable
 * by themselves.
 *
 * What you may not know is that they don't have to be independent.
 *
 * When several monad transformers are chained, their transformations are 
 * applied sequentially. This means that each transformation has access to 
 * and can trigger all previous (or "outer") transformations.
 *
 * The ordering in this library is left to right, so if we 
 * have a stack like `mtl.base.task, dom` then we can use the `Task` monad transformer
 * in the implementation of the `dom` monad transformer.
 *
 * Let's redefine the `promptFor` method so it creates a Task directly:
 */
dom.promptFor = function (f,val) {
  return (process) => {
    process.stdout.write(f(val))
    return this.outer.fromContinuation((error, success) => {
      process.stdin.resume()
      process.stdin.on('data', function (text) {
        process.stdin.pause()
        success(util.inspect(text))
      })
    })
  }
}
const mNew = mtl.make(mtl.base.task, dom)
const getUsernameNew = () =>
  mNew.of()
    .promptFor(()=> 'Username: ')
    .write((username) => `Your username is "${username}"`)

getUsernameNew().run()

/*
 * What is also cool is that each new transformation "inherits" the methods of the 
 * previous transformations, which means that the dom transformation will work on any
 * arbitrary stack, as long as it includes the `Task` transformer.
 *
 * For example let's include some transformations that will enable us to run some of
 * our previous examples:
 *
 */
