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
  if (!event.detail.commitId) {
    throw new Error('Unexpected event detail, missing commitId');
  }
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
      sourceRevisions: [
        {
          actionName: matchedPipeline.stages[0].actions[0].name,
          revisionType: 'COMMIT_ID',
          revisionValue: event.detail.commitId,
        },
      ],
      variables: [
        {
          name: 'EVENT_commitId',
          value: event.detail.commitId,
        },
        {
          name: 'EVENT_event',
          value: event.detail.event ?? 'error:empty',
        },
        {
          name: 'EVENT_oldCommitId',
          value: event.detail.oldCommitId ?? 'error:empty',
        },
        {
          name: 'EVENT_referenceName',
          value: event.detail.referenceName ?? 'error:empty',
        },
        {
          name: 'EVENT_referenceType',
          value: event.detail.referenceType ?? 'error:empty',
        },
        {
          name: 'EVENT_repositoryName',
          value: event.detail.repositoryName ?? 'error:empty',
        },
      ],
    });

    try {
      console.log('----- command');
      console.log(JSON.stringify(command, null, 2));
      const data = await client.send(command);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.log('--error--');
      console.log(JSON.stringify(error));
    }
  }
};
