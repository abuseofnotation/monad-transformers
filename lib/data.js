exports.id = {
  name: 'ID',
  of (val, proto) { return proto.of({idVal: val }) },
  chain (funk, val, proto) {
    return proto.chain((innerId) => {
      return funk(innerId.idVal)
    }, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({idVal: innerValue}), val)
  },
  wrap (val, proto) {
    return proto.of(val)
  }
}

exports.maybe = {
  name: 'Maybe',
  of (val, proto) { return proto.of({maybeVal: val }) },
  chain (funk, val, proto) {
    return proto.chain((innerMaybe) => {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)
    }, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({maybeVal: innerValue}), val)
  },
  get (key, val) {
    return {maybeVal: val[key]}
  },
  wrap (maybeVal, proto) {
    return proto.of(maybeVal)
  }
}
