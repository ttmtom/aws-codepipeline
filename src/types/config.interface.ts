import { BuildEnvironmentVariable } from 'aws-cdk-lib/aws-codebuild/lib/project'
import { PipelineVariable } from '@aws-sdk/client-codepipeline/dist-types/models/models_0'

export enum PIPELINE_STAGE {
  SOURCE = 'source',
  TEST = 'test',
  APPROVAL = 'approval',
  AUTO_APPROVAL = 'auto-approval',
  DEPLOY = 'deploy',
}

export interface IPulseBackendConfig {
  common: {
    repositoryName: string
    artifactBucketName: string
    pipelineName: string
    codebuild: {
      projects: {
        stage: PIPELINE_STAGE
        projectName: string
        buildSpecYaml: string
        environmentVariables?: {
          [name: string]: BuildEnvironmentVariable
        }
      }[]
    }
  }
  deployEnvs: TDeployEnv[]
}

export type TDeployEnv = {
  id: string
  tagVersionOnBuild?: boolean
  autoDeploy?: boolean
  branchRule: {
    id: string
    referenceName: (
      | string
      | {
          prefix?: string
          suffix?: string
        }
    )[]
    event: string[]
    detailType: string[]
  }
  pipelineVar: PipelineVariable[]
}
