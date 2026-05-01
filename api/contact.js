function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request) {
  var apiKey = process.env.RESEND_API_KEY;
  var toEmail = process.env.CONTACT_TO_EMAIL;
  var fromEmail =
    process.env.CONTACT_FROM_EMAIL || "Portfolio contact <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    console.error("Missing RESEND_API_KEY or CONTACT_TO_EMAIL");
    return Response.json(
      { ok: false, error: "Contact form is not configured." },
      { status: 503 }
    );
  }

  var raw = {};
  try {
    raw = await request.json();
  } catch (e) {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  var firstName = String(raw.firstName || "").trim().slice(0, 120);
  var lastName = String(raw.lastName || "").trim().slice(0, 120);
  var email = String(raw.email || "").trim().slice(0, 254);
  var message = String(raw.message || "").trim().slice(0, 8000);

  if (!firstName || !lastName || !email || !message) {
    return Response.json({ ok: false, error: "Please fill in all fields." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  }

  var subject = "Portfolio contact: " + firstName + " " + lastName;
  var html =
    "<p><strong>Name:</strong> " +
    escapeHtml(firstName) +
    " " +
    escapeHtml(lastName) +
    "</p>" +
    "<p><strong>Reply-to:</strong> " +
    '<a href="mailto:' +
    escapeHtml(email) +
    '">' +
    escapeHtml(email) +
    "</a></p>" +
    "<p><strong>Message:</strong></p>" +
    "<p>" +
    escapeHtml(message).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>") +
    "</p>";

  var resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: subject,
      html: html,
    }),
  });

  var json = {};
  try {
    json = await resendRes.json();
  } catch (e) {
    json = {};
  }

  if (!resendRes.ok) {
    console.error("Resend error", resendRes.status, json);
    return Response.json(
      { ok: false, error: "Could not send message. Try again later." },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
