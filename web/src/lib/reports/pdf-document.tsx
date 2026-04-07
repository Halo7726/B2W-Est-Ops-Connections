import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReportDefinition } from "@/lib/reports/api-types";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 12,
    borderBottom: "1 solid #dddddd",
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    color: "#444444",
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1 solid #bbbbbb",
    backgroundColor: "#f7f7f7",
  },
  headerCell: {
    flexGrow: 1,
    flexBasis: 0,
    padding: 4,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #eeeeee",
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    padding: 4,
  },
  footer: {
    marginTop: 10,
    color: "#666666",
  },
});

function toDisplay(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface Props {
  report: ReportDefinition;
  rows: Record<string, unknown>[];
}

export function ReportPdfDocument({ report, rows }: Props) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const generatedAt = new Date().toISOString();

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{report.name}</Text>
          <Text style={styles.subtitle}>Entity: {report.entity}</Text>
          <Text style={styles.subtitle}>Rows: {rows.length}</Text>
          <Text style={styles.subtitle}>Generated At: {generatedAt}</Text>
        </View>

        <View style={styles.tableHeader}>
          {columns.map((column) => (
            <Text key={column} style={styles.headerCell}>
              {column}
            </Text>
          ))}
        </View>

        {rows.slice(0, 2000).map((row, idx) => (
          <View key={idx} style={styles.row}>
            {columns.map((column) => (
              <Text key={column} style={styles.cell}>
                {toDisplay(row[column])}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>Report builder export</Text>
      </Page>
    </Document>
  );
}
