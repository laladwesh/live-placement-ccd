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
   subject: `CCD Placement Confirmation – Congratulations!`,
   html: `
     <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
       <p>Dear <strong>${studentName}</strong>,</p>
       <p>Congratulations!</p>
       <p>As per the offer(s) we received and the offer allocation policy of CCD, we are happy to inform you that you have been successfully placed in <strong>${companyName}</strong>.</p>
       <p>We have already informed the company that you are intimated about this offer and you are out of the further placement process.</p>
       <p><strong>Important Instructions:</strong></p>
       <ul>
         <li>As per the CCD placement policy, you are requested not to appear for any further interviews.</li>
         <li>By the end of the day, your offer details will be displayed in the placement portal.</li>
         <li>Please do not reply to this email. All queries are to be handled through <a href="mailto:ccd_queries@iitg.ac.in">ccd_queries@iitg.ac.in</a>.</li>
       </ul>
       <p>We wish you all the very best for your career ahead.</p>
       <br />
       <p>Warm regards,<br />
       Center for Career Development (CCD)<br />
       IIT Guwahati</p>
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
