import * as cdk from '@aws-cdk/core';
import { EcsEventBasedScaling } from '../src';
import '@aws-cdk/assert/jest';

test('create app', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app);
  new EcsEventBasedScaling(stack, 'EcsEventBasedScalingCluster', {});
  expect(stack).toHaveResource('AWS::ECS::Cluster');
  expect(stack).toHaveResource('AWS::ECS::TaskDefinition');
  expect(stack).toHaveResource('AWS::IAM::Policy');
  expect(stack).toHaveResource('AWS::IAM::Role');
  expect(stack).toHaveResource('AWS::ECS::Service');
  expect(stack).toHaveResource('AWS::S3::Bucket');
  expect(stack).toHaveResource('AWS::SQS::Queue');
  expect(stack).toHaveResource('AWS::CloudWatch::Alarm');
  expect(stack).toHaveResource('AWS::ApplicationAutoScaling::ScalingPolicy');
});