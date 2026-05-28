import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Navigate, Link } from 'react-router-dom';
import { getCachedUser, fetchCurrentUser, clearCachedUser } from '../utils/userCache';
import api from '../api/axios';

// ── Role → nav items (text only, matching placement portal) ──────
const NAV = {
  admin: [
    { to: '/admin',              label: 'Offer Management', end: true },
    { to: '/admin/company',      label: 'Companies'                   },
    { to: '/admin/students',     label: 'Students'                    },
    { to: '/intern-master-data', label: 'Internship Data'             },
  ],
  superadmin: [
    { to: '/admin',              label: 'Offer Management', end: true },
    { to: '/admin/company',      label: 'Companies'                   },
    { to: '/admin/students',     label: 'Students'                    },
    { to: '/poc',                label: 'POC View'                    },
    { to: '/intern-master-data', label: 'Internship Data'             },
  ],
  poc:    [{ to: '/poc',                label: 'My Companies'         }],
  student:[{ to: '/student',            label: 'My Shortlists'        }],
  viewer: [
    { to: '/viewers/confirmed',  label: 'Confirmed Placements'        },
    { to: '/intern-master-data', label: 'Internship Data'             },
  ],
};

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ── Hamburger / close icons ──────────────────────────────────────
const MenuIcon  = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>;
const CloseIcon = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
const LogoutIcon = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>;

// ── Sidebar — exact placement portal style ───────────────────────
function Sidebar({ user, open, onClose, onLogout }) {
  const links = user ? (NAV[user.role] || []) : [];

  return (
    <aside
      style={{
        width: 320,
        minWidth: 320,
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 40,
        transition: '350ms',
        paddingBottom: 'env(safe-area-inset-bottom)',
        // Subtle right shadow like the portal
        boxShadow: '1px 0 4px rgba(27,33,45,0.08)',
      }}
      className={[
        'fixed top-0 left-0 h-full lg:relative lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >

      {/* ── Upper: logo + nav ──────────────────── */}
      <div>

        {/* Header — centered logo + title */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            // flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 'calc(20px + env(safe-area-inset-top))',
            paddingBottom: 16,
            marginBottom: 8,
            // borderBottom: '1px solid #E9E9EB',
          }}
        >
          {/* Mobile close — absolute top-right */}
          <button
            className="lg:hidden"
            style={{
              position: 'absolute', top: 12, right: 10,
              color: '#8D9096', background: 'none', border: 'none',
              cursor: 'pointer', padding: 4,
            }}
            onClick={onClose}
          >
            <CloseIcon />
          </button>

          <img
            src="https://iitg.ac.in/placements/static/media/iitglogo.d364692baec36d70b8ff.png"
            alt="IITG"
            style={{ width: 62, height: 62, marginBottom: 8 }}
          />
          <span style={{ marginLeft:'20px', color: 'black', fontWeight: 700, fontSize: '1.55rem', letterSpacing: 0.2, textAlign: 'center', lineHeight: 1.2 }}>
            DDay Portal
          </span>
          {/* <span style={{ color: '#8D9096', fontSize: 11, marginTop: 3, textAlign: 'center' }}>
            IIT Guwahati · CCD
          </span> */}
        </div>

        {/* Nav items — matches .navmenuitem + .navtext pattern */}
        <ul style={{ width: '100%', backgroundColor: 'white', listStyle: 'none', padding: 0, margin: 0 }}>
          {links.map(link => (
            <li
              key={link.to}
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                padding: '6px 0 0 0',
                height: 50,
              }}
            >
              <NavLink
                to={link.to}
                end={link.end}
                onClick={onClose}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'black',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  marginLeft: 10,
                  marginRight: 10,
                  borderRadius: 0,
                  backgroundColor: isActive ? 'rgb(238, 238, 238)' : 'transparent',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                })}
                // Hover via class since inline styles can't do :hover
                className="sidebar-navlink"
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Footer ───────────────────────────── */}
      <Link
       to="/team"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '12px 16px 20px',
          fontSize: 16,
          fontWeight: 600,
          color: 'black',
          fontFamily: 'Lato, sans-serif',
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        Technical Support Team, CCD, IITG
      </Link>
    </aside>
  );
}

// ── Layout root ──────────────────────────────────────────────────
export default function Layout() {
  const navigate = useNavigate();

  // All hooks before any conditional return
  const [user, setUser] = useState(() => getCachedUser());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) { navigate('/login', { replace: true }); return; }
    if (user) return;
    fetchCurrentUser(api)
      .then(u => setUser(u))
      .catch(() => {
        clearCachedUser();
        localStorage.removeItem('jwt_token');
        navigate('/login', { replace: true });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    clearCachedUser();
    localStorage.removeItem('jwt_token');
    navigate('/login', { replace: true });
  };

  const token = localStorage.getItem('jwt_token');
  if (!token) return <Navigate to="/login" replace />;

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#EEF1F4' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', borderBottom: '2px solid #2164E8', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', overflow: 'hidden', fontFamily: 'Lato, ui-sans-serif, sans-serif' }}
      ref={el => { if (el) el.style.height = '100dvh'; }}
      className="h-screen"
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
      />

      {/* ── Content side ──────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar — white, matches placement portal header */}
        <header
          style={{
            height: 45,
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
            zIndex: 20,
            paddingTop: 'env(safe-area-inset-top)',
            boxShadow: '0px 0.3px 0.9px rgba(27,33,45,0.08), 0px 1.6px 3.6px rgba(27,33,45,0.10)',
          }}
        >
          {/* Mobile: hamburger + portal name */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              style={{ color: '#353B47', background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center' }}
              onClick={() => setSidebarOpen(true)}
              onTouchStart={() => {}}
            >
              <MenuIcon />
            </button>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1E2532' }}>DDay Portal</span>
          </div>

          {/* Desktop: empty left spacer */}
          <div className="hidden lg:block" />

          {/* Right side: user info + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* User name — matches portal blue style */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#2164E8',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <svg width="16" height="16" fill="#2164E8" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
              <span className="hidden sm:inline">{user.name}</span>
              <span className="hidden sm:inline" style={{ color: '#8D9096', fontSize: 12, fontWeight: 400, textTransform: 'uppercase' }}>
                ({user.role})
              </span>
            </div>

            {/* Sign Out button */}
            <button
              onClick={logout}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = '#EEF1F4'; }}
              onMouseOut={e => { e.currentTarget.style.backgroundColor = 'white'; }}
              onTouchStart={() => {}}
              style={{
                height: 30,
                padding: '0 12px',
                background: 'white',
                border: '1px solid #DBDDE0',
                color: '#353B47',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                borderRadius: 2,
                fontFamily: 'Lato, sans-serif',
                flexShrink: 0,
              }}
            >
              <LogoutIcon /> Sign Out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#EEF1F4',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
