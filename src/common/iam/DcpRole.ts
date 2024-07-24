import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { IUser } from 'aws-cdk-lib/aws-iam'

interface IDcpRoleProps {
  name: string
  description: string
  /** Each service as key, with allowed action(s) and resource(s)
   * If resource(s) is not defined, asterisk will be auto generated
   */
  allowResourceActions?: {
    [name: string]: { actions: string[]; resources?: string[] }
  }
  /** Specify the managed policy name(s), whether it's AWS or Customer */
  includeManagedPolicies?: {
    Aws?: string[] // managed policy names
    Customer?: string[] // managed policy names
  }
  /** Include group creation to grant users */
  usernames?: string[]
  principal?: {
    accounts?: string[]
    services?: string[]
    arns?: string[]
  }
  /**
   * Add grants to resources instead of dropping them
   *
   * If this is `false`(or not specified), other principals MUST be defined as the constructor needs at least 1.
   *
   * If this is `true`, a trust relation is generated for the account root principal
   *
   * @default false
   */
  trustRootPrincipal?: boolean
}

export class DcpRole extends cdk.aws_iam.Role {
  /**
   * Constructs a new DCP role (sts principal) with corresponding policy document and statements
   * @param scope Inherit scope
   * @param id Id of the role
   * @param props Mandatory options specification
   */
  static newRole(scope: Construct, id: string, props: IDcpRoleProps): DcpRole
  /**
   * Constructs a new DCP role with corresponding policy document and statements
   * @param scope Inherit scope
   * @param id Id of the role
   * @param props Mandatory options specification
   */
  static newRole(scope: Construct, id: string, props: IDcpRoleProps): DcpRole {
    return new this(scope, id, props, false)
  }

  public readonly id: string
  public readonly roleName: string

  public computeRoleArn(): string {
    return `arn:aws:iam::${this.env.account}:role/${this.roleName}`
  }

  static computeRoleArn(scope: Construct, name: string): string {
    return `arn:aws:iam::${cdk.Stack.of(scope).account}:role/dcp-rl-${name}`
  }

  static fromName(scope: Construct, name: string): cdk.aws_iam.IRole {
    return cdk.aws_iam.Role.fromRoleArn(
      scope,
      name,
      `arn:aws:iam::${cdk.Stack.of(scope).account}:role/dcp-svc-rl-${name}`
    )
  }

  protected constructor(
    scope: Construct,
    id: string,
    props: IDcpRoleProps,
    isService: boolean
  ) {
    let _prefix = 'dcp'
    if (isService) {
      _prefix += '-svc'
    }

    const _roleName: string = `${_prefix}-rl-${props.name}`
    const _groupName: string = `${_prefix}-grp-rl-${props.name}`
    const _groupPolicyName: string = `${_prefix}-grp-pl-${props.name}`
    const _docName: string = `${_prefix}-pl-${props.name}`
    const _statements: cdk.aws_iam.PolicyStatement[] = []

    const _inlinePolicies: { [name: string]: cdk.aws_iam.PolicyDocument } = {}
    //#region Inline policies
    if (props.allowResourceActions) {
      let actions: string[]
      let resources: string[]

      for (const serviceKey in props.allowResourceActions) {
        actions = resources = []
        const service = props.allowResourceActions[serviceKey]

        actions = service.actions.map((action) => `${serviceKey}:${action}`)
        resources = service.resources || ['*']

        _statements.push(
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: actions,
            resources: resources,
          })
        )
      }

      _inlinePolicies[_docName] = new cdk.aws_iam.PolicyDocument({
        statements: _statements,
      })
    }
    //#endregion

    const _managedPolicies: cdk.aws_iam.IManagedPolicy[] = []
    //#region Managed policies
    if (props.includeManagedPolicies) {
      const _awsManaged = props.includeManagedPolicies.Aws || []
      _awsManaged.forEach((managed) =>
        _managedPolicies.push(
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(managed)
        )
      )
      const _customerManaged = props.includeManagedPolicies.Customer || []
      _customerManaged.forEach((managed) =>
        _managedPolicies.push(
          cdk.aws_iam.ManagedPolicy.fromManagedPolicyName(
            scope,
            managed,
            managed
          )
        )
      )
    }
    //#endregion

    let _compositePrincipal!: cdk.aws_iam.CompositePrincipal
    const addPrincipal = (principal: cdk.aws_iam.IPrincipal) => {
      if (!_compositePrincipal) {
        _compositePrincipal = new cdk.aws_iam.CompositePrincipal(principal)
      } else {
        _compositePrincipal.addPrincipals(principal)
      }
    }

    if (props.trustRootPrincipal ?? false) {
      addPrincipal(new cdk.aws_iam.AccountRootPrincipal())
    }

    //#region Compile CompositePrincipal
    if (props.principal) {
      if (props.principal.accounts) {
        props.principal.accounts.forEach((account) => {
          addPrincipal(new cdk.aws_iam.AccountPrincipal(account))
        })
      }

      if (props.principal.services) {
        props.principal.services.forEach((service) => {
          addPrincipal(
            new cdk.aws_iam.ServicePrincipal(`${service}.amazonaws.com`)
          )
        })
      }

      if (props.principal.arns) {
        props.principal.arns.forEach((arn) => {
          addPrincipal(new cdk.aws_iam.ArnPrincipal(arn))
        })
      }
    } else {
      addPrincipal(new cdk.aws_iam.ServicePrincipal('sts.amazonaws.com'))
    }
    //#endregion

    let permissionBoundary: cdk.aws_iam.IManagedPolicy | undefined = undefined
    if (isService) {
      permissionBoundary = cdk.aws_iam.ManagedPolicy.fromManagedPolicyName(
        scope,
        `WorkloadRolePermissionsBoundary-${props.name}`,
        'WorkloadRolePermissionsBoundary'
      )
    }

    super(scope, id, {
      roleName: _roleName,
      description: props.description,
      assumedBy: _compositePrincipal,
      inlinePolicies: _inlinePolicies,
      managedPolicies: _managedPolicies,
      permissionsBoundary: permissionBoundary,
    })

    this.id = id
    this.roleName = _roleName

    //#region Group for users to assume the role
    if (props.usernames) {
      const _users: IUser[] = props.usernames.map((username) =>
        cdk.aws_iam.User.fromUserName(scope, 'username', username)
      )

      const _group: cdk.aws_iam.Group = new cdk.aws_iam.Group(
        scope,
        _groupName,
        {
          groupName: _groupName,
          managedPolicies: [
            new cdk.aws_iam.ManagedPolicy(scope, _groupPolicyName, {
              statements: [
                new cdk.aws_iam.PolicyStatement({
                  effect: cdk.aws_iam.Effect.ALLOW,
                  actions: ['sts:AssumeRole'],
                  resources: [this.roleArn],
                }),
              ],
            }),
          ],
        }
      )

      _users.forEach((user) => _group.addUser(user))
    }
    //#endregion
  }
}

export class DcpServiceRole extends DcpRole {
  /**
   * Constructs a new DCP role (sts principal) with corresponding policy document and statements
   * @param scope Inherit scope
   * @param id Id of the role
   * @param props Mandatory options specification
   */
  static new(scope: Construct, id: string, props: IDcpRoleProps): DcpRole
  /**
   * Constructs a new DCP role with corresponding policy document and statements
   * @param scope Inherit scope
   * @param id Id of the role
   * @param props Mandatory options specification
   */
  static new(scope: Construct, id: string, props: IDcpRoleProps): DcpRole {
    return new this(scope, id, props)
  }

  protected constructor(scope: Construct, id: string, props: IDcpRoleProps) {
    super(scope, id, props, true)
  }
}

/* Raw sample of IAM Role
  // const _operatorRole = new project-resource-resource.Role(this, "operatorRole", {
  //   roleName: "dcp-rl-operator",
  //   assumedBy: new project-resource-resource.ServicePrincipal("sts.amazonaws.com"),
  //   inlinePolicies: {
  //     "dcp-pl-operator": new project-resource-resource.PolicyDocument({
  //       statements: [
  //         new project-resource-resource.PolicyStatement({
  //           effect: project-resource-resource.Effect.ALLOW,
  //           actions: [
  //             "dynamodb:BatchGetItem",
  //             "dynamodb:GetRecords",
  //             "dynamodb:GetShardIterator",
  //             "dynamodb:Query",
  //             "dynamodb:GetItem",
  //             "dynamodb:Scan",
  //             "dynamodb:DescribeStream",
  //             "dynamodb:GetRecords",
  //             "dynamodb:GetShardIterator",
  //             "dynamodb:ListStreams",
  //           ],
  //           resources: ["*"],
  //         }),
  //       ],
  //     }),
  //   },
  // });
*/
