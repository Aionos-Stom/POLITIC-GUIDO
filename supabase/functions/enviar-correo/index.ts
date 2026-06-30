import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import nodemailer from "npm:nodemailer@6";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to_email, to_name, reset_link, expires_in = "1 hora" } = await req.json();

    if (!to_email || !reset_link) {
      return new Response(
        JSON.stringify({ ok: false, error: "Faltan campos requeridos." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "gsiemprecercadeti@gmail.com",
        pass: Deno.env.get("GMAIL_APP_PASSWORD"),
      },
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:48px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0"
  style="max-width:580px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 32px rgba(7,26,68,.14);">
  <tr><td style="background:#071a44;padding:36px 40px 28px;text-align:center;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#c8102e;margin-bottom:10px;">República Dominicana</div>
    <div style="font-size:48px;font-weight:900;color:#fff;letter-spacing:.04em;line-height:1;">GUIDO</div>
    <div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:6px;letter-spacing:.1em;text-transform:uppercase;">Siempre cerca de ti</div>
    <div style="width:56px;height:4px;background:#c8102e;margin:20px auto 0;border-radius:2px;"></div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,#c8102e 0%,#071a44 100%);"></td></tr>
  <tr><td style="padding:40px 44px 32px;">
    <p style="font-size:16px;color:#1a2a4a;margin:0 0 18px;font-weight:700;">Hola, ${to_name ?? "usuario"}</p>
    <p style="font-size:15px;color:#4a5568;line-height:1.7;margin:0 0 10px;">
      Recibimos una solicitud para <strong>restablecer la contraseña</strong>
      de tu cuenta en el sistema <strong style="color:#071a44;">GUIDO</strong>.
    </p>
    <p style="font-size:15px;color:#4a5568;line-height:1.7;margin:0 0 32px;">
      Si no realizaste esta solicitud, puedes ignorar este correo de forma segura.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:4px 0 36px;">
      <a href="${reset_link}"
         style="display:inline-block;padding:16px 44px;background:#c8102e;color:#fff;
                font-size:15px;font-weight:700;text-decoration:none;border-radius:50px;letter-spacing:.04em;">
        Restablecer contraseña
      </a>
    </td></tr>
    </table>
    <p style="font-size:13px;color:#718096;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
    <p style="font-size:11px;color:#a0aec0;word-break:break-all;margin:0 0 32px;
              background:#f7f9fc;padding:12px 16px;border-radius:8px;border-left:3px solid #c8102e;">
      ${reset_link}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="background:#fff8f8;border:1px solid #fde8e8;border-radius:8px;padding:14px 18px;">
      <p style="font-size:13px;color:#b91c1c;margin:0;">
        ⏱ <strong>Este enlace expira en ${expires_in}.</strong> Después deberás solicitar uno nuevo.
      </p>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="height:1px;background:#edf2f7;"></td></tr>
  <tr><td style="background:#071a44;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:rgba(255,255,255,.6);margin:0 0 4px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">GUIDO — Sistema de Gestión Territorial</p>
    <p style="font-size:11px;color:rgba(255,255,255,.35);margin:0;">República Dominicana · Siempre cerca de ti</p>
    <div style="width:32px;height:2px;background:#c8102e;margin:14px auto 0;border-radius:1px;"></div>
    <p style="font-size:10px;color:rgba(255,255,255,.25);margin:12px 0 0;">Este es un mensaje automático. Por favor no responda.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    await transporter.sendMail({
      from:    '"GUIDO — Siempre cerca de ti" <gsiemprecercadeti@gmail.com>',
      to:      to_email,
      subject: "Recuperar contraseña — GUIDO",
      html,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("enviar-correo error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
