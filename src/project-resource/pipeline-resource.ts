import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { IRepository, Repository } from 'aws-cdk-lib/aws-codecommit';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
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

  constructor(scope: Construct, config: TPipelineConfig) {
    super(scope, 'Resources');

    const repository = Repository.fromRepositoryName(
      this,
      'SourceRepos',
      config.source
    );

    const artifactBucket = new Bucket(
      this,
      `${config.projectName}-artifact-bucket`,
      {
        bucketName: `${config.projectName}-artifact-bucket`,
        enforceSSL: true,
        publicReadAccess: false,
        encryption: BucketEncryption.S3_MANAGED,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: false,
        removalPolicy: RemovalPolicy.DESTROY,
        versioned: true,
      }
    );

    const pipelineServiceRole = DcpServiceRole.newRole(
      this,
      `PipelineServiceRole`,
      {
        name: `${config.projectName}-pipeline-role`,
        description: `This service role will be used for ${config.projectName} Pipelines`,
        trustRootPrincipal: false,
        principal: {
          services: [
            // ...config.iam.pipelineServiceRole?.principalServices,
            'codepipeline',
          ],
        },
        allowResourceActions: {
          s3: {
            actions: [
              'GetObject',
              'GetBucket',
              'List*',
              'DeleteObject',
              'PutObject',
              'Abort*',
            ],
            resources: [`arn:aws:s3:::${artifactBucket.bucketName}`],
          },
        },
      }
    );

    const eventRole = DcpServiceRole.newRole(this, `EventRulesServiceRole`, {
      name: `${config.projectName}-rule-role`,
      description: `This service role will be used for ${config.projectName} Event to start the pipelines`,
      trustRootPrincipal: false,
      principal: {
        services: ['events'],
      },
      allowResourceActions: {
        codepipeline: {
          actions: ['StartPipelineExecution'],
          resources: ['*'],
        },
      },
    });

    const projectRole = DcpServiceRole.newRole(this, `CodebuildProjectRole`, {
      name: `${config.projectName}-project-role`,
      description: `This service role will be used for ${config.projectName} Codebuild projects`,
      trustRootPrincipal: false,
      principal: {
        services: config.iam.codebuildRole.principalServices,
      },
      allowResourceActions: config.iam.codebuildRole.allowActions,
    });

    const lambdaRole = DcpServiceRole.new(this, `LambdaServiceRole`, {
      name: `${config.projectName}-pipeline-lambda-role`,
      description: `This service role will be used for ${config.projectName} Lambda functions`,
      trustRootPrincipal: false,
      principal: {
        services: ['lambda'],
      },
      allowResourceActions: {
        codepipeline: {
          actions: ['StartPipelineExecution'],
          resources: ['*'],
        },
        logs: {
          actions: ['*'],
          resources: ['*'],
        },
      },
    });

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
