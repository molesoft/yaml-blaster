#!/bin/bash

TMP_FILE=/tmp/$(date +%s)
cat dist/cli.js | sudo tee $TMP_FILE > /dev/null
echo '#!/usr/bin/env node' > dist/cli.js
cat $TMP_FILE | sudo tee -a dist/cli.js > /dev/null