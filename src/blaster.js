/*
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE', which is part of this source code package.
 */

const {readFileSync, writeFileSync} = require('fs')
const yaml = require('js-yaml')
const uniq = require('lodash.uniq')
const {join} = require('path')
const get = require('lodash.get')

const die = (str) => {
  process.exit(typeof str === 'string' ? str : JSON.stringify(str, null, 2))
}

class Blaster {

  #matchers = {
    tabChar: new RegExp('(?<=\\n)(?!\\n)\\s*(?=.*)', 'g'),
    var: new RegExp('(?<={{).*(?=}})','g'),
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

  #handlers = {
    file: this.handleFile.bind(this),
    localFile: this.handleFilesLocal.bind(this),
    loop: this.expandLoopStatements.bind(this),
    convertFile: this.convertFile.bind(this)
  }
  
  #stages = [
    'loop',
    'convertFile',
    'file'
  ]

  #fragment
  #data
  #inputPath
  #tabChar

  constructor(fragment, data, inputPath, tabChar) {
    this.#fragment = fragment
    this.#data = data
    this.#inputPath = inputPath

    if(tabChar) {
      this.#tabChar = tabChar
    } else {
      const tabCharRe = new RegExp('(?<=\\n)(?!\\n)\\s*(?=.*)', 'g')
      const matches = fragment.match(tabCharRe)
      const sorted = uniq(matches).sort((a,b) => a.length - b.length)
      this.#tabChar = sorted[0] !== '' ? sorted[0] : sorted[1]
    }
  }

  set tabChar(val) {
    this.#tabChar = val
  }

  get tabChar() {
    return this.#tabChar
  }

  getUniqueMatches(str, matcher) {
    return uniq(str.match(this.#matchers[matcher]))
  }

  getMatches(matcher, fragment) {
    return fragment.match(get(this.#matchers,matcher))
  }

  handleVars(str, data) {
    const matches = this.getUniqueMatches(str, 'var')
    return matches.reduce((s, match) => {
      const re = new RegExp(`{{${match}}}`,'g')
      const val =  get(data, match)
      return s.replace(re,val)
    }, str)
  }

  regexEscape(str) {
    return str
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\//g, '\\/')
      .replace(/\./g, '\\.')
  }

  getPadding(str, rightMatch) {
    const escaped = this.regexEscape(rightMatch)
    const re = new RegExp(`(?<=\\n).*(?=${escaped})`)
    const [match] = str.match(re) || []
    if(match.indexOf('-') > -1 ) {
      const sub = match.substring(0, match.indexOf('-'))
      return sub + this.#tabChar
    }
    return match
  }
  
  getPaddingBlind(str, rightMatch) {
    const escaped = this.regexEscape(rightMatch)
    const re = new RegExp(`(?<=\n).*(?=${escaped})`)
    const matches = str.match(re) || []
    const joined =  matches.join('')
    return joined
  }
  
  padFragment(padding, fragment) {
    const yamlKeyRe = new RegExp('([^\\s]*:[\\s]*)')
    const yamlKeyIdx = padding.search(yamlKeyRe)
    if(padding.length === 0) { // top-level
      return fragment.split('\n').map((f, i) => {
        return i > 0 ? `${padding}${f}` : f
      }).join('\n')
    } else if(yamlKeyIdx > -1) { // It's a yaml map value
      const newPadding = padding.replace(yamlKeyRe, '')
      return '\n' + fragment.split('\n').map((f, i) => {
        return `${this.#tabChar}${newPadding}${f}`
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
  
  loadFragment(joinedPath, match, parentFragment) {
    let fragment = readFileSync(joinedPath, 'utf8')
    const padding = this.getPadding(parentFragment, match)
    const paddedFragment = this.padFragment(padding, fragment)
    return paddedFragment
  }
  
  expandLoopStatements(match, index, fragment, data) {
    const fullStatement = `{{for:${match}}}`
    const [dataPath] = fragment.match(this.#matchers.forDataPath) || []
    const arr = get(data, dataPath)
    const padding = this.getPaddingBlind(fragment, fullStatement)
    const replacement = arr.reduce((s, item, i) => {
      const str = `${i > 0 ? padding : ''}{{${match}}}`.replace(dataPath, `${dataPath}.${i}`)
      return s ? `${s}\n${str}` : str
    }, '')
    const replaced = fragment.replace(fullStatement, replacement)
    return replaced
  }
  
  getMatchInfo(matcher, fragment) {
    const reMatch = this.getMatches(matcher, fragment) || []
    const [ match ] = reMatch
    const { index } = reMatch
    return [match,index]
  }
  
  handleFilesLocal(match, idx, fragment, data, pth = '') {
    const [ varPath, varPathIdx ] = this.getMatchInfo('fileLocal.varPath', match)
  
    const re = new RegExp(`${varPath.replace('[', '\\[').replace(']','\\]')}, *`)
    const convertedToFileForm = match.replace(re, '')
    const replaced = fragment.replace(match, convertedToFileForm)
    
    const newPth = `${pth}${pth ? '.' : ''}`
    return this.handleEverything(replaced, data, newPth)
  }
  
  convertFile(match, idx, fragment) {
    return fragment.replace(`{{file:${match}}}`, `{{., file:${match}}}`)
  }
  
  updateVarPaths(fragment, varPath) {
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
  
  handleFile(match, idx, fragment, data, inputhPath) {
    const [varPath] = this.getMatchInfo('varPath', match)
    const [filePath] = this.getMatchInfo('filePath', match)
    const joinedPath = join(inputhPath, filePath)
    const fileFragment = this.loadFragment(joinedPath, match, fragment)
    const pathsUpdated = this.updateVarPaths(fileFragment, varPath)
    return fragment.replace(match, pathsUpdated)
  }
  
  deComment(fragment) {
    return fragment.replace(this.#matchers.comments, '\n')
  }


  handleEverything(fragment, data, inputhPath) {
    return this.#stages.reduce((s, stage) => {
      const [match, idx] = this.getMatchInfo(stage, s)
      if(match) {
        const replaced = this.#handlers[stage](match, idx, fragment, data, inputhPath)
        return this.handleEverything(replaced, data, inputhPath)
      } else {
        return s
      }
    }, fragment)
  }
  
  flatten(obj, agg = {}, pth = '') {
    const pthPrefix = `${pth}${pth ? '.' : ''}`
    if(Array.isArray(obj)) {
      obj.forEach((item, i) => {
        const newPth = `${pthPrefix}${i}`
        this.flatten(item, agg, newPth)
      })
      return agg
    } else if(typeof obj === 'object') {
      Object.keys(obj).forEach((key, i) => {
        const item = obj[key]
        const newPth = `${pthPrefix}${key}`
        this.flatten(item, agg, newPth)
      })
      return agg
    } else {
      agg[pth] = obj
      return agg
    }
  }
  
  fixMultiLeadingDots(fragment) {
    return fragment.replace(/{{\.+/g, '{{')
  }

  process(fragment, data, inputhPath) {
    const deCommented = this.deComment(fragment)
    const replaced = this.handleEverything(deCommented, data, inputhPath)
    const dotsFixed = this.fixMultiLeadingDots(replaced)
    const flatData = this.flatten(data)
    return this.handleVars(dotsFixed, flatData)
  }

}
module.exports = Blaster