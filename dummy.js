// dummy.js - Generate realistic placement data
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./src/models/user.model.js";
import Student from "./src/models/student.model.js";
import Company from "./src/models/company.model.js";
import Shortlist from "./src/models/shortlist.model.js";
import Offer from "./src/models/offer.model.js";

const MONGO_URI = process.env.MONGO_URI;

// Company names pool
const COMPANY_NAMES = [
  "Google India", "Microsoft", "Amazon", "Meta", "Apple", "Goldman Sachs", "Morgan Stanley",
  "JP Morgan", "Deutsche Bank", "Barclays", "Citi", "HSBC", "Wells Fargo",
  "Flipkart", "Paytm", "PhonePe", "Razorpay", "Zomato", "Swiggy", "Uber", "Ola",
  "Accenture", "Deloitte", "EY", "KPMG", "PwC", "McKinsey", "BCG", "Bain & Company",
  "IBM", "Oracle", "SAP", "Adobe", "Salesforce", "Cisco", "Intel", "Nvidia",
  "TCS", "Infosys", "Wipro", "HCL", "Tech Mahindra", "LTI", "Mindtree", "Mphasis",
  "Atlassian", "Cohesity", "Druva", "Nutanix", "VMware", "Red Hat", "Cloudera",
  "Qualcomm", "Broadcom", "Texas Instruments", "Analog Devices", "MediaTek",
  "Airbnb", "Booking.com", "Netflix", "Spotify", "Twitter", "Snapchat", "LinkedIn",
  "Samsung", "LG", "Sony", "Panasonic", "Hitachi", "Toshiba", "Fujitsu",
  "Visa", "Mastercard", "PayPal", "Stripe", "Square", "Robinhood", "Coinbase",
  "Directi", "OYO", "Byju's", "Unacademy", "Vedantu", "Upgrad", "Cred",
  "Nykaa", "Meesho", "ShareChat", "Dream11", "MPL", "Paytm Mall", "Snapdeal",
  "DE Shaw", "Tower Research", "Graviton", "Maven Securities", "Optiver", "IMC Trading",
  "Sprinklr", "Innovaccer", "Freshworks", "Postman", "Hasura", "BrowserStack",
  "Siemens", "Bosch", "ABB", "Schneider Electric", "Honeywell", "GE Digital",
  "Shell", "BP", "ExxonMobil", "Chevron", "Total", "Reliance Industries",
  "Tata Consultancy Services", "Mahindra Tech", "L&T Infotech", "Birlasoft",
  "American Express", "Capital One", "Discover", "Synchrony", "Ally Financial",
  "Workday", "ServiceNow", "Splunkito", "Datadog", "Snowflake", "MongoDB",
  "Dell Technologies", "HP Inc", "Lenovo", "Asus", "Acer", "MSI",
  "Zoom", "Slack", "Dropbox", "Box", "DocuSign", "Zendesk",
  "Shopify", "Squarespace", "Wix", "BigCommerce", "Magento", "WooCommerce",
  "Epic Games", "Unity Technologies", "Electronic Arts", "Activision", "Ubisoft",
  "SpaceX", "Tesla", "Rivian", "Lucid Motors", "NIO", "XPeng",
  "Grab", "Gojek", "Sea Limited", "Bukalapak", "Tokopedia", "Shopee",
  "ByteDance", "Alibaba", "Tencent", "JD.com", "Meituan", "Didi",
  "Wayfair", "Etsy", "Zillow", "Redfin", "OpenDoor", "Compass",
  "DoorDash", "Instacart", "GrubHub", "Deliveroo", "Just Eat", "Foodpanda",
  "Roblox", "Riot Games", "Valve", "Bungie", "Supercell", "King",
  "Figma", "Notion", "Airtable", "Monday.com", "Asana", "Trello",
  "GitLab", "GitHub", "Bitbucket", "SourceForge", "JFrog", "Sonatype",
  "Twilio", "SendGrid", "Mailchimp", "HubSpot", "Marketo", "Eloqua",
  "Palantir", "C3.ai", "DataRobot", "H2O.ai", "Scale AI", "Labelbox",
  "Robloxia", "Discord", "Clubhouse", "Reddit", "Pinterest", "Tumblr",
  "Canva", "InVision", "Sketch", "Framer", "Abstract", "Zeplin",
  "Affirm", "Klarna", "Afterpay", "SoFi", "Chime", "Varo",
  "Plaid", "Brex", "Ramp", "Divvy", "Expensify", "Bill.com",
  "UiPath", "Automation Anywhere", "Blue Prism", "WorkFusion", "Kofax",
  "Crowdstrike", "Palo Alto Networks", "Fortinet", "Check Point", "Zscaler",
  "Okta", "Auth0", "OneLogin", "Duo Security", "Ping Identity",
  "HashiCorp", "Terraform", "Ansible", "Puppet", "Chef", "Jenkins",
  "Confluent", "Apache Kafka", "RabbitMQ", "Redis Labs", "Elastic",
  "New Relic", "Dynatrace", "AppDynamics", "Sumo Logic", "Splunk",
  "PagerDuty", "Opsgenie", "VictorOps", "Incident.io", "FireHydrant",
  "LaunchDarkly", "Split.io", "Optimizely", "VWO", "Mixpanel",
  "Amplitude", "Segment", "mParticle", "Tealium", "Adobe Analytics",
  "Tableau", "Looker", "Sisense", "Domo", "ThoughtSpot", "Qlik",
  "Informatica", "Talend", "MuleSoft", "Dell Boomi", "SnapLogic",
  "ABBYY",
  "DocuWare", "M-Files", "OpenText", "Hyland", "Laserfiche",
  "Freshdesk", "Intercom", "Drift", "LiveChat",
  "Genesys", "Five9", "Talkdesk", "Vonage", "RingCentral",
  "Adobe Sign", "HelloSign", "PandaDoc", "SignNow",
  "Gusto", "Zenefits", "BambooHR", "Namely", "Rippling",
  "ADP", "Paychex", "Paylocity", "UltiPro", "Kronos",
  "SAP SuccessFactors", "Oracle HCM", "Workday HCM", "Ceridian Dayforce",
  "Lever", "Greenhouse", "SmartRecruiters", "iCIMS", "Jobvite",
  "LinkedIn Talent", "Indeed Hire", "ZipRecruiter", "Monster", "Glassdoor",
  "AngelList", "Wellfound", "Hired", "Vettery", "Triplebyte",
  "HackerRank", "CodeSignal", "LeetCode", "Codility", "TestDome",
  "Udemy", "Coursera", "edX", "Pluralsight", "LinkedIn Learning",
  "Skillshare", "MasterClass", "Codecademy", "DataCamp", "Udacity",
  "Khan Academy", "Brilliant", "Duolingo", "Babbel", "Rosetta Stone",
  "Grammarly", "Hemingway", "ProWritingAid", "Copyscape", "Turnitin",
  "Zoom Video", "Microsoft Teams", "Google Meet", "Webex", "GoToMeeting",
  "BlueJeans", "Whereby", "Jitsi", "BigBlueButton", "8x8",
  "Miro", "Mural", "Lucidchart", "Draw.io", "Whimsical",
  "Coda", "Roam Research", "Obsidian", "RemNote",
  "Evernote", "OneNote", "Bear", "Simplenote", "Standard Notes",
  "1Password", "LastPass", "Dashlane", "Bitwarden", "NordPass",
  "ExpressVPN", "NordVPN", "Surfshark", "ProtonVPN", "CyberGhost",
  "Malwarebytes", "Norton", "McAfee", "Kaspersky", "Bitdefender",
  "Avast", "AVG", "Trend Micro", "ESET", "Sophos",
  "Cloudflare", "Akamai", "Fastly", "Imperva", "Sucuri",
  "AWS", "Azure", "Google Cloud", "DigitalOcean", "Linode",
  "Heroku", "Netlify", "Vercel", "Railway", "Render",
  "Firebase", "Supabase", "Appwrite", "Back4App", "Parse",
  "PayU", "CCAvenue", "Instamojo",
  "Paytm Payments", "PhonePe Business", "Google Pay Business", "Amazon Pay",
  "BharatPe", "Cashfree", "Juspay", "Easebuzz", "PayKun",
  "Khatabook", "Vyapar", "Zoho Books", "QuickBooks", "FreshBooks",
  "Xero", "Wave", "Sage", "NetSuite", "SAP Business One",
  "Odoo", "ERPNext", "Dolibarr", "OpenERP", "Tryton",
  "SugarCRM", "Salesforce CRM", "Zoho CRM", "Pipedrive", "Close",
  "Copper", "Insightly", "Nimble", "Capsule", "Streak",
  "Mailshake", "Lemlist", "Woodpecker", "Reply.io", "Outreach",
  "SalesLoft", "Yesware", "Mixmax", "Mailtrack", "MailTag"
];

// Indian first names
const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Arnav", "Ayush",
  "Krishna", "Ishaan", "Shaurya", "Atharv", "Advik", "Pranav", "Advait",
  "Ananya", "Diya", "Aadhya", "Saanvi", "Anvi", "Aarohi", "Navya", "Pari",
  "Sara", "Anika", "Kiara", "Myra", "Riya", "Shanaya", "Prisha",
  "Rahul", "Rohan", "Karan", "Aryan", "Rishi", "Varun", "Nikhil", "Abhinav",
  "Lakshmi", "Priya", "Divya", "Sneha", "Pooja", "Kavya", "Shruti", "Neha"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Kumar", "Singh", "Reddy", "Gupta", "Agarwal",
  "Joshi", "Iyer", "Rao", "Nair", "Mehta", "Kapoor", "Malhotra", "Chopra",
  "Trivedi", "Pandey", "Mishra", "Jain", "Shah", "Desai", "Kulkarni", "Menon",
  "Srinivasan", "Krishnan", "Murthy", "Bhat", "Hegde", "Kamath", "Shetty"
];

// Venues
const VENUES = [
  "Academic Complex 1", "Academic Complex 2", "Core 1", "Core 2", "Core 3",
  "Lecture Hall Complex", "Seminar Hall", "Conference Room A", "Conference Room B",
  "Auditorium", "Tutorial Room 101", "Tutorial Room 102", "Computer Center",
  "Central Library", "Department Building"
];

// Generate random phone number
const generatePhone = () => {
  return `${Math.floor(7000000000 + Math.random() * 3000000000)}`;
};

// Generate random roll number (9 digits: YYDDNNNNN where YY=year, DD=dept, NNNNN=sequential)
const generateRollNumber = (index) => {
  const year = String(20 + Math.floor(Math.random() * 5)); // 20-24
  const deptCode = String(Math.floor(Math.random() * 100)).padStart(2, '0'); // 00-99 for different depts
  const num = String(index + 1).padStart(5, '0'); // Sequential number (00001-99999)
  return `${year}${deptCode}${num}`; // e.g., 200100001 (9 digits)
};

// Generate random email
const generateEmail = (firstName, lastName, rollNumber) => {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${rollNumber}@iitg.ac.in`;
};

// Random selection helper
const randomSelect = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateData = async () => {
  console.log("🚀 Starting data generation...\n");

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected\n");

    // Clear existing data (keep POCs and Students)
    console.log("🗑️  Clearing companies, shortlists, and offers...");
    await Company.deleteMany({});
    await Shortlist.deleteMany({});
    await Offer.deleteMany({});
    console.log("✅ Cleared companies, shortlists, and offers\n");

    // Check if POCs and Students already exist
    const existingPOCs = await User.find({ role: "poc" });
    const existingStudents = await Student.find({}).populate('userId');
    
    let pocUsers = [];
    let students = [];
    let studentUsers = [];

    // Step 1: Create POCs (100 POCs) - Skip if already exist
    if (existingPOCs.length >= 100) {
      console.log(`✅ Using existing ${existingPOCs.length} POCs\n`);
      pocUsers = existingPOCs;
    } else {
      console.log("👥 Creating 100 POCs...");
      for (let i = 0; i < 100; i++) {
        const firstName = randomSelect(FIRST_NAMES);
        const lastName = randomSelect(LAST_NAMES);
        const emailId = `poc${i + 1}@placement.iitg.ac.in`;
        
        const user = await User.create({
          emailId,
          passwordHash: `poc${i + 1}@123`,
          name: `${firstName} ${lastName}`,
          phoneNo: generatePhone(),
          role: "poc",
          isAllowed: true,
          providers: [{ provider: "credentials", providerId: emailId }]
        });
        pocUsers.push(user);
      }
      console.log(`✅ Created ${pocUsers.length} POCs\n`);
    }

    // Step 2: Create Students (3000 students) - Skip if already exist
    if (existingStudents.length >= 3000) {
      console.log(`✅ Using existing ${existingStudents.length} students\n`);
      students = existingStudents;
      // Reset placement status
      await Student.updateMany({}, { isPlaced: false, placedCompany: null, shortlistedCompanies: [], waitlistedCompanies: [] });
      studentUsers = students.map(s => s.userId);
    } else {
      console.log("🎓 Creating 3000 students...");
      
      for (let i = 0; i < 3000; i++) {
        const firstName = randomSelect(FIRST_NAMES);
        const lastName = randomSelect(LAST_NAMES);
        const rollNumber = generateRollNumber(i + 1);
        const emailId = generateEmail(firstName, lastName, rollNumber);
        
        const user = await User.create({
          emailId,
          passwordHash: `student${i + 1}@123`,
          name: `${firstName} ${lastName}`,
          phoneNo: generatePhone(),
          role: "student",
          isAllowed: true,
          providers: [{ provider: "credentials", providerId: emailId }]
        });
        studentUsers.push(user);

        const student = await Student.create({
          userId: user._id,
          rollNumber,
          isPlaced: false
        });
        students.push(student);

        if ((i + 1) % 500 === 0) {
          console.log(`  ✓ Created ${i + 1}/3000 students`);
        }
      }
      console.log(`✅ Created ${students.length} students\n`);
    }

    // Step 3: Create Companies (500 companies)
    console.log("🏢 Creating 500 companies...");
    const companies = [];
    
    for (let i = 0; i < 500; i++) {
      // Add unique suffix to avoid duplicate names
      const baseName = COMPANY_NAMES[i % COMPANY_NAMES.length];
      const suffix = i >= COMPANY_NAMES.length ? ` - Branch ${Math.floor(i / COMPANY_NAMES.length) + 1}` : "";
      const companyName = baseName + suffix;
      const venue = randomSelect(VENUES);
      const maxRounds = randomInt(2, 4); // Changed from 3-5 to 2-4 to match max value
      
      // Assign 2-4 POCs to each company
      const numPOCs = randomInt(2, 4);
      const assignedPOCs = [];
      const usedIndices = new Set();
      
      while (assignedPOCs.length < numPOCs) {
        const pocIndex = randomInt(0, pocUsers.length - 1);
        if (!usedIndices.has(pocIndex)) {
          assignedPOCs.push(pocUsers[pocIndex]._id);
          usedIndices.add(pocIndex);
        }
      }

      const company = await Company.create({
        name: companyName,
        venue,
        description: `Leading tech company offering exciting opportunities in software development and innovation.`,
        maxRounds,
        POCs: assignedPOCs,
        isProcessCompleted: false
      });
      companies.push(company);

      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ Created ${i + 1}/500 companies`);
      }
    }
    console.log(`✅ Created ${companies.length} companies\n`);

    // Step 4: Create Shortlists (Each student gets shortlisted by 4-5 companies)
    console.log("📋 Creating shortlists (avg 4-5 per student)...");
    const shortlists = [];
    let shortlistCount = 0;

    for (const student of students) {
      const numShortlists = randomInt(4, 5);
      const assignedCompanies = new Set();

      for (let i = 0; i < numShortlists; i++) {
        let company;
        do {
          company = randomSelect(companies);
        } while (assignedCompanies.has(company._id.toString()));
        
        assignedCompanies.add(company._id.toString());

        const stages = ["R1", "R2", "R3", "R4", "REJECTED"];
        const stage = randomSelect(stages.slice(0, Math.min(company.maxRounds, 4))); // Use company's maxRounds
        
        const shortlist = await Shortlist.create({
          studentId: student.userId,
          companyId: company._id,
          companyName: company.name,
          status: randomSelect(["shortlisted", "waitlisted"]), // lowercase
          stage: stage,
          interviewStatus: randomSelect(["R", "Y", "G"]), // R=Red, Y=Yellow, G=Green
          isOffered: false,
          isStudentPlaced: false
        });
        shortlists.push(shortlist);
        shortlistCount++;

        // Update student's shortlisted companies
        await Student.findByIdAndUpdate(student._id, {
          $addToSet: { shortlistedCompanies: company._id }
        });
      }

      if ((students.indexOf(student) + 1) % 500 === 0) {
        console.log(`  ✓ Processed ${students.indexOf(student) + 1}/3000 students`);
      }
    }
    console.log(`✅ Created ${shortlistCount} shortlists\n`);

    // Step 5: Create Offers (Each student gets 4-5 offers)
    console.log("💼 Creating offers (avg 4-5 per student)...");
    let offerCount = 0;

    for (const student of students) {
      const studentShortlists = shortlists.filter(s => 
        s.studentId.toString() === student.userId.toString()
      );

      // Create 4-5 offers from their shortlists
      const numOffers = Math.min(randomInt(4, 5), studentShortlists.length);
      
      for (let i = 0; i < numOffers; i++) {
        const shortlist = studentShortlists[i];
        
        const offer = await Offer.create({
          studentId: student.userId,
          companyId: shortlist.companyId,
          approvalStatus: i === 0 ? "APPROVED" : randomSelect(["PENDING", "PENDING", "APPROVED"]),
          offerStatus: "PENDING",
          venue: randomSelect(VENUES),
          remarks: i === 0 ? "First offer - auto approved for testing" : ""
        });

        // Update shortlist
        await Shortlist.findByIdAndUpdate(shortlist._id, {
          isOffered: true,
          stage: "OFFERED"
        });

        // If first offer is approved, mark student as placed
        if (i === 0) {
          await Student.findByIdAndUpdate(student._id, {
            isPlaced: true,
            placedCompany: shortlist.companyId
          });

          // Update company placed students
          await Company.findByIdAndUpdate(shortlist.companyId, {
            $addToSet: { placedStudents: student.userId }
          });

          // Update offer
          await Offer.findByIdAndUpdate(offer._id, {
            approvedBy: "admin@iitg.ac.in",
            approvedAt: new Date()
          });

          // Mark other shortlists as student placed
          await Shortlist.updateMany(
            { studentId: student.userId },
            { 
              isStudentPlaced: true,
              studentPlacedCompany: shortlist.companyId
            }
          );
        }

        offerCount++;
      }

      if ((students.indexOf(student) + 1) % 500 === 0) {
        console.log(`  ✓ Created offers for ${students.indexOf(student) + 1}/3000 students`);
      }
    }
    console.log(`✅ Created ${offerCount} offers\n`);

    // Summary
    console.log("📊 DATA GENERATION SUMMARY");
    console.log("═".repeat(50));
    console.log(`👥 POCs: ${pocUsers.length}`);
    console.log(`🎓 Students: ${students.length}`);
    console.log(`🏢 Companies: ${companies.length}`);
    console.log(`📋 Shortlists: ${shortlistCount}`);
    console.log(`💼 Offers: ${offerCount}`);
    console.log(`✅ Placed Students: ${students.length} (100%)`);
    console.log("═".repeat(50));
    console.log("\n✨ Sample Credentials:");
    console.log("   POC: poc1@placement.iitg.ac.in / poc1@123");
    console.log(`   Student: ${studentUsers[0].emailId} / student1@123`);
    console.log("   Admin: Use your existing admin credentials");
    console.log("\n🎉 Data generation completed successfully!\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Run the script
generateData();
