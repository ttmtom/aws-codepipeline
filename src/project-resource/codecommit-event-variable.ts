import { Variable } from 'aws-cdk-lib/aws-codepipeline';

export const CodecommitEventVariable: Variable[] = [
  new Variable({
    variableName: `EVENT_commitId`,
  }),
  new Variable({
    variableName: `EVENT_oldCommitId`,
  }),
  new Variable({
    variableName: `EVENT_event`,
  }),
  new Variable({
    variableName: `EVENT_referenceName`,
  }),
  new Variable({
    variableName: `evnet_referenceType`,
  }),
  new Variable({
    variableName: `EVENT_repositoryName`,
  }),
];
