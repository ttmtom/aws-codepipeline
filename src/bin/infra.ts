#!/usr/bin/envs node

import * as dotenv from "dotenv";
dotenv.config({ path: `./envs/${process.env.ENVIRONMENT}.env` });

import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import {PulsePipelineStack} from "../pulse-pipeline-stack";


function createStack() {
    const app = new cdk.App();

    console.log("--- build pipeline");
    new PulsePipelineStack(app, "fwd-ai-studio-backend-cicd", {
        env: {
            account: process.env.AWS_ACCOUNT_ID?.replace("\r", ""),
            region: process.env.AWS_REGION?.replace("\r", ""),
        },
    });
}

createStack();
