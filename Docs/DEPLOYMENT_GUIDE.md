# Deployment Guide

## Table of Contents
- [Deployment Guide](#deployment-guide)
- [Table of Contents](#table-of-contents)
- [Requirements](#requirements)
  - [Request Higher Bedrock LLM Invocation Quotas](#request-higher-bedrock-llm-invocation-quotas)
- [Pre-Deployment](#pre-deployment)
  - [Create GitHub Personal Access Token](#create-github-personal-access-token)
- [Deployment](#deployment)
  - [Step 1: Fork \& Clone The Repository](#step-1-fork--clone-the-repository)
  - [Step 2: Upload Secrets](#step-2-upload-secrets)
  - [Step 3: CDK Deployment](#step-3-cdk-deployment)
- [Post-Deployment](#post-deployment)
  - [Step 1: Build AWS Amplify App](#step-1-build-aws-amplify-app)
  - [Step 2: Configure Admin User](#step-2-configure-admin-user)
  - [Step 3: Visit Web App](#step-3-visit-web-app)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
- [Cleanup](#cleanup)
  - [Taking down the deployed stack](#taking-down-the-deployed-stack)

## Requirements

Before you deploy, you must have the following installed on your device:

- [git](https://git-scm.com/downloads)
- [AWS Account](https://aws.amazon.com/account/)
- [GitHub Account](https://github.com/)
- [AWS CLI](https://aws.amazon.com/cli/) _(v2.0.0+ required)_
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) _(v2.1022.0+ required)_
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) _(v10.0.0+ required)_
- [node](https://nodejs.org/en/ln/getting-started/how-to-install-nodejs) _(v22.7.9+ required)_
- [Python](https://www.python.org/downloads/) _(v3.11+ required)_


### Request Higher Bedrock LLM Invocation Quotas

For optimal performance, it is recommended to request higher invocation quotas for Bedrock LLM models before deployment. The default quotas may be insufficient for processing concurrent requests or high-volume usage.

For detailed information about Bedrock service quotas, see the [AWS Bedrock Service Quotas documentation](https://docs.aws.amazon.com/general/latest/gr/bedrock.html#limits_bedrock).

To request quota increases:

1. Navigate to the **AWS Service Quotas** console in your AWS account
2. Search for "Bedrock" in the service quotas
3. Select the relevant LLM models you plan to use:
   - Meta Llama 3 70B Instruct
   - Cohere Embed V4
4. Request quota increases for "Requests per minute" based on your expected usage
5. Submit the quota increase request and wait for AWS approval (this can take 24-48 hours)

_Note: Consider your expected concurrent users and document processing volume when requesting quota increases. Higher quotas ensure smoother operations without throttling._

## Pre-Deployment

### Create GitHub Personal Access Token

To deploy this solution, you will need to generate a GitHub personal access token. Please visit [here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic) for detailed instruction to create a personal access token.

_Note: when selecting the scopes to grant the token (step 8 of the instruction), make sure you select `repo` scope._

**Once you create a token, please note down its value as you will use it later in the deployment process.**

## Deployment

### Step 1: Fork & Clone The Repository

First, you need to fork the repository. To create a fork, navigate to the main branch of this repository. Then, in the top-right corner, click `Fork`.

You will be directed to the page where you can customize owner, repository name, etc, but you do not have to change any option. Simply click `Create fork` in the bottom right corner.

Now let's clone the GitHub repository onto your machine. To do this:

1. Create a folder on your computer to contain the project code.
2. For an Apple computer, open Terminal. If on a Windows machine, open Command Prompt or Windows Terminal. Enter into the folder you made using the command `cd path/to/folder`. To find the path to a folder on a Mac, right click on the folder and press `Get Info`, then select the whole text found under `Where:` and copy with ⌘C. On Windows (not WSL), enter into the folder on File Explorer and click on the path box (located to the left of the search bar), then copy the whole text that shows up.
3. Clone the GitHub repository by entering the following command. Be sure to replace `<YOUR-GITHUB-USERNAME>` with your own username.

```bash
git clone https://github.com/<YOUR-GITHUB-USERNAME>/OER-AI
```

The code should now be in the folder you created. Navigate into the root folder containing the entire codebase by running the command:

```bash
cd OER-AI
```

#### Install Dependencies

Go into the cdk folder which can be done with the following command:

```bash
cd cdk
```

Now that you are in the cdk directory, install the core dependencies with the following command:

```bash
npm install
```

Go into the frontend folder which can be done with the following command:

```bash
cd ../frontend
```

Now that you are in the frontend directory, install the core dependencies with the following command:

```bash
npm install
```

### Step 2: Upload Secrets

You would have to supply your GitHub personal access token you created earlier when deploying the solution. Run the following command and ensure you replace `<YOUR-GITHUB-TOKEN>` and `<YOUR-PROFILE-NAME>` with your actual GitHub token and the appropriate AWS profile name.

<details>
<summary>macOS/Linux</summary>

```bash
aws secretsmanager create-secret \
  --name github-personal-access-token \
  --secret-string '{"my-github-token": "<YOUR-GITHUB-TOKEN>"}' \
  --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws secretsmanager create-secret ^
  --name github-personal-access-token ^
  --secret-string "{\"my-github-token\": \"<YOUR-GITHUB-TOKEN>\"}" ^
  --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws secretsmanager create-secret `
  --name github-personal-access-token `
  --secret-string '{"my-github-token": "<YOUR-GITHUB-TOKEN>"}' `
  --profile <YOUR-PROFILE-NAME>
```

</details>

&nbsp;

Moreover, you will need to upload your GitHub username to Amazon SSM Parameter Store. You can do so by running the following command. Make sure you replace `<YOUR-GITHUB-USERNAME>` and `<YOUR-PROFILE-NAME>` with your actual username and the appropriate AWS profile name.

<details>
<summary>macOS/Linux</summary>

```bash
aws ssm put-parameter \
  --name "oer-owner-name" \
  --value "<YOUR-GITHUB-USERNAME>" \
  --type String \
  --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws ssm put-parameter ^
  --name "oer-owner-name" ^
  --value "<YOUR-GITHUB-USERNAME>" ^
  --type String ^
  --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws ssm put-parameter `
  --name "oer-owner-name" `
  --value "<YOUR-GITHUB-USERNAME>" `
  --type String `
  --profile <YOUR-PROFILE-NAME>
```

</details>

&nbsp;

You would have to supply a custom database username when deploying the solution to increase security. Run the following command and ensure you replace `<YOUR-DB-USERNAME>` with the custom name of your choice.

<details>
<summary>macOS/Linux</summary>

```bash
aws secretsmanager create-secret \
  --name OERSecrets \
  --secret-string "{\"DB_Username\":\"<YOUR-DB-USERNAME>\"}" \
  --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws secretsmanager create-secret ^
  --name OERSecrets ^
  --secret-string "{\"DB_Username\":\"<YOUR-DB-USERNAME>\"}" ^
  --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws secretsmanager create-secret `
  --name OERSecrets `
  --secret-string '{"DB_Username":"<YOUR-DB-USERNAME>"}' `
  --profile <YOUR-PROFILE-NAME>
```

</details>

&nbsp;

For example:

```bash
aws secretsmanager create-secret \
  --name OERSecrets \
  --secret-string '{"DB_Username":"OERDatabaseUser"}' \
  --profile <YOUR-PROFILE-NAME>
```

### Step 3: CDK Deployment

It's time to set up everything that goes on behind the scenes! For more information on how the backend works, feel free to refer to the Architecture documentation, but an understanding of the backend is not necessary for deployment.

If you are new to CDK, note that the AWS Cloud Development Kit (CDK) lets you define cloud infrastructure using code. Review the [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/) for a quick primer before proceeding.

Note: Guardrails (Bedrock) are created as part of the CDK deployment. For operational guidance and advanced customization of guardrails and Bedrock configuration, see `Docs/BEDROCK_GUARDRAILS.md`.

Open a terminal in the `/cdk` directory.

**Initialize the CDK stack** (required only if you have not deployed any resources with CDK in this region before). Please replace `<YOUR-PROFILE-NAME>` with the appropriate AWS profile used earlier.

```bash
cdk synth --profile <YOUR-PROFILE-NAME>
cdk bootstrap aws://<YOUR_AWS_ACCOUNT_ID>/<YOUR_ACCOUNT_REGION> --profile <YOUR-PROFILE-NAME>
```

**Deploy CDK stack**

You may run the following command to deploy the stacks all at once. Again, replace `<YOUR-PROFILE-NAME>` with the appropriate AWS profile used earlier. Also replace `<YOUR-STACK-PREFIX>` with the appropriate stack prefix.

The stack prefix will be prefixed onto the physical names of the resources created during deployment. The `environment` parameter specifies the deployment environment (dev, test, prod), the `version` parameter indicates the application version being deployed, and the `githubRepo` parameter should match your forked repository name.

```bash
cdk deploy --all \
  --context StackPrefix=<YOUR-STACK-PREFIX> \
  --context environment=dev \
  --context version=1.0.0 \
  --context githubRepo=OER-AI \
  --profile <YOUR-PROFILE-NAME>
```

For example:

```bash
cdk deploy --all \
  --context StackPrefix=OER \
  --context environment=dev \
  --context version=1.0.0 \
  --context githubRepo=OER-AI \
  --profile my-aws-profile
```

**Note:** The deployment process may take 15-30 minutes to complete. You will be prompted to approve IAM changes and security group modifications during deployment.

### CodePipeline & ECR image bootstrapping (fresh deployment gotchas)

When deploying the stack for the first time, CodePipeline/CodeBuild may create ECR repositories but no container images exist yet — the pipeline itself performs the build and push of Docker images required by Docker-based Lambda functions. If CodePipeline hasn't been started yet, Lambdas that reference these images may briefly report `Image not found` errors or may fail to start until images are published.

To resolve this, choose one of the following options:

1. Manually start the pipeline (recommended):
  - Console: AWS Console → **CodePipeline** → select your pipeline (`<STACK-PREFIX>-pipeline`) → **Release change** or **Start pipeline**.
  - CLI:

```powershell
aws codepipeline start-pipeline-execution --name "<PIPELINE_NAME>" --profile <PROFILE>
```

2. Trigger the pipeline by pushing a commit to the repository/branch connected to the pipeline (e.g., `main`):

```powershell
git commit --allow-empty -m "Trigger initial pipeline build"
git push origin main
```

3. Manually push Docker images to ECR to bootstrap the runtime images (when CodeBuild is not yet available or you prefer to push them yourself):
  - Login to ECR, build the image locally, tag it with the expected repository/tag, then push.

Example (PowerShell):

```powershell
$region = "<AWS_REGION>"
$account = "<AWS_ACCOUNT_ID>"
$repo = "<ECR_REPOSITORY_NAME>"
$uri = "$($account).dkr.ecr.$region.amazonaws.com/$repo:latest"

aws ecr get-login-password --region $region | docker login --username AWS --password-stdin "$($account).dkr.ecr.$region.amazonaws.com"

cd cdk\lambda\dataIngestion
docker build -t $repo -f Dockerfile .
docker tag $repo:latest $uri
docker push $uri
```

Notes:
- Verify the exact ECR repository name in the AWS Console (ECR) or CDK outputs. The repository names depend on the stack prefix and build pipeline.
- If you manually push images, ensure names and tags match the ones the pipeline/CDK expects.
- After the pipeline successfully completes and images are pushed, your Lambdas will use the available images and the API should function correctly.

Troubleshooting:
- Check CodePipeline and CodeBuild console logs for failure details.
- Check ECR to verify images and tags are present.
- If deployments fail due to permissions, ensure CodeBuild/CodePipeline roles have ECR push permissions and IAM policies required to access the repo.

## Post-Deployment

### Step 1: Build AWS Amplify App

1. Log in to AWS console, and navigate to **AWS Amplify**. You can do so by typing `Amplify` in the search bar at the top.
2. From `All apps`, click `<STACK-PREFIX>-amplify`.
3. You will see multiple branches listed (`main`, `dev`, `api_endpoint_setup`). Click on the branch that corresponds to your GitHub repository's default branch (typically `main`).
4. Click `Redeploy this version` to trigger a build
5. Wait for the build to complete (this may take 5-10 minutes)
6. You now have access to the `Amplify App ID` and the public domain name to use the web app.

### Step 2: Configure Admin User

To create an admin user for accessing the admin dashboard:

1. Navigate to **AWS Cognito** in the AWS Console
2. Find the User Pool named `<STACK-PREFIX>-UserPool`
3. Click on "Users" in the left sidebar
4. Click "Create user"
5. Fill in the required information:
   - Username: your email address
   - Email: same as username
   - Temporary password: create a secure password
6. Click "Don't send an email invitation"
7. Click "Create user"
8. After creation, select the user and click "Add user to group"
9. Select the "admin" group
10. On first login, you'll be prompted to change your password

### Step 3: Visit Web App

You can now navigate to the web app URL (found in the Amplify console) to see your application in action.

**Default URL format:** `https://main.<app-id>.amplifyapp.com`

## Troubleshooting

### Common Issues

**Issue: CDK deployment fails with "Resource already exists"**
- Solution: Check if you have existing resources with the same names. Either delete them or use a different stack prefix.

**Issue: CloudFormation validation error during ResourceExistenceCheck referencing DataPipeline or CICD ARNs**
- Symptoms: CloudFormation throws a validation error during the change set or deployment phase, related to a `ResourceExistenceCheck` for an ARN that appears to reference the `DataPipeline` or `CICD` resources. This commonly occurs on first-time deployments when the pipeline and ECR resources are created by the deployment but are referenced in IAM policy statements or other policies before they exist.
- Quick workaround (first-time deployment):
  1. Temporarily update the resource ARN entries in the CICD and DataPipeline stacks to use wildcard ARNs. For example:

```ts
// Before (strict/specific ARN)
resources: [
  "`arn:aws:ecr:${this.region}:${this.account}:repository/${repoName}`"
]

// After (temporary wildcard to avoid ResourceExistenceCheck failures)
resources: [
  "*"
]
```

or for CodePipeline/CodeBuild-related ARNs:

```ts
// Before (strict)
`arn:aws:codepipeline:${this.region}:${this.account}:${id}-DockerImagePipeline`

// After (wildcard)
`*`
```

  2. Re-run `cdk deploy --all` to complete the initial deployment. Once the pipeline completes and has created the necessary resources (ECR repos, artifacts, etc.), you may revert the wildcard ARNs to the specific ARNs and re-deploy to restore least-privilege scoping.
  3. Trigger the pipeline (Console -> CodePipeline -> Release change) OR push a commit to the repo to allow the pipeline to create images and artifacts.

- Important notes:
  - This is a temporary workaround intended only for first-time deployments. Using wildcard ARNs reduces IAM scope and weakens security; remember to revert the changes back to specific ARNs and re-deploy after the pipeline runs successfully.
  - Where to change: Look for `resources:` in the stack files `cdk/lib/cicd-stack.ts` and `cdk/lib/data-pipeline-stack.ts` and adjust any ARN strings used in `PolicyStatement` definitions or `addToResourcePolicy` calls.

**Issue: Amplify build fails**
- Solution: Check the build logs in Amplify console. Common causes:
  - Missing environment variables
  - Node version mismatch
  - Dependency installation failures

**Issue: Database connection errors**
- Solution: Verify that:
  - RDS instance is running
  - Security groups allow Lambda to access RDS
  - Database credentials are correct in Secrets Manager


**Issue: CORS errors in browser**
- Solution: Verify that the API Gateway CORS configuration includes your Amplify domain

**Issue: WebSocket connection fails**
- Solution: Check that:
  - WebSocket API is deployed
  - Lambda functions have correct permissions
  - Frontend is using the correct WebSocket URL

## Cleanup

### Taking down the deployed stack

To take down the deployed stack for a fresh redeployment in the future, follow these steps in order:

1. **Disable RDS Deletion Protection:**
   - Navigate to **Amazon RDS** in the AWS Console
   - Click on "Databases" in the left sidebar
   - Select the database instance named `<STACK-PREFIX>-database`
   - Click "Modify"
   - Scroll down to "Deletion protection" and uncheck the box
   - Click "Continue" and then "Modify DB instance"
   - Wait for the modification to complete before proceeding

2. **Delete Amplify App:**
   - Navigate to AWS Amplify console
   - Select your app
   - Click "Actions" → "Delete app"

3. **Delete CloudFormation Stacks:**
   Navigate to AWS CloudFormation console and delete stacks in this order:
   - `<STACK-PREFIX>-Amplify`
   - `<STACK-PREFIX>-CICD`
   - `<STACK-PREFIX>-Api`
   - `<STACK-PREFIX>-DataPipeline`
   - `<STACK-PREFIX>-DBFlow`
   - `<STACK-PREFIX>-Database`
   - `<STACK-PREFIX>-VpcStack`

4. **Delete Secrets:**
   - Navigate to AWS Secrets Manager
   - Delete the following secrets:
     - `github-personal-access-token`
     - `OERSecrets`
     - Any database credentials created by the stack

5. **Delete SSM Parameters:**
   - Navigate to AWS Systems Manager → Parameter Store
   - Delete the following parameters:
     - `oer-owner-name`
     - Any other parameters created by the stack

6. **Delete ECR Repositories** (if any were created):
   - Navigate to Amazon ECR
   - Delete repositories created by the stack

7. **Verify Cleanup**:
   - Check CloudWatch Logs for any remaining log groups
   - Check Lambda functions for any remaining functions
   - Check API Gateway for any remaining APIs

**Note:** Please wait for each stack to be properly deleted before deleting the next stack. Some resources have dependencies that must be removed first.

**Cost Warning:** Ensure all resources are deleted to avoid ongoing charges. Pay special attention to:
- RDS instances
- NAT Gateways
- Elastic IPs
- S3 storage
- CloudWatch Logs retention
