import { useEffect, useId, useRef, useState } from "react";
import "./FileUpload.css";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const TARGET_SIZE_MB = 4.8;
const MAX_SOURCE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_DIMENSION = 2800;
const COMPRESSION_QUALITIES = [0.92, 0.86, 0.8, 0.74];

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  ...HEIC_MIME_TYPES,
]);

function isHeicFile(file) {
  if (!file) return false;

  return (
    HEIC_MIME_TYPES.has((file.type || "").toLowerCase()) ||
    /\.hei[cf]$/i.test(file.name || "")
  );
}

function isSupportedImage(file) {
  return (
    SUPPORTED_IMAGE_TYPES.has((file.type || "").toLowerCase()) ||
    /\.(jpe?g|png|webp|hei[cf])$/i.test(file.name || "")
  );
}

function formatFileSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function outputImageType(file) {
  if (/\.png$/i.test(file.name || "") || file.type === "image/png") {
    return "image/png";
  }

  if (/\.webp$/i.test(file.name || "") || file.type === "image/webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function jpegFileName(fileName) {
  const baseName = fileName.replace(/\.hei[cf]$/i, "") || "image";

  return `${baseName}.jpg`;
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The image could not be read."));
    };

    image.src = objectUrl;
  });
}

async function convertHeicToJpeg(file) {
  const { default: heic2any } = await import("heic2any");
  const convertedBlob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.95,
  });
  const jpegBlob = Array.isArray(convertedBlob)
    ? convertedBlob[0]
    : convertedBlob;

  if (!jpegBlob) {
    throw new Error("The HEIC/HEIF image could not be converted.");
  }

  return new File([jpegBlob], jpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

async function optimizeImage(file, dimensions) {
  const requiresResize =
    Math.max(dimensions.width, dimensions.height) > MAX_DIMENSION;

  if (file.size <= MAX_UPLOAD_SIZE_BYTES && !requiresResize) {
    return file;
  }

  const { default: imageCompression } =
    await import("browser-image-compression");
  let optimizedFile = file;

  for (const quality of COMPRESSION_QUALITIES) {
    optimizedFile = await imageCompression(file, {
      maxSizeMB: TARGET_SIZE_MB,
      maxWidthOrHeight: MAX_DIMENSION,
      initialQuality: quality,
      maxIteration: 10,
      useWebWorker: true,
      fileType: outputImageType(file),
    });

    if (optimizedFile.size <= MAX_UPLOAD_SIZE_BYTES) {
      return optimizedFile;
    }
  }

  return optimizedFile;
}

function FileUpload({
  label,
  helpText,
  file,
  existingPreview,
  onChange,
  required = false,
}) {
  const inputId = useId();
  const conversionId = useRef(0);

  const [preview, setPreview] = useState(existingPreview || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [optimizationMessage, setOptimizationMessage] = useState("");

  /*
   * Cancel any pending conversion when the component unmounts.
   */
  useEffect(() => {
    return () => {
      conversionId.current += 1;
    };
  }, []);

  /*
   * Create preview for the file that the parent gives us.
   *
   * HEIC should already have been converted before reaching this point.
   */
  useEffect(() => {
    if (!file) {
      setPreview(existingPreview || "");
      return undefined;
    }

    if (isHeicFile(file)) {
      setPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);

    setPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, existingPreview]);

  async function handleChange(event) {
    const selectedFile = event.target.files?.[0] || null;
    const currentConversionId = ++conversionId.current;

    setError("");
    setOptimizationMessage("");

    if (!selectedFile) {
      setIsProcessing(false);
      onChange(null);
      return;
    }

    if (!isSupportedImage(selectedFile)) {
      setIsProcessing(false);
      onChange(null);
      setError("Choose a JPG, PNG, WebP, HEIC, or HEIF image file.");
      return;
    }

    if (selectedFile.size > MAX_SOURCE_SIZE_BYTES) {
      setIsProcessing(false);
      onChange(null);
      setError(
        "Choose an image smaller than 50 MB so it can be optimized safely.",
      );
      return;
    }

    setIsProcessing(true);

    try {
      const sourceFile = isHeicFile(selectedFile)
        ? await convertHeicToJpeg(selectedFile)
        : selectedFile;

      if (currentConversionId !== conversionId.current) return;

      const dimensions = await getImageDimensions(sourceFile);
      if (currentConversionId !== conversionId.current) return;

      const optimizedFile = await optimizeImage(sourceFile, dimensions);
      if (currentConversionId !== conversionId.current) return;

      if (optimizedFile.size > MAX_UPLOAD_SIZE_BYTES) {
        onChange(null);
        setError(
          "This image could not be optimized below 5 MB without excessive quality loss. Please choose a smaller image.",
        );
        return;
      }

      const uploadFile = new File([optimizedFile], sourceFile.name, {
        type: optimizedFile.type || outputImageType(sourceFile),
        lastModified: selectedFile.lastModified,
      });

      onChange(uploadFile);

      if (uploadFile.size < selectedFile.size || sourceFile !== selectedFile) {
        setOptimizationMessage(
          `Image optimized: ${formatFileSize(selectedFile.size)} → ${formatFileSize(uploadFile.size)}`,
        );
      }
    } catch (processingError) {
      console.error("Image optimization failed:", processingError);

      if (currentConversionId !== conversionId.current) {
        return;
      }

      onChange(null);
      setError(
        "We couldn't optimize this image. Please try another JPG, PNG, WebP, HEIC, or HEIF file.",
      );
    } finally {
      if (currentConversionId === conversionId.current) {
        setIsProcessing(false);
      }
    }
  }

  return (
    <div className="file-upload">
      <input
        id={inputId}
        className="file-upload__input"
        type="file"
        accept="image/*,.heic,.heif"
        required={required}
        onChange={handleChange}
      />

      <label className="file-upload__dropzone" htmlFor={inputId}>
        {isProcessing ? (
          <span className="file-upload__status" aria-live="polite">
            Optimizing image…
          </span>
        ) : preview ? (
          <img
            className="file-upload__preview"
            src={preview}
            alt="Selected upload preview"
          />
        ) : (
          <span className="file-upload__visual">⇧</span>
        )}

        <span className="file-upload__title">{label}</span>

        <span
          className={error ? "file-upload__error" : "file-upload__help"}
          role={error ? "alert" : undefined}
        >
          {error || optimizationMessage || (file ? file.name : helpText)}
        </span>

        <span className="file-upload__button">Choose file</span>
      </label>
    </div>
  );
}

export default FileUpload;
