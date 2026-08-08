import { useEffect, useId, useState } from "react";
import "./FileUpload.css";

function FileUpload({ label, helpText, file, existingPreview, onChange, required = false }) {
  const inputId = useId();
  const [preview, setPreview] = useState(existingPreview || "");

  useEffect(() => {
    if (!file) {
      setPreview(existingPreview || "");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, existingPreview]);

  return (
    <div className="file-upload">
      <input id={inputId} className="file-upload__input" type="file" accept="image/*" required={required} onChange={(event) => onChange(event.target.files?.[0] || null)} />
      <label className="file-upload__dropzone" htmlFor={inputId}>
        {preview ? <img className="file-upload__preview" src={preview} alt="Selected upload preview" /> : <span className="file-upload__visual">⇧</span>}
        <span className="file-upload__title">{label}</span>
        <span className="file-upload__help">{file ? file.name : helpText}</span>
        <span className="file-upload__button">Choose file</span>
      </label>
    </div>
  );
}

export default FileUpload;
