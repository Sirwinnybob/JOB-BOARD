#!/usr/bin/env python3
"""
PDF Dark Mode Converter - Vector-based conversion using pikepdf

This script converts PDFs to dark mode by manipulating PDF content streams
to transform colors while preserving text quality, searchability, and images.

Based on the proven approach from pdf-dark-mode-converter repository.
"""

import sys
import io
import re
import pikepdf
from pikepdf import Pdf, Name
from reportlab.pdfgen import canvas
from PIL import Image, ImageOps
from typing import Tuple, Optional


# Color transformation constants
WHITE_BRIGHTNESS_THRESHOLD = 0.93
BLACK_BRIGHTNESS_THRESHOLD = 0.15
DARK_BRIGHTNESS_THRESHOLD = 0.4
MEDIUM_DARK_BRIGHTNESS_THRESHOLD = 0.6
LOW_SATURATION_THRESHOLD = 0.3

# Brightness weights (ITU-R BT.601)
BRIGHTNESS_WEIGHT_RED = 0.299
BRIGHTNESS_WEIGHT_GREEN = 0.587
BRIGHTNESS_WEIGHT_BLUE = 0.114

# Transformation parameters
BRIGHT_WHITE_VALUE = 0.98
DARK_COLORED_MIN_VALUE = 0.65
DARK_COLORED_VALUE_RANGE = 0.2
DARK_COLORED_SATURATION_BOOST = 1.1
DARK_VALUE_BASE = 0.75
DARK_VALUE_MULTIPLIER = 0.8
DARK_SATURATION_MULTIPLIER = 0.85
MEDIUM_DARK_VALUE_BASE = 0.65
MEDIUM_DARK_VALUE_MULTIPLIER = 1.0
MEDIUM_DARK_SATURATION_MULTIPLIER = 0.9
LIGHT_VALUE_BASE = 0.5
LIGHT_VALUE_MULTIPLIER = 0.5

# Regex patterns for PDF color operators
NUMBER_PATTERN = r'\d*\.?\d+'
PATTERN_RGB_NON_STROKING = re.compile(
    rf'({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+rg'
)
PATTERN_RGB_STROKING = re.compile(
    rf'({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+RG'
)
PATTERN_GRAY_NON_STROKING = re.compile(rf'({NUMBER_PATTERN})\s+g\b')
PATTERN_GRAY_STROKING = re.compile(rf'({NUMBER_PATTERN})\s+G\b')
PATTERN_CMYK_NON_STROKING = re.compile(
    rf'({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+k\b'
)
PATTERN_CMYK_STROKING = re.compile(
    rf'({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+({NUMBER_PATTERN})\s+K\b'
)

# Default theme (pure black)
DEFAULT_BG_COLOR = {"r": 0, "g": 0, "b": 0}


class PDFDarkModeConverter:
    """Convert PDFs to dark mode using vector-based content stream manipulation."""

    def __init__(self, bg_color=None, preserve_images=True):
        """
        Initialize the converter.

        Args:
            bg_color: Background color dict with r, g, b values (0-255)
            preserve_images: If True, don't invert images (better for 3D renders)
        """
        self.bg_color = bg_color or DEFAULT_BG_COLOR
        self.preserve_images = preserve_images
        self.pdf = None

    def convert_file(self, input_path: str, output_path: str):
        """
        Convert a PDF file to dark mode.

        Args:
            input_path: Path to input PDF
            output_path: Path to save dark mode PDF
        """
        with open(input_path, 'rb') as f:
            input_bytes = f.read()

        output_bytes = self.convert_bytes(input_bytes)

        with open(output_path, 'wb') as f:
            f.write(output_bytes)

    def convert_bytes(self, input_bytes: bytes) -> bytes:
        """
        Convert PDF bytes to dark mode.

        Args:
            input_bytes: PDF file as bytes

        Returns:
            Dark mode PDF as bytes
        """
        pdf = Pdf.open(io.BytesIO(input_bytes))
        self.pdf = pdf

        try:
            # Process each page
            for page in pdf.pages:
                self._process_page(page)

            # Save to bytes
            output = io.BytesIO()
            pdf.save(output)
            output.seek(0)
            return output.getvalue()

        finally:
            pdf.close()
            self.pdf = None

    def _create_background_pdf(self, width: float, height: float) -> Pdf:
        """Create a PDF with dark background."""
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(width, height))

        # Set fill color to theme color (normalized to 0-1)
        bg_r = self.bg_color["r"] / 255.0
        bg_g = self.bg_color["g"] / 255.0
        bg_b = self.bg_color["b"] / 255.0

        can.setFillColorRGB(bg_r, bg_g, bg_b)
        can.rect(0, 0, width, height, fill=True, stroke=False)
        can.save()

        packet.seek(0)
        return Pdf.open(packet)

    def _process_page(self, page):
        """
        Process a single page: transform colors, then add background.

        IMPORTANT: Colors must be transformed BEFORE adding background,
        otherwise the background becomes part of the content and gets lost.
        """
        # Transform colors in content streams FIRST
        if Name.Contents in page:
            contents = page.Contents
            all_content = []

            # Handle array of content streams
            if isinstance(contents, pikepdf.Array):
                for stream in contents:
                    if hasattr(stream, 'read_bytes'):
                        content_data = stream.read_bytes()
                        content_str = content_data.decode('latin-1', errors='replace')
                        all_content.append(content_str)
            # Handle single content stream
            elif hasattr(contents, 'read_bytes'):
                content_data = contents.read_bytes()
                content_str = content_data.decode('latin-1', errors='replace')
                all_content.append(content_str)

            # Combine and transform
            combined_content = '\n'.join(all_content)
            modified_content = self._transform_content_stream(combined_content)

            # Replace with transformed content
            new_stream = pikepdf.Stream(self.pdf, modified_content.encode('latin-1', errors='replace'))
            page.Contents = new_stream

        # NOW add dark background as underlay (after colors are transformed)
        mediabox = page.MediaBox
        width = float(mediabox[2] - mediabox[0])
        height = float(mediabox[3] - mediabox[1])

        bg_pdf = self._create_background_pdf(width, height)
        bg_page = bg_pdf.pages[0]
        page.add_underlay(bg_page, pikepdf.Rectangle(0, 0, width, height))
        bg_pdf.close()

    def _transform_content_stream(self, content: str) -> str:
        """Transform all color operators in a PDF content stream."""
        # RGB non-stroking (rg) - text and fill colors
        content = PATTERN_RGB_NON_STROKING.sub(
            lambda m: self._replace_rgb(m, 'rg'), content
        )

        # RGB stroking (RG) - line colors
        content = PATTERN_RGB_STROKING.sub(
            lambda m: self._replace_rgb(m, 'RG'), content
        )

        # Grayscale non-stroking (g)
        content = PATTERN_GRAY_NON_STROKING.sub(
            lambda m: self._replace_gray(m, 'g'), content
        )

        # Grayscale stroking (G)
        content = PATTERN_GRAY_STROKING.sub(
            lambda m: self._replace_gray(m, 'G'), content
        )

        # CMYK non-stroking (k)
        content = PATTERN_CMYK_NON_STROKING.sub(
            lambda m: self._replace_cmyk(m, 'k'), content
        )

        # CMYK stroking (K)
        content = PATTERN_CMYK_STROKING.sub(
            lambda m: self._replace_cmyk(m, 'K'), content
        )

        return content

    def _replace_rgb(self, match, operator: str) -> str:
        """Replace RGB color operator with transformed values."""
        r = float(match.group(1))
        g = float(match.group(2))
        b = float(match.group(3))

        new_r, new_g, new_b = self._transform_rgb(r, g, b)
        return f"{new_r:.4f} {new_g:.4f} {new_b:.4f} {operator}"

    def _replace_gray(self, match, operator: str) -> str:
        """Replace grayscale color operator with transformed value."""
        gray = float(match.group(1))
        new_gray = self._transform_grayscale(gray)
        return f"{new_gray:.4f} {operator} "

    def _replace_cmyk(self, match, operator: str) -> str:
        """Replace CMYK color operator with transformed values."""
        c = float(match.group(1))
        m = float(match.group(2))
        y = float(match.group(3))
        k = float(match.group(4))

        new_c, new_m, new_y, new_k = self._transform_cmyk(c, m, y, k)
        return f"{new_c:.4f} {new_m:.4f} {new_y:.4f} {new_k:.4f} {operator} "

    def _calculate_brightness(self, r: float, g: float, b: float) -> float:
        """Calculate perceived brightness using ITU-R BT.601 formula."""
        return (BRIGHTNESS_WEIGHT_RED * r +
                BRIGHTNESS_WEIGHT_GREEN * g +
                BRIGHTNESS_WEIGHT_BLUE * b)

    def _transform_rgb(self, r: float, g: float, b: float) -> Tuple[float, float, float]:
        """Transform RGB colors intelligently based on brightness and saturation."""
        brightness = self._calculate_brightness(r, g, b)

        # White/light backgrounds → dark theme color
        if brightness > WHITE_BRIGHTNESS_THRESHOLD:
            return (
                self.bg_color["r"] / 255.0,
                self.bg_color["g"] / 255.0,
                self.bg_color["b"] / 255.0
            )

        # Convert to HSV for hue-preserving transformations
        h, s, v = self._rgb_to_hsv(r, g, b)

        # Very dark with low saturation (grayscale/black text) → bright white
        if brightness < BLACK_BRIGHTNESS_THRESHOLD and s < LOW_SATURATION_THRESHOLD:
            return (BRIGHT_WHITE_VALUE, BRIGHT_WHITE_VALUE, BRIGHT_WHITE_VALUE)

        # Very dark with saturation (colored like dark blue) → brighten while keeping hue
        if brightness < BLACK_BRIGHTNESS_THRESHOLD:
            v = DARK_COLORED_MIN_VALUE + (v / BLACK_BRIGHTNESS_THRESHOLD) * DARK_COLORED_VALUE_RANGE
            s = min(s * DARK_COLORED_SATURATION_BOOST, 1.0)
            new_r, new_g, new_b = self._hsv_to_rgb(h, s, v)
            return self._clamp_rgb(new_r, new_g, new_b)

        # Dark colors → brighten significantly
        if brightness < DARK_BRIGHTNESS_THRESHOLD:
            v = DARK_VALUE_BASE + (v - BLACK_BRIGHTNESS_THRESHOLD) * DARK_VALUE_MULTIPLIER
            s = s * DARK_SATURATION_MULTIPLIER
            return self._hsv_to_rgb(h, s, v)

        # Medium-dark → brighten moderately
        if brightness < MEDIUM_DARK_BRIGHTNESS_THRESHOLD:
            v = MEDIUM_DARK_VALUE_BASE + (v - DARK_BRIGHTNESS_THRESHOLD) * MEDIUM_DARK_VALUE_MULTIPLIER
            s = s * MEDIUM_DARK_SATURATION_MULTIPLIER
            return self._hsv_to_rgb(h, s, v)

        # Other colors → moderate brightening
        v = LIGHT_VALUE_BASE + v * LIGHT_VALUE_MULTIPLIER
        return self._hsv_to_rgb(h, s, v)

    def _transform_grayscale(self, gray: float) -> float:
        """Transform grayscale values for dark mode."""
        if gray > WHITE_BRIGHTNESS_THRESHOLD:
            bg_gray = (BRIGHTNESS_WEIGHT_RED * self.bg_color["r"] +
                      BRIGHTNESS_WEIGHT_GREEN * self.bg_color["g"] +
                      BRIGHTNESS_WEIGHT_BLUE * self.bg_color["b"]) / 255.0
            return bg_gray

        if gray < BLACK_BRIGHTNESS_THRESHOLD:
            return BRIGHT_WHITE_VALUE

        if gray < DARK_BRIGHTNESS_THRESHOLD:
            return DARK_VALUE_BASE + (gray - BLACK_BRIGHTNESS_THRESHOLD) * DARK_VALUE_MULTIPLIER

        if gray < MEDIUM_DARK_BRIGHTNESS_THRESHOLD:
            return MEDIUM_DARK_VALUE_BASE + (gray - DARK_BRIGHTNESS_THRESHOLD) * MEDIUM_DARK_VALUE_MULTIPLIER

        return LIGHT_VALUE_BASE + gray * LIGHT_VALUE_MULTIPLIER

    def _transform_cmyk(self, c: float, m: float, y: float, k: float) -> Tuple[float, float, float, float]:
        """Transform CMYK colors by converting to RGB, transforming, and converting back."""
        # Convert to RGB
        r = (1 - c) * (1 - k)
        g = (1 - m) * (1 - k)
        b = (1 - y) * (1 - k)

        # Transform
        new_r, new_g, new_b = self._transform_rgb(r, g, b)

        # Convert back to CMYK
        if new_r == 0 and new_g == 0 and new_b == 0:
            return 0.0, 0.0, 0.0, 1.0

        new_k = 1 - max(new_r, new_g, new_b)
        if new_k < 1:
            new_c = (1 - new_r - new_k) / (1 - new_k)
            new_m = (1 - new_g - new_k) / (1 - new_k)
            new_y = (1 - new_b - new_k) / (1 - new_k)
        else:
            new_c = new_m = new_y = 0.0

        return new_c, new_m, new_y, new_k

    def _rgb_to_hsv(self, r: float, g: float, b: float) -> Tuple[float, float, float]:
        """Convert RGB to HSV (Hue, Saturation, Value)."""
        max_val = max(r, g, b)
        min_val = min(r, g, b)
        diff = max_val - min_val

        if diff == 0:
            h = 0
        elif max_val == r:
            h = (60 * ((g - b) / diff) + 360) % 360
        elif max_val == g:
            h = (60 * ((b - r) / diff) + 120) % 360
        else:
            h = (60 * ((r - g) / diff) + 240) % 360

        s = 0 if max_val == 0 else (diff / max_val)
        v = max_val

        return h / 360.0, s, v

    def _hsv_to_rgb(self, h: float, s: float, v: float) -> Tuple[float, float, float]:
        """Convert HSV to RGB."""
        h = h * 360.0
        c = v * s
        x = c * (1 - abs((h / 60) % 2 - 1))
        m = v - c

        if 0 <= h < 60:
            r, g, b = c, x, 0
        elif 60 <= h < 120:
            r, g, b = x, c, 0
        elif 120 <= h < 180:
            r, g, b = 0, c, x
        elif 180 <= h < 240:
            r, g, b = 0, x, c
        elif 240 <= h < 300:
            r, g, b = x, 0, c
        else:
            r, g, b = c, 0, x

        return r + m, g + m, b + m

    def _clamp_rgb(self, r: float, g: float, b: float) -> Tuple[float, float, float]:
        """Clamp RGB values to valid 0-1 range."""
        return (
            min(max(r, 0.0), 1.0),
            min(max(g, 0.0), 1.0),
            min(max(b, 0.0), 1.0)
        )


def main():
    """CLI interface for dark mode conversion."""
    if len(sys.argv) < 3:
        print("Usage: python3 pdfDarkMode.py <input.pdf> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        converter = PDFDarkModeConverter(preserve_images=True)
        converter.convert_file(input_path, output_path)
        print(f"SUCCESS: Converted {input_path} to {output_path}", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
