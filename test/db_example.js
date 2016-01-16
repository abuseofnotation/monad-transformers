/* # Database Example
 *
 * The following examples show performing async database operations using the library.
 *
 * ## Mocking our DB
 * 
 * For the sake of this example we will be mocking a simple DB REST API with a set of resources defined in the `data`
 * object and a function that simulates retriving a resource asynchronously - `getResource`. 
 * 
 * Our task will be related to retrieving info about the users and their occupations and handling different kinds
 * of errors.
 */
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}

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
const getResource = (url, error, success ) =>
    setTimeout(() => data[url]!== undefined ? success(data[url]) : error({error:`Invalid URL - ${url}`}), 10)

/* ## Defining some helpers
 * 
 * Before we start, let's require the library, and define several helpers that we will use.
 *
 * - `mGetResource` is just a curried version of the function that we defined in the mock. 
 * - `suffix` is a function for concatenating strings, which we can use to construct a URL of a given resource.
 */

const mGetResource = (url) => getResource.bind(null, url)

const suffix = (suffix) =>
  (str) => suffix + str

/* It is not such a long shot to imagine combining these two functions to get a function that retrieves a resource
 * given its ID. 
 *
 * We can do this either by using simple function composition:
 */

const compose = (f, g) => (a) => g(f(a))
const _getResourceFrom = compose(suffix, mGetResource)

/* Now, the `_getResourceFrom` function itself cannot be composed via simple function composition, simply
 * because it is asynchronous. 
 *
 * However it *can* be composed in principle, and we do that quite often in Javascript. You know - using Promises.
 *
 * mtl supports Promises too - more precisely their immutable conterparts - Tasks. So we can wrap our normal callback-
 * based async function into a task and just return it, using `chain` (which is kinda like `then` for Promises).
 */

const Task = require('data.task')

const __getResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type + '/'))
    .chain((url) => m.fromTask(new Task(mGetResource(url))))
/*
 * All this typically happens behind the scenes, as the `cont` function enables you to compose the asynchronous
 * function directly, just like in the previous example:
 */
const getResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type + '/'))
    .tellMap((url) => `Retrieving ${url}... `) //Ignore this line for now
    .cont(mGetResource)
/*
 * 
 * This is the final version of the function and I would like to make several remarks:
 *
 * - It is written in such a way that we expect the `getResourceId` parameter to already be wrapped in a monad. 
 * In that way we can define our monad globally and edit it as we please. 
 * 
 * - You also don't have to know what Task lib is being used - you just use the `cont` helper.
 *
 * - We haven't lost the ability to do normal function composition. We can do this by using the `map` 
 * function, provided by mtl, and functions, composed with `map` don't have to know about monads and wrappers at all.
 *
 * We will define one more helper function. One that given a user object, retrieves info about its occupation.
 * The function is simple - just retrieve the `occupation` key from the person object and then make a request for
 * it from the `occupations` endpoint (see above).
 *
 * And the function again presumes that we are using mtl. 
 *
 * Well if we do, than there is a function the Maybe monad transformer which we can use - the `maybeGet` method for
 * retrieving a property of an object. This means is that we can define our function simply by chaining.
 * Bonus - the method handles the cases when the value of the requested property is not defined.
 */

const getOccupationInfo = (mPersonalInfo) =>
  mPersonalInfo.maybeGet('occupation')
    .tap(getResourceFrom('occupations'))

/* Notice also how we compose monadic functions by using `tap`. `tap` is nothing hard - it just calls the 
 * specified function with the current value as an argument.
 *
 * ## Writing our program
 *
 * Now let's take our util functions for a spin, shall we? It is time to stop theorizing and write some "real" code 
 * that does something useful. For example retrieve the details for a given user, retrieve the details of his 
 * occupation and display both things one after another. Do you want to do that? 
 *
 * OK, I guess it is time to request the mtl library then: 
 */

const m = require('../lib/main').advanced

const getPersonInfo = (name) =>
  m.of(name)
    .tap(getResourceFrom('users'))
    .chain((personDetails) => 
      getOccupationInfo(m.of(personDetails))
        .map((occupationInfo) => `${personDetails.name} ${occupationInfo.description}` ))
/*
 * There is nothing new in this function. Let`s review it line by line, as a summary of this
 * tutorial:
 *
 * - We begin by puttin a regular value into a monad, using the `of` function.
 * - Again, tap is just a way to compose two monadic functions together. So this next line is
 *   equivalent with `getResourceFrom('users')(m.of(name))`
 * - With `chain` we chain a function that receives a normal value and returns a monadic value.
 *   `chain` is actually the quintessential monadic function, so there is a lot of info available
 *   about it.
 * - When we are calling `chain` we have to return a monadic value, and we do.
 *   Again when you have a function that works in a monadic context, and you want to use it with 
 *   a normal value, you just wrap the value in a monad before feeding it to the function.
 * - We transform the value before returning it, using a "plain", non-monadic function, and the way
 *   to chain plain functions which aren't meant to be used inside a monad is by using `map`
 *   in the same way as `Array.map` is used to chain functions which don't work on arrays by 
 *   themselves. 
 *
 *   Using `map` inside the `chain` lambda or outside it is equivalent. We do it inside just because
 *   we want to be able to use the `personalDetails` object.
 *
 * ## What we did
 *
 * Now we will test our little function and make sure that it works fine. The function returns a monad
 * which contains our value, so we will want to take the value out of the monad. We do this by using 
 * the `run` function, which accepts a normal callback:
 */

exports.dbSuccess = (test) =>
  getPersonInfo('john')
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal[0][0], 'John writes code')
      test.done()
    }) 
/* 
 * I better explain the `taskSuccess.maybeVal[0][0]` part.
 *
 * Each monad transformation which we use (or don't) defines its own object namespace. In that namespace 
 * is its value, which is actually the namespace of another monad. So effectively this means that 
 * we have to go through all namespaces to get to our value. Why not just return the value directly? 
 * Beacause each layer contributes something to our program
 * 
 * Consider the following:
 *
 * ### Handling errors
 *
 * If we try to retrieve information abot a person that does not exist. The task will handle the error
 * by stopping the computation and you will find the error in the `taskError` property:
 */

exports.dbError = (test) =>
  getPersonInfo('UndefinedPerson')
    .run((result) => {
      test.equal(result.taskError.error, 'Invalid URL - users/UndefinedPerson') 
      test.done()
    }) 


/* 
 * ### Handling undefined properties
 * 
 * The Maybe monad transformer handles undefined values in much the same way as the Task handles errors -
 * it stops everything. In that way we can retrieve values that are undefined, and not get any errors.
 * We have to do a null check only once. 
 *
 */
exports.dbMaybe = (test) =>
  getPersonInfo('max')
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal, undefined)
      test.done()
    }) 


/* ## Logging
 *
 * Remember that our `getResourceFrom` function had one line which we ignored:
 *
 * `.tellMap((url) => 'Retrieving ${url}')`
 *
 * this line actually logs the url being requested by using the Writer monad.
 *
 * Sure enough, the log is part of the end result:
 */
exports.dbLog = (test) =>
  getPersonInfo('john')
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal[1], 'Retrieving users/john... Retrieving occupations/developer... ')
      test.done()
    }) 

/*
 * Logging is not the only use of the Writer monad. As a matter of fact, we can store
 * our whole result there:
 */

const wGetResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type + '/'))
    .cont(mGetResource)

const wGetOccupationInfo = (mPersonalInfo) =>
  mPersonalInfo.maybeGet('occupation')
    .tap(wGetResourceFrom('occupations'))

const writePersonInfo = (name) =>
  m.of(name)
    .map(suffix('users/'))
    .cont(mGetResource)
    .tellMap((userInfo) => userInfo.name)
    .tell(" ")
    .tap(wGetOccupationInfo)
    .tellMap((occupationInfo => occupationInfo.description))

exports.dbWriter = (test) =>
  writePersonInfo('john')
    .tell(", ")
    .kleisi(writePersonInfo('jim'))
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal[1], 'John writes code, Jim feeds the animals')
      test.done()
    }) 


