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

const CCD_GREEN = "#1B7A3D";
const ccdWebsite = "https://www.iitg.ac.in/ccd/";
const ccdLinkedIn = "https://www.linkedin.com/in/ccdiitg/";

function buildOfferApprovalHtml({ studentName, companyName }) {
  return `<!DOCTYPE html>
<html lang='en' xmlns='http://www.w3.org/1999/xhtml' xmlns:o='urn:schemas-microsoft-com:office:office'>
<head>
  <meta charset='UTF-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <meta name='x-apple-disable-message-reformatting'>
  <title></title>
</head>
<body style='margin:0;padding:0;'>
  <table role='presentation' style='width:100%;border-collapse:collapse;border:0;border-spacing:0;background:#ffffff;'>
    <tr>
      <td align='center' style='padding:0;'>
        <table role='presentation' style='width:602px;border-collapse:collapse;border:1px solid #cccccc;border-spacing:0;text-align:left;'>
          <tr>
            <td align='center' style='padding:15px 0 15px 0;background:${CCD_GREEN};'>
              <h2 style='color:#FFFFFF;font-size:30px;padding:0 5%;font-weight:400;'>Centre of Career Development, IIT Guwahati</h2>
            </td>
          </tr>
          <tr>
            <td style='padding:36px 30px 42px 30px;'>
              <table role='presentation' style='width:100%;border-collapse:collapse;border:0;border-spacing:0;'>
                <tr>
                  <td style='padding:0 0 36px 0;color:#363B40;'>
                    <p style='margin:0 0 12px 0;font-size:16px;line-height:24px;font-family:Arial,sans-serif;'>
                      Dear ${studentName || "Student"}, <br/><br/>
                      Congratulations! <br/><br/>
                      As per the offer(s) we received and the offer allocation policy of CCD, we are happy to inform you that you have been successfully placed in <b>${companyName || "the company"}</b>.<br/><br/>
                      We have already informed the company that you are intimated about this offer and you are out of the further placement process.<br/><br/>
                      <b>Important Instructions:</b><br/>
                      As per the CCD placement policy, you are requested not to appear for any further interviews.<br/>
                      By the end of the day, your offer details will be displayed in the placement portal.<br/>
                      Please do not reply to this email. All queries are to be handled through <b>ccd_queries@iitg.ac.in</b>.<br/><br/>
                      Your access to the <b>Placement Portal</b> and the <b>D-Day Portal</b> has now been blocked.<br/><br/>
                      <b>Note:</b> If your package is less than <b>10 LPA CTC</b> and your branch's placement percentage is more than <b>50%</b>, your portal access will be restored in <b>Phase 2</b>.<br/><br/>
                      We wish you all the very best for your career ahead.<br/><br/>
                      Warm regards,<br/>
                      Center for Career Development (CCD)<br/>
                      IIT Guwahati
                    </p>
                    <br/><br/>
                    <hr>
                    Visit us at <a href=${ccdWebsite}>CCD portal</a><br/>
                    <a href=${ccdLinkedIn}>LinkedIn</a> | <a href=${process.env.FRONTEND_URL}> Career Portal</a><br/>
                    Centre for Career Development</br>
                    IIT Guwahati </br>
                    <hr>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style='padding:30px;background:${CCD_GREEN};'>
              <table role='presentation' style='width:100%;border-collapse:collapse;border:0;border-spacing:0;font-size:9px;font-family:Arial,sans-serif;'>
                <tr>
                  <td style='padding:0;width:50%;' align='left'>
                    <p style='margin:0;font-size:14px;line-height:16px;font-family:Arial,sans-serif;color:#ffffff;'>Center for Career Development<br/></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOfferApprovalEmail({ to, studentName, companyName }) {
 const mailOptions = {
   from: `"CCD" <${process.env.SMTP_USER}>`,
   to,
   subject: `CCD Placement Confirmation – Congratulations!`,
   html: buildOfferApprovalHtml({ studentName, companyName }),
 };


 try {
   const info = await transporter.sendMail(mailOptions);
   console.log("Offer confirmation email sent:", info.messageId);
 } catch (error) {
   console.error("Failed to send offer email:", error);
   throw new Error("Mail delivery failed");
 }
}
