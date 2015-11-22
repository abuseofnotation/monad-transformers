interface monadDefinition <M> {
	name:string,
	of:(a:monad) => M
	chain:(funk:(M:M)=> M, a:M) => M
	lift:(a:monad) => M
	run: (funk:any, val:any) => any
}

interface monadDefinitionProcessed<M> extends monadDefinition<M> {
	outer:monadDefinitionProcessed<any>
} 

interface monad {
}