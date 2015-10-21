exports.state = {
  name: 'State',
  of (val) {return (prevState) => [val, prevState]},
  chain (funk, val) {
    return (prevState) =>
      val(prevState).chain((params) => {
        const val = params[0], newState = params[1]
        return [funk(val), newState]
      })
  }
}
