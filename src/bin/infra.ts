#!/usr/bin/envs node

import * as dotenv from 'dotenv';

import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'js-yaml';
import {
  PipelineConfigSchema,
  TGeneralPipelineConfig,
} from '../types/config.type';
import { GeneralPipelineStack } from '../general-pipeline-stack';

function createStack() {
  const app = new cdk.App();
  let appConfig: TGeneralPipelineConfig;
  try {
    const yamlPath = path.join(__dirname, '../../../config.yaml');
    console.log('loading yaml config from path: ', yamlPath);
    const fileContent = fs.readFileSync(yamlPath, 'utf-8');
    console.log('yaml config loaded');
    const config = yaml.load(fileContent);

    console.log('parsing config to json and validating');
    appConfig = PipelineConfigSchema.parse(config);

    console.log('Validation successful:');
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Validation failed:', error);
    throw error;
  }

  dotenv.config({
    path: path.resolve(__dirname, `../../../.env`),
  });

  new GeneralPipelineStack(
    app,
    `${appConfig.projectName}-pipeline-stack`,
    {
      env: {
        account: process.env.AWS_ACCOUNT_ID?.replace('\r', ''),
        region: process.env.AWS_REGION?.replace('\r', ''),
      },
    },
    appConfig
  );
}

createStack();
