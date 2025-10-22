import {
  App,
  GitHubSourceCodeProvider,
  RedirectStatus,
} from "@aws-cdk/aws-amplify-alpha";
import * as cdk from "aws-cdk-lib";
import { BuildSpec } from "aws-cdk-lib/aws-codebuild";
import { Construct } from "constructs";
import * as yaml from "yaml";
import { ApiGatewayStack } from "./api-stack";

interface AmplifyStackProps extends cdk.StackProps {
  githubRepo: string;
}

export class AmplifyStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    apiStack: ApiGatewayStack,
    props: AmplifyStackProps
  ) {
    super(scope, id, props);

    const githubRepoName = props.githubRepo;

    const amplifyYaml = yaml.parse(` 
      version: 1
      applications:
        - appRoot: frontend
          frontend:
            phases:
              preBuild:
                commands:
                  - pwd
                  - npm ci
              build:
                commands:
                  - npm run build
            artifacts:
              baseDirectory: dist
              files:
                - '**/*'
            cache:
              paths:
                - 'node_modules/**/*'
            redirects:
              - source: </^[^.]+$|.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>
                target: /
                status: 404
    `);

    const username = cdk.aws_ssm.StringParameter.valueForStringParameter(
      this,
      "oer-owner-name"
    );

    const amplifyApp = new App(this, `${id}-amplifyApp`, {
      appName: `${id}-amplify`,
      sourceCodeProvider: new GitHubSourceCodeProvider({
        owner: username,
        repository: githubRepoName,
        oauthToken: cdk.SecretValue.secretsManager(
          "github-personal-access-token",
          {
            jsonField: "my-github-token",
          }
        ),
      }),
      environmentVariables: {
        VITE_AWS_REGION: this.region,
        VITE_COGNITO_USER_POOL_ID: apiStack.getUserPoolId(),
        VITE_COGNITO_USER_POOL_CLIENT_ID: apiStack.getUserPoolClientId(),
        VITE_API_ENDPOINT: apiStack.getEndpointUrl(),
        VITE_IDENTITY_POOL_ID: apiStack.getIdentityPoolId(),
      },
      buildSpec: BuildSpec.fromObjectToYaml(amplifyYaml),
    });

    amplifyApp.addCustomRule({
      source: "/<*>",
      target: "	/index.html",
      status: RedirectStatus.NOT_FOUND_REWRITE,
    });

    amplifyApp.addBranch("main");
    amplifyApp.addBranch("api_endpoint_setup");
    amplifyApp.addBranch("frontend");
  }
}
