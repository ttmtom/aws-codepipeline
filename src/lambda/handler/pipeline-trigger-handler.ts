import {
  CodePipelineClient,
  StartPipelineExecutionCommand,
} from '@aws-sdk/client-codepipeline';
import { EventBridgeEvent } from 'aws-lambda';
import jsonObject from '../../config.json';
import { TGeneralPipelineConfig } from '../../types/config.type';
import { getPipelineName } from '../../project-resource/helper';

const CONFIG = jsonObject as TGeneralPipelineConfig;

type TCodecommitEventDetail = {
  callerUserArn: string;
  commitId: string;
  event: string;
  oldCommitId: string;
  referenceFullName: string;
  referenceName: string;
  referenceType: string;
  repositoryId: string;
  repositoryName: string;
};

export const handler = async (
  event: EventBridgeEvent<string, TCodecommitEventDetail>
) => {
  console.log(event);
  const refName = event.detail.referenceName;

  const matchedPipeline = CONFIG.codePipelines.find((pipelineConfig) => {
    const { trigger } = pipelineConfig;
    return trigger.detail.referenceName.find((ref) => {
      if (typeof ref === 'string') {
        return ref === refName;
      } else {
        return ref.prefix ? refName.startsWith(ref.prefix) : false;
      }
    });
  });
  if (matchedPipeline) {
    console.log('matchedPipeline', matchedPipeline);
    const client = new CodePipelineClient({
      region: process.env.AWS_REGION ?? 'ap-southeast-1',
    });

    const command = new StartPipelineExecutionCommand({
      name: getPipelineName(CONFIG.projectName, matchedPipeline.pipelineName),
      variables: Object.keys(event.detail).flatMap((key) => {
        return {
          name: `EVENT_${key}`,
          value: event.detail[key],
        };
      }),
    });

    try {
      const data = await client.send(command);
      console.log(JSON.stringify(data));
    } catch (error) {
      console.log('--error--');
      console.log(JSON.stringify(error));
    }
  }
};
