import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as glue from "aws-cdk-lib/aws-glue";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { VpcStack } from "./vpc-stack";
import { DatabaseStack } from "./database-stack";

interface DataPipelineStackProps extends cdk.StackProps {
  vpcStack: VpcStack;
  databaseStack: DatabaseStack;
}

export class DataPipelineStack extends cdk.Stack {
  public readonly csvBucket: s3.Bucket;
  public readonly textbookIngestionQueue: sqs.Queue;
  public readonly csvProcessorFunction: lambda.Function;
  public readonly jobProcessorLambda: lambda.Function;
  public readonly glueConnection: glue.CfnConnection;
  public readonly glueBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataPipelineStackProps) {
    super(scope, id, props);

    const { vpcStack, databaseStack } = props;

    // Create S3 bucket for CSV ingestion
    this.csvBucket = new s3.Bucket(this, `${id}-csv-bucket`, {
      bucketName: `${id.toLowerCase()}-csv-ingestion-bucket`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ["*"],
        },
      ],
      // When deleting the stack, the bucket will be deleted as well
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    // Create SQS FIFO queue for rate-limited textbook processing
    this.textbookIngestionQueue = new sqs.Queue(
      this,
      `${id}-textbook-ingestion-queue`,
      {
        queueName: `${id}-textbook-ingestion-queue.fifo`,
        fifo: true,
        contentBasedDeduplication: true,
        visibilityTimeout: Duration.minutes(15),
        retentionPeriod: Duration.days(14),
        deadLetterQueue: {
          queue: new sqs.Queue(this, `${id}-textbook-ingestion-dlq`, {
            queueName: `${id}-textbook-ingestion-dlq.fifo`,
            fifo: true,
            contentBasedDeduplication: true,
            retentionPeriod: Duration.days(14),
          }),
          maxReceiveCount: 3,
        },
      }
    );

    // Create Lambda execution role with necessary permissions
    const lambdaRole = new iam.Role(this, `${id}-DataPipelineLambdaRole`, {
      roleName: `${id}-DataPipelineLambdaRole`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        ),
      ],
    });

    // Add permissions for Secrets Manager
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:*`,
        ],
      })
    );

    // Create Lambda function to process CSV uploads
    this.csvProcessorFunction = new lambda.Function(
      this,
      `${id}-CsvProcessorFunction`,
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        code: lambda.Code.fromAsset("lambda/csvProcessor"),
        handler: "index.handler",
        timeout: Duration.minutes(10),
        memorySize: 512,
        functionName: `${id}-CsvProcessorFunction`,
        environment: {
          REGION: this.region,
          QUEUE_URL: this.textbookIngestionQueue.queueUrl,
        },
        role: lambdaRole,
        vpc: vpcStack.vpc,
      }
    );

    // Grant Lambda permissions to read from S3 bucket
    this.csvBucket.grantRead(this.csvProcessorFunction);

    // Grant Lambda permissions to send messages to SQS queue
    this.textbookIngestionQueue.grantSendMessages(this.csvProcessorFunction);

    // Add S3 event notification to trigger Lambda on CSV uploads
    this.csvProcessorFunction.addEventSource(
      new lambdaEventSources.S3EventSource(this.csvBucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ suffix: ".csv" }],
      })
    );

    // Create Lambda function to process SQS messages and trigger Glue jobs
    const jobProcessorRole = new iam.Role(this, `${id}-JobProcessorRole`, {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
      inlinePolicies: {
        SQSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ],
              resources: [this.textbookIngestionQueue.queueArn],
            }),
          ],
        }),
        GlueAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "glue:StartJobRun",
                "glue:GetJobRun",
                "glue:GetJobRuns",
              ],
              resources: [
                `arn:aws:glue:${this.region}:${this.account}:job/${id}-data-processing-job`,
              ],
            }),
          ],
        }),
      },
    });

    this.jobProcessorLambda = new lambda.Function(
      this,
      `${id}-JobProcessorLambda`,
      {
        functionName: `${id}-job-processor`,
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: "main.lambda_handler",
        code: lambda.Code.fromAsset("lambda/jobProcessor"),
        timeout: Duration.minutes(15),
        memorySize: 512,
        role: jobProcessorRole,
        environment: {
          DATA_PROCESSING_BUCKET: this.csvBucket.bucketName,
          REGION: this.region,
        },
      }
    );

    // Connect SQS queue to Lambda function
    this.jobProcessorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(this.textbookIngestionQueue, {
        batchSize: 1,
        maxConcurrency: 2,
      })
    );

    // Create security group for Glue jobs
    const glueSecurityGroup = new ec2.SecurityGroup(
      this,
      "glueSelfReferencingSG",
      {
        vpc: vpcStack.vpc,
        allowAllOutbound: true,
        description: "Self-referencing security group for Glue",
      }
    );

    // Add self-referencing ingress rule
    glueSecurityGroup.addIngressRule(
      glueSecurityGroup,
      ec2.Port.allTcp(),
      "self-referencing security group rule"
    );

    // Create Glue network connection
    this.glueConnection = new glue.CfnConnection(this, "GlueVpcConnection", {
      catalogId: this.account,
      connectionInput: {
        name: `${id}-glue-vpc-connection`,
        description: "VPC connection for Glue jobs",
        connectionType: "NETWORK",
        physicalConnectionRequirements: {
          availabilityZone: vpcStack.vpc.availabilityZones[0],
          securityGroupIdList: [glueSecurityGroup.securityGroupId],
          subnetId: vpcStack.vpc.privateSubnets[0].subnetId,
        },
      },
    });
    this.glueConnection.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Create S3 bucket for Glue scripts and custom modules
    this.glueBucket = new s3.Bucket(this, `${id}-glue-bucket`, {
      bucketName: `${id.toLowerCase()}-glue-processing-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Upload Glue scripts and libraries
    new s3deploy.BucketDeployment(this, "DeployGlueJobScripts", {
      sources: [s3deploy.Source.asset("./glue/scripts/")],
      destinationBucket: this.glueBucket,
      destinationKeyPrefix: "glue/scripts",
      exclude: [
        "*.ipynb",
        "*test*",
        "*src*",
        "*DS_Store",
        "*__pycache__*",
        "*.pyc",
        "*.json",
        "*temp*",
      ],
    });

    // IAM Role for Glue Jobs
    const glueJobRole = new iam.Role(this, "GlueJobRole", {
      assumedBy: new iam.ServicePrincipal("glue.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSGlueServiceRole"
        ),
      ],
      inlinePolicies: {
        GlueJobPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
              ],
              resources: [
                this.csvBucket.bucketArn,
                `${this.csvBucket.bucketArn}/*`,
                this.glueBucket.bucketArn,
                `${this.glueBucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
                "sqs:SendMessage",
              ],
              resources: [this.textbookIngestionQueue.queueArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: ["arn:aws:logs:*:*:*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["secretsmanager:GetSecretValue"],
              resources: [
                `arn:aws:secretsmanager:${this.region}:${this.account}:secret:*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["bedrock:InvokeModel"],
              resources: [
                `arn:aws:bedrock:us-east-1::foundation-model/cohere.embed-v4:0`,
              ],
            }),
          ],
        }),
      },
    });

    const PYTHON_VER = "3";
    const GLUE_VER = "5.0";
    const MAX_CONCURRENT_RUNS = 5;
    const MAX_RETRIES = 0;
    const MAX_CAPACITY = 2;
    const TIMEOUT = 2880;
    // Specify versions to ensure compatibility with Cohere Embed v4
    const PYTHON_LIBS =
      "scrapy,requests,beautifulsoup4==4.14.2,lxml,urllib3==2.5.0,pandas==2.3.3,psycopg2-binary==2.9.10,langchain-text-splitters==1.0.0,langchain-aws==1.0.0,langchain-postgres==0.0.16,langchain-core==1.0.7,boto3==1.40.72";

    // Glue Job for data processing
    const dataProcessingJob = new glue.CfnJob(this, "DataProcessingJob", {
      name: `${id}-data-processing-job`,
      role: glueJobRole.roleArn,
      command: {
        name: "glueetl",
        scriptLocation: `s3://${this.glueBucket.bucketName}/glue/scripts/data_processing.py`,
        pythonVersion: PYTHON_VER,
      },
      defaultArguments: {
        "--job-language": "python",
        "--job-bookmark-option": "job-bookmark-enable",
        "--enable-metrics": "true",
        "--enable-continuous-cloudwatch-log": "true",
        "--library-set": "analytics",
        "--CSV_BUCKET": this.csvBucket.bucketName,
        "--GLUE_BUCKET": this.glueBucket.bucketName,
        "--region_name": this.region,
        "--rds_secret": databaseStack.secretPathAdminName,
        "--rds_proxy_endpoint": databaseStack.rdsProxyEndpoint,
        // Processing configuration
        "--pipeline_mode": "full_update", // or "incremental" for delta processing
        "--batch_id": "", // Will be set at runtime via job parameters
        // Queue and temp storage
        "--SQS_QUEUE_URL": this.textbookIngestionQueue.queueUrl,
        "--TempDir": `s3://${this.glueBucket.bucketName}/temp/`,
        // Additional Python packages (on top of analytics library set)
        "--additional-python-modules": PYTHON_LIBS,
        // Custom modules/wheels from S3
        //"--extra-py-files": `s3://${this.glueBucket.bucketName}/glue/libs/`,
        "--embedding_model_id": `cohere.embed-v4:0`,
      },
      connections: {
        connections: [this.glueConnection.ref],
      },
      executionProperty: { maxConcurrentRuns: MAX_CONCURRENT_RUNS },
      maxRetries: MAX_RETRIES,
      maxCapacity: MAX_CAPACITY,
      timeout: TIMEOUT,
      glueVersion: GLUE_VER,
    });

    // Output the Glue job name
    new cdk.CfnOutput(this, "GlueJobName", {
      value: dataProcessingJob.name!,
      description: "Name of the Glue data processing job",
    });

    new cdk.CfnOutput(this, "GlueBucketName", {
      value: this.glueBucket.bucketName,
      description: "S3 bucket for Glue scripts and assets",
    });

    this.jobProcessorLambda.addEnvironment(
      "GLUE_JOB_NAME",
      dataProcessingJob.name!
    );
  }
}
