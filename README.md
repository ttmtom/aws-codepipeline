# Cai common pipeline

This is a common pipeline module for Cai project.
It is used to easy to create a pipeline using AWS service, CodePipeline, CodeBuild, S3 and Lambda.

## How to use

### Step

1. add this git repository as a submodule to your project `.gitmodules`
    ```
    [submodule "cicd/pipeline"]
        path = path/to/pipeline
        url = codecommit::
        branch = main
    ```
2. copy the `sample.config.yaml`, `sample.env` and `buildSpecs` folder to your project
   ```
   cicd
    |-.env
    |-config.yaml
    |-buildSpecs
    |  |-buildspec.yaml
    |  |-...
    |-pipelinefolder
    |  |-...
   ```
3. update the `config.yaml` and `.env` file
4. run `cicd/pipeline/deploy.sh` to deploy the pipeline

### Schema

#### config.yaml

| Key           |                              description                               |                                    type | required |      example | default |
|---------------|:----------------------------------------------------------------------:|----------------------------------------:|---------:|-------------:|--------:|
| projectName   |                    the project name of the pipeline                    |                                  string |        Y | orchestrator |     N/A |
| sources       |                      List of repositories source                       |              Array of [source](#source) |        Y |           -- |     N/A |
| codebuilds    |               List of codebuild for the pipeline action                |        Array of [codebuild](#codebuild) |        Y |           -- |     N/A |
| iam           | Object of aws role for codebuild to assume and do the required actions |              Object of [iam role](#iam) |        Y |           -- |     N/A |
| codePipelines |              List of codepipeline needed for the project               | Object of [codepipeline](#codepipeline) |        Y |           -- |     N/A |

#### source <a name="source">

| Key            |            description            |   type | required |                      example | default |
|----------------|:---------------------------------:|-------:|---------:|-----------------------------:|--------:|
| id             | the unique id for this repository | string |        Y |                 orchestrator |     N/A |
| repositoryName |    the name of the repository     | string |        Y | cai-llm-orchestrator-service |     N/A |

#### codebuild <a name="codebuild">

| Key                               |                         description                          |                    type | required |             example |                      default |
|-----------------------------------|:------------------------------------------------------------:|------------------------:|---------:|--------------------:|-----------------------------:|
| projectName                       |          the unique name for this codebuild project          |                  string |        Y |              deploy |                          N/A |
| buildSpecYaml                     |    the buildspec yaml name under the `buildSpecs` folder     |                  string |        Y |         deploy.yaml |                          N/A |
| environmentVariables              | Object of Variables, used on the codebuild project on `ENV`  |                  string |        N |                  -- |                          N/A |
| environmentVariables[name]        |                  the name of this env value                  |                  string |        N |                  -- |                          N/A |
| environmentVariables[name][value] |                          the value                           |                  string |        N |                  -- |                          N/A |
| environmentVariables[name][type]  | the type of the value see aws `BuildEnvironmentVariableType` |                  string |        N |                  -- |                          N/A |
| imageId                           |                The image id for the codebuild                |                  string |        N |                  -- | `aws/codebuild/standard:7.0` |
| computerType                      |             The computer type for this codebuild             | aws enume `ComputeType` |        N | `ComputeType.SMALL` |          `ComputeType.SMALL` |
| timeout                           |               The computer timeout in minutes                |         number (1 - 15) |        N |                  10 |                           15 |

#### iam <a name="iam">

| Key           |               description                |          type | required | example | default |
|---------------|:----------------------------------------:|--------------:|---------:|--------:|--------:|
| codebuildRole | the role settings for the codebuild role | [role](#role) |        Y |      -- |     N/A |

##### role

| Key                                  |               description                |            type | required |              example | default |
|--------------------------------------|:----------------------------------------:|----------------:|---------:|---------------------:|--------:|
| allowActions                         | The actions list for the allowed actions |          string |        Y |                   -- |     N/A |
| allowActions[serviceName]            |      The service name of the action      |          string |        Y |                 `s3` |     N/A |
| allowActions[serviceName][actions]   |             Array of actions             | Array of string |        Y | `GetObject`, `List*` |     N/A |
| allowActions[serviceName][resources] |            Array of resources            | Array of string |        Y |         `*`, `{arn}` |     N/A |
| principalServices                    |       Array of principal services        | Array of string |        Y |          `codebuild` |     N/A |

#### codepipeline <a name="codepipeline">

| Key                            |                    description                    |              type | required |                                         example | default |
|--------------------------------|:-------------------------------------------------:|------------------:|---------:|------------------------------------------------:|--------:|
| pipelineName                   |         The pipeline name of the pipeline         |            string |        Y |                                    orchestrator |     N/A |
| stages                         |                 The stage setting                 |    Array of stage |        Y |                                              -- |     N/A |
| stages[stageName]              |                  The stage name                   |            string |        Y |                                        `source` |     N/A |
| stages[actions]                |          The action to do in this stage           | [action](#action) |        Y |                                              -- |     N/A |
| trigger                        |           The trigger to start pipeline           |                   |        Y |                                              -- |     N/A |
| trigger[id]                    |                  The trigger id                   |            string |        Y |                                             dev |     N/A |
| trigger[detailType]            |          The `detailType` of the trigger          |   Array of string |        Y |            `CodeCommit Repository State Change` |     N/A |
| trigger[repositories]          | The repositories that listen to, map to source id |   Array of string |        Y |                                  `orchestrator` |     N/A |
| trigger[detail]                |        The detail setting for this trigger        |     detail object |        Y |                                              -- |     N/A |
| trigger[detail][referenceType] | The detail reference type (e.g. `branch`, `tag`)  |            string |        Y |                                           `tag` |     N/A |
| trigger[detail][referenceName] |         The pattern of the reference name         |   string or shape |        Y | `/main` or `{prefix: /release, suffix: hotfix}` |     N/A |
| trigger[detail][event]         |            The events of the reference            |   Array of string |        Y |          `referenceCreated`, `referenceUpdated` |     N/A |
| variables                      |       The variables needed for the actions        | Array of variable |        Y |                                              -- |     N/A |
| variables[name]                |             The variable unique name              |            string |        Y |                              `ENVIRONMENT_CODE` |     N/A |
| variables[value]               |                The variable value                 |            string |        Y |                                           `dev` |     N/A |

##### action

codebuild action

| Key                                          |                              description                               |                           type | required |                         example |                        default |
|----------------------------------------------|:----------------------------------------------------------------------:|-------------------------------:|---------:|--------------------------------:|-------------------------------:|
| name                                         |                           unique action name                           |                         string |        Y |                        `deploy` |                             -- |
| type                                         |                      PipelineActionType.CODEBUILD                      | `PipelineActionType.CODEBUILD` |        Y |                              -- | `PipelineActionType.CODEBUILD` |
| configuration                                |                        the action configuration                        |    source configuration object |        Y |                              -- |                             -- |
| configuration[type]                          |                       aws `CodeBuildActionType`                        |            CodeBuildActionType |        N |      `CodeBuildActionType.TEST` |    `CodeBuildActionType.BUILD` |
| configuration[projectName]                   |                   the project name map to codebuild                    |            CodeBuildActionType |        Y |                        `deploy` |                             -- |
| configuration[inputArtifact]                 |       the input artifact for the project, map to the action name       |                         string |        Y |                        `source` |                             -- |
| configuration[hasOutput]                     |      boolean to control would the action has the output artifact       |                        boolean |        N |                          `true` |                        `false` |
| configuration[environmentVariables]          |                 record of the project variables needed                 |        object of the variables |        N |                          `true` |                        `false` |
| configuration[environmentVariables][keyName] |                        the name of the variable                        |                         string |        N |              `ENVIRONMENT_CODE` |                             -- |
| configuration[environmentVariables][value]   | the value of the variable, can map it from the pipeline variables name |                         string |        N | `#{variables.ENVIRONMENT_CODE}` |                             -- |

source action

| Key                         |           description           |                        type | required |        example |                                 default |
|-----------------------------|:-------------------------------:|----------------------------:|---------:|---------------:|----------------------------------------:|
| name                        |       unique action name        |                      string |        Y |       `source` |                                      -- |
| type                        |  PipelineActionType.CODEBUILD   | `PipelineActionType.SOURCE` |        Y |             -- |             `PipelineActionType.SOURCE` |
| configuration               |    the action configuration     | source configuration object |        Y |             -- |                                      -- |
| configuration[repositoryId] | the repository id map to source |                      string |        Y | `orchestrator` |                                      -- |
| configuration[branch]       |      the repository branch      |                      string |        Y |         `main` | the commit id that trigger the pipeline |

approval action

| Key  |         description          |                          type | required |    example |                       default |
|------|:----------------------------:|------------------------------:|---------:|-----------:|------------------------------:|
| name |      unique action name      |                        string |        Y | `approval` |                            -- |
| type | PipelineActionType.CODEBUILD | `PipelineActionType.APPROVAL` |        Y |         -- | `PipelineActionType.APPROVAL` |

#### sample

```yaml
projectName: "orchestrator"
iam:
  codebuildRole:
    principalServices:
      - "codebuild"
    allowActions:
      s3:
        actions:
          - 'GetObject'
          - 'GetBucket'
          - 'List*'
          - 'DeleteObject'
          - 'Abort'
          - 'PutObject'
        resources:
          - '*'
      codecommit:
        actions:
          - '*'
        resources:
          - '*'
      sts:
        actions:
          - 'AssumeRole'
        resources:
          - '*'
      codepipeline:
        actions:
          - 'GetPipelineState'
          - 'PutApprovalResult'
        resources:
          - '*'
sources:
  - id: "orchestrator"
    repositoryName: "cai-llm-orchestrator-service"
codebuilds:
  - projectName: "deploy"
    buildSpecYaml: "deploy.yaml"
codePipelines:
  - pipelineName: "dev-tom"
    trigger:
      id: "dev-tom"
      detailType:
        - "CodeCommit Repository State Change"
      repositories:
        - "orchestrator"
      detail:
        referenceName:
          - prefix: "feature/cicd-setup"
        referenceType:
          - "branch"
        event:
          - "referenceCreated"
          - "referenceUpdated"
    stages:
      - stageName: "source"
        actions:
          - name: "source"
            type: "source"
            configuration:
              repositoryId: "orchestrator"
              branch: "main-fc"
      - stageName: "approval"
        actions:
          - name: "approve"
            type: "approval"
      - stageName: "build"
        actions:
          - name: "build"
            type: "codebuild"
            configuration:
              projectName: "deploy"
              inputArtifact: "source"
              environmentVariables:
                "ROLE_ARN":
                  value: "#{variables.ROLE_ARN}"
                "ENVIRONMENT_CODE":
                  value: "#{variables.ENVIRONMENT_CODE}"
    variables:
      - name: "ROLE_ARN"
        value: "arn"
      - name: "ENVIRONMENT_CODE"
        value: "dev"
```