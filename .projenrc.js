const { AwsCdkConstructLibrary } = require('projen');

const project = new AwsCdkConstructLibrary({
  author: 'Hari Ohm Prasath',
  authorAddress: 'harrajag@amazon.com',
  cdkVersion: '1.73.0',
  jsiiFqn: 'projen.AwsCdkConstructLibrary',
  name: 'ecs-event-based-scaling',
  repositoryUrl: 'git@ssh.gitlab.aws.dev:am3-app-modernization-gsp/ecs-event-based-scaling.git',
  cdkDependencies: [
    '@aws-cdk/core',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-s3',
    '@aws-cdk/aws-autoscaling',
    '@aws-cdk/aws-cloudwatch',
    '@aws-cdk/aws-s3-notifications',
    '@aws-cdk/aws-sqs',
  ],
  gitignore: [
    'cdk.out',
  ],
});

project.synth();
