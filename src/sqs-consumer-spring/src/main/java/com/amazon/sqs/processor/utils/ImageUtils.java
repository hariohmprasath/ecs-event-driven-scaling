package com.amazon.sqs.processor.utils;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.font.TextAttribute;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.AttributedString;

import javax.imageio.ImageIO;

import net.coobird.thumbnailator.Thumbnails;

public class ImageUtils {
	public static BufferedImage resizeImage(BufferedImage originalImage, int targetWidth,
			int targetHeight, String extension) throws IOException {
		ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
		Thumbnails.of(originalImage)
				.size(targetWidth, targetHeight)
				.outputFormat(extension)
				.outputQuality(0.90)
				.toOutputStream(outputStream);
		byte[] data = outputStream.toByteArray();
		ByteArrayInputStream inputStream = new ByteArrayInputStream(data);
		return ImageIO.read(inputStream);
	}

	public static BufferedImage signImageBottomRight(String text, BufferedImage image) {
		Font font = new Font("Arial", Font.BOLD, 18);

		AttributedString attributedText = new AttributedString(text);
		attributedText.addAttribute(TextAttribute.FONT, font);
		attributedText.addAttribute(TextAttribute.FOREGROUND, Color.GREEN);
		Graphics g = image.getGraphics();
		FontMetrics metrics = g.getFontMetrics(font);
		int positionX = (image.getWidth() - metrics.stringWidth(text));
		int positionY = (image.getHeight() - metrics.getHeight()) + metrics.getAscent();

		g.drawString(attributedText.getIterator(), positionX, positionY);
		return image;
	}
}
