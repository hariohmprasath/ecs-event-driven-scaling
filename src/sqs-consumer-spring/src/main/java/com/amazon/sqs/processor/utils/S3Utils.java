package com.amazon.sqs.processor.utils;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.S3Object;
import com.amazonaws.services.s3.model.S3ObjectInputStream;
import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


public class S3Utils {
	private static final AmazonS3 S3_CLIENT_BUILDER = AmazonS3ClientBuilder.standard()
			.withCredentials(new DefaultAWSCredentialsProviderChain())
			.build();
	private static final Logger LOG = LoggerFactory.getLogger(S3Utils.class);

	public static void downloadFile(String bucketName, String objectKey, String fileName) {
		try (S3Object s3object = S3_CLIENT_BUILDER.getObject(bucketName, objectKey);
			 S3ObjectInputStream inputStream = s3object.getObjectContent()) {
			String fullPath = String.format("/tmp/%s", fileName);
			FileUtils.copyInputStreamToFile(inputStream, new File(fullPath));
		}
		catch (Exception e) {
			LOG.error("Error while downloading file {}", e.getMessage(), e);
		}
	}

	public static void uploadFile(String bucketName, String objectKey, File file) {
		S3_CLIENT_BUILDER.putObject(
				bucketName,
				objectKey,
				file
		);
	}

	public static String getObjectKeyName(String objectKey) {
		if (objectKey.lastIndexOf("/") != -1) {
			return objectKey.substring(objectKey.lastIndexOf("/") + 1);
		}

		return objectKey;
	}

	public static String getObjectKeyPath(String objectKey) {
		if (objectKey.lastIndexOf("/") != -1)
			return objectKey.substring(0, objectKey.lastIndexOf("/") - 1);

		else
			return null;
	}

	public static Map<String, String> getFileDetails(String fileName) {
		Map<String, String> details = new HashMap<>();
		if (fileName.contains(".")) {
			String[] split = fileName.split("\\.");
			details.put("name", split[0]);
			details.put("ext", split[1]);
		}
		else
			details.put("name", fileName);

		return details;
	}
}
