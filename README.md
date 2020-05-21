# YAML-Blaster - Framework for processing YAML templates
This was created to ease the pain of having to use a giant single-file AWS Cloudformation template by allowing variable replacement, file loading, and loops.

## Table of Contents
- [Installation](#Installation)
- [Usage](#Usage)
    -  [CLI](#CLI)
- [Features](#Features)
    - [Simple Variable replacement](#Simple-Variable-replacement)
    - [Load a file](#Load-a-file)
      - [Using top-level data scope](#Using-top-level-data-scope)
      - [Using specific data scope](#Using-specific-data-scope)
    - [Loops](#Loops)

## Installation
### npm
```
$ npm install -g yaml-blaster
```
## Usage
### CLI
Assuming your project looks like this
```
project
|
+-- template.yaml
|
+-- data.yaml
```
From the project directory just run
```
$ yaml-blaster \
  -i template.yaml \  # The input template
  -d data.yaml        # A configuration file
```
Or from anywwhere run
```
$ yaml-blaster \
  -i /full/path/to/project/template.yaml \
  -d /full/path/to/project/data.yaml
```
To save the output to a file
```
$ yaml-blaster \
  -i template.yaml \
  -d data.yaml \
  -o processed.yaml
```

## Features
### Simple Variable replacement
Syntax: `{{variable}}` - Replace variables in the template

template.yaml
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: {{name}}
```
data.yaml
```
name: my-bucket-name
```
run
```
$ yaml-blaster \
  -i template.yaml \
  -d data.yaml
```
output
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-bucket-name
```
### Load a file
Syntax: `{{file:relative/path}}` - load a file and replace it in the template

#### Using top-level data scope
By default, any variables in the loaded snippet
will be replaced using the top-level scope of the data file.

project structure
```
project
|
+-- template.yaml
|
+-- data.yaml
|
+-- snippets
   |
   +-- bucket.yaml
```
template.yaml
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  {{file:sub-templates/bucket.yaml}}
```
snippets/bucket.yaml
```
{{logicalName}}:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: {{bucketName}}
```
data.yaml
```
logicalName: MyS3Bucket
bucketName: my-s3-bucket
```
output
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName:my-s3-bucket
```

#### Using specific data scope
Syntax: `{{path.to.value, file:relative/path}}` - load a file and replace variables under a specific scope

project structure
```
project
|
+-- template.yaml
|
+-- data.yaml
|
+-- snippets
   |
   +-- bucket.yaml
```
template.yaml
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  {{bucket1, file:sub-templates/bucket.yaml}}
  {{bucket2, file:sub-templates/bucket.yaml}}
```
snippets/bucket.yaml
```
{{logicalName}}:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: {{bucketName}}
```
data.yaml
```
bucket1:
  logicalName: MyFirstS3Bucket
  bucketName: my-s3-bucket-1
bucket2:
  logicalName: MySecondS3Bucket
  bucketName: my-s3-bucket-2
```
output
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyFirstS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-s3-bucket-1
  MySecondS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-s3-bucket-2
```
### Loops
Syntax: `{{for:path.to.array, file:relative/path}}` - add n number of instances of a snippet by referring to an array in the data file

project structure
```
project
|
+-- template.yaml
|
+-- data.yaml
|
+-- snippets
   |
   +-- bucket.yaml
```
template.yaml
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  {{for:buckets, file:sub-templates/bucket.yaml}}
```
snippets/bucket.yaml
```
{{logicalName}}:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: {{bucketName}}
```
data.yaml
```
buckets:
  - logicalName: MyFirstS3Bucket
    bucketName: my-s3-bucket-1
  - logicalName: MySecondS3Bucket
    bucketName: my-s3-bucket-2
```
output
```
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyFirstS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-s3-bucket-1
  MySecondS3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-s3-bucket-2
```