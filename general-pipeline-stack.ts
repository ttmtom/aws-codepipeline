import { DefaultStackSynthesizer, Stack, type StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
// import {
//   Artifact,
//   Pipeline,
//   PipelineType,
//   Variable,
// } from 'aws-cdk-lib/aws-codepipeline'
// import {
//   CodeBuildAction,
//   CodeBuildActionType,
//   CodeCommitSourceAction,
//   CodeCommitTrigger,
//   ManualApprovalAction,
// } from 'aws-cdk-lib/aws-codepipeline-actions'
// import { Rule } from 'aws-cdk-lib/aws-events'
// import * as targets from 'aws-cdk-lib/aws-events-targets'
import { DcpHelper } from './src/common/helper/DcpHelper';
import { PipelineResource } from './src/project-resource/pipeline-resource';
import { TPipelineConfig } from './src/types/config.type';

export class GeneralPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    config: TPipelineConfig
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
  }
}

// class PulsePipeline extends Construct {
//   constructor(
//     scope: Construct,
//     deployEnv: TDeployEnv,
//     props: PipelineResource,
//     config: IPulseBackendConfig['common']
//   ) {
//     super(scope, `${deployEnv.id}-pipeline`)
//     const { s3, codecommit, codepipeline, codebuild, event } = props
//     const artifacts: {
//       [key in PIPELINE_STAGE]: Artifact
//     } = Object.values(PIPELINE_STAGE).reduce(
//       (acc: { [key in PIPELINE_STAGE]: Artifact }, stage: PIPELINE_STAGE) => {
//         acc[stage] = new Artifact(stage)
//         return acc
//       },
//       {} as { [key in PIPELINE_STAGE]: Artifact }
//     )
//     const cicd = new Pipeline(
//       this,
//       `fwd-ai-studio-backend-cicd-${deployEnv.id}`,
//       {
//         pipelineName: `${config.pipelineName}-${deployEnv.id}`,
//         pipelineType: PipelineType.V2,
//         variables: [
//           new Variable({
//             variableName: 'TARGET_BRANCH',
//             defaultValue: 'main',
//           }),
//           new Variable({
//             variableName: 'TARGET_ENV',
//             defaultValue: deployEnv.id,
//           }),
//           new Variable({
//             variableName: 'TARGET_SERVICE_ROLE',
//             defaultValue: 'role_arn',
//           }),
//           new Variable({
//             variableName: 'TAG_VERSION',
//             defaultValue: 'false',
//           }),
//         ],
//         restartExecutionOnUpdate: false,
//         artifactBucket: s3.artifactBucket,
//         role: codepipeline.pipelineServiceRole,
//         stages: [
//           {
//             stageName: PIPELINE_STAGE.SOURCE,
//             actions: [
//               new CodeCommitSourceAction({
//                 actionName: PIPELINE_STAGE.SOURCE,
//                 repository: codecommit.repository,
//                 output: artifacts[PIPELINE_STAGE.SOURCE],
//                 trigger: CodeCommitTrigger.NONE,
//                 branch: 'main',
//                 role: codepipeline.pipelineServiceRole,
//                 codeBuildCloneOutput: true,
//               }),
//             ],
//           },
//           {
//             stageName: PIPELINE_STAGE.TEST,
//             actions: [
//               new CodeBuildAction({
//                 type: CodeBuildActionType.TEST,
//                 actionName: PIPELINE_STAGE.TEST,
//                 project: codebuild.projects[PIPELINE_STAGE.TEST],
//                 input: artifacts[PIPELINE_STAGE.SOURCE],
//                 environmentVariables: {
//                   TARGET_BRANCH: { value: '#{variables.TARGET_BRANCH}' },
//                 },
//                 role: codepipeline.pipelineServiceRole,
//               }),
//             ],
//           },
//           ...(!deployEnv.autoDeploy
//             ? [
//                 {
//                   stageName: PIPELINE_STAGE.APPROVAL,
//                   actions: [
//                     new ManualApprovalAction({
//                       actionName: PIPELINE_STAGE.APPROVAL,
//                       role: codepipeline.pipelineServiceRole,
//                     }),
//                   ],
//                 },
//               ]
//             : []),
//           {
//             stageName: PIPELINE_STAGE.DEPLOY,
//             actions: [
//               new CodeBuildAction({
//                 type: CodeBuildActionType.BUILD,
//                 actionName: PIPELINE_STAGE.DEPLOY,
//                 project: codebuild.projects[PIPELINE_STAGE.DEPLOY],
//                 input: artifacts[PIPELINE_STAGE.SOURCE],
//                 environmentVariables: {
//                   TARGET_BRANCH: { value: '#{variables.TARGET_BRANCH}' },
//                   TARGET_SERVICE_ROLE: {
//                     value: '#{variables.TARGET_SERVICE_ROLE}',
//                   },
//                   TARGET_ENV: { value: '#{variables.TARGET_ENV}' },
//                   TAG_VERSION: { value: `#{variables.TAG_VERSION}` },
//                 },
//                 role: codepipeline.pipelineServiceRole,
//               }),
//             ],
//           },
//         ],
//       }
//     )
//
//     const rule = new Rule(this, `on-${deployEnv.id}-branch-commit`, {
//       eventPattern: {
//         source: ['aws.codecommit'],
//         detailType: deployEnv.branchRule.detailType,
//         resources: [codecommit.repository.repositoryArn],
//         detail: {
//           referenceType: ['branch'],
//           referenceName: deployEnv.branchRule.referenceName,
//           event: deployEnv.branchRule.event,
//         },
//       },
//     })
//     rule.addTarget(new targets.LambdaFunction(event.trigger))
//   }
// }
