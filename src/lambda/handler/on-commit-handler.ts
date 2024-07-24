import {
  CodePipelineClient,
  StartPipelineExecutionCommand,
} from '@aws-sdk/client-codepipeline'
import { EventBridgeEvent } from 'aws-lambda'
import { PIPELINE_CONFIG } from '../../config'

type TCodecommitEventDetail = {
  callerUserArn: string
  commitId: string
  event: string
  oldCommitId: string
  referenceFullName: string
  referenceName: string
  referenceType: string
  repositoryId: string
  repositoryName: string
}

export const handler = async (
  event: EventBridgeEvent<string, TCodecommitEventDetail>
) => {
  console.log(event)
  const refName = event.detail.referenceName
  const commitId = event.detail.commitId

  const matchedEnv = PIPELINE_CONFIG.deployEnvs.find((deployEnv) => {
    const { branchRule } = deployEnv
    return branchRule.referenceName.find((ref) => {
      if (typeof ref === 'string') {
        return ref === refName
      } else {
        return ref.prefix ? refName.startsWith(ref.prefix) : false
      }
    })
  })
  if (matchedEnv) {
    console.log('matchedEnv', matchedEnv)
    const client = new CodePipelineClient({
      region: process.env.AWS_REGION ?? 'ap-southeast-1',
    })
    console.log(`${PIPELINE_CONFIG.common.repositoryName}-${matchedEnv.id}`)

    const command = new StartPipelineExecutionCommand({
      name: `${PIPELINE_CONFIG.common.pipelineName}-${matchedEnv.id}`,
      variables: [
        {
          name: 'TARGET_BRANCH',
          value: refName,
        },
        {
          name: 'TAG_VERSION',
          value: matchedEnv.tagVersionOnBuild ? 'true' : 'false',
        },
        ...matchedEnv.pipelineVar,
      ],
    })
    try {
      const data = await client.send(command)
      console.log(JSON.stringify(data))
    } catch (error) {
      console.log('--error--')
      console.log(JSON.stringify(error))
    }
  }
}
