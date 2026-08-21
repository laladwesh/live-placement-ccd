import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Navigate, Link } from 'react-router-dom';
import { getCachedUser, fetchCurrentUser, clearCachedUser } from '../utils/userCache';
import api from '../api/axios';
import {
  FileTextOutlined,
  BankOutlined,
  TeamOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  MenuOutlined,
  CloseOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';

// ── Role → nav items ──────────────────────────────────────────────
const NAV = {
  admin: [
    { to: '/admin',              label: 'Offer Management', end: true, Icon: FileTextOutlined  },
    { to: '/admin/company',      label: 'Companies',                   Icon: BankOutlined      },
    { to: '/admin/students',     label: 'Students',                    Icon: TeamOutlined      },
    { to: '/prev-placement',     label: 'Prev Placement Data',         Icon: DatabaseOutlined  },
    { to: '/intern-stats-live',  label: 'Live Intern Data',            Icon: BarChartOutlined  },
    { to: '/intern-master-data', label: 'Prev Intern Data',            Icon: DatabaseOutlined  },
  ],
  superadmin: [
    { to: '/admin',              label: 'Offer Management', end: true, Icon: FileTextOutlined  },
    { to: '/admin/company',      label: 'Companies',                   Icon: BankOutlined      },
    { to: '/admin/students',     label: 'Students',                    Icon: TeamOutlined      },
    { to: '/poc',                label: 'POC View',                    Icon: EyeOutlined       },
    { to: '/prev-placement',     label: 'Prev Placement Data',         Icon: DatabaseOutlined  },
    { to: '/intern-stats-live',  label: 'Live Intern Data',            Icon: BarChartOutlined  },
    { to: '/intern-master-data', label: 'Prev Intern Data',            Icon: DatabaseOutlined  },
  ],
  poc:    [{ to: '/poc',                label: 'My Companies',         Icon: BankOutlined      }],
  student:[{ to: '/student',            label: 'My Shortlists',        Icon: FileTextOutlined  }],
  viewer: [
    { to: '/viewers/confirmed',  label: 'Confirmed Placements',        Icon: CheckCircleOutlined },
    { to: '/intern-stats-live',  label: 'Live Intern Data',            Icon: BarChartOutlined    },
    { to: '/intern-master-data', label: 'Prev Intern Data',            Icon: DatabaseOutlined    },
  ],
};

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

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
              cursor: 'pointer', padding: 4, fontSize: 18,
            }}
            onClick={onClose}
          >
            <CloseOutlined />
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
          {links.map(({ to, label, end, Icon }) => (
            <li
              key={to}
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                padding: '6px 0 0 0',
                height: 50,
              }}
            >
              <NavLink
                to={to}
                end={end}
                onClick={onClose}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#14213D' : '#33383F',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px 0 18px',
                  marginLeft: 8,
                  marginRight: 8,
                  borderRadius: 0,
                  borderLeft: isActive ? '3px solid #14213D' : '3px solid transparent',
                  backgroundColor: isActive ? '#E9E2DF' : 'transparent',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                })}
                className="sidebar-navlink"
              >
                {({ isActive }) => (
                  <>
                    {Icon && <Icon style={{ fontSize: 16, opacity: isActive ? 1 : 0.65, flexShrink: 0 }} />}
                    {label}
                  </>
                )}
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
          fontFamily: 'Inter, -apple-system, sans-serif',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#F4F2F1' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', borderBottom: '2px solid #14213D', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}
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
              style={{ color: '#353B47', background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 20 }}
              onClick={() => setSidebarOpen(true)}
              onTouchStart={() => {}}
            >
              <MenuOutlined />
            </button>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1E2532' }}>DDay Portal</span>
          </div>

          {/* Desktop: empty left spacer */}
          <div className="hidden lg:block" />

          {/* Right side: user info + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* User name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#14213D',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <UserOutlined style={{ fontSize: 16 }} />
              <span className="hidden sm:inline">{user.name}</span>
              <span className="hidden sm:inline" style={{ color: '#8D9096', fontSize: 12, fontWeight: 400, textTransform: 'uppercase' }}>
                ({user.role})
              </span>
            </div>

            {/* Sign Out button */}
            <button
              onClick={logout}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = '#F4F2F1'; }}
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
                fontFamily: 'Inter, -apple-system, sans-serif',
                flexShrink: 0,
              }}
            >
              <LogoutOutlined style={{ fontSize: 13 }} /> Sign Out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#F4F2F1',
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
