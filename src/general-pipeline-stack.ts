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
      codecommit,
      codebuild: { projects },
      lambdas,
    } = resource;

    const { pipelineName, trigger, stages, environmentVariables } = props;

    const cicd = new Pipeline(
      this,
      `fwd-${commonConfig.projectName}-${pipelineName}-pipeline`,
      {
        pipelineName: `fwd-${commonConfig.projectName}-${pipelineName}-pipeline`,
        pipelineType: PipelineType.V2,
        variables: environmentVariables.map(
          (envVar) =>
            new Variable({
              variableName: envVar.variableName,
              defaultValue: envVar.defaultValue,
            })
        ),
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
                  repository: codecommit[action.configuration.repositoryId],
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
                  project: projects[action.projectId],
                  input: this.getArtifact(action.configuration.inputArtifact),
                  outputs: action.configuration.hasOutput
                    ? [this.getArtifact(action.name)]
                    : [],
                  environmentVariables: {
                    TARGET_BRANCH: { value: '#{variables.TARGET_BRANCH}' },
                  },
                  role: roles.pipelineServiceRole,
                });
              } else if (isApprovalAction(action)) {
                return new ManualApprovalAction({
                  actionName: action.name,
                  role: roles.pipelineServiceRole,
                });
              }
            }),
          };
        }),
      }
    );

    const rule = new Rule(this, `${pipelineName}-trigger-${trigger.id}`, {
      eventPattern: {
        source: ['aws.codecommit'],
        detailType: trigger.detailType,
        resources: trigger.repositories.map((repos) => {
          return codecommit[repos].repositoryArn;
        }),
        detail: trigger.detail,
      },
    });
    rule.addTarget(new targets.LambdaFunction(lambdas.eventTrigger));
  }

  private getArtifact(stage: string): Artifact {
    return this.artifacts[stage];
  }
}
