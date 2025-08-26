import transform from '../dist/index.js'

const path = {
  foo: [
    '$.some.crazy',
    {
      bar: '$.example'
    }
  ]
}

const data = {
  some: {
    crazy: [{ example: 'A' }, { example: 'B' }]
  }
}

const expected = {
  foo: [{ bar: 'A' }, { bar: 'B' }]
}

const result = transform(data, path)

console.log('Expected:', JSON.stringify(expected, null, 2))
console.log('Result:', JSON.stringify(result, null, 2))
console.log('Match:', JSON.stringify(expected) === JSON.stringify(result))
