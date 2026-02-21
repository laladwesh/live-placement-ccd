import React, { useState } from "react";
import Navbar from "../components/Navbar";

export default function TeamPage() {
  const [imageErrors, setImageErrors] = useState({});

  const leadCoordinator = {
    name: "Aagam Bhavesh Mehta",
    role: "LEAD STUDENT COORDINATOR",
    department: "BTech, Mathematics and Computing",
    email: "m.aagam@iitg.ac.in",
    linkedin: "https://www.linkedin.com/in/aagam-mehta-01b995249/",
    photo: "/dday/maagam.jpeg",
    tenure: "25—26",
  };

  // Added linkedin field to each coordinator
  const studentCoordinators = [
    {
      name: "Ramdhan Kumar",
      department: "btech, EcE",
      email: "k.ramdhan@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/ramdhankumar1425/",
      photo: "/dday/karamdhan.jpeg",
    },
    {
      name: "Dhruvkumar R Pansuriya",
      department: "Btech, CSE",
      email: "r.pansuriya@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/dhruvpansuriya05/",
      photo: "/dday/dpansuriya.jpeg",
    },
    {
      name: "Chandan Jyoti Das",
      department: "Btech, ECE",
      email: "d.chandan@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/chandan-jyoti-das-675b3a283/",
      photo: "/dday/jchandan.png",
    },
    {
      name: "Aryashi Tripathi",
      department: "btech, CSE",
      email: "t.aryashi@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/aryashi/",
      photo: "/dday/taryashi.png",
    },
    {
      name: "Vibha Gupta",
      department: "Btech, DSAI",
      email: "g.vibha@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/vibha-gupta-a53a1b2a2/",
      photo: "https://www.iitg.ac.in/gate-jam/img/logo.png",
    },
     {
      name: "Avinash GUpta",
      department: "Btech, ECE",
      email: "g.avinash@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/avinash-gupta-58171828a/",
      photo: "/dday/gavinash.png",
    },
    {
      name: "Srayash Singh",
      department: "btech, BSBE",
      email: "s.srayash@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/srayash/",
      photo: "https://www.iitg.ac.in/gate-jam/img/logo.png",
    },
    {
      name: "Priya Gawshinde",
      department: "btech, physics",
      email: "p.gawshinde@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/priya-gawshinde/",
      photo: "https://www.iitg.ac.in/gate-jam/img/logo.png",
    },
    {
      name: "Jash Vaidya",
      department: "btech, csE",
      email: "v.jash@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/jash-vaidya-00253b2a4/",
      photo: "/dday/jvaidya.png",
    },
    {
      name: "Utkarsh Narayan Pandey",
      department: "btech, ece",
      email: "u.pandey@iitg.ac.in",
      linkedin: "https://www.linkedin.com/in/utkarshnp/",
      photo: "/dday/upandey.jpeg",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-black p-4 md:p-8 font-mono">
      {/* <Navbar user={null} /> */}

      <main className="max-w-screen-2xl mx-auto mt-12">
        {/* Brutalist Header */}
        <div className="border-b-8 border-black pb-8 mb-16 flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="max-w-4xl">
            <h1 className="text-6xl md:text-8xl font-black leading-[0.8] tracking-tighter uppercase">
              Technical <br /> Support Team
            </h1>
            <p className="mt-8 text-xl font-bold max-w-xl leading-tight uppercase">
              The team powering all technical operations at the Center for
              Career Development, IITG.
            </p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black tabular-nums tracking-tighter uppercase border-4 border-black px-4 py-2">
              Tenure {leadCoordinator.tenure}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-4 border-black bg-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          {/* Main Slot: Lead Coordinator */}
          <section className="lg:col-span-5 bg-white p-10 border-r-4 border-black relative overflow-hidden group">
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <span className="bg-black text-white px-3 py-1 text-xs font-bold tracking-widest uppercase mb-12 inline-block shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
                  Lead Student Coordinator
                </span>

                <div className="aspect-square w-full max-w-[300px] border-4 border-black mb-10 overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <img
                    src={leadCoordinator.photo}
                    className="w-full h-full object-cover"
                    alt={leadCoordinator.name}
                  />
                </div>

                <h2 className="text-5xl font-black leading-none mb-4 uppercase break-words tracking-tighter">
                  {leadCoordinator.name}
                </h2>
                <p className="text-lg font-bold text-slate-500 uppercase">
                  {leadCoordinator.department}
                </p>
              </div>

              <div className="mt-20 flex flex-col gap-4">
                <a
                  href={`mailto:${leadCoordinator.email}`}
                  className="text-2xl font-black italic hover:text-blue-600 transition-colors underline decoration-4 underline-offset-4"
                >
                  → EMAIL
                </a>
                <a
                  href={leadCoordinator.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-2xl font-black italic hover:text-blue-600 transition-colors underline decoration-4 underline-offset-4"
                >
                  → LINKEDIN_PROFILE
                </a>
              </div>
            </div>

            <div className="absolute bottom-[-20px] right-[-10px] text-[15rem] font-black text-slate-100 -z-0 select-none group-hover:text-blue-50 transition-colors">
              01
            </div>
          </section>

          {/* List Slot: Coordinators */}
          <section className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-0 bg-black">
            {studentCoordinators.map((coord, i) => (
              <div
                key={i}
                className="bg-white p-8 border-l-0 md:border-l-4 border-b-4 border-black flex flex-col justify-between hover:bg-yellow-300 transition-all cursor-crosshair group relative"
              >
                <div className="flex justify-between items-start mb-12">
                  <div className="w-36 h-36 border-4 border-black grayscale group-hover:grayscale-0 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <img
                      src={coord.photo}
                      className="w-full h-full object-cover"
                      alt={coord.name}
                    />
                  </div>
                  <span className="font-black text-2xl italic underline decoration-2">
                    #{i + 2}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black uppercase leading-tight mb-2 tracking-tighter">
                    {coord.name}
                  </h3>
                  <p className="text-xs font-bold uppercase tracking-widest mb-8 opacity-60">
                    DEP: {coord.department}
                  </p>

                  {/* Updated Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <a
                      href={`mailto:${coord.email}`}
                      className="w-full border-2 border-black bg-white px-4 py-2 text-xs font-black hover:bg-black hover:text-white transition-all uppercase text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    >
                      SEND_EMAIL
                    </a>
                    <a
                      href={coord.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full border-2 border-black bg-black text-white px-4 py-2 text-xs font-black hover:bg-blue-600 transition-all uppercase text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    >
                      VIEW_LINKEDIN
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {/* Filler Block */}
            <div className="bg-[#E0E0E0] hidden md:flex items-center justify-center border-l-4 border-b-4 border-black">
              <span className="text-4xl font-black rotate-90 uppercase tracking-[1em] text-slate-400 select-none">
                IITG
              </span>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-24 pb-12 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
        <div className="border-b-2 border-black">CCD TECH TEAM // 2026</div>
        <div className="hidden md:block">GUWAHATI / ASSAM / INDIA</div>
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="hover:text-blue-600 cursor-pointer underline decoration-2 transition-all active:text-black"
        >
          BACK_TO_TOP
        </div>
      </footer>
    </div>
  );
}
