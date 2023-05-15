import { serialize } from '../index.js'
import { assertEquals } from "https://deno.land/std@0.187.0/testing/asserts.ts"

Deno.test('numbers',() => {
    assertEquals(serialize(0)        , '0')
    assertEquals(serialize(1.1)      , '1.1')
    assertEquals(serialize(NaN)      , 'NaN')
    assertEquals(serialize(Infinity) , 'Infinity')
    assertEquals(serialize(-Infinity), '-Infinity')
})

Deno.test('strings',() => {
    assertEquals(serialize('')        , '""')
    assertEquals(serialize('foo')     , '"foo"')
    assertEquals(serialize('foo"bar') , '"foo\\"bar"')
    assertEquals(serialize('foo\nbar'), '"foo\\nbar"')
    assertEquals(serialize('\'"`')    , '"\'\\"`"')
})

Deno.test('symbols', () => {
    assertThrows(serialize, Symbol())
    assertThrows(serialize, Symbol('foo'))
    assertEquals(serialize(Symbol.for('foo'))    , 'Symbol.for("foo")')
    assertEquals(serialize(Symbol.iterator)      , 'Symbol.iterator')
    assertEquals(serialize(Symbol.species)       , 'Symbol.species')
    assertEquals(serialize(Symbol.for('for'))    , 'Symbol.for("for")')
    assertEquals(serialize(Symbol.for('length')) , 'Symbol.for("length")')
})

Deno.test('classes', () => {
    assertThrows(serialize, class Foo {})
    assertThrows(serialize, class Object {})
    assertThrows(serialize, class Array {})
})

Deno.test('instances', () => {
    assertThrows(serialize, new Date)
    assertThrows(serialize, new Error)
    assertThrows(serialize, new Map)
    assertThrows(serialize, new Set)
    assertThrows(serialize, Object.create(null))
    assertThrows(serialize, Object.create({}))
})

Deno.test('arrays', () => {
    assertEquals(serialize([])           , '[]')
    assertEquals(serialize([1,2,3])      , '[1, 2, 3]')
    assertEquals(serialize([1,[2,[3]],4]), '[1, [2, [3]], 4]')
    assertEquals(serialize([
        Infinity,
        {
            [Symbol.for('xyz')]: {
                [Symbol.for('abc')]: Symbol.for('def'),
                a                  : 21
            }
        },
        "str'\"ing" ]
    ),
    '[Infinity, { [Symbol.for("xyz")]: { a: 21, [Symbol.for("abc")]: Symbol.for("def") } }, "str\'\\"ing"]'
    )
})

Deno.test('functions', () => {
    assertEquals(serialize(() => {})               , '()=>{}')
    assertEquals(serialize(function() {})          , 'function() {}')
    assertEquals(serialize(function foo() {})      , 'function foo() {}')
    assertEquals(serialize(function*() {})         , 'function*() {}')
    assertEquals(serialize(async () => {})         , 'async ()=>{}')
    assertEquals(serialize(async function() {})    , 'async function() {}')
    assertEquals(serialize(async function foo() {}), 'async function foo() {}')
    assertEquals(serialize(async function*() {})   , 'async function*() {}')
    assertEquals(serialize(Object)                 , 'Object')
    assertEquals(serialize(Function.prototype)     , 'Function.prototype')
    // node and deno show the implementation of btoa on calling toString()
    // assertEquals(serialize(btoa)                , 'btoa')
})

Deno.test('objects with functions', () => {
    assertEquals(serialize({ foo: () => {} })           , '{ foo: ()=>{} }')
    assertEquals(serialize({ foo: function() {} })      , '{ foo: function() {} }')
    assertEquals(serialize({ foo: function foo() {} })  , '{ foo: function foo() {} }')
    assertEquals(serialize({ foo() {} })                , '{ foo () {} }')
    assertEquals(serialize({ async foo() {} })          , '{ async foo () {} }')
    assertEquals(serialize({ get foo() { return 'x' } }), "{ get foo () {\n            return 'x';\n        } }")
    assertEquals(serialize({ set foo(x : unknown) {} })       , "{ set foo (x){} }")
    assertEquals(serialize({
        get foo() { return 'x' },
        set foo(x:any) {}
    }), "{ get foo () {\n            return 'x';\n        }, set foo (x){} }")
    assertEquals(serialize({
        get [Symbol.for("foo")]() { return 'x' },
        set [Symbol.for("foo")](x : unknown) {}
    }), "{ get [Symbol.for(\"foo\")] () {\n            return 'x';\n        }, set [Symbol.for(\"foo\")] (x){} }")
})


function assertThrows<Input, Fun extends (input: Input) => unknown>(
    fun   : Fun,
    input : Input
) {
    try {
        const result = fun(input)
        throw new Error(`Expected ${fun.name} to throw when passed ${input}, but it succeeded with ${result}.`)
    } catch (e) {
        return
    }
}