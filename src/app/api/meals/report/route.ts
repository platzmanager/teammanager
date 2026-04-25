import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getMealClaimsForReport, settleMealClaims } from "@/actions/meals";
import type { BillingInterval } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const settle = searchParams.get("settle") === "true";

  if (!from || !to) {
    return NextResponse.json({ error: "Parameter 'from' und 'to' erforderlich" }, { status: 400 });
  }

  const { clubName, settings, claims } = await getMealClaimsForReport(from, to);

  const intervalLabel: Record<BillingInterval, string> = {
    monthly: "Monatsabrechnung",
    quarterly: "Quartalsabrechnung",
    yearly: "Jahresabrechnung",
    seasonal: "Saisonabrechnung",
  };
  const label = intervalLabel[settings?.billing_interval ?? "monthly"];

  // ── PDF ────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Brand colours (oklch → rgb approximations)
  const primary   = rgb(0.894, 0.396, 0.243); // #e4653e
  const golden    = rgb(0.949, 0.757, 0.306); // #f2c14e
  const black     = rgb(0.05, 0.05, 0.05);
  const white     = rgb(1, 1, 1);
  const lightGray = rgb(0.95, 0.95, 0.95);
  const green     = rgb(0.08, 0.50, 0.10);
  const muted     = rgb(0.45, 0.45, 0.45);

  // ── HEADER ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 88, width, height: 88, color: primary });
  // Golden accent stripe
  page.drawRectangle({ x: 0, y: height - 91, width, height: 3, color: golden });
  // Decorative accent block
  page.drawRectangle({ x: width - 120, y: height - 88, width: 80, height: 88, color: rgb(0.95, 0.43, 0.27) });

  page.drawText("ESSENSZUSCHUSS", { x: 40, y: height - 34, size: 20, font: bold, color: white });
  page.drawText("ABRECHNUNG",     { x: 40, y: height - 55, size: 20, font: bold, color: golden });
  page.drawText(clubName,          { x: 40, y: height - 75, size: 8,  font: regular, color: rgb(1, 0.88, 0.88) });

  // Date range right-aligned
  const fromStr  = new Date(from).toLocaleDateString("de-DE");
  const toStr    = new Date(to).toLocaleDateString("de-DE");
  const rangeStr = `${fromStr} – ${toStr}`;
  page.drawText(label, {
    x: width - 40 - bold.widthOfTextAtSize(label, 10),
    y: height - 42, size: 10, font: bold, color: white,
  });
  page.drawText(rangeStr, {
    x: width - 40 - regular.widthOfTextAtSize(rangeStr, 8),
    y: height - 57, size: 8, font: regular, color: rgb(1, 0.88, 0.88),
  });

  // ── SUMMARY BOX ───────────────────────────────────────────────
  const totalMeals  = claims.reduce((s, c) => s + c.meal_count, 0);
  const totalAmount = claims.reduce((s, c) => s + c.meal_count * c.amount_per_meal, 0);
  const sumY = height - 128;

  page.drawRectangle({ x: 40, y: sumY - 10, width: width - 80, height: 36, color: lightGray });
  page.drawRectangle({ x: 40, y: sumY - 10, width: 4, height: 36, color: golden });

  page.drawText(`${claims.length} Spiele`, { x: 55, y: sumY + 12, size: 10, font: bold, color: black });
  page.drawText(`${totalMeals} Essen gesamt`, { x: 55, y: sumY, size: 9, font: regular, color: muted });

  const amtStr = `${totalAmount.toFixed(2)} €`;
  page.drawText("GESAMTBETRAG", {
    x: width - 40 - bold.widthOfTextAtSize("GESAMTBETRAG", 7),
    y: sumY + 14, size: 7, font: bold, color: muted,
  });
  page.drawText(amtStr, {
    x: width - 40 - bold.widthOfTextAtSize(amtStr, 16),
    y: sumY, size: 16, font: bold, color: green,
  });

  // ── TABLE ─────────────────────────────────────────────────────
  const tableTop = sumY - 38;
  const cols = { datum: 40, mannschaft: 120, gegner: 265, mf: 385, essen: 472, betrag: 510 };

  page.drawRectangle({ x: 40, y: tableTop - 6, width: width - 80, height: 20, color: black });
  for (const [label2, x] of Object.entries({
    DATUM: cols.datum, MANNSCHAFT: cols.mannschaft, GEGNER: cols.gegner,
    MF: cols.mf, ESSEN: cols.essen, BETRAG: cols.betrag,
  })) {
    page.drawText(label2, { x, y: tableTop + 1, size: 7, font: bold, color: golden });
  }

  let y = tableTop - 18;
  let row = 0;
  for (const claim of claims) {
    if (y < 80) break; // TODO: multi-page

    if (row % 2 === 0) {
      page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 16, color: lightGray });
    }

    const matchDate = claim.match?.match_date
      ? new Date(claim.match.match_date).toLocaleDateString("de-DE")
      : "–";

    // Team label: age_class + gender shorthand
    const ageClass = (claim.match?.team as any)?.age_class ?? "";
    const teamName = (claim.match?.team as any)?.name ?? ageClass;
    const teamLabel = teamName.length > 16 ? teamName.slice(0, 16) + "…" : teamName;

    const opponent = (claim.match?.away_team ?? "–");
    const opponentLabel = opponent.length > 22 ? opponent.slice(0, 22) + "…" : opponent;

    const mf = claim.captain
      ? `${(claim.captain.first_name ?? "")[0] ?? ""}. ${claim.captain.last_name ?? ""}`
      : "–";

    const rowColor = claim.status === "settled" ? rgb(0.1, 0.35, 0.75) : green;
    const rowAmount = claim.meal_count * claim.amount_per_meal;

    page.drawText(matchDate,   { x: cols.datum,      y, size: 8, font: regular, color: black });
    page.drawText(teamLabel,   { x: cols.mannschaft, y, size: 8, font: bold,    color: black });
    page.drawText(opponentLabel,{ x: cols.gegner,    y, size: 8, font: regular, color: black });
    page.drawText(mf,          { x: cols.mf,         y, size: 7, font: regular, color: muted });
    page.drawText(String(claim.meal_count), { x: cols.essen + 4, y, size: 9, font: bold, color: primary });
    page.drawText(`${rowAmount.toFixed(2)} €`, { x: cols.betrag, y, size: 8, font: bold, color: rowColor });

    y -= 17;
    row++;
  }

  // Totals row
  y -= 4;
  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 2, color: primary });
  y -= 14;
  page.drawText("GESAMT", { x: cols.datum, y, size: 9, font: bold, color: black });
  page.drawText(String(totalMeals), { x: cols.essen + 4, y, size: 10, font: bold, color: primary });
  page.drawText(`${totalAmount.toFixed(2)} €`, { x: cols.betrag, y, size: 10, font: bold, color: green });

  // ── FOOTER ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 36, width, height: 1, color: rgb(0.85, 0.85, 0.85) });
  const footerStr = `Erstellt am ${new Date().toLocaleDateString("de-DE")} · ${clubName}`;
  page.drawText(footerStr, { x: 40, y: 22, size: 7, font: regular, color: muted });
  page.drawText("Seite 1", {
    x: width - 40 - regular.widthOfTextAtSize("Seite 1", 7),
    y: 22, size: 7, font: regular, color: muted,
  });

  // ── SAVE ──────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();

  // Mark as settled if requested
  if (settle) {
    const ids = claims.filter((c) => c.status === "confirmed").map((c) => c.id);
    if (ids.length > 0) await settleMealClaims(ids);
  }

  const filename = `Essenszuschuss_${from}_${to}.pdf`;
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
