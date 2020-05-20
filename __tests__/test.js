const {blaster, expandLoopStatements, handleFilesLocal, flatten, handleEverything, updateVarPaths, go} = require('../bin/blaster')
const {join} = require('path')
const {readFileSync} = require('fs')
it('should win', async () => {
  const data = {
    proto: 'mygreatnewproto',
    cidr: 'mygreatnewcidr',
    tagName: 'tagname',
    tagVal: 'tagval',
    instances: [
      {
        name: 'dog',
        size: '1',
        cidr: '2',
        tags: {
          name: 'tag1',
          val: 'tag1'
        }
      },
      {
        name: 'cat',
        size: '2',
        cidr: '3',
        tags: {
          name: 'tag2',
          val: 'tag3'
        }
      }
    ]
  }
  const inputFile = join(__dirname,'samples/template.yaml')
  const inputPath = join(__dirname,'samples')
  const input = readFileSync(inputFile, 'utf8')
  const result = blaster(input, inputPath, data, '  ')
  console.log(result)
  return
})
it('should expand loop statements', async () => {
  const data = {
    instances: [
      { name: 'dog'  },
      { name: 'cat' }
    ]
  }
  const inputFile = join(__dirname,'samples/loop.yaml')
  const input = readFileSync(inputFile, 'utf8')
  const result = expandLoopStatements(input, data, '  ')
  expect(result).toMatchSnapshot()
})
it.skip('should import files with local data', async () => {
  const data = {
    instances: [
      { name: 'dog'  },
      { name: 'cat' }
    ]
  }
  const inputPath = join(__dirname,'samples')
  const inputFile = join(inputPath, 'fileImportLocal.yaml')
  const input = readFileSync(inputFile, 'utf8')
  const result = handleFilesLocal(input, data, inputPath, '  ')
  console.log(result)
  // expect(result).toMatchSnapshot()
})

it.only('should handle mutliple stages', async () => {
  const data = {
    cidr: '0.0.0.0/0',
    proto: 'https',
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
  console.log(result)
  // expect(result).toMatchSnapshot()
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
