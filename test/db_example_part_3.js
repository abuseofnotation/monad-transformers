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
 * For our next task - DOM manipulation - we also have an environment on which we act on - a DOM node.
 * so we will once again use `Reader`, 
 *
 * Only we are going to modify it just a little bit, so it fits our needs exactly.
 *
 * We are going to start with the original implementation:
 */
const mtl = require("../lib/main.js")
const m = mtl.advanced

var reader = {
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
dom.name = 'DOM'
/*
 * And lastly, we are also going to patch the `run` method so our new monad grabs its environment
 * a different property of the run context. We do this because we want to be able to use our new
 * monad along with the original Reader and specify different environments.
 */
dom.run = function run (f, reader) {
  return f(reader(this.node))
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
 * Our DOM monad transformer is done, all we have to do is define some helpers.
 *
 * Now that we know that the environment for this reader is going to be a DOM node,
 * we can add some DOM-specific methods to it.
 *
 * For example we want to have a function accepting a lambda which returns
 * a string and setting the string as the node's `innerHTML`.
 
 * We can call this one `renderTemplate`, because it renders the value, using the lambda
 * function as a template (notice that `f` is a pure function - has no access to the node)
 */
dom.renderTemplate = function (f, val) {
  return (node) => {
    //Perform the side effect.
    node.innerHTML =''
    node.appendChild(f(val)) 
    //Return the same value.
    return this.outer.of(val) 
  }
}
/*
 * Sometimes we may have constructed the node before and may want to just insert it in the DOM
 * directly. It may be worth it to define this as a helper:
 */
dom.render = function (val) {
  return this.renderTemplate(a => a, val)
}
/*
 * We have a function that does output, now we need one that receives input from the DOM.
 * How do we take input from the DOM without having access to the DOM itself?
 * One way to do this is to use the element ID:
 */
dom.getFieldValue = function (f, val) {
  return (node) => {
    //Perform the side effect.
    const fieldValue = node.getElementById(f(val)).value
    //Return the same value.
    return this.outer.of(fieldValue) 
  }
}

/*
 * Let's see how we would use it
 * Now lets write a simple program
 */

const insertField = () =>
  m.of().chain(() => {
    div = document.createElement('div')
    return m
      .render(div)
      .cont((error, success) => (div.onClick = success))
  })


