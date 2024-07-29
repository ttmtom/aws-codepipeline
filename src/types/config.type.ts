import { z } from 'zod';
import {
  BuildEnvironmentVariable,
  BuildEnvironmentVariableType,
  ComputeType,
} from 'aws-cdk-lib/aws-codebuild';
import { CodeBuildActionType } from 'aws-cdk-lib/aws-codepipeline-actions';

export enum PipelineActionType {
  SOURCE = 'source',
  CODEBUILD = 'codebuild',
  APPROVAL = 'approval',
}

const BuildEnvironmentVariableSchema: z.ZodType<BuildEnvironmentVariable> =
  z.object({
    type: z.nativeEnum(BuildEnvironmentVariableType),
    value: z.string(),
  });

const IamServiceRoleSchema = z.object({
  allowActions: z.record(
    z.object({
      actions: z.array(z.string()),
      resources: z.array(z.string()),
    })
  ),
  principalServices: z.array(z.string()),
});

const CodebuildConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name is required' }),
  buildSpecYaml: z.string().min(1, { message: 'Build spec is required' }),
  environmentVariables: z.record(BuildEnvironmentVariableSchema).optional(),
  imageId: z.string().optional(),
  computerType: z.nativeEnum(ComputeType).optional(),
  timeout: z.number().max(15).optional(),
});

const PipelineActionBaseSchema = z.object({
  name: z.string().min(1, { message: 'action name is required' }),
  type: z.nativeEnum(PipelineActionType),
});

type TPipelineActionBase = z.infer<typeof PipelineActionBaseSchema>;

const PipelineSourceActionSchema = PipelineActionBaseSchema.extend({
  type: z.literal(PipelineActionType.SOURCE),
  configuration: z.object({
    branch: z.string().optional(),
    repositoryId: z.string().min(1, { message: 'Repository id is required' }),
  }),
});

type TPipelineSourceAction = z.infer<typeof PipelineSourceActionSchema>;

export const isSourceAction = (
  action: TPipelineActionBase
): action is TPipelineSourceAction => {
  return action.type === PipelineActionType.SOURCE;
};

const PipelineCodebuildActionSchema = PipelineActionBaseSchema.extend({
  type: z.literal(PipelineActionType.CODEBUILD),
  configuration: z.object({
    type: z.nativeEnum(CodeBuildActionType).optional(),
    projectName: z.string().min(1, { message: 'Project name is required' }),
    inputArtifact: z.string(),
    hasOutput: z.boolean().optional(),
    environmentVariables: z
      .record(
        z.object({
          value: z.string(),
        })
      )
      .optional(),
  }),
});

type TPipelineCodebuildAction = z.infer<typeof PipelineCodebuildActionSchema>;

export const isCodebuildAction = (
  action: TPipelineActionBase
): action is TPipelineCodebuildAction => {
  return action.type === PipelineActionType.CODEBUILD;
};

const PipelineApprovalActionSchema = PipelineActionBaseSchema.extend({
  type: z.literal(PipelineActionType.APPROVAL),
});

type TPipelineApprovalAction = z.infer<typeof PipelineApprovalActionSchema>;

export const isApprovalAction = (
  action: TPipelineActionBase
): action is TPipelineApprovalAction => {
  return action.type === PipelineActionType.APPROVAL;
};

const CodePipelineSchema = z.object({
  pipelineName: z.string().min(1, { message: 'Pipeline name is required' }),
  stages: z.array(
    z.object({
      stageName: z.string().min(1, { message: 'Stage name is required' }),
      actions: z.array(
        z.union([
          PipelineCodebuildActionSchema,
          PipelineSourceActionSchema,
          PipelineApprovalActionSchema,
        ])
      ),
    })
  ),
  trigger: z.object({
    id: z.string(),
    detailType: z.array(z.string()),
    repositories: z.array(z.string()),
    detail: z.object({
      referenceType: z.array(z.string()),
      referenceName: z.array(
        z.union([
          z.string(),
          z.object({
            prefix: z.string().optional(),
            suffix: z.string().optional(),
          }),
        ])
      ),
      event: z.array(z.string()),
    }),
  }),
  variables: z.array(
    z.object({
      variableName: z.string(),
      defaultValue: z.string().optional(),
    })
  ),
});

export const PipelineConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name is required' }),
  sources: z.array(
    z.object({
      id: z.string().min(1, { message: 'Repository id is required' }),
      repositoryName: z
        .string()
        .min(1, { message: 'Repository name is required' }),
    })
  ),
  codebuilds: z.array(CodebuildConfigSchema),
  iam: z.object({
    // pipelineServiceRole: IamServiceRoleSchema.optional(),
    // eventRole: IamServiceRoleSchema.optional(),
    // lambdaRole: IamServiceRoleSchema.optional(),
    codebuildRole: IamServiceRoleSchema,
  }),
  codePipelines: z.array(CodePipelineSchema),
});

export type TPipelineConfig = z.infer<typeof CodePipelineSchema>;
export type TGeneralPipelineConfig = z.infer<typeof PipelineConfigSchema>;
