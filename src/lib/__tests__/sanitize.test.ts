import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeName,
  isValidSwift,
  isValidIban,
  isValidAccountNumber,
  isValidRoutingNumber,
  isValidMoneyAmount,
  normalizeIban,
  normalizeSwift,
} from "../sanitize";

describe("sanitizeText", () => {
  it("strips HTML tags", () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it("strips null bytes", () => {
    expect(sanitizeText("hello\0world")).toBe("helloworld");
  });

  it("strips control characters but keeps newlines and tabs", () => {
    expect(sanitizeText("hello\x01\x02world")).toBe("helloworld");
    expect(sanitizeText("hello\nworld")).toBe("hello\nworld");
    expect(sanitizeText("hello\tworld")).toBe("hello\tworld");
  });

  it("strips javascript: protocol", () => {
    expect(sanitizeText("javascript:alert(1)")).toBe("alert(1)");
  });

  it("strips event handlers", () => {
    expect(sanitizeText('onerror=alert(1) onclick="hack()"')).toBe('alert(1) "hack()"');
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });

  it("passes through clean text", () => {
    expect(sanitizeText("Normal business text 123")).toBe("Normal business text 123");
  });
});

describe("sanitizeName", () => {
  it("allows Latin letters and spaces", () => {
    expect(sanitizeName("John Doe")).toBe("John Doe");
  });

  it("allows accented characters", () => {
    expect(sanitizeName("José García")).toBe("José García");
  });

  it("allows Cyrillic characters", () => {
    expect(sanitizeName("Иван Петров")).toBe("Иван Петров");
  });

  it("strips special characters", () => {
    expect(sanitizeName("John@Doe#123!")).toBe("JohnDoe123");
  });

  it("allows basic punctuation (dash, apostrophe, period, comma, parens)", () => {
    expect(sanitizeName("O'Brien-Smith (Jr.)")).toBe("O'Brien-Smith (Jr.)");
  });
});

describe("isValidSwift", () => {
  it("accepts 8-char SWIFT", () => {
    expect(isValidSwift("DEUTDEFF")).toBe(true);
  });

  it("accepts 11-char SWIFT", () => {
    expect(isValidSwift("DEUTDEFF500")).toBe(true);
  });

  it("rejects short codes", () => {
    expect(isValidSwift("DEUTDE")).toBe(false);
  });

  it("rejects 9-char codes", () => {
    expect(isValidSwift("DEUTDEFF5")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(isValidSwift("deutdeff")).toBe(false);
  });
});

describe("isValidIban", () => {
  it("accepts valid German IBAN", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });

  it("accepts IBAN with spaces (normalized)", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
  });

  it("accepts lowercase (normalized to uppercase)", () => {
    expect(isValidIban("de89370400440532013000")).toBe(true);
  });

  it("rejects missing country code", () => {
    expect(isValidIban("89370400440532013000")).toBe(false);
  });

  it("rejects too short", () => {
    expect(isValidIban("DE89")).toBe(false);
  });
});

describe("isValidAccountNumber", () => {
  it("accepts digits", () => {
    expect(isValidAccountNumber("12345678")).toBe(true);
  });

  it("accepts dashes and spaces", () => {
    expect(isValidAccountNumber("1234-5678 9012")).toBe(true);
  });

  it("rejects letters", () => {
    expect(isValidAccountNumber("1234ABCD")).toBe(false);
  });

  it("rejects too short", () => {
    expect(isValidAccountNumber("123")).toBe(false);
  });
});

describe("isValidRoutingNumber", () => {
  it("accepts 9 digits", () => {
    expect(isValidRoutingNumber("021000021")).toBe(true);
  });

  it("rejects 8 digits", () => {
    expect(isValidRoutingNumber("02100002")).toBe(false);
  });

  it("rejects letters", () => {
    expect(isValidRoutingNumber("0210000AB")).toBe(false);
  });
});

describe("isValidMoneyAmount", () => {
  it("accepts zero", () => {
    expect(isValidMoneyAmount(0)).toBe(true);
  });

  it("accepts positive amounts", () => {
    expect(isValidMoneyAmount(1234.56)).toBe(true);
  });

  it("rejects negative", () => {
    expect(isValidMoneyAmount(-1)).toBe(false);
  });

  it("rejects above max", () => {
    expect(isValidMoneyAmount(1_000_001)).toBe(false);
  });

  it("accepts custom max", () => {
    expect(isValidMoneyAmount(500, 500)).toBe(true);
    expect(isValidMoneyAmount(501, 500)).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(isValidMoneyAmount(Infinity)).toBe(false);
  });

  it("rejects NaN", () => {
    expect(isValidMoneyAmount(NaN)).toBe(false);
  });
});

describe("normalizeIban", () => {
  it("strips spaces and uppercases", () => {
    expect(normalizeIban("de89 3704 0044")).toBe("DE8937040044");
  });
});

describe("normalizeSwift", () => {
  it("strips spaces and uppercases", () => {
    expect(normalizeSwift("deut deff")).toBe("DEUTDEFF");
  });
});
