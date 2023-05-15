/**
 * @param { string | symbol } key
 * @param { unknown } value
 * @param { { dev ?: boolean, build ?: boolean} }
 * @returns { import('astro').AstroIntegration | undefined }
 */
export default function addGlobal(key, value, { dev = true, build = false } = {}) {

	if (typeof key !== 'string' && typeof key !== 'symbol') {
		console.error('\nastro-add-global will not add ', key, ' because its key is of an invalid type: ' + typeof key + '.\nThe key must either be a string or a symbol.\n')
		return undefined
	}
	
	const serializedKey = failableApplication(serialize, key)

	if ('error' in serializedKey) {
		if (typeof serializedKey.error === 'symbol') console.error('\nastro-add-global will not add ', key,' because its key is non-registered symbol.\n\nA symbol must be registered to be serialized.\n\nConsider using `Symbol.for("description")` instead.\n')
		else console.error('astro-add-global will not add a global because this key could not be serialized:', key)
		return undefined
	}
	
	const serializedValue = failableApplication(serialize, value)

	if ('error' in serializedValue) {
		if (typeof serializedValue.error === 'symbol') console.error('\nastro-add-global will not add ' + serializedKey.ok + ' because the value contains a non-regisstered symbol.\n\nA symbol must be registered to be serialized.\n\nConsider using `Symbol.for("description")` instead.\n')
		else console.error('\nastro-add-global will not add ' + serializedKey.ok + ' because the value contains an invalid type: ' + typeof serializedValue.error + '.', serializedValue.error)
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
export function serialize(value) {
    
	if (value === undefined)         return 'undefined'
	if (value === null)              return 'null'
	if (typeof value === 'boolean')  return String(value)
	if (typeof value === 'number')   return String(value)
	if (typeof value === 'string')   return JSON.stringify(value)
	if (Array.isArray(value))        return '[' + value.map(serialize).join(', ') + ']'
	
	if (typeof value === 'function') {
		if (value === Function.prototype) return 'Function.prototype'
		const serializedFun = value.toString()
		if (serializedFun.includes('[native code]')) return value.name
		else return serializedFun
	}

	if (typeof value === 'symbol') {
		const key = Symbol.keyFor(value)
		if (key === undefined) {
			// built-in symbols (Symbol.iterator, Symbol.species, ...)
			if (value.description) return value.description
			throw value
		}
		return 'Symbol.for(' + JSON.stringify(key) + ')'
	}
	
	if (Object.getPrototypeOf(value) === Object.getPrototypeOf({})) {
		
		const keys = Object.keys(value)
		const keyValueSerialized =
			keys.map(key => {
				const { set, get } = Object.getOwnPropertyDescriptor(value, key)
				
				if (set !== undefined && get !== undefined)
					return get.toString() + ', ' + set.toString()

				if (set !== undefined)return set.toString()
				if (get !== undefined)return get.toString()
				
				const fieldValue = value[key]
				if (typeof fieldValue === 'function') {}
				const serializedFun = serialize(fieldValue)
				// callable property syntax: const x = { f() {} }; const y = { async f() {} }
				if (/^(async\s+)?(?!async)(?!function)\w+\s*\(/.test(serializedFun)) return serializedFun
				return key + ': ' + serializedFun
			}).join(', ')
		
		const symbolKeys = Object.getOwnPropertySymbols(value)
		const symbolKeyValueSerialized =
			symbolKeys
			.map(key => {
				const { set, get } = Object.getOwnPropertyDescriptor(value, key)
				
				if (set !== undefined && get !== undefined)
					return get.toString() + ', ' + set.toString()

				if (set !== undefined)return set.toString()
				if (get !== undefined)return get.toString()
				
				return '[' + serialize(key) + ']: ' + serialize(value[key])
			})
			.join(', ')
		
		if (keys.length === 0 && symbolKeys.length === 0) return '{}'
		if (symbolKeys.length === 0)                      return '{ ' + keyValueSerialized + ' }'
		if (keys.length === 0)                            return '{ ' + symbolKeyValueSerialized + ' }'
		else                                              return '{ ' + keyValueSerialized + ', ' + symbolKeyValueSerialized + ' }'
	
	}

	throw value
}
