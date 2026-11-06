import os
import re
import hashlib
import secrets
import urllib.parse
import requests
from .database import db

class AuthService:
    def __init__(self):
        self.jwt_secret = os.environ.get("JWT_SECRET", "cloudoon-dev-secret-key")

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.strip().encode("utf-8")).hexdigest()

    def validate_password_strength(self, password: str) -> dict:
        score = 0
        feedback = []
        if len(password) >= 8:
            score += 1
        else:
            feedback.append("At least 8 characters")

        if re.search(r'[A-Z]', password):
            score += 1
        else:
            feedback.append("At least one uppercase letter")

        if re.search(r'[a-z]', password):
            score += 1
        else:
            feedback.append("At least one lowercase letter")

        if re.search(r'[0-9]', password):
            score += 1
        else:
            feedback.append("At least one number")

        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 1
        else:
            feedback.append("At least one special symbol")

        levels = {0: "Very Weak", 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong", 5: "Very Strong"}
        return {
            "score": score,
            "max_score": 5,
            "level": levels.get(score, "Weak"),
            "is_acceptable": score >= 3,
            "missing": feedback
        }

    def search_addresses(self, query: str) -> list:
        clean = query.strip().lower()
        if not clean or len(clean) < 2:
            return []
        suggestions = [
            {"street": "Ngong Road, Kilimani", "city": "Nairobi", "country": "Kenya", "postal": "00100"},
            {"street": "Waiyaki Way, Westlands", "city": "Nairobi", "country": "Kenya", "postal": "00800"},
            {"street": "Mombasa Road, Industrial Area", "city": "Nairobi", "country": "Kenya", "postal": "00500"},
            {"street": "Kimathi Street, CBD", "city": "Nairobi", "country": "Kenya", "postal": "00100"},
            {"street": "Oginga Odinga Street", "city": "Kisumu", "country": "Kenya", "postal": "40100"},
            {"street": "Moi Avenue", "city": "Mombasa", "country": "Kenya", "postal": "80100"}
        ]
        return [s for s in suggestions if clean in f"{s['street']} {s['city']}".lower()]

    def register(self, email: str, full_name: str, phone: str, password: str, country: str, address: str, city: str, postal: str) -> dict:
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            return {"success": False, "message": "A valid email address is required."}
        if not password or len(password.strip()) < 4:
            return {"success": False, "message": "Password must be at least 4 characters long."}

        pwd_hash = self._hash_password(password)
        user = db.save_user(clean_email, full_name, phone, pwd_hash, country, address, city, postal)
        return {
            "success": True,
            "user": {
                "email": user["email"],
                "name": user["full_name"],
                "phone": user.get("phone", ""),
                "address": user.get("address", "")
            },
            "token": f"session_{clean_email}"
        }

    def login(self, email: str, password: str) -> dict:
        clean_email = email.strip().lower()
        user = db.get_user(clean_email)
        if not user:
            return {"success": False, "message": "Account not found with this email. Please register first."}
        if user["password_hash"] != self._hash_password(password):
            return {"success": False, "message": "Invalid password. Please check your credentials and try again."}
        return {
            "success": True,
            "user": {
                "email": user["email"],
                "name": user["full_name"],
                "phone": user.get("phone", ""),
                "address": user.get("address", "")
            },
            "token": f"session_{clean_email}"
        }

    def is_oauth_configured(self, provider: str) -> bool:
        p = provider.lower().strip()
        if p == "google":
            cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
            sec = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
            return bool(cid and sec and not cid.startswith("your-") and not sec.startswith("your-"))
        if p == "github":
            cid = os.environ.get("GITHUB_CLIENT_ID", "").strip()
            sec = os.environ.get("GITHUB_CLIENT_SECRET", "").strip()
            return bool(cid and sec and not cid.startswith("your-") and not sec.startswith("your-"))
        return False

    def get_oauth_login_url(self, provider: str, redirect_uri: str, state: str):
        p = provider.lower().strip()
        if p == "google":
            cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
            if not cid or cid.startswith("your-"):
                return None
            params = {
                "client_id": cid,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "offline",
                "prompt": "select_account"
            }
            return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)

        if p == "github":
            cid = os.environ.get("GITHUB_CLIENT_ID", "").strip()
            if not cid or cid.startswith("your-"):
                return None
            params = {
                "client_id": cid,
                "redirect_uri": redirect_uri,
                "scope": "read:user user:email",
                "state": state
            }
            return "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode(params)

        return None

    def handle_oauth_callback(self, provider: str, code: str, redirect_uri: str) -> dict:
        p = provider.lower().strip()
        if p == "google":
            cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
            sec = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
            try:
                res = requests.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": cid,
                        "client_secret": sec,
                        "redirect_uri": redirect_uri,
                        "grant_type": "authorization_code"
                    },
                    timeout=10
                )
                data = res.json()
                token = data.get("access_token")
                if not token:
                    return {"success": False, "message": data.get("error_description") or "Google token exchange failed"}

                user_res = requests.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                user_info = user_res.json()
                email = (user_info.get("email") or "").strip().lower()
                name = user_info.get("name") or user_info.get("given_name") or email.split("@")[0]
                if not email:
                    return {"success": False, "message": "Google did not provide a verified email address."}

                user = db.get_user(email)
                if not user:
                    user = db.save_user(
                        email=email,
                        full_name=name,
                        phone="",
                        password_hash=self._hash_password(secrets.token_hex(16)),
                        country="Kenya",
                        address="",
                        city="Nairobi",
                        postal="",
                        is_verified=1
                    )
                return {"success": True, "provider": "google", "user": user}
            except Exception as e:
                return {"success": False, "message": f"Google authentication failed: {str(e)}"}

        if p == "github":
            cid = os.environ.get("GITHUB_CLIENT_ID", "").strip()
            sec = os.environ.get("GITHUB_CLIENT_SECRET", "").strip()
            try:
                res = requests.post(
                    "https://github.com/login/oauth/access_token",
                    json={
                        "client_id": cid,
                        "client_secret": sec,
                        "code": code,
                        "redirect_uri": redirect_uri
                    },
                    headers={"Accept": "application/json"},
                    timeout=10
                )
                data = res.json()
                token = data.get("access_token")
                if not token:
                    return {"success": False, "message": data.get("error_description") or "GitHub token exchange failed"}

                headers = {"Authorization": f"Bearer {token}", "User-Agent": "Cloudoon-OAuth-App"}
                user_res = requests.get("https://api.github.com/user", headers=headers, timeout=10)
                user_data = user_res.json()
                name = user_data.get("name") or user_data.get("login") or "GitHub User"
                email = user_data.get("email")

                if not email:
                    emails_res = requests.get("https://api.github.com/user/emails", headers=headers, timeout=10)
                    if emails_res.status_code == 200:
                        emails_list = emails_res.json()
                        for em in emails_list:
                            if em.get("primary") and em.get("verified"):
                                email = em.get("email")
                                break
                        if not email and emails_list:
                            email = emails_list[0].get("email")

                if not email:
                    login_name = user_data.get("login") or "dev"
                    email = f"{login_name}@users.noreply.github.com"

                email = email.strip().lower()
                user = db.get_user(email)
                if not user:
                    user = db.save_user(
                        email=email,
                        full_name=name,
                        phone="",
                        password_hash=self._hash_password(secrets.token_hex(16)),
                        country="Kenya",
                        address="",
                        city="Nairobi",
                        postal="",
                        is_verified=1
                    )
                return {"success": True, "provider": "github", "user": user}
            except Exception as e:
                return {"success": False, "message": f"GitHub authentication failed: {str(e)}"}

        return {"success": False, "message": "Unsupported OAuth provider."}

    def oauth_demo_login(self, provider: str) -> dict:
        p = provider.lower().strip()
        demo_profiles = {
            "google": {"name": "Google Verified User", "email": "user.google@cloudoon.com"},
            "github": {"name": "GitHub Developer", "email": "developer.github@cloudoon.com"},
            "sso": {"name": "Corporate Admin", "email": "admin.sso@cloudoon.com"}
        }
        info = demo_profiles.get(p, {"name": "Cloudoon User", "email": f"user.{p}@cloudoon.com"})
        clean_email = info["email"].lower()
        user = db.get_user(clean_email)
        if not user:
            user = db.save_user(
                email=clean_email,
                full_name=info["name"],
                phone="0712345678",
                password_hash=self._hash_password("cloudoon-demo-oauth-pwd"),
                country="Kenya",
                address="Kilimani, Nairobi",
                city="Nairobi",
                postal="00100",
                is_verified=1
            )
        return {
            "success": True,
            "provider": provider,
            "user": user,
            "token": f"oauth_token_{provider}",
            "is_demo": True
        }

    def oauth_simulate(self, provider: str) -> dict:
        return self.oauth_demo_login(provider)
