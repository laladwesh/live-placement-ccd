## Authentication & Role Identification

Users log in using **Outlook and Google authentication**.  
After login:

- The email ID is checked against the database to determine the user’s role.
- Depending on the role, users are redirected to their respective dashboards:
  - `/admin`
  - `/poc`
  - `/student/:id`

---

## Workflow

### Admin Dashboard

- On login, the admin sees:

  - A **button to add company details** → opens a form to add:
    - Company name
    - POC details (name, email, phone number)
    - List of students (shortlisted and waitlisted both) (via CSV upload)
  - A **button to act as POC** for any company (for testing or support).
  - If company details already exist, then add these students in the already existing list of shortlisted students.

- The main dashboard has **two views**:

  - **Pending Offers**
  - **Confirmed Offers**

- Each view has a **search bar**.

#### Pending Offers Section

Displays all students who have received offers:

Student Name - Dropdown with company name he/she has offer in and a button [Send Mail]

When the admin clicks a "Send Mail" button:

- The student receives an email about the offer from that Company.
- The student moves from **Pending Offers** → **Confirmed Offers**.

#### Confirmed Offers Section

Shows:

Student Name - Company Name

Once a student is placed:

- Their record in other companies becomes **immutable** (i.e., frozen).
- Full row ko change karke just keep it as Student Name - “Already Placed” in the POC side for all the companies he/she is shortlisted and waitlisted for
- The POC dashboards update in **real-time** to reflect this.

---

### POC Dashboard

On login:

- Top section displays the **Company Name**.
- Below that, for each shortlisted student:

Student Name : [Stage](R1, R2, R3 or R4) [interviewStatus](R, Y or G) [Offer]

Where:

- **Offer** is a button — when clicked:

  - It triggers a **real-time update** on the admin dashboard.

- Clicking on the **Student Name** navigates to `/student/:id` (student view to get the contact details).

- At the end, there is a button to add any student (in case of waitlist / walk-ins)

---

### Student Dashboard

For each student:

- Displays:
  - Name, Email ID, Phone Number
  - List of companies shortlisted and waitlisted for as :
    Company Name | status(shortlist/waitlist) | Venue | POC Number

If placed:

- Shows:

Congratulations! You are already placed in placeholder{Company Name} and are now out of the placement process.

For POCs viewing the same student after placement:

- Shows:

This student is already placed.

---

## Real-Time Updates

- Admin and POC dashboards stay in **sync** using WebSockets (via Socket.io).
- Any change in offer status or placement reflects instantly without refresh.

## Future Enhancements

- Role-based permissions with granular access control.
- Automated reminder and follow-up emails.
- Analytics dashboard for placement statistics.
- Bulk import/export of placement data.
