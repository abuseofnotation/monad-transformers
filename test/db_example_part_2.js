const mtl = require("../lib/main.js")
const m = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.reader)

/*
 */
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
const suffix = mtl.curry((suffix, str) => suffix + '/' + str)

/*
 * # Parametrizing the data source
 *
 * In the next part of my tutorial will make functions that modify the resources that they retrieve.
 * As you can see I included some of the resources from the previous tutorial.
 * I could not reuse more of it, because of the way that the `getResource` function was written:
 */

const data = initData()
const GetResource = (url) => data.getResource.bind(null, url)

/* Namely, the function is bound to a specific data source. This means that we won't be able to test our stuff
 * the way that we want to test it because we will have to always keep track of what in our data is 
 * changed. So let's fix it:
 */

const mGetResource = (url, data) => data.getResource.bind(null, url)

/*
 * So we just parametrized the function. Easy, right. Now we just have to specify the dataSource when we call it.
 */

/*
 * However, this breaks our workflow a bit. In the previous version of the tutorial we had this beautiful
 * `getResourceFrom` function that was quite handy:
 */
const getResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .tellMap((url) => `Retrieving ${url}... `) 
    .cont(mGetResource)
/*
 * Now, because this function calls `mGetResource`, it would also have to accept a dataSource and our whole code would 
 * start smelling bad. Unless there is a transformation that can handle this for us. 
 *
 * And as you might suspect, there
 * actually is one.
 *
 * In order to use it, let's first refactor our code a bit:
 */

const taskGetResourceFrom = (type) => 
  (id) => 
    m.of(suffix(type, id))
    .chain((url) => m.fromContinuation(mGetResource(url)))
/*
 * Remember this? This is the first version of the function that does not use the `cont` helper. Or it is close to it anyways -
 * this one uses another helper - the `fromContinuation` constructor).
 *
 * And this is the version that we will be using:
 */

const mGetResourceFrom = (type) => 
  (id) => 
    m.of(suffix(type, id))
     //.readerChain((url, data) => {debugger; return m.fromContinuation(mGetResource(url, data)) })
     .readerMap((url, data) => mGetResource(url, data)).chain(m.fromContinuation)

const mGetUser = mGetResourceFrom('users')

/*
 * So you see that we are not using `chain` anymore. Instead we are using `readerChain` - a helper function coming from the 
 * Reader monad transformation. The Reader monad transformation is the evil twin of the Writer monad transformation.
 * It gives us access to a immutable environment that we can use.
 * throughout our computation without bothering to pass it around.
 *
 * ## Monad transformers and the transformer stack
 *
 * That is all good, you might say, but why do we have to take a step back in order to use it? Why can't we still use our helper.
 * 
 * The reason for this is that we are combining the effects of two different monad transformers. And monad transformers aren't
 * related to each other, although it may seem so from a first glance.
 *
 * A monad constructor is defined just by specifying the transformations that it uses. and the order in which the data is
 * transformed.
 *
 * For example here is a monad constructor that we can use for this tutorial:
 */

//const m = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.reader)

/*
 * We include just the monads we need in it. And we can customize it however we like.
 *
 *
 * # Posting resources
 *
 */
const mUpdateResourceTo = (type) => 
  (mResource ) => mResource
    .readerChain((resource, data) => 
        m.fromContinuation(data.postResource( suffix(url, resource.id) , resource.data)))


const processResource = (type, resourceId, f) =>
  m.of(resourceId)
    .tap(getResourceFrom(type))
    .map(f)
    .map((resource) => ({id:resourceId, resource:recource}))
    .tap(mUpdateResourceTo(type))


exports.mGetResource = (test) => {
    debugger
    mGetUser('john')
    .run((result) => {
      test.done()
    }, {environment:initData()})
  }

