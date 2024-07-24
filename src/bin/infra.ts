#!/usr/bin/envs node

import * as dotenv from 'dotenv';

dotenv.config({ path: `./envs/${process.env.ENVIRONMENT}.env` });

import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
// import { GeneralPipelineStack } from '../../general-pipeline-stack';
import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'js-yaml';
import { PipelineConfigSchema } from '../types/config.type';

try {
  const yamlPath = path.join(__dirname, '../../../pipeline-config.yaml');
  console.log('loading yaml config from path: ', yamlPath);
  const fileContent = fs.readFileSync(yamlPath, 'utf-8');
  const config = yaml.load(fileContent);
  console.log(config);

  // Validate the JSON data
  const parsedData = PipelineConfigSchema.parse(config);
  console.log('Validation successful:', parsedData);
} catch (error) {
  console.error('Validation failed:', error);
}

// function createStack() {
//   const app = new cdk.App()
//
//   console.log('--- build pipeline')
//   new GeneralPipelineStack(app, 'fwd-ai-studio-backend-cicd', {
//     env: {
//       account: process.env.AWS_ACCOUNT_ID?.replace('\r', ''),
//       region: process.env.AWS_REGION?.replace('\r', ''),
//     },
//   })
// }
//
// createStack()
