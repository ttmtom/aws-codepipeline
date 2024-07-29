import { DefaultStackSynthesizer, Stack, type StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import {
  Artifact,
  Pipeline,
  PipelineType,
  Variable,
} from 'aws-cdk-lib/aws-codepipeline';
import {
  CodeBuildAction,
  CodeBuildActionType,
  CodeCommitSourceAction,
  CodeCommitTrigger,
  ManualApprovalAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { Rule } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { DcpHelper } from './common/helper/DcpHelper';
import { PipelineResource } from './project-resource/pipeline-resource';
import {
  TGeneralPipelineConfig,
  TPipelineConfig,
  isApprovalAction,
  isCodebuildAction,
  isSourceAction,
} from './types/config.type';
import { CodecommitEventVariable } from './project-resource/codecommit-event-variable';
import { getPipelineName } from './project-resource/helper';

export class GeneralPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    config: TGeneralPipelineConfig
  ) {
    super(scope, id, {
      ...props,
      ...{
        synthesizer: new DefaultStackSynthesizer({
          generateBootstrapVersionRule: false,
          qualifier: 'dcp-svc',
          ...DcpHelper.getCdkOverrideRoles(props.env),
        }),
      },
    });

    const pr = new PipelineResource(this, config);
    config.codePipelines.forEach((pipeline) => {
      new CaiPipeline(this, config, pipeline, pr);
    });
  }
}

class CaiPipeline extends Construct {
  private artifacts: { [key: string]: Artifact } = {};

  constructor(
    scope: Construct,
    commonConfig: Exclude<TGeneralPipelineConfig, 'codePipelines'>,
    props: TPipelineConfig,
    resource: PipelineResource
  ) {
    super(scope, `${commonConfig.projectName}-pipeline-${props.pipelineName}`);
    const {
      s3,
      iam: { roles },
      codecommit: { repositories },
      codebuild: { projects },
      lambdas,
    } = resource;

    const { pipelineName, trigger, stages, variables } = props;

    const cicd = new Pipeline(
      this,
      `fwd-${commonConfig.projectName}-${pipelineName}-pipeline`,
      {
        pipelineName: getPipelineName(commonConfig.projectName, pipelineName),
        pipelineType: PipelineType.V2,
        variables: [
          ...variables.map(
            (envVar) =>
              new Variable({
                variableName: envVar.variableName,
                defaultValue: envVar.defaultValue,
              })
          ),
          ...CodecommitEventVariable,
        ],
        restartExecutionOnUpdate: false,
        artifactBucket: s3.artifactBucket,
        role: roles.pipelineServiceRole,
        stages: stages.map((stage) => {
          return {
            stageName: stage.stageName,
            actions: stage.actions.map((action) => {
              if (isSourceAction(action)) {
                return new CodeCommitSourceAction({
                  actionName: action.name,
                  repository: this.getRepository(
                    repositories,
                    action.configuration.repositoryId
                  ),
                  output: this.getArtifact(action.name),
                  trigger: CodeCommitTrigger.NONE,
                  branch: action.configuration.branch ?? 'main',
                  role: roles.pipelineServiceRole,
                  codeBuildCloneOutput: true,
                });
              } else if (isCodebuildAction(action)) {
                return new CodeBuildAction({
                  type: action.configuration.type ?? CodeBuildActionType.TEST,
                  actionName: action.name,
                  project: this.getProject(
                    projects,
                    action.configuration.projectName
                  ),
                  input: this.getArtifact(action.configuration.inputArtifact),
                  outputs: action.configuration.hasOutput
                    ? [this.getArtifact(action.name)]
                    : [],
                  environmentVariables:
                    action.configuration.environmentVariables,
                  role: roles.pipelineServiceRole,
                });
              } else if (isApprovalAction(action)) {
                return new ManualApprovalAction({
                  actionName: action.name,
                  role: roles.pipelineServiceRole,
                });
              }
              throw new Error('Invalid action type');
            }),
          };
        }),
      }
    );

    const rule = new Rule(this, `${pipelineName}-trigger-${trigger.id}`, {
      eventPattern: {
        source: ['aws.codecommit'],
        detailType: trigger.detailType,
        resources: trigger.repositories.map(
          (repos) => this.getRepository(repositories, repos).repositoryArn
        ),
        detail: trigger.detail,
      },
    });
    rule.addTarget(new targets.LambdaFunction(lambdas.eventTrigger));
  }

  private getRepository(
    repositories: PipelineResource['codecommit']['repositories'],
    repositoryId: string
  ) {
    if (!repositories[repositoryId]) {
      throw new Error(`Repository ${repositoryId} not found`);
    }
    return repositories[repositoryId];
  }

  private getArtifact(stage: string): Artifact {
    if (this.artifacts[stage]) {
      return this.artifacts[stage];
    }
    this.artifacts[stage] = new Artifact(stage);
    return this.artifacts[stage];
  }

  private getProject(
    projects: PipelineResource['codebuild']['projects'],
    projectId: string
  ) {
    const project = projects[projectId];
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project;
  }
}
