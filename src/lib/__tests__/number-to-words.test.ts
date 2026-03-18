import { describe, it, expect } from "vitest";
import { numberToWords } from "../number-to-words";

describe("numberToWords", () => {
  it("converts zero", () => {
    expect(numberToWords(0)).toBe("Zero US dollars");
  });

  it("converts one dollar", () => {
    expect(numberToWords(1)).toBe("One US dollar");
  });

  it("converts teens", () => {
    expect(numberToWords(15)).toBe("Fifteen US dollars");
  });

  it("converts tens", () => {
    expect(numberToWords(50)).toBe("Fifty US dollars");
  });

  it("converts compound tens", () => {
    expect(numberToWords(42)).toBe("Forty-two US dollars");
  });

  it("converts hundreds", () => {
    expect(numberToWords(100)).toBe("One hundred US dollars");
  });

  it("converts hundreds with remainder", () => {
    expect(numberToWords(215)).toBe("Two hundred fifteen US dollars");
  });

  it("converts thousands", () => {
    expect(numberToWords(1000)).toBe("One thousand US dollars");
  });

  it("converts complex number", () => {
    expect(numberToWords(1234)).toBe("One thousand two hundred thirty-four US dollars");
  });

  it("converts millions", () => {
    expect(numberToWords(1_000_000)).toBe("One million US dollars");
  });

  it("converts billions", () => {
    expect(numberToWords(2_000_000_000)).toBe("Two billion US dollars");
  });

  it("handles cents", () => {
    expect(numberToWords(0.99)).toBe("Zero US dollars and ninety-nine cents");
  });

  it("handles one cent", () => {
    expect(numberToWords(0.01)).toBe("Zero US dollars and one cent");
  });

  it("handles dollars and cents", () => {
    expect(numberToWords(1234.56)).toBe(
      "One thousand two hundred thirty-four US dollars and fifty-six cents"
    );
  });

  it("handles typical salary amount", () => {
    expect(numberToWords(5000)).toBe("Five thousand US dollars");
  });

  it("handles amount with no cents", () => {
    expect(numberToWords(250.0)).toBe("Two hundred fifty US dollars");
  });
});
