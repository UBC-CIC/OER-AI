#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
//import { DatabaseStack } from "../lib/database-stack";
//import { ApiGatewayStack } from "../lib/api-stack";
//import { DBFlowStack } from "../lib/dbFlow-stack";
//import { AmplifyStack } from "../lib/amplify-stack";
//import { CICDStack } from "../lib/cicd-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const StackPrefix = app.node.tryGetContext("StackPrefix");
const environment = app.node.tryGetContext("environmentName");
const version = app.node.tryGetContext("versionNumber");
const githubRepo = app.node.tryGetContext("githubRepo");
const vpcStack = new VpcStack(app, `${StackPrefix}-VpcStack`, {
  env,
  stackPrefix: StackPrefix,
});
