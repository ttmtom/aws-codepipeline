import * as cdk from 'aws-cdk-lib'
export class DcpHelper {
  private static buildIamRoleArn(
    account: string | undefined,
    name: string
  ): string {
    return `arn:aws:iam::${account}:role/${name}`
  }
  static getCdkOverrideRoles(env: cdk.Environment | undefined): {
    [name: string]: string
  } {
    if (!env) throw new Error('Unable to proceed without envs information')
    const overrideCdkRoles: {
      [name: string]: string
    } = {
      cloudFormationExecutionRole: 'cfn-exec-role',
      deployRoleArn: 'deploy-role',
      fileAssetPublishingRoleArn: 'file-publishing-role',
      imageAssetPublishingRoleArn: 'image-publishing-role',
      lookupRoleArn: 'lookup-role',
    }
    const dcpRolePrefix = 'dcp-svc'
    const roleKeys = Object.keys(overrideCdkRoles)
    for (let i = 0; i < roleKeys.length; i++) {
      const name = overrideCdkRoles[roleKeys[i]]
      overrideCdkRoles[roleKeys[i]] = DcpHelper.buildIamRoleArn(
        env.account,
        `${dcpRolePrefix}-${name}-${env.account}-${env.region}`
      )
    }
    return overrideCdkRoles
  }
}
