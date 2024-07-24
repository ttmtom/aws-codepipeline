import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { IRepository, Repository } from 'aws-cdk-lib/aws-codecommit';
// import {
//   BlockPublicAccess,
//   Bucket,
//   BucketEncryption,
// } from 'aws-cdk-lib/aws-s3';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
// import {
//   BuildSpec,
//   ComputeType,
//   LinuxBuildImage,
//   PipelineProject,
//   Project,
// } from 'aws-cdk-lib/aws-codebuild';
import { DcpServiceRole } from '../common/iam/DcpRole';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { TPipelineConfig } from '../types/config.type';

export interface IPipelineResource {
  // readonly s3: {
  //   artifactBucket: Bucket;
  // };
  // readonly event: {
  //   eventRole: DcpServiceRole;
  //   trigger: NodejsFunction;
  //   lambdaRole: DcpServiceRole;
  // };
  // readonly codepipeline: {
  //   pipelineServiceRole: DcpServiceRole;
  //   // envConfigs: TDeployEnv[];
  // };
  readonly codecommit: {
    repository: IRepository;
  };
  // readonly codebuild: {
  //   projects: {
  //     [id: string]: Project;
  //   };
  // };
}

export class PipelineResource extends Construct implements IPipelineResource {
  // readonly codebuild: { projects: { [p: string]: Project } };
  readonly codecommit: { repository: IRepository };
  readonly codepipeline: {
    pipelineServiceRole: DcpServiceRole;
    // envConfigs: TDeployEnv[];
  };
  readonly event: {
    eventRole: DcpServiceRole;
    trigger: NodejsFunction;
    lambdaRole: DcpServiceRole;
  };

  // readonly s3: { artifactBucket: Bucket };

  constructor(scope: Construct, props: TPipelineConfig) {
    super(scope, 'Resources');

    const repository = Repository.fromRepositoryName(
      this,
      'BackendRepos',
      props.common.source
    );

    // this.codebuild = {
    //   projects,
    // };
    // this.s3 = {
    //   artifactBucket,
    // };
    this.codecommit = {
      repository,
    };
    // this.event = {
    //   eventRole,
    //   trigger: handler,
    //   lambdaRole,
    // };
    // this.codepipeline = {
    //   pipelineServiceRole,
    //   // envConfigs,
    // };
  }
}
