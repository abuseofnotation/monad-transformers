/*
 */
const initData = require('./db_example').initData

const suffix = require('./db_example').suffix
/*
 * In the next part of my tutorial will make functions that modify the resources that they retrieve.
 * As you can see I included some of the resources from my previous tutorial.
 * I could not reuse more of it, because of the way that the `getResource` function was written:
 */

const data = initData()
const GetResource = (url) => data.getResource.bind(null, url)

/* Namely, the function is bound to a data source. This means that we won't be able to test our stuff
 * the way that we want to test it because we will have to always keep track of what in our data is 
 * changed.
 *
 * And we don't want that, especially if the solution is so easy:
 */

const mGetResource = (url, data) => data.getResource.bind(null, url)

/*
 * So we just parametrized the function. Easy, right. Now we just have to specify the dataSource when we call it.
 *
 * Lets write our `mPostResource` function in the same way:
 */

const mPostResource = (url, data) => data.postResource.bind(null, url)

/*
 * However, this breaks our workflow a bit. In the previous version of the tutorial we had this beautiful
 * `getResourceFrom` function that was quite handy:
 */
const getResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type + '/'))
    .cont(mGetResource)
/*
 * Now, because this function uses `mGetResource`, it would also have to accept a dataSource and our whole code would 
 * start smelling bad. Unless there is a transformation that can handle this for us.
 */

const getResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type + '/'))
    .envChain((url, data) => 
        m.fromContinuation(mGetResource(url, data)))
  
