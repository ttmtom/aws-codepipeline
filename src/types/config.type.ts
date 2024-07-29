import { z } from 'zod';
import {
  BuildEnvironmentVariable,
  BuildEnvironmentVariableType,
  ComputeType,
} from 'aws-cdk-lib/aws-codebuild';
import { Duration } from 'aws-cdk-lib/core';

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

export const PipelineConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name is required' }),
  sources: z.array(
    z.object({
      projectId: z.string().min(1, { message: 'Project id is required' }),
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
});

export type TPipelineConfig = z.infer<typeof PipelineConfigSchema>;
