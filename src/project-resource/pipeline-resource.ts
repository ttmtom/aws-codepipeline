import { Construct } from 'constructs'
import { IPulseBackendConfig, TDeployEnv } from '../types/config.interface'
import * as path from 'path'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { IRepository, Repository } from 'aws-cdk-lib/aws-codecommit'
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3'
import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import {
  BuildSpec,
  ComputeType,
  LinuxBuildImage,
  PipelineProject,
  Project,
} from 'aws-cdk-lib/aws-codebuild'
import { DcpServiceRole } from '../common/iam/DcpRole'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { PROJECT_NAME } from '../config'

export interface IPipelineResource {
  readonly s3: {
    artifactBucket: Bucket
  }
  readonly event: {
    eventRole: DcpServiceRole
    trigger: NodejsFunction
    lambdaRole: DcpServiceRole
  }
  readonly codepipeline: {
    pipelineServiceRole: DcpServiceRole
    // envConfigs: TDeployEnv[];
  }
  readonly codecommit: {
    repository: IRepository
  }
  readonly codebuild: {
    projects: {
      [id: string]: Project
    }
  }
}

export class PipelineResource extends Construct implements IPipelineResource {
  readonly codebuild: { projects: { [p: string]: Project } }
  readonly codecommit: { repository: IRepository }
  readonly codepipeline: {
    pipelineServiceRole: DcpServiceRole
    // envConfigs: TDeployEnv[];
  }
  readonly event: {
    eventRole: DcpServiceRole
    trigger: NodejsFunction
    lambdaRole: DcpServiceRole
  }

  readonly s3: { artifactBucket: Bucket }

  constructor(scope: Construct, props: IPulseBackendConfig['common']) {
    super(scope, 'Resources')

    const repository = Repository.fromRepositoryName(
      this,
      'BackendRepos',
      props.repositoryName
    )

    const artifactBucket = new Bucket(this, `${PROJECT_NAME}ArtifactBucket`, {
      bucketName: props.artifactBucketName,
      enforceSSL: true,
      publicReadAccess: false,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: false,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      // eventBridgeEnabled: true,
    })

    const pipelineServiceRole = DcpServiceRole.newRole(
      this,
      `PipelineServiceRole`,
      {
        name: `${PROJECT_NAME}-pipeline-role`,
        description:
          'This service role will be used for Fwd ai studio backend Pipelines',
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
            resources: [`arn:aws:s3:::${props.artifactBucketName}`],
          },
        },
      }
    )

    const eventRole = DcpServiceRole.newRole(this, `EventRulesServiceRole`, {
      name: `${PROJECT_NAME}-rule-role`,
      description:
        'This service role will be used for Fwd ai studio backend Event to start the pipelines',
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
    })

    const projectRole = DcpServiceRole.newRole(this, `CodebuildProjectRole`, {
      name: `${PROJECT_NAME}-project-role`,
      description:
        'Fwd Copilot AI studio backend Project Role - for ai studio Backend related CodeBuild projects',
      trustRootPrincipal: false,
      principal: {
        services: ['codebuild'],
      },
      allowResourceActions: {
        s3: {
          actions: [
            'GetObject',
            'GetBucket',
            'List*',
            'DeleteObject',
            'PutObject',
            'Abort',
          ],
          resources: ['*'],
        },
        codecommit: {
          actions: ['*'],
          resources: ['*'],
        },
        sts: {
          actions: ['AssumeRole'],
          resources: ['*'],
        },
        codepipeline: {
          actions: ['GetPipelineState', 'PutApprovalResult'],
          resources: ['*'],
        },
      },
    })

    const projects: { [p: string]: Project } = {}
    props.codebuild.projects.forEach((projectSettings) => {
      projects[projectSettings.stage] = new PipelineProject(
        this,
        `codebuild-${projectSettings.stage}`,
        {
          projectName: `${PROJECT_NAME}-${projectSettings.projectName}`,
          environment: {
            buildImage: LinuxBuildImage.fromCodeBuildImageId(
              'aws/codebuild/standard:7.0'
            ),
            computeType: ComputeType.SMALL,
            environmentVariables: projectSettings.environmentVariables,
          },
          role: projectRole,
          buildSpec: BuildSpec.fromObject(
            yaml.load(
              fs.readFileSync(
                path.resolve(
                  __dirname,
                  `../buildSpecs/${projectSettings.buildSpecYaml}`
                ),
                'utf8'
              )
            ) as {
              [key: string]: never
            }
          ),
          timeout: Duration.minutes(15),
        }
      )
    })

    const lambdaRole = DcpServiceRole.new(this, `LambdaServiceRole`, {
      name: `${PROJECT_NAME}-pipeline-lambda-role`,
      description: '',
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
    })

    const handler = new NodejsFunction(this, 'OnCommitHandler', {
      functionName: `${PROJECT_NAME}-pipeline-on-commit-handler`,
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/handler/on-commit-handler.ts'),
      handler: 'handler',
      timeout: Duration.minutes(10),
      role: lambdaRole,
      bundling: {
        tsconfig: path.join('./tsconfig.json'),
        externalModules: ['aws-sdk'],
      },
      environment: {
        REPOSITORY_ARN: repository.repositoryArn,
      },
    })

    this.codebuild = {
      projects,
    }
    this.s3 = {
      artifactBucket,
    }
    this.codecommit = {
      repository,
    }
    this.event = {
      eventRole,
      trigger: handler,
      lambdaRole,
    }
    this.codepipeline = {
      pipelineServiceRole,
      // envConfigs,
    }
  }
}
