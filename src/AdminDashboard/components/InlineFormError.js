function InlineFormError({ message }) {
  return message ? (
    <p className="admin-form__error admin-form__error--inline">{message}</p>
  ) : null;
}

export default InlineFormError;
