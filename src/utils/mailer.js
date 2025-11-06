import nodemailer from "nodemailer";

console.log("SMTP connecting to:", process.env.SMTP_HOST);

const transporter = nodemailer.createTransport({
 host: process.env.SMTP_HOST,
 port: Number(process.env.SMTP_PORT),
 secure: process.env.SMTP_SECURE === "true", // must be false for port 587
 auth: {
   user: process.env.SMTP_USER,
   pass: process.env.SMTP_PASS,
 }
});

transporter.verify(function (error, success) {
 if (error) {
   console.error("SMTP connection failed:", error);
 } else {
   console.log("SMTP server ready to send mails");
 }
});

export async function sendOfferApprovalEmail({ to, studentName, companyName }) {
 const mailOptions = {
   from: `"CCD" <${process.env.SMTP_USER}>`,
   to,
   subject: `Test Mail ${studentName} — Offer Approved!`,
   // html template has to be updated according to template provide by sir, this is a placeholder.
   html: `
     <div style="font-family: Arial, sans-serif; line-height: 1.5;">
       <h2>Testing ${studentName},</h2>
       <p>We are delighted to inform you that you have been <strong>offered a role</strong> at <strong>${companyName}</strong>.</p>
       <br />
       <p>Best regards,</p>
       <p><strong>Aagam bhaiya</strong></p>
     </div>
   `,
 };


 try {
   const info = await transporter.sendMail(mailOptions);
   console.log("Offer confirmation email sent:", info.messageId);
 } catch (error) {
   console.error("Failed to send offer email:", error);
   throw new Error("Mail delivery failed");
 }
}
