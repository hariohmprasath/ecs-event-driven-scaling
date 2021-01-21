import * as path from 'path';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3n from '@aws-cdk/aws-s3-notifications';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';

// Customizable construct inputs
export interface IEcsEventScalingProps {
  // VPC
  readonly vpc?: ec2.IVpc;

  // S3 Input bucket (where input images will be uploaded)
  readonly inputBucket?: s3.Bucket;

  // S3 Output bucket (where generated images will be uploaded)
  readonly outputBucket?: s3.Bucket;

  // Cool down parameter [Scaling]
  readonly scalingCoolDown?: cdk.Duration;

  // Min instances [Scaling]
  readonly minInstances?: number;

  // Max instances [Scaling]
  readonly maxInstances?: number;
}

export class EcsEventBasedScaling extends cdk.Construct {

  readonly vpc: ec2.IVpc;
  readonly inputBucket: s3.Bucket;
  readonly outputBucket: s3.Bucket;
  readonly scalingCoolDown: cdk.Duration;
  readonly minInstances: number;
  readonly maxInstances: number;

  constructor(scope: cdk.Construct, id: string, props: IEcsEventScalingProps = {}) {
    super(scope, id);

    // Setup default values if not set
    this.vpc = props.vpc ?? new ec2.Vpc(this, 'sqs-scaling-Vpc', { natGateways: 1 });
    this.inputBucket = props.inputBucket ?? new s3.Bucket(this, 'input-bucket');
    this.outputBucket = props.outputBucket ?? new s3.Bucket(this, 'output-bucket');
    this.scalingCoolDown = props.scalingCoolDown ?? cdk.Duration.seconds(200);
    this.minInstances = props.minInstances ?? 1;
    this.maxInstances = props.maxInstances ?? 10;

    // Cluster
    const cluster = new ecs.Cluster(this, 'sqs-scalingcluster', {
      vpc: this.vpc,
      containerInsights: true,
    });

    // Queue [same queue name used inside spring container]
    const queue = new sqs.Queue(this, 'sqs-scaling-queue', {
      queueName: 'S3NotificationQueue',
    });
    this.inputBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.SqsDestination(queue));

    // Setup capacity providers and default strategy for cluster
    const cfnEcsCluster = cluster.node.defaultChild as ecs.CfnCluster;
    cfnEcsCluster.capacityProviders = ['FARGATE', 'FARGATE_SPOT'];
    cfnEcsCluster.defaultCapacityProviderStrategy = [{
      capacityProvider: 'FARGATE',
      weight: 1,
      base: 4,
    }, {
      capacityProvider: 'FARGATE_SPOT',
      weight: 4,
    }];

    // IAM role for ECS tasks
    const ecsFargateTaskRole = new iam.Role(this, 'sqs-scaling-task-role', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
      ],
    });

    // Task and container definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'sqs-scaling-task', {
      taskRole: ecsFargateTaskRole,
      executionRole: ecsFargateTaskRole,
      memoryLimitMiB: 4096,
      cpu: 2048,
    });

    // Default container
    const containerDefinition = taskDefinition.addContainer('sqs-scaling-container', {
      image: ecs.ContainerImage.fromAsset(path.resolve(
        __dirname,
        'sqs-consumer-spring',
      )),
      environment: {
        OUTPUT_BUCKET: this.outputBucket.bucketName,
      },
      essential: true,
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'sqs-scaling-logs',
      }),
    });

    // Port mapping
    containerDefinition.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // Setup Fargate service
    var service = new ecs.FargateService(this, 'sqs-scaling-service', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // Metrics to listen
    const workerUtilizationMetric = new cloudwatch.Metric({
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      statistic: 'max',
      period: cdk.Duration.minutes(1),
      dimensions: {
        QueueName: queue.queueName,
      },
    });

    // Autoscaling
    var serviceAutoscaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    // Setup scaling metric and cooldown period
    serviceAutoscaling.scaleOnMetric('sqs-scaling-scaleOnMetrics', {
      metric: workerUtilizationMetric,
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: this.scalingCoolDown,
      scalingSteps: [
        { upper: 10, change: -1 },
        { lower: 40, change: +1 },
        { lower: 100, change: +3 },
      ],
    });

    // Output -> Input bucket
    new cdk.CfnOutput(this, 'input-bucket-output', {
      exportName: 'Input-Bucket',
      description: 'Input S3 Bucket',
      value: this.inputBucket.bucketName,
    });

    // Output -> Output bucket
    new cdk.CfnOutput(this, 'output-bucket-output', {
      exportName: 'Output-Bucket',
      value: this.outputBucket.bucketName,
    });

    // Output -> SQS Queue
    new cdk.CfnOutput(this, 'queue-output', {
      exportName: 'SQS-Queue',
      value: queue.queueName,
    });
  }
}