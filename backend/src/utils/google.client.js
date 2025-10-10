// backend/src/utils/google.client.js
import axios from "axios";
import querystring from "querystring";

const getGoogleConfig = () => ({
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  SCOPE: process.env.GOOGLE_SCOPE || "openid email profile"
});

export const buildGoogleAuthorizeUrl = ({ state, prompt = "select_account" } = {}) => {
  const { CLIENT_ID, REDIRECT_URI, SCOPE } = getGoogleConfig();
  if (!CLIENT_ID || !REDIRECT_URI) {
    console.error("Google config missing", { hasClientId: !!CLIENT_ID, hasRedirect: !!REDIRECT_URI });
    throw new Error("Google environment variables not configured (CLIENT_ID or REDIRECT_URI)");
  }

  const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  const params = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    prompt
  };

  return `${AUTHORIZE_URL}?${querystring.stringify(params)}`;
};

export const exchangeGoogleCodeForToken = async (code) => {
  const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = getGoogleConfig();
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Google env variables (CLIENT_ID/CLIENT_SECRET/REDIRECT_URI) are not configured");
  }

  const TOKEN_URL = "https://oauth2.googleapis.com/token";
  const body = {
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code"
  };

  const res = await axios.post(TOKEN_URL, querystring.stringify(body), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  // res.data contains access_token, id_token, refresh_token (if offline), expires_in, scope, token_type
  return res.data;
};

export const getGoogleProfile = async (accessToken) => {
  const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
  const res = await axios.get(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data; // returns { sub, email, email_verified, name, given_name, family_name, picture, ... }
};
