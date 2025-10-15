# Placement Live Sheet — Data Model & Usage

## Final Schemas

### 1) `User` (single collection for Admin / POC / Student)

- `name` — String
- `emailId` — String (used for indexing & login)
- `phoneNo` — String
- `role` — Enum `('admin','poc','student')` (used to determine which dashboard/permissions the user has)
- `companyName` — Name of the company for the role `'poc'`

### 2) `Student` (student-specific collection)

- `userId` — ObjectId (refers to `User`)
- `isPlaced` — Boolean
- `shortlistedCompanies` — Array of ObjectId (company ids)
- `waitlistedCompanies` — Array of ObjectId (company ids)
- `placedCompany` — ObjectId (company id or null)

> Note: This is separate from `User`. Only users with role `"student"` will have a `Student` document.

### 3) `Company`

- `name` — String (unique index)
- `POCs` — Array of ObjectId (user ids where `role == 'poc'`)
- `venue` — String (tentative interview venue)
- `shortlistedStudents` — Array of ObjectId (student user ids)
- `waitlistedStudents` — Array of ObjectId (student user ids)
- `placedStudents` — Array of ObjectId (student user ids)
- `isProcessCompleted`

### 4) `Pair / Application` (one doc per company-student pair)

- `companyId` — ObjectId (ref Company) — recommended primary ref
- `companyName` — String
- `studentId` — ObjectId (ref User / Student) — recommended primary ref
- `studentEmail` — String
- `status` — Enum `('shortlisted' , 'waitlisted')`
- `stage` — Enum `('R1','R2','R3','R4')` — which round the pair is currently at
- `interviewStatus` — Enum `('R','Y','G')` — round result / color-coded status
- `isOffered` — Boolean — whether an offer was issued (true/false)


When a student is shortlisted for a company, perform three writes to the database: 

Create/Update the Pair / Application document.

Push the company's ID into the Student.shortlistedCompanies array.

Push the student's ID into the Company.shortlistedStudents array.

(handle this carefully in code (e.g., using Mongoose middleware or transactions) to ensure that if one write fails, the others are rolled back to prevent data from becoming inconsistent.)
