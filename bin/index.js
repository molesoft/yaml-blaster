#!/usr/bin/env node

const {readFileSync, writeFileSync} = require('fs')
const {join} = require('path')
const yargs = require('yargs')
const chalk = require("chalk")
const boxen = require("boxen")

console.log(process.argv)
const args = yargs
  .usage("Usage: -p <input path>")
  .option("p", { alias: "path", describe: "Input file path", type: "string", demandOption: true })
  .argv
  const relDir = process.cwd()
  const input = readFileSync(inPath, 'utf8')
