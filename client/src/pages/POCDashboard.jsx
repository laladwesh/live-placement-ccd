// src/pages/POCDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, Spin, Empty } from "antd";
import { SearchOutlined, EnvironmentOutlined, ArrowRightOutlined } from "@ant-design/icons";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function POCDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    if (user) return; // Already have user from cache
    api.get("/users/me").then(res => {
      setCachedUser(res.data.user);
      setUser(res.data.user);
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      fetchCompanies();
    }
  }, [user]);

  // Join poc room for realtime company updates and listen for process-changed events
  useEffect(() => {
    if (!socket || !user) return;

    // Only POCs and admins acting as POC should join
    if (user.role === 'poc' || user.role === 'admin') {
      socket.emit('join:poc');

      const handler = (data) => {
        // If company was completed or reopened, refresh the companies list
        fetchCompanies();
      };

      socket.on('company:process-changed', handler);

      return () => {
        socket.off('company:process-changed', handler);
      };
    }
  }, [socket, user]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/poc/companies");
      setCompanies(res.data.companies || []);
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-6 text-slate-600">Loading...</div>;
  }

  // Check if user is POC or admin
  if (user.role !== "poc" && user.role !== "admin" && user.role !== "superadmin") {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Access Denied: POC privileges required
        </div>
      </div>
    );
  }

  // Filter companies by search term (client-side)
  const filteredCompanies = companies.filter(c => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.venue || "").toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="px-6 py-6">
      <div className="mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161B22', margin: 0 }}>POC Dashboard</h1>
        <p style={{ fontSize: 13, color: '#666B72', marginTop: 4 }}>Manage interviews for your assigned companies</p>
      </div>

      <div className="mb-6" style={{ maxWidth: 480 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#8D9096' }} />}
          placeholder="Search companies by name or venue…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          allowClear
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spin size="large" />
        </div>
      ) : companies.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E4E1E0', padding: 48 }}>
          <Empty description="No companies assigned yet. Contact admin for assignments." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map(company => (
            <div
              key={company._id}
              onClick={() => navigate(`/poc/company/${company._id}`)}
              style={{
                background: '#fff',
                border: '1px solid #E4E1E0',
                padding: 20,
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,33,61,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: '#161B22', marginBottom: 4 }}>
                {company.name}
              </div>
              {company.venue && (
                <div style={{ fontSize: 12, color: '#8D9096', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <EnvironmentOutlined /> {company.venue}
                </div>
              )}
              {company.description && (
                <p style={{ fontSize: 13, color: '#33383F', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {company.description}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: 13 }}>
                <span style={{ color: '#8D9096' }}>Max Rounds</span>
                <span style={{ fontWeight: 600, color: '#161B22' }}>{company.maxRounds}</span>
              </div>
              <Button type="primary" block icon={<ArrowRightOutlined />}>
                Manage Interviews
              </Button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

