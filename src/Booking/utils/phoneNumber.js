const PHONE_FORMATTING_CHARACTERS = /^[+\d().\-\s]*$/;

function getPhoneDigits(value) {
  if (typeof value !== "string" || !PHONE_FORMATTING_CHARACTERS.test(value)) {
    return null;
  }

  return value.replace(/\D/g, "");
}

function getDisplayDigits(value) {
  const digits = getPhoneDigits(value);
  if (digits === null) return null;

  const isExplicitUsCountryCode = value.trim().startsWith("+1");
  if (
    digits.startsWith("1") &&
    (isExplicitUsCountryCode || digits.length === 11)
  ) {
    return digits.slice(1);
  }

  return digits;
}

export function normalizeUsPhoneNumber(value) {
  const digits = getPhoneDigits(value);
  if (digits === null) return "";

  const localDigits = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  return localDigits.length === 10 ? localDigits : "";
}

export function formatUsPhoneNumber(value) {
  const digits = getDisplayDigits(value);
  if (digits === null) return value;

  if (!digits) return value.trim().startsWith("+") ? value : "";
  if (digits.length < 3) return digits;
  if (digits.length === 3) return `(${digits})`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function getFormattedPhoneCaretPosition(value, selectionStart) {
  const rawBeforeCursor = value.slice(0, selectionStart ?? value.length);
  const totalDigits = getPhoneDigits(value);
  let digitsBeforeCursor = getPhoneDigits(rawBeforeCursor)?.length ?? 0;

  if (
    totalDigits?.length === 11 &&
    totalDigits.startsWith("1") &&
    rawBeforeCursor.replace(/\D/g, "").startsWith("1")
  ) {
    digitsBeforeCursor -= 1;
  }

  const formatted = formatUsPhoneNumber(value);
  if (!/\d/.test(formatted)) return formatted.length;
  if (digitsBeforeCursor <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) seenDigits += 1;
    if (seenDigits === digitsBeforeCursor) return index + 1;
  }

  return formatted.length;
}
