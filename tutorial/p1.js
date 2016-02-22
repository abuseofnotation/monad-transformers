/* 
 * # Retrieving REST Resources
 *
 * #### Using the monad stack. Using the `Task` monad, the `Maybe` monad and the `Writer` monad.
 * 
 * _This is part 1 from the `monad-transformers` tutorial. See also [part 2](p2.md) and [part 3](p3.md)._
 *
 *
 * The following series of tutorials show performing some real-world tasks using the `monad-transformers` library.
 * Our first task will be related to retrieving resources from a RESTful service and handling different kinds
 * of errors.
 *
 * ## Mocking our Data
 *
 * Below is a simple simple fake REST API with a set of resources defined in the `data`
 * object and functions that simulate retriving and modifying resources asynchronously.
 * We will be working with this service throughout the tutorial.
 */
const mtl = require('../lib/main')
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const initData = () => {
  const data = {
    'users/john': {
      name:'John',
      occupation: 'developer'
    },
    'users/max': {
      name: 'Max' //Has no occupation
    },
    'users/jim': {
      name:'Jim',
      occupation: 'farmer'
    },
    'occupations/developer': {
      description: 'writes code'
    },
    'occupations/farmer': {
      description: 'feeds the animals'
    }
  }
  return {
    getResource (url, error, success) {
      setTimeout(() => data[url]!== undefined ? success(data[url]) : error({error:`Invalid URL - ${url}`}), 10)
    },
    postResource (url, value, error, success) {
      setTimeout(() => { data[url] = value; success(value) }, 10)
    }
  }
}
const data = initData()

/* ## Defining some helpers
 * 
 * Before we start with our first task let's define several helpers that we will use.
 * This is an important technique in functional programming - to define as much of our code as possible using pure
 * functions.
 */

const mGetResource = (url) => data.getResource.bind(null, url)

const suffix = (suffix, str) => suffix + '/' + str

/*
 * - `mGetResource` is just a curried version of the function that we defined in the mock. 
 *
 * - `suffix` is a function for concatenating strings, which we can use to construct a URL of a given resource.
 *
 * ### Composing functions with `monad-transformers`
 *
 * Another important technique in functional programming is the technique of combining different small functions using
 * composition. After looking at these two helpers, it is not such a long shot to imagine composing them into 
 * one function that retrieves a resource given its ID. Here is how this will work using simple function composition:
 */

const compose = (f, g) => (a) => g(f(a))
const ordinaryGetResourceFrom = compose(suffix, mGetResource)


/* This is cool however the `mGetResource` function is asynchronous and therefore it does not return a value.
 * Therefore the `ordinaryGetResourceFrom` function is also asynchronoust cannot be composed any further via simple function composition.
 *
 * However it *can* be composed in principle, and as a matter of fact we do that quite often in JavaScript. 
 * You know, using Promises. We pass an async functions to the `then` method, and then we chain another async function and
 * so on.
 *
 * The `monad-transformers` lib supports Promises too among other monads - more precisely their immutable conterparts 
 * [Tasks](http://docs.folktalejs.org/en/latest/api/data/task/index.html).  This means that we can wrap our normal 
 * callback-based async function in a Task and compose it, using [`chain`](../wrapper.md) (which is kinda like the `then` for 
 * Promises). 
 */

const Task = require('data.task')

const taskGetResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .chain((url) => m.fromTask(new Task(mGetResource(url))))
/*
 * There is a slightly prettier way to write the same function using the `cont` helper function, which creates a
 * Task behind the scenes.
 */
const getResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .tellMap((url) => `Retrieving ${url}... `) 
    .cont(mGetResource)
/*
 * A couple of remarks:
 *
 * - There is one unrelated line, beggining with `tellMap` which we will discuss later. 
 *
 * - The function is written in such a way that you don't have to know about which async lib is being used - 
 *   you just use the `cont` helper.
 *
 * - We haven't lost the ability to do normal function composition. We can do it by using the [`map`](../wrapper.md)
 * function. Functions, composed with `map` don't have to know about monads and wrappers at all.
 *
 * Using our newly-defined `getResouceFrom`, we will define one more helper function - 
 * one that given a person object, retrieves info about its occupation.
 * The function is simple - just retrieve the `occupation` key from the person object and then make a request for
 * it from the `occupations` endpoint. You can check the data model above, but basically we receive a plain JS object 
 * and  we have to access one of its properties. There is a helper for doing that in the `Maybe` monad transformer 
 * called `maybeGet`. The strength of `maybeGet` is that it also handles
 * the case when the value of the requested property is not defined.
 */

const getOccupationInfo = (mPersonalInfo) =>
  m.of(mPersonalInfo)
    .maybeGet('occupation')
    .chain(getResourceFrom('occupations'))

/* Notice also how we compose functions that return monads by using `chain`.
 *
 * ## Writing our program
 *
 * Now let's apply what we defined so far and write some code that actually does something.
 * The following snippet first retrieves the details for a given user then retrieve the details of his
 * occupation and finally displays both pieces of info one after the other:
 *
 */

const m = mtl.advanced 

const getPersonInfo = (name) =>
  m.of(name) //1
    .chain(getResourceFrom('users')) //2
    .chain((personDetails) => //3
      getOccupationInfo(personDetails) //4
        .map((occupationInfo) => `${personDetails.name} ${occupationInfo.description}` )) //5
/*
 * There should be nothing new for you in this snippet. Let`s review it line by line, as a summary of this
 * tutorial:
 *
 * 1. We begin by puttin a regular value into a monad, using the `of` function.
 *
 * 2. With `chain` we compose a function that receives a normal value and returns a monadic value.
 * `chain` is actually the quintessential monadic function, so there is a lot of info available
 * about it.
 *
 * 3. We `chain` again, this time with an inline function.
 *
 * 4. When we are calling `chain` we have to return a monadic value, and we do that.
 * Again when you have a function that works in a monadic context, and you want to use it with 
 * a "normal" value, you just wrap the value in a monad before feeding it to the function.
 *
 * 5. We transform the value before returning it, using a "plain", non-monadic function, and the way
 * to compose plain functions which aren't meant to be used inside a monad is by using [`map`](../wrapper.md)
 * in the same way as `Array.map` is used to apply functions which don't work on arrays by 
 * themselves, to Arrays. 
 *
 * Using `map` inside the `chain` lambda is equivalent to using it outside of it. We do it inside
 * just because we want to be able to use the `personalDetails` object.
 *
 * ## What we did
 *
 * Now we will test the `getPersonInfo` function and make sure that it works well. The function returns 
 * a monad which contains our value, so we will want to take the value out of the monad. We do this by using 
 * the `run` function which accepts a normal callback:
 */
exports.test = {}
exports.test.dbSuccess = (test) => getPersonInfo('john')
  .run((result) => {
    test.equal(result.taskSuccess.value.value.value, 'John writes code')
    test.done()
  }) 
/* 
 * Works fine but we better explain the `taskSuccess.value.value.value` part:
 * Each monad transformation which we use defines its own object namespace. In that namespace
 * we can see its value, which is actually the namespace of another monad. So effectively this means that 
 * in order to get to our value, we have to go through all these namespaces.
 * Why does't the library give you the value directly? 
 * Because, as you will find out shortly, each layer of the monadic onion contributes something to 
 * our program.
 * 
 * ### Handling errors
 *
 * If we try to retrieve information abot a person that does not exist the Task monad will handle the error
 * by stopping the computation. You will find the error in the `taskError` property:
 */

exports.test.dbError = (test) => getPersonInfo('UndefinedPerson')
  .run((result) => {
    test.equal(result.taskError.error, 'Invalid URL - users/UndefinedPerson') 
    test.done()
  }) 


/* 
 * ### Handling `undefined` properties
 * 
 * The Maybe monad transformer handles undefined values in much the same way as the Task handles errors -
 * it stops everything. In that way we can retrieve values that are `undefined`, and not get any errors for
 * trying to do something with them afterwards. We have to do a `null` check only once - at the end.
 *
 * For example here is what happens if we try to request a user that does not have an "occupation" field.
 *
 */
exports.test.dbMaybe = (test) => getPersonInfo('max')
  .run((result) => {
    test.equal(result.taskSuccess.value, undefined)
    test.done()
  }) 

/* 
 * Notice that although we performed some operations on the user after retrieving it, no exception was raised.
 *
 * ### Logging
 *
 * Remember that our `getResourceFrom` function had one line which we ignored:
 *
 * `.tellMap((url) => 'Retrieving ${url}')`
 *
 * this line actually logs the url being requested by using the `Writer` monad.
 * Sure enough, the log is part of the end result:
 */
exports.test.dbLog = (test) => getPersonInfo('john')
  .run((result) => {
    test.equal(result.taskSuccess.value.writer, 'Retrieving users/john... Retrieving occupations/developer... ')
    test.done()
  }) 

exports.initData = initData
exports.suffix = suffix

/*
 * Go to [Part 2](p2.md).
 */
