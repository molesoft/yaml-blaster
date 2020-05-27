const Blaster = require('../dist/blaster')
const {join} = require('path')
const {readFileSync, unlinkSync} = require('fs')
const yaml = require('js-yaml')
const uuid = require('uuid')

it('should handle complex comments and multiple vars on the same line', () => {
  const inputPath = join(__dirname,'sample2')
  const inputFile = join(inputPath, 'template.yaml')
  const dataPath = join(inputPath, 'data.yaml')
  const data = yaml.safeLoad(readFileSync(dataPath,'utf8'))
  const input = readFileSync(inputFile, 'utf8')
  const yb = new Blaster(input, data, inputPath)
  const result = yb.process(input, data, inputPath)
  expect(result).toMatchSnapshot()
})

it('should have a cli interface that works', () => {
  const argvBackup = [...process.argv]
  const args = [...process.argv]
  const tmpPath = `/tmp/${uuid.v4()}`
  args.push('-i', '__tests__/samples/template.yaml', '-d', '__tests__/samples/data.json', '-o', tmpPath)
  process.argv = args
  require('../dist/cli')
  process.argv = argvBackup
  const result = readFileSync(tmpPath, 'utf8')
  unlinkSync(tmpPath)
  expect(result).toMatchSnapshot()
})

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
  const yb = new Blaster(input, data, inputPath)
  const result = yb.process(input, data, inputPath)
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
  const yb = new Blaster(fragment)
  const result = yb.updateVarPaths(fragment, 'instances.0')
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
  const yb = new Blaster('')
  const result = yb.flatten(data)
  expect(result).toMatchSnapshot()
})