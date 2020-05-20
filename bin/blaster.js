const {readFileSync, writeFileSync} = require('fs')
const yaml = require('js-yaml')
const uniq = require('lodash.uniq')
const {join} = require('path')
const get = require('lodash.get');

const tabChar = '  '

const die = (str) => {
  process.exit(typeof str === 'string' ? str : JSON.stringify(str, null, 2))
}

const matchers = {
  var: new RegExp('(?<={{).*(?=}})','g'),
  // file: new RegExp('(?<={{file:).*(?=}})'),
  file: new RegExp('{{(?!for:).*,\\s*file:.*}}'),
  filePath: new RegExp('(?<=file:).*(?=}})'),
  localFile: new RegExp('{{.*\[[0-9]*\],.*file:.*}}'),
  varPath: new RegExp('(?<={{)(?!for:).*(?=,.*file:.*}})'),
  fileLocal: {
    full: new RegExp('{{.*\[[0-9]*\],.*file:.*}}'),
    varPath: new RegExp('(?<={{).*(?=,.*file:.*}})')
  },
  comments: new RegExp('(\n[\\s]*#.*[\n])', 'g'),
  localVar: new RegExp('(?<={{.*\\.).*(?=.*}})', 'g'),
  loop: new RegExp('(?<={{for:.*).*(?=.*}})'),
  forFile: new RegExp('(?<={{for:.*,\\s*file:).*(?=.*}})'),
  forDataPath: new RegExp('(?<={{for:).*(?=,)'),
  convertFile: new RegExp('(?<={{file:).*(?=}})')
}

function getUniqueMatches(str, matcher) {
  return uniq(str.match(matchers[matcher]))
}

function getMatches(matcher, fragment) {
  return fragment.match(get(matchers,matcher))
}

function handleVar(match, str, val) {
  const re = new RegExp(`{{${match}}}`,'g')
  return str.replace(re,val)
}

function handleLocalVar(match, str, val) {
  const re = new RegExp(`{{.${match}}}`,'g')
  const replaced = str.replace(re,val)
  return replaced  
}

function handleVars(str, data) {
  const matches = getUniqueMatches(str, 'var')
  return matches.reduce((s, match) => {
    return handleVar(match, s, get(data, match))
  }, str)
}

function handleLocalVars(str, data) {
  const matches = getUniqueMatches(str, 'localVar')
  return matches.reduce((s, match) => {
    return handleLocalVar(match, s, data[match])
  }, str)
}

function regexEscape(str) {
  return str
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\//g, '\\/')
    .replace(/\./g, '\\.')
}

function getPadding(str, rightMatch) {
  const escaped = regexEscape(rightMatch)
  const re = new RegExp(`(?<=\\n).*(?=${escaped})`)
  const [match] = str.match(re) || []
  if(match.indexOf('-') > -1 ) {
    const sub = match.substring(0, match.indexOf('-'))
    return sub + tabChar
  }
  return match
}

function getPaddingBlind(str, rightMatch) {
  const escaped = regexEscape(rightMatch)
  const re = new RegExp(`(?<=\n).*(?=${escaped})`)
  const matches = str.match(re) || []
  const joined =  matches.join('')
  return joined
}

function padFragment(padding, fragment) {
  const yamlKeyRe = new RegExp('([^\\s]*:[\\s]*)')
  const yamlKeyIdx = padding.search(yamlKeyRe)
  if(padding.length === 0) { // top-level
    return fragment.split('\n').map((f, i) => {
      return i > 0 ? `${padding}${f}` : f
    }).join('\n')
  } else if(yamlKeyIdx > -1) { // It's a yaml map value
    const newPadding = padding.replace(yamlKeyRe, '')
    return '\n' + fragment.split('\n').map((f, i) => {
      return `${tabChar}${newPadding}${f}`
    }).join('\n')

  } else if(padding.indexOf('-') > -1) { // It's a yaml list value
    return fragment.split('\n').map((f, i) => {
      return i > 0 ? `${padding}${f}` : f
    }).join('\n')
  } else { 
    return fragment.split('\n').map((f, i) => {
      return i > 0 ? `${padding}${f}` : f
    }).join('\n')
  }
}

function loadFragment(joinedPath, match, parentFragment) {
  let fragment = readFileSync(joinedPath, 'utf8')
  const padding = getPadding(parentFragment, match)
  const paddedFragment = padFragment(padding, fragment)
  return paddedFragment
}

function blaster(input, inputPath, data) {
  input = input.replace(matchers.comments, '\n')
  let str = input
  str = handleFiles(str, inputPath, null, data)
  str = handleVars(str, data)
  return str
}

function expandLoopStatements(match, index, fragment, data) {
  const fullStatement = `{{for:${match}}}`
  const [dataPath] = fragment.match(matchers.forDataPath) || []
  const arr = get(data, dataPath)
  const padding = getPaddingBlind(fragment, fullStatement)
  const replacement = arr.reduce((s, item, i) => {
    const str = `${i > 0 ? padding : ''}{{${match}}}`.replace(dataPath, `${dataPath}.${i}`)
    return s ? `${s}\n${str}` : str
  }, '')
  const replaced = fragment.replace(fullStatement, replacement)
  return replaced
}

function getMatchInfo(matcher, fragment) {
  const reMatch = getMatches(matcher, fragment) || []
  const [ match ] = reMatch
  const { index } = reMatch
  return [match,index]
}

function handleFilesLocal(match, idx, fragment, data, pth = '') {
  const [ varPath, varPathIdx ] = getMatchInfo('fileLocal.varPath', match)

  const re = new RegExp(`${varPath.replace('[', '\\[').replace(']','\\]')}, *`)
  const convertedToFileForm = match.replace(re, '')
  const replaced = fragment.replace(match, convertedToFileForm)
  
  const newPth = `${pth}${pth ? '.' : ''}`
  return handleEverything(replaced, data, newPth)
}

function convertFile(match, idx, fragment) {
  return fragment.replace(`{{file:${match}}}`, `{{., file:${match}}}`)
}

function updateVarPaths(fragment, varPath) {
  let newFragment = `${fragment}`
  const varMatches = fragment.match(/{{[a-zA-Z0-9/]*}}/g) || []
  const fileMatches = fragment.match(/{{file:.*}}/g) || []
  const forMatches = fragment.match(/{{for:.*}}/g) || []
  const existingPathMatches = fragment.match(/{{(?!for:).*,.*}}/g) || []

  existingPathMatches.forEach(match => {
    const newMatch = match.replace('{{',`{{${varPath}.`)
    newFragment = newFragment.replace(match,newMatch)
  })
  varMatches.forEach(match => {
    const newMatch = match.replace('{{',`{{${varPath}.`)
    newFragment = newFragment.replace(match,newMatch)
  })
  fileMatches.forEach(match => {
    const newMatch = match.replace('{{',`{{${varPath}, `)
    newFragment = newFragment.replace(match,newMatch)
  })
  forMatches.forEach(match => {
    const [existingVarPath] = match.match(/(?<={{for:).*(?=,)/)
    const newMatch = match.replace(`{{for:${existingVarPath}`,`{{for:${varPath}.${existingVarPath}`)
    newFragment = newFragment.replace(match,newMatch)
  })
  return newFragment
}

function handleFile(match, idx, fragment, data, inputhPath) {
  const [varPath] = getMatchInfo('varPath', match)
  const [filePath] = getMatchInfo('filePath', match)
  const joinedPath = join(inputhPath, filePath)
  const fileFragment = loadFragment(joinedPath, match, fragment)
  const pathsUpdated = updateVarPaths(fileFragment, varPath)
  if(filePath === 'subTemplates/subSubTemplates/tags.yaml') {
    console.log(varPath)
  }
  return fragment.replace(match, pathsUpdated)
}

function deComment(fragment) {
  return fragment.replace(matchers.comments, '\n')
}

const handlers = {
  file: handleFile,
  localFile: handleFilesLocal,
  loop: expandLoopStatements,
  convertFile: convertFile
}

const stages = [
  'loop',
  'convertFile',
  'file'
]

function handleEverything(fragment, data, inputhPath) {
  return stages.reduce((s, stage) => {
    const [match, idx] = getMatchInfo(stage, s)
    if(match) {
      const replaced = handlers[stage](match, idx, fragment, data, inputhPath)
      return handleEverything(replaced, data, inputhPath)
    } else {
      return s
    }
  }, fragment)
}

function flatten(obj, agg = {}, pth = '') {
  const pthPrefix = `${pth}${pth ? '.' : ''}`
  if(Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const newPth = `${pthPrefix}${i}`
      flatten(item, agg, newPth)
    })
    return agg
  } else if(typeof obj === 'object') {
    Object.keys(obj).forEach((key, i) => {
      const item = obj[key]
      const newPth = `${pthPrefix}${key}`
      flatten(item, agg, newPth)
    })
    return agg
  } else {
    agg[pth] = obj
    return agg
  }
}

function fixMultiLeadingDots(fragment) {
  return fragment.replace(/{{\.+/g, '{{')
}

const go = (fragment, data, inputhPath) => {
  const deCommented = deComment(fragment)
  const replaced = handleEverything(deCommented, data, inputhPath)
  const dotsFixed = fixMultiLeadingDots(replaced)
  const flatData = flatten(data)
  return handleVars(dotsFixed, flatData)
}

module.exports = {
  go,
  blaster,
  expandLoopStatements,
  handleFilesLocal,
  flatten,
  handleEverything,
  updateVarPaths
}