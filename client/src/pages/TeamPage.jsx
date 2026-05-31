import React, { useState } from "react";

// ── Tenure data ──────────────────────────────────────────────────
const TENURES = {
  "26—27": {
    leads: [
      { name: "Avinash Gupta",  department: "BTech, ECE", email: "g.avinash@iitg.ac.in", linkedin: "https://www.linkedin.com/in/avinash-gupta-58171828a/", photo: "/dday/avinash.jpeg" },
      { name: "Gaurav Anand",   department: "BTech, CE",  email: "g.anand@iitg.ac.in",   linkedin: "https://www.linkedin.com/in/gaurav-anand-26b380296/", photo: "/dday/gaurav.jpg" },
    ],
    coordinators: [
      { name: "Bibek Nath",           department: "CL",  email: "n.bibek@iitg.ac.in",         linkedin: "https://www.linkedin.com/in/bibek-nath-944254170/",   photo: "/dday/Bibek.jpeg" },
      { name: "Hari Chakravarthy",     department: "ECE", email: "c.nomula@iitg.ac.in",         linkedin: "https://www.linkedin.com/in/nhc1866/",                photo: "/dday/Hari.jpeg" },
      { name: "Kabya Ranjan Chaubey", department: "EEE", email: "c.kabya@iitg.ac.in",          linkedin: "https://www.linkedin.com/in/kbchaubey25/",            photo: "/dday/Kabya.jpeg" },
      { name: "Raman Agrawal",        department: "EEE", email: "raman.agrawal@iitg.ac.in",    linkedin: "https://www.linkedin.com/in/raman-agrawal-7a24bb326", photo: "/dday/Raman.jpeg" },
    ],
  },
  "25—26": {
    teamPhoto: "/dday/25-26.jpeg",   // optional group photo — remove this line to hide the section
    leads: [
      { name: "Aagam Bhavesh Mehta", department: "BTech, Mathematics and Computing", email: "m.aagam@iitg.ac.in", linkedin: "https://www.linkedin.com/in/aagam-mehta-01b995249/", photo: "/dday/maagam.jpeg" },
    ],
    coordinators: [
      { name: "Ramdhan Kumar",          department: "BTech, ECE",     email: "k.ramdhan@iitg.ac.in",   linkedin: "https://www.linkedin.com/in/ramdhankumar1425/",             photo: "/dday/karamdhan.jpeg" },
      { name: "Avinash Gupta",          department: "BTech, ECE",     email: "g.avinash@iitg.ac.in",   linkedin: "https://www.linkedin.com/in/avinash-gupta-58171828a/",      photo: "/dday/gavinash.png" },
      { name: "Dhruvkumar R Pansuriya", department: "BTech, CSE",     email: "r.pansuriya@iitg.ac.in", linkedin: "https://www.linkedin.com/in/dhruvpansuriya05/",             photo: "/dday/dpansuriya.jpeg" },
      { name: "Chandan Jyoti Das",      department: "BTech, ECE",     email: "d.chandan@iitg.ac.in",   linkedin: "https://www.linkedin.com/in/chandan-jyoti-das-675b3a283/", photo: "/dday/jchandan.png" },
      { name: "Utkarsh Narayan Pandey", department: "BTech, ECE",     email: "u.pandey@iitg.ac.in",    linkedin: "https://www.linkedin.com/in/utkarshnp/",                   photo: "/dday/upandey.jpeg" },
      { name: "Aryashi Tripathi",       department: "BTech, CSE",     email: "t.aryashi@iitg.ac.in",   linkedin: "https://www.linkedin.com/in/aryashi/",                     photo: "/dday/taryashi.png" },
      { name: "Jash Vaidya",            department: "BTech, CSE",     email: "v.jash@iitg.ac.in",      linkedin: "https://www.linkedin.com/in/jash-vaidya-00253b2a4/",       photo: "/dday/jvaidya.png" },
      { name: "Srayash Singh",          department: "BTech, BSBE",    email: "s.srayash@iitg.ac.in",   linkedin: "https://www.linkedin.com/in/srayash/",                     photo: "https://www.iitg.ac.in/gate-jam/img/logo.png" },
      { name: "Vibha Gupta",            department: "BTech, DSAI",    email: "g.vibha@iitg.ac.in",     linkedin: "https://www.linkedin.com/in/vibha-gupta-a53a1b2a2/",       photo: "/dday/gvibha.png" },
      { name: "Priya Gawshinde",        department: "BTech, Physics", email: "p.gawshinde@iitg.ac.in", linkedin: "https://www.linkedin.com/in/priya-gawshinde/",              photo: "/dday/gpriya.png" },
    ],
  },
};

const TENURE_KEYS = ["26—27", "25—26"];

function LeadCard({ lead, index, total }) {
  const isMulti = total > 1;
  return (
    <div className={`relative flex flex-col justify-between p-8 bg-white overflow-hidden group ${isMulti ? "border-b-4 last:border-b-0 border-black" : "h-full"}`}>
      <div className="relative z-10">
        <span className="bg-black text-white px-3 py-1 text-xs font-bold tracking-widest uppercase mb-8 inline-block shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
          Lead Coordinator{isMulti ? ` #${index + 1}` : ""}
        </span>
        <div className={`border-4 border-black mb-6 overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${isMulti ? "w-56 h-56" : "aspect-square w-full max-w-[280px]"}`}>
          <img src={lead.photo} className="w-full h-full object-cover" alt={lead.name} />
        </div>
        <h2 className={`font-black leading-none mb-2 uppercase break-words tracking-tighter ${isMulti ? "text-3xl" : "text-5xl"}`}>
          {lead.name}
        </h2>
        <p className="text-sm font-bold text-slate-500 uppercase mb-6">{lead.department}</p>
      </div>
      <div className="flex flex-col gap-2 relative z-10">
        <a href={`mailto:${lead.email}`} className="text-lg font-black italic hover:text-blue-600 transition-colors underline decoration-4 underline-offset-4">
          → EMAIL
        </a>
        <a href={lead.linkedin} target="_blank" rel="noreferrer" className="text-lg font-black italic hover:text-blue-600 transition-colors underline decoration-4 underline-offset-4">
          → LINKEDIN
        </a>
      </div>
      <div className="absolute bottom-[-20px] right-[-10px] text-[12rem] font-black text-slate-100 -z-0 select-none group-hover:text-blue-50 transition-colors">
        {String(index + 1).padStart(2, "0")}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [activeTenure, setActiveTenure] = useState("26—27");
  const tenure = TENURES[activeTenure];

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-black p-4 md:p-8 font-mono">
      <main className="max-w-screen-2xl mx-auto mt-8">

        <div className="border-b-8 border-black pb-8 mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="max-w-4xl">
            <h1 className="text-6xl md:text-8xl font-black leading-[0.8] tracking-tighter uppercase">
              Technical <br /> Support Team
            </h1>
            <p className="mt-8 text-xl font-bold max-w-xl leading-tight uppercase">
              The team powering all technical operations at the Center for Career Development, IITG.
            </p>
          </div>
        </div>

        <div className="flex gap-0 mb-10 border-4 border-black w-fit shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          {TENURE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setActiveTenure(key)}
              className={`px-8 py-3 text-base font-black tracking-tight uppercase transition-all border-r-4 last:border-r-0 border-black flex items-center gap-2 ${
                activeTenure === key ? "bg-black text-white" : "bg-white text-black hover:bg-yellow-300"
              }`}
            >
              Tenure {key}
              {key === "26—27" && (
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 font-bold tracking-widest">CURRENT</span>
              )}
            </button>
          ))}
        </div>

        {/* Team photo — only shown when tenure has one */}
        {tenure.teamPhoto && (
          <div className="mb-10 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden group cursor-crosshair">
            <div className="bg-black px-5 py-2 flex items-center justify-between">
              <span className="text-white text-xs font-black tracking-[0.2em] uppercase">
                Team Photo — Tenure {activeTenure}
              </span>
              <span className="text-yellow-300 text-xs font-black tracking-widest uppercase">GROUP</span>
            </div>
            <img
              src={tenure.teamPhoto}
              alt={`Team ${activeTenure}`}
              className="w-full object-cover max-h-[420px] grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500"
              style={{ display: "block" }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-4 border-black bg-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          <section className="lg:col-span-5 border-r-4 border-black flex flex-col">
            {tenure.leads.map((lead, i) => (
              <LeadCard key={i} lead={lead} index={i} total={tenure.leads.length} />
            ))}
          </section>

          <section className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-0 bg-black">
            {tenure.coordinators.map((coord, i) => (
              <div
                key={i}
                className="bg-white p-8 border-l-0 md:border-l-4 border-b-4 border-black flex flex-col justify-between hover:bg-yellow-300 transition-all cursor-crosshair group"
              >
                <div className="flex justify-between items-start mb-10">
                  <div className="w-32 h-32 border-4 border-black grayscale group-hover:grayscale-0 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <img src={coord.photo} className="w-full h-full object-cover" alt={coord.name} />
                  </div>
                  <span className="font-black text-2xl italic underline decoration-2">#{tenure.leads.length + i + 1}</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase leading-tight mb-1 tracking-tighter">{coord.name}</h3>
                  <p className="text-xs font-bold uppercase tracking-widest mb-6 opacity-60">DEP: {coord.department}</p>
                  <div className="flex flex-col gap-2">
                    <a href={`mailto:${coord.email}`} className="w-full border-2 border-black bg-white px-4 py-2 text-xs font-black hover:bg-black hover:text-white transition-all uppercase text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">SEND_EMAIL</a>
                    <a href={coord.linkedin} target="_blank" rel="noreferrer" className="w-full border-2 border-black bg-black text-white px-4 py-2 text-xs font-black hover:bg-blue-600 transition-all uppercase text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">VIEW_LINKEDIN</a>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-[#E0E0E0] hidden md:flex items-center justify-center border-l-4 border-b-4 border-black">
              <span className="text-4xl font-black rotate-90 uppercase tracking-[1em] text-slate-400 select-none">IITG</span>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-24 pb-12 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
        <div className="border-b-2 border-black">CCD TECH TEAM // 2027</div>
        <div className="hidden md:block">GUWAHATI / ASSAM / INDIA</div>
        <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-blue-600 cursor-pointer underline decoration-2 transition-all">BACK_TO_TOP</div>
      </footer>
    </div>
  );
}
