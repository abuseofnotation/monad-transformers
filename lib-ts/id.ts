interface idWrapped extends monad {
	idContainer:id
}

interface id {
  idVal:any
}

export const idWrapped : monadDefinition <idWrapped> = {
  name: 'idWrapped',
  of (val) { 
    return {idContainer:this.outer.of({idVal: val })}
  },
  chain (funk, val) {
    return {
      idContainer:this.outer.chain((innerId) => {
        const val = funk(innerId.idVal)
        return val.idContainer
      }, val.idContainer)
    }
  },
  lift (val) {
    return {idContainer:this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)}
  },
  run (funk, val) {
    return this.outer.run((innerId)=> {
      return funk(innerId.idVal)
    }, val.idContainer)
  }
}
export const id = {
  name: 'ID',
  of (val) { 
    return this.outer.of({idVal: val }) 
  },
  chain (funk, val) {
    return this.outer.chain((innerId) => {
      return funk(innerId.idVal)
    }, val)
  },
  lift (val) {
    return this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)
  },
  run (funk, val) {
    return this.outer.run((innerId)=> {
      return funk(innerId.idVal)
    }, val)
  }
}

