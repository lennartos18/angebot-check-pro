import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { angebotId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header to validate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Fetch angebot with positionen
    const { data: angebot, error: angebotError } = await supabase
      .from("angebote")
      .select(`
        *,
        positionen (
          *,
          gewerke (name)
        )
      `)
      .eq("id", angebotId)
      .single();

    if (angebotError || !angebot) {
      throw new Error("Angebot not found");
    }

    // Generate HTML for PDF
    const getStatusColor = (status: string) => {
      switch (status) {
        case "green": return "#22c55e";
        case "yellow": return "#eab308";
        case "red": return "#ef4444";
        default: return "#6b7280";
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case "green": return "✓ Plausibel";
        case "yellow": return "⚠ Prüfen";
        case "red": return "✗ Auffällig";
        default: return "?";
      }
    };

    const positionenHtml = angebot.positionen?.map((pos: any, idx: number) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-size: 14px;">${idx + 1}</td>
        <td style="padding: 12px 8px; font-size: 14px;">
          <strong>${pos.beschreibung}</strong>
          ${pos.material ? `<br><span style="color: #6b7280; font-size: 12px;">${pos.material}</span>` : ""}
        </td>
        <td style="padding: 12px 8px; font-size: 14px; text-align: right;">${pos.menge || "-"} ${pos.einheit || ""}</td>
        <td style="padding: 12px 8px; font-size: 14px; text-align: right;">${pos.einzelpreis ? pos.einzelpreis.toFixed(2) + " €" : "-"}</td>
        <td style="padding: 12px 8px; font-size: 14px; text-align: right; font-weight: 600;">${pos.gesamtpreis ? pos.gesamtpreis.toFixed(2) + " €" : "-"}</td>
        <td style="padding: 12px 8px; text-align: center;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background-color: ${getStatusColor(pos.status)}20; color: ${getStatusColor(pos.status)};">
            ${getStatusText(pos.status)}
          </span>
        </td>
      </tr>
      <tr style="background-color: #f9fafb;">
        <td colspan="6" style="padding: 8px 8px 16px 8px; font-size: 13px; color: #4b5563;">
          <strong>Hinweis:</strong> ${pos.hinweis || "Keine Hinweise"}
          ${pos.marktpreis_durchschnitt ? `<br><span style="color: #6b7280;">Marktpreis: ${pos.marktpreis_min?.toFixed(2)} - ${pos.marktpreis_max?.toFixed(2)} € (Ø ${pos.marktpreis_durchschnitt?.toFixed(2)} €)</span>` : ""}
          ${pos.abweichung_prozent ? `<br><span style="color: ${pos.abweichung_prozent > 0 ? '#ef4444' : '#22c55e'};">Abweichung: ${pos.abweichung_prozent > 0 ? '+' : ''}${pos.abweichung_prozent?.toFixed(1)}%</span>` : ""}
        </td>
      </tr>
    `).join("") || "";

    const greenCount = angebot.positionen?.filter((p: any) => p.status === "green").length || 0;
    const yellowCount = angebot.positionen?.filter((p: any) => p.status === "yellow").length || 0;
    const redCount = angebot.positionen?.filter((p: any) => p.status === "red").length || 0;

    const htmlContent = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>AngebotsCheck Report - ${angebot.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #1f2937; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .logo { font-size: 24px; font-weight: 700; color: #1e40af; }
    .logo span { color: #1f2937; }
    .report-date { color: #6b7280; font-size: 14px; }
    .score-card { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 32px; }
    .score-title { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
    .score-value { font-size: 48px; font-weight: 700; }
    .score-label { font-size: 14px; opacity: 0.8; }
    .summary-box { background: #f0f9ff; border-left: 4px solid #1e40af; padding: 16px 20px; margin-bottom: 32px; border-radius: 0 8px 8px 0; }
    .stats { display: flex; gap: 16px; margin-bottom: 32px; }
    .stat-item { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-green { background: #dcfce7; color: #166534; }
    .stat-yellow { background: #fef9c3; color: #854d0e; }
    .stat-red { background: #fee2e2; color: #991b1b; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { background: #f3f4f6; padding: 12px 8px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span>Angebots</span>Check</div>
      <div style="font-size: 20px; font-weight: 600; margin-top: 8px;">${angebot.title}</div>
      ${angebot.handwerker_firma ? `<div style="color: #6b7280; margin-top: 4px;">${angebot.handwerker_firma}</div>` : ""}
      ${angebot.stadt ? `<div style="color: #6b7280;">${angebot.plz || ""} ${angebot.stadt}</div>` : ""}
    </div>
    <div class="report-date">
      Report erstellt am<br>
      <strong>${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
    </div>
  </div>

  <div style="display: flex; gap: 24px; margin-bottom: 32px;">
    <div class="score-card" style="flex: 1;">
      <div class="score-title">Plausibilitäts-Score</div>
      <div class="score-value">${angebot.plausibility_score || 0}<span style="font-size: 24px;">/100</span></div>
      <div class="score-label">${angebot.plausibility_score >= 80 ? "Gutes Angebot" : angebot.plausibility_score >= 60 ? "Prüfung empfohlen" : "Vorsicht geboten"}</div>
    </div>
    <div style="flex: 1; background: #f9fafb; padding: 24px; border-radius: 12px;">
      <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Angebotssumme</div>
      <div style="font-size: 36px; font-weight: 700; color: #1f2937;">${angebot.gesamtpreis?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || "N/A"}</div>
      <div style="font-size: 14px; color: #6b7280; margin-top: 8px;">${angebot.positionen?.length || 0} Positionen analysiert</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat-item stat-green">
      <div class="stat-value">${greenCount}</div>
      <div class="stat-label">Plausibel</div>
    </div>
    <div class="stat-item stat-yellow">
      <div class="stat-value">${yellowCount}</div>
      <div class="stat-label">Zu prüfen</div>
    </div>
    <div class="stat-item stat-red">
      <div class="stat-value">${redCount}</div>
      <div class="stat-label">Auffällig</div>
    </div>
  </div>

  <div class="summary-box">
    <strong style="display: block; margin-bottom: 8px;">📋 Zusammenfassung & Empfehlungen</strong>
    ${angebot.analysis_summary || "Keine Zusammenfassung verfügbar."}
  </div>

  <h2 style="font-size: 18px; margin-bottom: 16px;">Detailanalyse der Positionen</h2>
  
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">Nr.</th>
        <th>Position / Material</th>
        <th style="width: 100px; text-align: right;">Menge</th>
        <th style="width: 100px; text-align: right;">EP</th>
        <th style="width: 100px; text-align: right;">Gesamt</th>
        <th style="width: 100px; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${positionenHtml}
    </tbody>
    <tfoot>
      <tr style="background: #f3f4f6; font-weight: 600;">
        <td colspan="4" style="padding: 16px 8px;">Gesamtsumme</td>
        <td style="padding: 16px 8px; text-align: right;">${angebot.gesamtpreis?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || "N/A"}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <p>Dieser Report wurde automatisch von AngebotsCheck erstellt.</p>
    <p>Die Analyse basiert auf Marktdaten und dient als Orientierungshilfe. Alle Angaben ohne Gewähr.</p>
    <p style="margin-top: 16px;">© ${new Date().getFullYear()} AngebotsCheck - Handwerker-Angebote transparent prüfen</p>
  </div>
</body>
</html>`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        html: htmlContent,
        title: `AngebotsCheck_Report_${angebot.title?.replace(/[^a-zA-Z0-9]/g, '_') || angebotId}.pdf`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate PDF error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});