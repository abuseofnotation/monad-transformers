/*
 * Ahh, the TODO app. How many frameworks were demonstrated with it. It may seem like a cliche, but it is helpful.
 * So how to go with it?
 */

/*
 * Most of the applications that we write are dynamic - they constantly receive input and output.
 * 
 * Such applications cannot be purely functional, that is they must feature an imperative core that takes care 
 * of rendering and interactivity. 
 *
 * Our job is to model the application such that this core is trivial. Monads are NOT used to 
 * model the imperative part - they are used to model the rest of the application.
 *
 * Assume that we have a function that get's called for every user action (a kind of universal event handler):
 * 
 * Then we can use the following as out imperative core:
 */

const mtl = require("../lib/main.js")
const m = mtl.advanced

var appState = m.of()
const onUserAction = (a) => {
  appState = appState.chain(processAction(a))
  document.innerHTML = ''
  document.appendChild = render(appState)

}


