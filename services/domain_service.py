import os
import re
import socket
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

class DomainService:
    def __init__(self):
        self.api_key = os.environ.get("REGISTRAR_API_KEY", "")
        self.api_endpoint = os.environ.get("REGISTRAR_ENDPOINT", "https://api.cloudoon.com/domains")
        self.tlds = {
            ".com": {"first_year": 9.99, "renewal": 14.99, "popular": True},
            ".net": {"first_year": 11.99, "renewal": 16.99, "popular": False},
            ".org": {"first_year": 12.49, "renewal": 15.99, "popular": True},
            ".co.ke": {"first_year": 7.99, "renewal": 11.99, "popular": True},
            ".io": {"first_year": 29.99, "renewal": 39.99, "popular": True},
            ".cloud": {"first_year": 4.99, "renewal": 19.99, "popular": True},
            ".tech": {"first_year": 3.99, "renewal": 18.99, "popular": False},
            ".store": {"first_year": 2.99, "renewal": 24.99, "popular": False},
            ".online": {"first_year": 1.99, "renewal": 19.99, "popular": False}
        }
        self.known_taken = {
            "google.com", "microsoft.com", "apple.com", "amazon.com", "cloudoon.com",
            "facebook.com", "netflix.com", "github.com", "twitter.com", "openai.com",
            "youtube.com", "yahoo.com", "instagram.com", "linkedin.com", "wikipedia.org"
        }

    def _check_domain(self, domain_name: str) -> bool:
        clean = domain_name.strip().lower()
        if clean in self.known_taken:
            return False

        try:
            socket.gethostbyname(clean)
            return False
        except Exception:
            pass

        try:
            url = f"https://rdap.org/domain/{clean}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CloudoonDomainCheck/1.0"})
            with urllib.request.urlopen(req, timeout=2.2) as resp:
                if resp.status in (200, 301, 302):
                    return False
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return True
            return False
        except Exception:
            pass

        return True

    def search(self, query: str) -> dict:
        clean_query = query.strip().lower()
        clean_query = re.sub(r"https?://", "", clean_query)
        clean_query = re.sub(r"^www\.", "", clean_query)
        clean_query = clean_query.split("/")[0]

        parts = clean_query.split(".", 1)
        base_name = parts[0]
        requested_tld = f".{parts[1]}" if len(parts) > 1 else ".com"

        domains_to_check = []
        if requested_tld in self.tlds:
            domains_to_check.append(f"{base_name}{requested_tld}")

        for tld in self.tlds:
            cand = f"{base_name}{tld}"
            if cand not in domains_to_check:
                domains_to_check.append(cand)

        with ThreadPoolExecutor(max_workers=6) as executor:
            availability_map = dict(zip(domains_to_check, executor.map(self._check_domain, domains_to_check)))

        results = []
        is_exact_available = False

        exact_domain = f"{base_name}{requested_tld}"
        if exact_domain in availability_map:
            is_avail = availability_map[exact_domain]
            is_exact_available = is_avail
            tld_meta = self.tlds.get(requested_tld, {"first_year": 9.99, "renewal": 14.99})
            results.append({
                "domain": exact_domain,
                "tld": requested_tld,
                "available": is_avail,
                "first_year": tld_meta["first_year"],
                "renewal": tld_meta["renewal"],
                "featured": True
            })

        for d in domains_to_check:
            if d == exact_domain:
                continue
            tld_match = "." + d.split(".", 1)[1] if "." in d else ".com"
            tld_meta = self.tlds.get(tld_match, {"first_year": 9.99, "renewal": 14.99, "popular": False})
            results.append({
                "domain": d,
                "tld": tld_match,
                "available": availability_map.get(d, True),
                "first_year": tld_meta["first_year"],
                "renewal": tld_meta["renewal"],
                "featured": tld_meta.get("popular", False)
            })

        results.sort(key=lambda x: (not x["featured"], not x["available"]))

        return {
            "query": query,
            "base_name": base_name,
            "exact_available": is_exact_available,
            "results": results
        }

    def check_transfer(self, domain: str, auth_code: str) -> dict:
        clean_domain = domain.strip().lower()
        if not auth_code or len(auth_code.strip()) < 5:
            return {
                "valid": False,
                "domain": clean_domain,
                "message": "Invalid EPP authorization code. Codes are typically 6-16 characters."
            }

        tld = "." + clean_domain.split(".")[-1] if "." in clean_domain else ".com"
        pricing = self.tlds.get(tld, {"first_year": 10.99, "renewal": 14.99})

        return {
            "valid": True,
            "domain": clean_domain,
            "first_year": pricing["first_year"],
            "renewal": pricing["renewal"],
            "message": "Domain is eligible for transfer with free 1-year extension."
        }

    def get_tlds(self) -> dict:
        return self.tlds
