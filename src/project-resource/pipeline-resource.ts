import { Construct } from 'constructs';
import { IRepository, Repository } from 'aws-cdk-lib/aws-codecommit';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  BuildSpec,
  ComputeType,
  LinuxBuildImage,
  PipelineProject,
  Project,
} from 'aws-cdk-lib/aws-codebuild';
import { DcpServiceRole } from '../common/iam/DcpRole';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { TGeneralPipelineConfig } from '../types/config.type';
import path from 'path';
import yaml from 'js-yaml';
import * as fs from 'node:fs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export interface IPipelineResource {
  readonly s3: {
    artifactBucket: Bucket;
  };
  readonly codecommit: {
    repositories: { [key: string]: IRepository };
  };
  readonly codebuild: {
    projects: {
      [id: string]: Project;
    };
  };
  readonly iam: {
    roles: {
      pipelineServiceRole: DcpServiceRole;
      eventRole: DcpServiceRole;
      lambdaRole: DcpServiceRole;
      projectRole: DcpServiceRole;
    };
  };
  readonly lambdas: {
    eventTrigger: NodejsFunction;
  };
}

export class PipelineResource extends Construct implements IPipelineResource {
  readonly codebuild: { projects: { [p: string]: Project } };
  readonly codecommit: {
    repositories: { [key: string]: IRepository };
  };
  readonly iam: {
    roles: {
      pipelineServiceRole: DcpServiceRole;
      eventRole: DcpServiceRole;
      lambdaRole: DcpServiceRole;
      projectRole: DcpServiceRole;
    };
  };
  readonly s3: { artifactBucket: Bucket };
  readonly lambdas: { eventTrigger: NodejsFunction };

  constructor(scope: Construct, config: TGeneralPipelineConfig) {
    super(scope, 'Resources');
    const { projectName } = config;

    const artifactBucket = new Bucket(this, `${projectName}-artifact-bucket`, {
      bucketName: `${projectName}-artifact-bucket`,
      enforceSSL: true,
      publicReadAccess: false,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: false,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
    });
    const repositories: {
      [key: string]: IRepository;
    } = {};
    config.sources.map((source) => {
      repositories[source.id] = Repository.fromRepositoryName(this, `repository-${source.id}`, source.repositoryName);
    });
    const pipelineServiceRole = DcpServiceRole.newRole(
      this,
      `pipeline-service-role`,
      {
        name: `${config.projectName}-pipeline-role`,
        description: `This service role will be used for ${config.projectName} Pipelines`,
        trustRootPrincipal: false,
        principal: {
          services: ['codepipeline'],
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

    const eventRole = DcpServiceRole.newRole(this, `event-service-role`, {
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

    const projectRole = DcpServiceRole.newRole(this, `codebuild-project-role`, {
      name: `${config.projectName}-project-role`,
      description: `This service role will be used for ${config.projectName} Codebuild projects`,
      trustRootPrincipal: false,
      principal: {
        services: config.iam.codebuildRole.principalServices,
      },
      allowResourceActions: config.iam.codebuildRole.allowActions,
    });

    const lambdaRole = DcpServiceRole.new(this, `lambda-service-role`, {
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

    const projects: {
      [key: string]: Project;
    } = {};
    config.codebuilds.forEach((build) => {
      projects[build.projectName] = new PipelineProject(
        this,
        `codebuild-${build.projectName}`,
        {
          projectName: `${projectName}-${build.projectName}`,
          environment: {
            buildImage: LinuxBuildImage.fromCodeBuildImageId(
              build.imageId ?? 'aws/codebuild/standard:7.0'
            ),
            computeType: build.computerType ?? ComputeType.SMALL,
            environmentVariables: build.environmentVariables,
          },
          role: projectRole,
          buildSpec: BuildSpec.fromObject(
            yaml.load(
              fs.readFileSync(
                path.resolve(
                  __dirname,
                  `../../../buildSpecs/${build.buildSpecYaml}`
                ),
                'utf8'
              )
            ) as {
              [key: string]: never;
            }
          ),
          timeout: Duration.minutes(build.timeout ?? 15),
        }
      );
    });

    const eventTrigger = new NodejsFunction(this, 'trigger-handler', {
      functionName: `${projectName}-pipeline-trigger-handler`,
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(
        __dirname,
        '../lambda/handler/pipeline-trigger-handler.ts'
      ),
      handler: 'handler',
      timeout: Duration.minutes(10),
      role: lambdaRole,
      bundling: {
        tsconfig: path.join('./tsconfig.json'),
        externalModules: ['aws-sdk'],
      },
    });

    this.codebuild = {
      projects,
    };
    this.s3 = {
      artifactBucket,
    };
    this.codecommit = {
      repositories,
    };
    this.iam = {
      roles: {
        pipelineServiceRole,
        eventRole,
        lambdaRole,
        projectRole,
      },
    };
    this.lambdas = {
      eventTrigger,
    };
  }
}
