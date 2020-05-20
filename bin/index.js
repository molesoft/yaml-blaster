#!/usr/bin/env node

const {readFileSync, writeFileSync} = require('fs')
const {join} = require('path')
const yargs = require('yargs')
const chalk = require('chalk')
const boxen = require('boxen')
const {go} = require('./blaster')
const yaml = require('js-yaml')

const args = yargs
  .usage("Usage: -i <input path> -d <data path> -0 <output path>")
  .option("i", { alias: "input", describe: "Input file path", type: "string", demandOption: true })
  .option("d", { alias: "data", describe: "Data file path", type: "string", demandOption: true })
  .option("o", { alias: "out", describe: "Output file path", type: "string", demandOption: false })
  .argv

const relDir = process.cwd()
const inputPath = args.input.startsWith('/') ? args.input : join(relDir, args.input)
const inputDir = inputPath.split('/').reduce((s,item,i) => {
  return i === inputPath.split('/').length - 1 ? s : `${s}/${item}`
}, '')
const input = readFileSync(inputPath, 'utf8')
const dataString = readFileSync(args.data, 'utf8')
let data
try {
  data = JSON.parse(dataString)
} catch(err) {
  data = yaml.safeLoad(dataString)
}

const processed = go(input, data, inputDir)
if(args.out) {
  const outPath = args.out.startsWith('/') ? args.out : join(relDir, args.out)
  writeFileSync(outPath, processed)
} else {
  console.log(processed)
}