import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IUser } from 'aws-cdk-lib/aws-iam';

interface IIamRoleProps {
  name: string;
  description: string;
  allowResourceActions?: {
    [name: string]: { actions: string[]; resources?: string[] };
  };
  includeManagedPolicies?: {
    Aws?: string[]; // managed policy names
    Customer?: string[]; // managed policy names
  };
  usernames?: string[];
  principal?: {
    accounts?: string[];
    services?: string[];
    arns?: string[];
  };
  trustRootPrincipal?: boolean;
}

export class IamRole extends cdk.aws_iam.Role {
  static newRole(scope: Construct, id: string, props: IIamRoleProps): IamRole;
  static newRole(scope: Construct, id: string, props: IIamRoleProps): IamRole {
    return new this(scope, id, props, false);
  }

  public readonly id: string;
  public readonly roleName: string;

  public computeRoleArn(): string {
    return `arn:aws:iam::${this.env.account}:role/${this.roleName}`;
  }

  static computeRoleArn(scope: Construct, name: string): string {
    return `arn:aws:iam::${cdk.Stack.of(scope).account}:role/rl-${name}`;
  }

  static fromName(scope: Construct, name: string): cdk.aws_iam.IRole {
    return cdk.aws_iam.Role.fromRoleArn(
      scope,
      name,
      `arn:aws:iam::${cdk.Stack.of(scope).account}:role/svc-rl-${name}`
    );
  }

  protected constructor(
    scope: Construct,
    id: string,
    props: IIamRoleProps,
    isService: boolean
  ) {
    let _prefix = '';
    if (isService) {
      _prefix += 'svc';
    }

    const _roleName: string = `${_prefix}-rl-${props.name}`;
    const _groupName: string = `${_prefix}-grp-rl-${props.name}`;
    const _groupPolicyName: string = `${_prefix}-grp-pl-${props.name}`;
    const _docName: string = `${_prefix}-pl-${props.name}`;
    const _statements: cdk.aws_iam.PolicyStatement[] = [];

    const _inlinePolicies: { [name: string]: cdk.aws_iam.PolicyDocument } = {};
    //#region Inline policies
    if (props.allowResourceActions) {
      let actions: string[];
      let resources: string[];

      for (const serviceKey in props.allowResourceActions) {
        actions = resources = [];
        const service = props.allowResourceActions[serviceKey];

        actions = service.actions.map((action) => `${serviceKey}:${action}`);
        resources = service.resources || ['*'];

        _statements.push(
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: actions,
            resources: resources,
          })
        );
      }

      _inlinePolicies[_docName] = new cdk.aws_iam.PolicyDocument({
        statements: _statements,
      });
    }
    //#endregion

    const _managedPolicies: cdk.aws_iam.IManagedPolicy[] = [];
    //#region Managed policies
    if (props.includeManagedPolicies) {
      const _awsManaged = props.includeManagedPolicies.Aws || [];
      _awsManaged.forEach((managed) =>
        _managedPolicies.push(
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(managed)
        )
      );
      const _customerManaged = props.includeManagedPolicies.Customer || [];
      _customerManaged.forEach((managed) =>
        _managedPolicies.push(
          cdk.aws_iam.ManagedPolicy.fromManagedPolicyName(
            scope,
            managed,
            managed
          )
        )
      );
    }
    //#endregion

    let _compositePrincipal!: cdk.aws_iam.CompositePrincipal;
    const addPrincipal = (principal: cdk.aws_iam.IPrincipal) => {
      if (!_compositePrincipal) {
        _compositePrincipal = new cdk.aws_iam.CompositePrincipal(principal);
      } else {
        _compositePrincipal.addPrincipals(principal);
      }
    };

    if (props.trustRootPrincipal ?? false) {
      addPrincipal(new cdk.aws_iam.AccountRootPrincipal());
    }

    //#region Compile CompositePrincipal
    if (props.principal) {
      if (props.principal.accounts) {
        props.principal.accounts.forEach((account) => {
          addPrincipal(new cdk.aws_iam.AccountPrincipal(account));
        });
      }

      if (props.principal.services) {
        props.principal.services.forEach((service) => {
          addPrincipal(
            new cdk.aws_iam.ServicePrincipal(`${service}.amazonaws.com`)
          );
        });
      }

      if (props.principal.arns) {
        props.principal.arns.forEach((arn) => {
          addPrincipal(new cdk.aws_iam.ArnPrincipal(arn));
        });
      }
    } else {
      addPrincipal(new cdk.aws_iam.ServicePrincipal('sts.amazonaws.com'));
    }
    //#endregion

    let permissionBoundary: cdk.aws_iam.IManagedPolicy | undefined = undefined;
    if (isService) {
      permissionBoundary = cdk.aws_iam.ManagedPolicy.fromManagedPolicyName(
        scope,
        `WorkloadRolePermissionsBoundary-${props.name}`,
        'WorkloadRolePermissionsBoundary'
      );
    }

    super(scope, id, {
      roleName: _roleName,
      description: props.description,
      assumedBy: _compositePrincipal,
      inlinePolicies: _inlinePolicies,
      managedPolicies: _managedPolicies,
      permissionsBoundary: permissionBoundary,
    });

    this.id = id;
    this.roleName = _roleName;

    //#region Group for users to assume the role
    if (props.usernames) {
      const _users: IUser[] = props.usernames.map((username) =>
        cdk.aws_iam.User.fromUserName(scope, 'username', username)
      );

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
      );

      _users.forEach((user) => _group.addUser(user));
    }
    //#endregion
  }
}

export class ServiceRole extends IamRole {
  static new(scope: Construct, id: string, props: IIamRoleProps): IamRole;
  static new(scope: Construct, id: string, props: IIamRoleProps): IamRole {
    return new this(scope, id, props);
  }

  protected constructor(scope: Construct, id: string, props: IIamRoleProps) {
    super(scope, id, props, true);
  }
}
