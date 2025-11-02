// backend/src/utils/azure.client.js
import axios from "axios";
import querystring from "querystring";

const getAzureConfig = () => ({
  TENANT: process.env.AZURE_TENANT_ID,
  CLIENT_ID: process.env.AZURE_CLIENT_ID,
  CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
  REDIRECT_URI: process.env.AZURE_REDIRECT_URI,
  SCOPE: process.env.AZURE_SCOPE || "openid profile email offline_access User.Read"
});

export const buildAzureAuthorizeUrl = ({ state, prompt = "select_account" } = {}) => {
  const { TENANT, CLIENT_ID, REDIRECT_URI, SCOPE } = getAzureConfig();
  if (!TENANT || !CLIENT_ID || !REDIRECT_URI) {
    // helpful debug when something is misconfigured
    console.error("Azure config missing", { TENANT, CLIENT_ID, REDIRECT_URI });
    throw new Error("Azure environment variables not configured");
  }
  const AUTHORIZE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
  const params = {
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPE,
    state,
    prompt
  };
  return `${AUTHORIZE_URL}?${querystring.stringify(params)}`;
};

export const exchangeAzureCodeForToken = async (code) => {
  const { TENANT, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPE } = getAzureConfig();
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error("Azure config missing for token exchange", { TENANT, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI });
    throw new Error("Azure environment variables not configured");
  }
  const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const body = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE
  };

  const res = await axios.post(TOKEN_URL, querystring.stringify(body), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  return res.data;
};

export const getAzureProfile = async (accessToken) => {
  const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";
  const res = await axios.get(GRAPH_ME, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data;
};
