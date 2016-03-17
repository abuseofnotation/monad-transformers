
/* 
 * # Dynamic
 *
 * #### Creating custom monads. 
 *
 * _This is part 4 from the `monad-transformers` tutorial. See also [part 1](p1.md), [part 2](p2.md) and 
 * [part 3](p3.md)._
 *
 * Most of the applications that we write are dynamic - they constantly receive input and output.
 * And a breed of especially dynamic applications are the GUI applications. 
 *
 * In command-line applications you prompt the user when it is OK to contact you. In graphical user interfaces
 * you just cannot stop him from clicking. And you cannot ignore his actions either, because he will complain
 * that the app isn't responsive.
 * 
 * ## Interlude: Purely-functional
 *
 * By now you probably realized that real applications cannot be purely functional, that is they must 
 * feature core that that takes care of side effects
 * (Haskell applications are called purely functional because that code is inside the Haskell runtime itself). 
 * Our job is to model the application such that this core is as trivial. Monads are NOT used to 
 * perform side effects - they are used to contain them.
 *
 * ## Our runtime.
 *
 * In the previous part of the tutorial we started writing our application by defining some pure functions 
 * and then we went on to connect it to the outside world. This time we will start out the opposite way -
 * we will define our side-effect handling functions first and then proceed to build a monad transformer that
 * handles them and a simple application.
 *
 * Our runtime will be as simple as possible.
 *
 * It will constitute of one function called `input` that get's called for every user action
 * (a kind of universal event handler)
 * and one function called `output` that we must use to render a new UI on screen. The main
 * difference between dynamic or interactive applications and non-dynamic ones is that here
 * `input` and `output` are not related. That is, you can produce input several times before you get
 * any output (for example when you have to fill several fields)
 * and you can receive output out of the blue (for example if a slow request from the server
 * finally arrives, or when someone else edits the same object that you have opened).
 *
 * More formally, `runtime` is a function which accepts a function called `input` and returns a
 * function called output.
 *
 * The `input` function is written by us. 
 * It accepts some object that represents a user action (an event if you will) and does not return anything.
 *
 * The `output` function is given to us by the runtime.
 * It accepts some object that represents a DOM node and again does not return anything.
 *
 */
const runtime = (input) => (node) => {
  document.appendChild(node)
}
/*
 *
 *
 * One thing that we have to take into account is that in order for the `output` function to remain pure
 * it must only deal with immutable values. That is it should not modify the DOM directly. A way to escape
 * this is to rerender the DOM every time the function is called. This is problematic from a performance point
 * of view, but
 */

const react = require('react')
/*
 * With React, our runtime function becomes very simple
 */

const runtime = () => {
  const component = createClass({render(ui){return ui}})
  return {component, output:(node) => {
    component.render(node)
  }}
}



const mtl = require("../lib/main.js")
