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

function convertConfigYamlToJson() {
  const yamlPath = path.join(__dirname, '../../../config.yaml');
  const jsonPath = path.join(__dirname, '../../config.json');
  try {
    // Read the YAML file
    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');

    // Parse the YAML content
    const parsedContent = yaml.load(yamlContent);

    // Convert the parsed content to JSON
    const jsonContent = JSON.stringify(parsedContent, null, 2);

    // Write the JSON content to a file
    fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
  } catch (error) {
    console.error('Error converting YAML to JSON:', error);
  }
}

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
    console.error('Validation failed:');
    console.log(JSON.stringify(error, null, 2));
    throw error;
  }

  convertConfigYamlToJson();

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
