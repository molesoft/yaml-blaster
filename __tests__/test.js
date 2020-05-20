const {blaster, expandLoopStatements, handleFilesLocal, flatten, handleEverything, updateVarPaths, go} = require('../bin/blaster')
const {join} = require('path')
const {readFileSync} = require('fs')

it('should handle mutliple stages', async () => {
  const data = {
    baz: 'bazval',
    cat: 'catval',
    cidr: '0.0.0.0/0',
    proto: 'https',
    someMap: {
      baz: 'mapbaz',
      cat: 'mapcat'
    },
    instances: [
      {
        name: 'dog',
        size: 'big',
        cidr: '0.1.1.1',
        tags: {
          name: 'tagname',
          val: 'tagval'
        }
      },
      {
        name: 'cat',
        size: 'real big',
        cidr: '0.2.2.2',
        tags: {
          name: 'tagname2',
          val: 'tagval2'
        }
      }
    ]
  }
  const inputPath = join(__dirname,'samples')
  const inputFile = join(inputPath, 'template.yaml')
  const input = readFileSync(inputFile, 'utf8')
  const result = go(input, data, inputPath)
  expect(result).toMatchSnapshot()
})

it('should update var paths', async () => {
  const fragment = `
  {{name}}:
  Type: AWS::EC2::Instance
  Properties:
    Size: {{size}}
    Cidr: {{cidr}}
  Tags: {{file:subTemplates/subSubTemplates/tags.yaml}}
  Foo: {{for:tags, file:subTemplates/subSubTemplates/tags.yaml}}
  `
  const result = updateVarPaths(fragment, 'instances.0')
  // console.log(result)
  expect(result).toMatchSnapshot()
})

it('should flatten a complex object', async () => {
  const data = {
    foo: 'bar',
    instances: [
      { name: 'dog'  },
      { name: 'cat' }
    ],
    baz: [
      [1,2],
      [3,4],
      [{
        test: [
          4,5,{5:6}
        ]
      }]
    ]
  }
  const result = flatten(data)
  expect(result).toMatchSnapshot()
})
