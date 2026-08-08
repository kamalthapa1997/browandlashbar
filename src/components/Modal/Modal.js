import { useEffect } from "react";
import "./Modal.css";

function Modal({ isOpen, onClose, maxWidth, children }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }

    if (isOpen) document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <button className="modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="modal__content" style={{ maxWidth }}>
        <button className="modal__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;
