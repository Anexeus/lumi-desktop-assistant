// Refuses to save obvious secrets as memories or notes. Not a guarantee: a best-effort guard
// against the common cases ("remember my password is …", pasted API keys, card numbers).

const PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/, // OpenAI / Stripe style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bAIza[0-9A-Za-z_-]{30,}/, // Google API key
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:password|passwd|pwd|passcode|pin|otp)\b\s*(?:is|:|=)\s*\S+/i,
  /\b(?:api[ _-]?key|secret|access[ _-]?token|auth[ _-]?token|private[ _-]?key)\b\s*(?:is|:|=)\s*\S{6,}/i
]

function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function looksSensitive(text: string): boolean {
  if (PATTERNS.some((re) => re.test(text))) return true
  // Card numbers: 13–19 digits, optionally grouped by spaces or dashes, passing the Luhn check.
  for (const match of text.matchAll(/\b(?:\d[ -]?){12,18}\d\b/g)) {
    const digits = match[0].replace(/\D/g, '')
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true
  }
  return false
}
