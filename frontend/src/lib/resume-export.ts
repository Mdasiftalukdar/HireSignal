/*
  Export a ResumeDoc to PDF (jsPDF, vector/selectable text) and DOCX (docx).
  Both are generated fully client-side from the structured model, so the output
  is real text — copy-pasteable and ATS-parseable, not a rasterized screenshot.
*/

import { jsPDF } from "jspdf";
import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { contactLine, type ResumeDoc } from "@/lib/resume-doc";

function fileBase(doc: ResumeDoc): string {
  return (doc.fullName || "resume").trim().replace(/\s+/g, "_");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------- PDF ------------------------------- */

export function exportPdf(doc: ResumeDoc) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // Name
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.fullName || "Your Name", margin, y);
  y += 24;

  // Headline
  if (doc.headline) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11.5);
    pdf.setTextColor(79, 70, 229);
    pdf.text(doc.headline, margin, y);
    y += 16;
  }

  // Contact
  const contact = contactLine(doc);
  if (contact) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(contact, margin, y);
    y += 12;
  }

  // Divider
  y += 4;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(1);
  pdf.line(margin, y, pageW - margin, y);
  y += 18;

  const paragraph = (text: string, size: number, color: [number, number, number], gap = 4) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      ensureSpace(size + gap);
      pdf.text(line, margin, y);
      y += size + gap;
    }
  };

  // Summary
  if (doc.summary.trim()) {
    pdf.setFont("helvetica", "normal");
    paragraph(doc.summary.trim(), 10, [51, 65, 85], 4);
    y += 8;
  }

  for (const section of doc.sections) {
    ensureSpace(30);
    // Section heading
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(section.heading.toUpperCase(), margin, y);
    y += 6;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.75);
    pdf.line(margin, y, pageW - margin, y);
    y += 14;

    for (const entry of section.entries) {
      const hasHeaderRow = entry.title || entry.subtitle || entry.meta;
      if (hasHeaderRow) {
        ensureSpace(16);
        // Title (left) + meta (right)
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(15, 23, 42);
        if (entry.title) pdf.text(entry.title, margin, y);
        if (entry.meta) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 116, 139);
          pdf.text(entry.meta, pageW - margin, y, { align: "right" });
        }
        y += 13;
        if (entry.subtitle) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(10);
          pdf.setTextColor(71, 85, 105);
          pdf.text(entry.subtitle, margin, y);
          y += 13;
        }
      }
      // Bullets
      pdf.setFont("helvetica", "normal");
      for (const b of entry.bullets.filter((x) => x.trim())) {
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        const lines = pdf.splitTextToSize(b.trim(), contentW - 14) as string[];
        lines.forEach((line, i) => {
          ensureSpace(14);
          if (i === 0) {
            pdf.setTextColor(79, 70, 229);
            pdf.text("•", margin, y);
            pdf.setTextColor(51, 65, 85);
          }
          pdf.text(line, margin + 14, y);
          y += 14;
        });
      }
      y += 6;
    }
    y += 6;
  }

  download(pdf.output("blob"), `${fileBase(doc)}.pdf`);
}

/* ------------------------------- DOCX ------------------------------ */

export async function exportDocx(doc: ResumeDoc) {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: doc.fullName || "Your Name", bold: true, size: 40 })],
    }),
  );
  if (doc.headline) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: doc.headline, color: "4F46E5", size: 23 })],
      }),
    );
  }
  const contact = contactLine(doc);
  if (contact) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contact, color: "64748B", size: 18 })],
        border: {
          bottom: { color: "E2E8F0", size: 6, style: BorderStyle.SINGLE, space: 6 },
        },
        spacing: { after: 160 },
      }),
    );
  }
  if (doc.summary.trim()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: doc.summary.trim(), size: 20, color: "334155" })],
        spacing: { after: 160 },
      }),
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.heading.toUpperCase(), bold: true, size: 23 })],
        border: {
          bottom: { color: "CBD5E1", size: 6, style: BorderStyle.SINGLE, space: 4 },
        },
        spacing: { before: 200, after: 120 },
      }),
    );
    for (const entry of section.entries) {
      if (entry.title || entry.meta) {
        children.push(
          new Paragraph({
            tabStops: [{ type: "right", position: 9360 } as never],
            children: [
              new TextRun({ text: entry.title, bold: true, size: 21 }),
              ...(entry.meta
                ? [new TextRun({ text: `\t${entry.meta}`, color: "64748B", size: 18 })]
                : []),
            ],
          }),
        );
      }
      if (entry.subtitle) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: entry.subtitle, italics: true, size: 20, color: "475569" })],
          }),
        );
      }
      for (const b of entry.bullets.filter((x) => x.trim())) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: b.trim(), size: 20, color: "334155" })],
          }),
        );
      }
    }
  }

  const document = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(document);
  download(blob, `${fileBase(doc)}.docx`);
}
