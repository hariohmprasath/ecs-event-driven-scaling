package com.amazon.sqs.processor.service;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.imageio.ImageIO;

import com.amazon.sqs.processor.Constants;
import com.amazon.sqs.processor.utils.ImageUtils;
import com.amazon.sqs.processor.utils.S3Utils;
import com.amazonaws.services.s3.event.S3EventNotification;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.cloud.aws.messaging.listener.annotation.SqsListener;
import org.springframework.stereotype.Service;

@Service
public class ImageProcessingService {
	private static final Logger LOG = LoggerFactory.getLogger(ImageProcessingService.class);
	private final ObjectMapper objectMapper = new ObjectMapper();

	@SqsListener("S3NotificationQueue")
	public void process(String json) throws IOException {		
		final S3EventNotification notification = objectMapper.readValue(json, S3EventNotification.class);
		final String outputBucket = System.getenv(Constants.OUTPUT_BUCKET);
		notification.getRecords()
				.forEach(x -> processFile(x.getS3().getBucket().getName(), x.getS3().getObject()
						.getKey(), outputBucket));
	}

	public void processFile(String bucketName, String objectKey, String outputBucket) {
		final String s3ObjectKeyName = S3Utils.getObjectKeyName(objectKey);
		final String s3ObjectKeyPath = S3Utils.getObjectKeyPath(objectKey);
		final Map<String, String> fileDetails = S3Utils.getFileDetails(s3ObjectKeyName);
		final String finalOutputFileName = fileDetails.get(Constants.NAME);
		final String extension = fileDetails.getOrDefault(Constants.EXT, Constants.PNG);

		try {		
			// Added artifical wait so we can get some messages in backlog, instead of processing it right away
			Thread.sleep(5000);			

			// Download S3 file to local
			S3Utils.downloadFile(bucketName, objectKey, finalOutputFileName);

			List<File> files = new ArrayList<>();
			final String fullPath = String.format("/tmp/%s", finalOutputFileName);
			final String outputParentPath = String.format("/tmp/%s", finalOutputFileName);
			if (fullPath != null) {
				// Read the source file into BufferedImage
				BufferedImage sourceImage = ImageIO.read(new File(fullPath));

				// Convert to 100 x 200
				File file = new File(outputParentPath + Constants.SMALL + extension);
				ImageIO.write(ImageUtils.resizeImage(sourceImage, 100, 200, extension), extension, file);
				files.add(file);

				// Convert to 300 x 500
				file = new File(outputParentPath + Constants.MEDIUM + extension);
				ImageIO.write(ImageUtils.resizeImage(sourceImage, 300, 500, extension), extension, file);
				files.add(file);

				// Convert to 720 x 1024
				file = new File(outputParentPath + Constants.LARGE + extension);
				ImageIO.write(ImageUtils.resizeImage(sourceImage, 720, 1024, extension), extension, file);
				files.add(file);

				// Paint a text in the bottom of the image
				file = new File(outputParentPath + Constants.TEXT + extension);
				ImageIO.write(ImageUtils.signImageBottomRight(Constants.SIGNED_TEXT, sourceImage), extension, file);
				files.add(file);

				// Upload the newly generated files and cleanup tmp files in the local disk
				files.parallelStream().forEach(f -> {
					try {
						S3Utils.uploadFile(outputBucket, String
								.format(("%s" + (s3ObjectKeyPath != null ? ("/" + s3ObjectKeyPath) : "")), f
										.getName()), f);
						Files.delete(Paths.get(f.getPath()));
					}
					catch (Exception e) {
						LOG.error("Error while upload files to S3 and cleaning up {}", e.getMessage(), e);
					}
				});

				// Cleanup original file
				Files.delete(Paths.get(fullPath));
			}
		}
		catch (Exception e) {
			LOG.error("Error while processing the image {}", e.getMessage(), e);
		}
	}
}
