/**
 * @param { string | symbol } key
 * @param { unknown } value
 * @param { { dev ?: boolean, build ?: boolean} }
 * @returns { import('astro').AstroIntegration | undefined }
 */
export default function addGlobal(key, value, { dev = true, build = false }) {

	if (typeof key !== 'string' && typeof key !== 'symbol') {
		console.error('\naddGlobal will not run because the key is of an invalid type: ' + typeof key + '.\n\nThe key must either be a string or a symbol.\n')
		return undefined
	}
	
	const serializedKey = failableApplication(serialize, key)

	if ('error' in serializedKey) {
		if (typeof serializedKey.error === 'symbol') console.error('\naddGlobal will not run because the key was a symbol without a description.\n\nA symbol must have a description to be serialized.\n\nConsider using `Symbol.for("description")` instead.\n')
		else console.error('addGlobal will not run because the key could not be serialized.')
		return undefined
	}
	
	const serializedValue = failableApplication(serialize, value)

	if ('error' in serializedValue) {
		if (typeof serializedValue.error === 'symbol') console.error('\naddGlobal will not run because the the value contained a symbol without a description.\n\nA symbol must have a description to be serialized.\n\nConsider using `Symbol.for("description")` instead.\n')
		else if (typeof serializedValue.error === 'function') console.error('\naddGlobal will not run because one of the values contained a named function.\n\nA function must be anonymous to be serialized.\n\nConsider using `' + serializedValue.error.name + ': () => { ... }` instead.\n')
		else console.error('\naddGlobal will not run because one of the values is of an invalid type: ' + typeof serializedValue.error + '.\n')
		return undefined
	}

	return {
		name: 'astro-add-global',
		hooks: {
			['astro:config:setup']({ config, command }) {
				if ((command === 'dev' && dev) || command === 'build' && build) {
					config.vite.plugins = [
						...config.vite.plugins ?? [],
						{
							name: 'vite-add-global',
							transform(code, id) {
								if (id.startsWith(config.srcDir.pathname) && id.endsWith('.astro')) {
									const importStatementsEndAt =
										this.parse(code)
										.body.findLast(element => element.type === 'ImportDeclaration')
										.end
									
									const newCode =
										code.slice(0, importStatementsEndAt) +
										'\n\nglobalThis[' + serializedKey.ok + '] ??= ' + serializedValue.ok + ';\n' +
										code.slice(importStatementsEndAt)
									
									return newCode
								}
							}
						}
					]
				}
			}
		}
	}
}

/**
 * @template I, O
 * @param { (input: I) => O } failableFun
 * @param { I } input
 * @returns { { ok : O } | { error : unknown } }
 */
function failableApplication(failableFun, input) {
	try {
		return { ok : failableFun(input) }
	}
	catch (error) {
		return { error }
	}
}

/**
 * @param { unknown } value
 * @returns { string }
 */
function serialize(value) {
    
	if (value === undefined)         return 'undefined'
	if (value === null)              return 'null'
	if (typeof value === 'boolean')  return String(value)
	if (typeof value === 'number')   return String(value)
	if (typeof value === 'string')   return JSON.stringify(value)
	if (Array.isArray(value))        return '[' + value.map(serialize).join(', ') + ']'
	
	if (typeof value === 'function') {
		const serializedFun = value.toString()
		if (serializedFun.startsWith(value.name)) throw value
		return serializedFun
	}

	if (typeof value === 'symbol') {
		const description = value.description
		if (description === undefined) throw value
		return 'Symbol.for(' + JSON.stringify(description) + ')'
	}
	
	if (Object.getPrototypeOf(value) === Object.getPrototypeOf({})) {
		
		const keys = Object.keys(value)
		const keyValueSerialized =
			keys.map(key =>
				key + ': ' + serialize(value[key])
			).join(', ')
		
		const symbolKeys = Object.getOwnPropertySymbols(value)
		const symbolKeyValueSerialized =
			symbolKeys.map(key =>
				'[' + serialize(key) + ']: ' + serialize(value[key])
			).join(', ')
		
		if (symbolKeys.length === 0) return '{ '+ keyValueSerialized + ' }'
		else                         return '{ '+ keyValueSerialized + ', ' + symbolKeyValueSerialized + ' }'
	
	}

	throw value
}
