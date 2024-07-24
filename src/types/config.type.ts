import { z } from 'zod';
import {
  BuildEnvironmentVariable,
  BuildEnvironmentVariableType,
} from 'aws-cdk-lib/aws-codebuild';

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

export const PipelineConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name is required' }),
  source: z.string().min(1, { message: 'Source is required' }),
  codebuilds: z.array(
    z.object({
      projectName: z.string().min(1, { message: 'Project name is required' }),
      buildSpecYaml: z.string().min(1, { message: 'Build spec is required' }),
      environmentVariables: z.record(BuildEnvironmentVariableSchema).optional(),
    })
  ),
  iam: z.object({
    // pipelineServiceRole: IamServiceRoleSchema.optional(),
    // eventRole: IamServiceRoleSchema.optional(),
    // lambdaRole: IamServiceRoleSchema.optional(),
    codebuildRole: IamServiceRoleSchema,
  }),
});

export type TPipelineConfig = z.infer<typeof PipelineConfigSchema>;
