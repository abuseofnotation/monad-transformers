/*
 * Ahh, the TODO app. How many frameworks were demonstrated with it. It may seem like a cliche, but it is helpful.
 * So how to go with it?
 */

/*
 * ## Interlude: an architecture for dynamic applications.
 *
 * Dynamic applications (ones that constantly receive input and output) can be modelled using the notions of 
 * an event stream (or an observable object). 
 *
 * Assume that we have a function that get's called for every user action (a kind of universal event handler):
 *
 * What we can do is to write the following in this function:
 */

var val = m.of()
const onUserAction (a) => ( val = val.chain(processAction(a).run()) 

/*
 * And `processAction` will be the rest of our app.
 */

