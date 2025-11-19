#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { DatabaseStack } from "../lib/database-stack";
import { DataPipelineStack } from "../lib/data-pipeline-stack";
import { ApiGatewayStack } from "../lib/api-stack";
import { DBFlowStack } from "../lib/dbFlow-stack";
import { AmplifyStack } from "../lib/amplify-stack";
import { CICDStack } from "../lib/cicd-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const StackPrefix = app.node.tryGetContext("StackPrefix");
const environment = app.node.tryGetContext("environment");
const version = app.node.tryGetContext("versionNumber");
const githubRepo = app.node.tryGetContext("githubRepo");

const vpcStack = new VpcStack(app, `${StackPrefix}-VpcStack`, {
  env,
  stackPrefix: StackPrefix,
});

const dbStack = new DatabaseStack(app, `${StackPrefix}-Database`, vpcStack, {
  env,
});

const dbFlowStack = new DBFlowStack(
  app,
  `${StackPrefix}-DBFlow`,
  vpcStack,
  dbStack,
  { env }
);

const dataPipelineStack = new DataPipelineStack(
  app,
  `${StackPrefix}-DataPipeline`,
  {
    env,
    vpcStack,
    databaseStack: dbStack,
  }
);
const cicdStack = new CICDStack(app, `${StackPrefix}-CICD`, {
  env,
  githubRepo: githubRepo,
  environmentName: environment,
  lambdaFunctions: [
    {
      name: "dataIngestion",
      functionName: `${StackPrefix}-Api-DataIngestionLambdaDockerFunction`,
      sourceDir: "cdk/lambda/dataIngestion",
    },
    {
      name: "textGeneration",
      functionName: `${StackPrefix}-Api-TextGenLambdaDockerFunction`,
      sourceDir: "cdk/lambda/textGeneration",
    },
    {
      name: "practiceMaterial",
      functionName: `${StackPrefix}-Api-PracticeMaterialLambdaDockerFunction`,
      sourceDir: "cdk/lambda/practiceMaterial",
    },
  ],
  pathFilters: [
    "cdk/lambda/dataIngestion/**",
    "cdk/lambda/textGeneration/**",
    "cdk/lambda/practiceMaterial/**",
  ],
});
const apiStack = new ApiGatewayStack(
  app,
  `${StackPrefix}-Api`,
  dbStack,
  vpcStack,
  {
    env,
    ecrRepositories: cicdStack.ecrRepositories,
  }
);
const amplifyStack = new AmplifyStack(app, `${StackPrefix}-Amplify`, apiStack, {
  env,
  githubRepo: githubRepo,
});
