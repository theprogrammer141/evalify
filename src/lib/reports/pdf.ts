import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { getExaminerPerformanceReport } from "@/lib/reports/service";
import type { getExaminerIssuedReport } from "@/lib/reports/service";

type PerformanceReport = Awaited<ReturnType<typeof getExaminerPerformanceReport>>;
type CandidateReport = Awaited<ReturnType<typeof getExaminerIssuedReport>>;

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 44;
const ink = rgb(0.08, 0.13, 0.22);
const muted = rgb(0.37, 0.43, 0.52);
const border = rgb(0.85, 0.88, 0.92);
const pale = rgb(0.95, 0.97, 0.99);
const blue = rgb(0.13, 0.39, 0.92);

function printableText(value: string) {
  const replacements: Record<string, string> = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2026": "...",
    "\u2022": "*",
    "\u00a0": " ",
  };
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u2022\u00a0]/g, (char) =>
      replacements[char] ?? " ",
    )
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = printableText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    let remaining = word;
    while (font.widthOfTextAtSize(remaining, size) > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let splitAt = 1;
      while (
        splitAt < remaining.length &&
        font.widthOfTextAtSize(remaining.slice(0, splitAt + 1), size) <= width
      ) {
        splitAt += 1;
      }
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    const candidate = line ? `${line} ${remaining}` : remaining;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function drawLines(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = ink,
  lineHeight = size + 3,
) {
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, font, size, color });
  });
}

function formatDate(value: string | null | Date) {
  if (!value) return "Not recorded";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function makeDocument() {
  return PDFDocument.create().then(async (document) => {
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    return { document, regular, bold };
  });
}

function drawPageHeader(
  page: PDFPage,
  title: string,
  subtitle: string,
  font: PDFFont,
  bold: PDFFont,
) {
  page.drawRectangle({
    x: 0,
    y: pageHeight - 8,
    width: pageWidth,
    height: 8,
    color: blue,
  });
  page.drawText("EVALIFY  /  EXAMINATION RECORDS", {
    x: margin,
    y: pageHeight - 37,
    font: bold,
    size: 8,
    color: blue,
  });
  const titleLines = wrapText(title, bold, 17, pageWidth - margin * 2);
  drawLines(page, titleLines, margin, pageHeight - 62, bold, 17, ink, 20);
  const subtitleY = pageHeight - 62 - titleLines.length * 20 - 3;
  page.drawText(printableText(subtitle), {
    x: margin,
    y: subtitleY,
    font,
    size: 9,
    color: muted,
    maxWidth: pageWidth - margin * 2,
  });
  const ruleY = subtitleY - 14;
  page.drawLine({
    start: { x: margin, y: ruleY },
    end: { x: pageWidth - margin, y: ruleY },
    thickness: 1,
    color: border,
  });
  return ruleY - 24;
}

function drawFooter(
  page: PDFPage,
  pageNumber: number,
  pageCount: number,
  generatedAt: string,
  font: PDFFont,
) {
  page.drawLine({
    start: { x: margin, y: 34 },
    end: { x: pageWidth - margin, y: 34 },
    thickness: 0.7,
    color: border,
  });
  page.drawText(`Generated ${printableText(formatDate(generatedAt))} UTC`, {
    x: margin,
    y: 20,
    font,
    size: 7,
    color: muted,
  });
  page.drawText(`Page ${pageNumber} of ${pageCount}`, {
    x: pageWidth - margin - 72,
    y: 20,
    font,
    size: 7,
    color: muted,
  });
}

function drawTableHeading(
  page: PDFPage,
  labels: string[],
  widths: number[],
  y: number,
  font: PDFFont,
) {
  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: pageWidth - margin * 2,
    height: 22,
    color: pale,
  });
  let x = margin + 8;
  labels.forEach((label, index) => {
    page.drawText(printableText(label), {
      x,
      y: y - 10,
      font,
      size: 7.5,
      color: ink,
      maxWidth: widths[index] - 12,
    });
    x += widths[index];
  });
}

export async function buildPerformanceReportPdf(report: PerformanceReport) {
  const { document, regular, bold } = await makeDocument();
  const pages: PDFPage[] = [];
  const columns = [200, 115, 100, pageWidth - margin * 2 - 415];
  let page: PDFPage;
  let y = pageHeight - 125;

  const addPage = (continued: boolean) => {
    page = document.addPage([pageWidth, pageHeight]);
    pages.push(page);
    y = drawPageHeader(
      page,
      report.title,
      continued
        ? "Candidate performance  /  Continued"
        : "Examination performance  /  Preview - not officially issued",
      regular,
      bold,
    );
    return page;
  };

  page = addPage(false);
  const summaryLines = [
    `Examination window: ${formatDate(report.opensAt)} - ${formatDate(report.closesAt)} UTC`,
    `Duration: ${report.durationMinutes} minutes`,
    `Candidates with attempts: ${report.candidateCount}`,
    `Finalized results: ${report.finalizedCount} of ${report.candidateCount}`,
    `Average finalized result: ${report.averagePercentage === null ? "Not available" : `${report.averagePercentage}%`}`,
    `Highest finalized marks: ${report.highestMarks === null ? "Not available" : `${report.highestMarks}`}`,
  ];
  drawLines(page, summaryLines, margin, y, regular, 9, ink, 15);
  y -= summaryLines.length * 15 + 18;

  drawTableHeading(
    page,
    ["Candidate", "Completion (UTC)", "Evaluation", "Marks"],
    columns,
    y,
    bold,
  );
  y -= 28;

  for (const candidate of report.candidates) {
    const status =
      candidate.evaluationStatus === "FINALIZED"
        ? candidate.published
          ? "Published"
          : "Finalized"
        : candidate.evaluationStatus?.replaceAll("_", " ") ?? "Not evaluated";
    const marks =
      candidate.evaluationStatus === "FINALIZED" &&
      candidate.totalMarks !== null
        ? `${candidate.totalMarks} / ${candidate.maximumMarks}`
        : `- / ${candidate.maximumMarks}`;
    const values = [
      candidate.candidateEmail,
      formatDate(candidate.completedAt),
      status,
      marks,
    ];
    const wrapped = values.map((value, index) =>
      wrapText(value, regular, 7.5, columns[index] - 12),
    );
    const rowHeight = Math.max(26, ...wrapped.map((lines) => lines.length * 10 + 10));

    if (y - rowHeight < 52) {
      page = addPage(true);
      drawTableHeading(
        page,
        ["Candidate", "Completion (UTC)", "Evaluation", "Marks"],
        columns,
        y,
        bold,
      );
      y -= 28;
    }

    let x = margin + 8;
    wrapped.forEach((lines, index) => {
      drawLines(page, lines, x, y - 8, regular, 7.5, ink, 10);
      x += columns[index];
    });
    page.drawLine({
      start: { x: margin, y: y - rowHeight },
      end: { x: pageWidth - margin, y: y - rowHeight },
      thickness: 0.45,
      color: border,
    });
    y -= rowHeight;
  }

  pages.forEach((currentPage, index) =>
    drawFooter(currentPage, index + 1, pages.length, report.generatedAt, regular),
  );
  return document.save();
}

export async function buildCandidateResultReportPdf(
  report: CandidateReport,
  verificationUrl: string,
) {
  const { document, regular, bold } = await makeDocument();
  const page = document.addPage([pageWidth, pageHeight]);
  drawPageHeader(
    page,
    "Candidate result report",
    "Official result  /  Issued by Evalify",
    regular,
    bold,
  );

  const percentage = Math.round((report.totalMarks / report.maximumMarks) * 1000) / 10;
  let y = pageHeight - 145;
  page.drawText("CANDIDATE", {
    x: margin,
    y,
    font: bold,
    size: 8,
    color: muted,
  });
  y -= 20;
  const candidateLines = wrapText(
    report.candidateEmail,
    bold,
    13,
    pageWidth - margin * 2,
  );
  drawLines(page, candidateLines, margin, y, bold, 13);
  y -= candidateLines.length * 16 + 30;
  page.drawText("EXAMINATION", {
    x: margin,
    y,
    font: bold,
    size: 8,
    color: muted,
  });
  y -= 22;
  const examinationTitleLines = wrapText(
    report.examinationTitle,
    bold,
    16,
    pageWidth - margin * 2,
  );
  drawLines(page, examinationTitleLines, margin, y, bold, 16, ink, 20);
  y -= examinationTitleLines.length * 20 + 30;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: border,
  });
  y -= 44;

  page.drawText("PUBLISHED RESULT", {
    x: margin,
    y,
    font: bold,
    size: 8,
    color: muted,
  });
  page.drawText(`${report.totalMarks} / ${report.maximumMarks}`, {
    x: margin,
    y: y - 49,
    font: bold,
    size: 31,
    color: ink,
  });
  page.drawText(`${percentage}%`, {
    x: pageWidth - margin - 110,
    y: y - 45,
    font: bold,
    size: 21,
    color: blue,
  });
  y -= 83;

  const details = [
    ["Examination duration", `${report.durationMinutes} minutes`],
    ["Attempt status", report.attemptStatus === "EXPIRED" ? "Expired" : "Submitted"],
    ["Completed", `${formatDate(report.completedAt)} UTC`],
    ["Result published", `${formatDate(report.publishedAt)} UTC`],
    ["Report issued", `${formatDate(report.issuedAt)} UTC`],
  ];
  for (const [label, value] of details) {
    page.drawText(label, {
      x: margin,
      y,
      font: regular,
      size: 9,
      color: muted,
    });
    page.drawText(printableText(value), {
      x: 190,
      y,
      font: bold,
      size: 9,
      color: ink,
    });
    y -= 24;
  }

  const qrBottom = Math.max(48, y - 130);
  const qrBytes = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 144,
  });
  const qr = await document.embedPng(qrBytes);
  page.drawRectangle({
    x: margin,
    y: qrBottom,
    width: pageWidth - margin * 2,
    height: 112,
    color: pale,
  });
  page.drawImage(qr, {
    x: margin + 12,
    y: qrBottom + 12,
    width: 88,
    height: 88,
  });
  page.drawText("VERIFY THIS REPORT", {
    x: margin + 112,
    y: qrBottom + 83,
    font: bold,
    size: 8,
    color: blue,
  });
  page.drawText("Scan the code or open this verification reference:", {
    x: margin + 112,
    y: qrBottom + 65,
    font: regular,
    size: 8,
    color: muted,
  });
  drawLines(
    page,
    wrapText(verificationUrl, regular, 7.5, pageWidth - margin * 2 - 128),
    margin + 112,
    qrBottom + 48,
    regular,
    7.5,
    ink,
    10,
  );
  page.drawText(`Verification ID: ${report.verificationToken}`, {
    x: margin + 112,
    y: qrBottom + 14,
    font: regular,
    size: 7.5,
    color: muted,
    maxWidth: pageWidth - margin * 2 - 128,
  });
  drawFooter(page, 1, 1, new Date().toISOString(), regular);
  return document.save();
}
