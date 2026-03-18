import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { numberToWords } from "@/lib/number-to-words";
import path from "path";

const logoPath = path.join(process.cwd(), "public/images/interexy-logo.png");

const border = "1px solid #000";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#000",
  },
  /* ---- Header table ---- */
  headerTable: {
    borderTop: border,
    borderLeft: border,
    borderRight: border,
  },
  row: {
    flexDirection: "row",
    borderBottom: border,
  },
  cellLeft: {
    width: "50%",
    padding: 8,
    borderRight: border,
  },
  cellRight: {
    width: "50%",
    padding: 8,
  },
  cellLeftAlign: {
    width: "50%",
    padding: 8,
    borderRight: border,
    justifyContent: "center",
  },
  cellRightAlign: {
    width: "50%",
    padding: 8,
    justifyContent: "center",
  },
  /* ---- Typography ---- */
  invoiceTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  agreementLine: {
    fontSize: 9,
    marginBottom: 1,
  },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    fontSize: 10,
  },
  supplierName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 6,
  },
  detailLine: {
    fontSize: 8,
    marginBottom: 2,
    flexDirection: "row",
  },
  detailLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  detailValue: {
    fontSize: 8,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "right",
  },
  metaValue: {
    fontSize: 9,
  },
  metaValueBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  /* ---- Logo cell ---- */
  logoCell: {
    width: "50%",
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
  },
  /* ---- Items table ---- */
  itemsTable: {
    borderTop: border,
    borderLeft: border,
    borderRight: border,
    marginTop: 16,
  },
  itemsHeaderRow: {
    flexDirection: "row",
    borderBottom: border,
    backgroundColor: "#f5f5f5",
  },
  itemsRow: {
    flexDirection: "row",
    borderBottom: border,
  },
  colDesc: { width: "50%", padding: 5, borderRight: border },
  colQty: { width: "15%", padding: 5, textAlign: "center", borderRight: border },
  colRate: { width: "15%", padding: 5, textAlign: "right", borderRight: border },
  colAmt: { width: "20%", padding: 5, textAlign: "right" },
  colDescH: { width: "50%", padding: 5, fontFamily: "Helvetica-Bold", borderRight: border },
  colQtyH: { width: "15%", padding: 5, textAlign: "center", fontFamily: "Helvetica-Bold", borderRight: border },
  colRateH: { width: "15%", padding: 5, textAlign: "right", fontFamily: "Helvetica-Bold", borderRight: border },
  colAmtH: { width: "20%", padding: 5, textAlign: "right", fontFamily: "Helvetica-Bold" },
  totalLabelCell: {
    width: "50%",
    padding: 5,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    borderRight: border,
  },
  totalValueCell: {
    width: "50%",
    padding: 5,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  totalWordsLabel: {
    width: "50%",
    padding: 5,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    borderRight: border,
  },
  totalWordsValue: {
    width: "50%",
    padding: 5,
    fontFamily: "Helvetica-BoldOblique",
  },
  /* ---- Footer ---- */
  footer: {
    marginTop: 16,
    fontSize: 8,
    lineHeight: 1.6,
  },
  signature: {
    marginTop: 40,
    fontSize: 9,
  },
});

export interface InvoiceData {
  invoiceNumber: number | string;
  agreementDate: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  entity: "BY" | "US" | "CRYPTO";
  supplier: {
    fullName: string;
    legalAddress?: string;
    iban?: string;
    bankAccount?: string;
    bankName?: string;
    bankAddress?: string;
    swift?: string;
    email: string;
  };
  lineItems: {
    description: string;
    quantity?: string;
    rate?: string;
    amount: number;
  }[];
}

interface CustomerInfo {
  name: string;
  legalAddress: string;
  taxId: string;
  taxLabel: string;
  bankName: string;
  bankLocation: string;
  accountTitle: string;
  accountNumber: string;
  extra?: { label: string; value: string }[];
  email: string;
}

const CUSTOMERS: Record<string, CustomerInfo> = {
  US: {
    name: "Interexy LLC",
    legalAddress: "11820, Miramar Prkw, 125, Miramar, Florida, 33025, USA",
    taxId: "38-4156419",
    taxLabel: "EIN:",
    bankName: "Bank of America",
    bankLocation: "18201 NE 19th Ave, North Miami Beach, Fl, 33162",
    accountTitle: "Interexy, LLC",
    accountNumber: "898114153738",
    extra: [
      { label: "ABA code:", value: "063100277 (paper/electronic)\n/ 026009593 (wires)" },
      { label: "SWIFT:", value: "BOFAUS3N (International in $)" },
      { label: "SWIFT:", value: "BOFAUS6N (International other\nCurrencies)" },
    ],
    email: "stan.sakharchuk@interexy.com",
  },
  BY: {
    name: "AMC LLC",
    legalAddress: "Republic of Belarus, Minsk",
    taxId: "",
    taxLabel: "UNP:",
    bankName: "Zepter Bank CJSC",
    bankLocation: "1B Platonova St., 220034, Minsk, Republic of Belarus",
    accountTitle: "AMC LLC",
    accountNumber: "",
    extra: [
      { label: "SWIFT:", value: "ZEPTBY2X" },
    ],
    email: "stan.sakharchuk@interexy.com",
  },
  CRYPTO: {
    name: "Crypto Payments",
    legalAddress: "TBD",
    taxId: "",
    taxLabel: "",
    bankName: "N/A",
    bankLocation: "N/A",
    accountTitle: "N/A",
    accountNumber: "",
    email: "stan.sakharchuk@interexy.com",
  },
};

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <Text style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label} </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </Text>
  );
}

function formatMoney(amount: number): string {
  return "$ " + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== HEADER TABLE ===== */}
        <View style={styles.headerTable}>
          {/* Row 1: Invoice title (left) + Logo (right) */}
          <View style={styles.row}>
            <View style={styles.cellLeft}>
              <Text style={styles.invoiceTitle}>INVOICE №{data.invoiceNumber}</Text>
              <Text style={styles.agreementLine}>GENERAL SERVICE AGREEMENT</Text>
              <Text style={styles.agreementLine}>Dated {data.agreementDate}</Text>
            </View>
            <View style={styles.logoCell}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={logoPath} style={styles.logo} />
            </View>
          </View>

          {/* Row 2: Supplier / Customer labels */}
          <View style={styles.row}>
            <View style={{ ...styles.cellLeft, paddingBottom: 4 }}>
              <Text style={styles.sectionLabel}>Supplier:</Text>
            </View>
            <View style={{ ...styles.cellRight, paddingBottom: 4 }}>
              <Text style={styles.sectionLabel}>Customer:</Text>
            </View>
          </View>

          {/* Row 3: Supplier / Customer details */}
          <View style={styles.row}>
            <View style={styles.cellLeft}>
              <Text style={styles.supplierName}>{data.supplier.fullName}</Text>
              <Detail label="Legal Address:" value={data.supplier.legalAddress} />
              <Detail label="IBAN:" value={data.supplier.iban} />
              <Detail label="Bank Account:" value={data.supplier.bankAccount} />
              <Detail label="Bank name:" value={data.supplier.bankName} />
              <Detail label="Bank address:" value={data.supplier.bankAddress} />
              <Detail label="SWIFT:" value={data.supplier.swift} />
              <Detail label="E-mail:" value={data.supplier.email} />
            </View>
            <View style={styles.cellRight}>
              {(() => {
                const c = CUSTOMERS[data.entity];
                return (
                  <>
                    <Text style={styles.supplierName}>{c.name}</Text>
                    <Detail label="Legal Address:" value={c.legalAddress} />
                    {c.taxId && <Detail label={c.taxLabel} value={c.taxId} />}
                    <Detail label="Bank name:" value={c.bankName} />
                    <Detail label="Bank location:" value={c.bankLocation} />
                    <Detail label="Account Title:" value={c.accountTitle} />
                    {c.accountNumber && <Detail label="Account Number:" value={c.accountNumber} />}
                    {c.extra?.map((ex, i) => (
                      <Detail key={i} label={ex.label} value={ex.value} />
                    ))}
                    <Detail label="E-mail:" value={c.email} />
                  </>
                );
              })()}
            </View>
          </View>

          {/* Row 4: Date */}
          <View style={styles.row}>
            <View style={styles.cellLeftAlign}>
              <Text style={styles.metaLabel}>Date:</Text>
            </View>
            <View style={styles.cellRightAlign}>
              <Text style={styles.metaValue}>{data.invoiceDate}</Text>
            </View>
          </View>

          {/* Row 5: Due Date */}
          <View style={styles.row}>
            <View style={styles.cellLeftAlign}>
              <Text style={styles.metaLabel}>Due Date:</Text>
            </View>
            <View style={styles.cellRightAlign}>
              <Text style={styles.metaValue}>{data.dueDate}</Text>
            </View>
          </View>

          {/* Row 6: Total due */}
          <View style={{ ...styles.row, borderBottom: border }}>
            <View style={styles.cellLeftAlign}>
              <Text style={styles.metaLabel}>Total due:</Text>
            </View>
            <View style={styles.cellRightAlign}>
              <Text style={styles.metaValueBold}>{formatMoney(data.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* ===== LINE ITEMS TABLE ===== */}
        <View style={styles.itemsTable}>
          <View style={styles.itemsHeaderRow}>
            <Text style={styles.colDescH}>Description:</Text>
            <Text style={styles.colQtyH}>Quantity:</Text>
            <Text style={styles.colRateH}>Rate:</Text>
            <Text style={styles.colAmtH}>Amount:</Text>
          </View>
          {data.lineItems.map((item, idx) => (
            <View style={styles.itemsRow} key={idx}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity || ""}</Text>
              <Text style={styles.colRate}>{item.rate || ""}</Text>
              <Text style={styles.colAmt}>{formatMoney(item.amount)}</Text>
            </View>
          ))}
          {/* Total row */}
          <View style={styles.itemsRow}>
            <Text style={styles.totalLabelCell}>Total:</Text>
            <Text style={styles.totalValueCell}>{formatMoney(data.totalAmount)}</Text>
          </View>
          {/* Total to pay in words */}
          <View style={{ ...styles.itemsRow, borderBottom: 0 }}>
            <Text style={styles.totalWordsLabel}>Total to pay:</Text>
            <Text style={styles.totalWordsValue}>{numberToWords(data.totalAmount)}</Text>
          </View>
        </View>

        {/* ===== FOOTER ===== */}
        <View style={styles.footer}>
          <Text>
            All commissions of correspondent banks are paid by the Customer.
          </Text>
          <Text style={{ marginTop: 6 }}>
            Payment in accordance with this Invoice is at the same time confirmation of the work performed,
            services rendered, settlement for the relevant period or final settlement (if this is the last
            and (or) only payment under the agreement) between the Parties and the fact that the Parties
            have no mutual claims and do not require signing additional documents.
          </Text>
        </View>

        {/* ===== SIGNATURE ===== */}
        <View style={styles.signature}>
          <Text>_____________________  {data.supplier.fullName}</Text>
        </View>
      </Page>
    </Document>
  );
}
