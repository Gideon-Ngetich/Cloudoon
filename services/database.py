import os
import random
import sqlite3
from datetime import datetime, timedelta

class Database:
    def __init__(self):
        self.pg_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cloudoon")
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        default_sqlite = os.path.join(base_dir, "cloudoon.db")
        if not os.access(base_dir, os.W_OK) or os.environ.get("VERCEL"):
            default_sqlite = os.path.join("/tmp", "cloudoon.db")
        self.sqlite_path = default_sqlite
        self.is_postgres = False
        self.conn = None
        self._init_connection()
        self._create_tables()

    def _init_connection(self):
        pg_bin = r"C:\Program Files\PostgreSQL\18\bin"
        if os.path.exists(pg_bin) and hasattr(os, "add_dll_directory"):
            try:
                os.add_dll_directory(pg_bin)
            except Exception:
                pass

        candidate_urls = []
        if self.pg_url and ("postgresql://" in self.pg_url or "postgres://" in self.pg_url):
            candidate_urls.append(self.pg_url)
            if "@dpg-" in self.pg_url and ".render.com" not in self.pg_url:
                import re
                fixed = re.sub(r"@(dpg-[^/:]+)", r"@\1.oregon-postgres.render.com", self.pg_url)
                if "sslmode=" not in fixed:
                    sep = "&" if "?" in fixed else "?"
                    fixed = f"{fixed}{sep}sslmode=require"
                candidate_urls.append(fixed)

        for target_url in candidate_urls:
            try:
                import psycopg2
                self.conn = psycopg2.connect(target_url, connect_timeout=8)
                self.conn.autocommit = True
                self.is_postgres = True
                return
            except Exception:
                pass

            try:
                import psycopg
                self.conn = psycopg.connect(target_url, autocommit=True, connect_timeout=8)
                self.is_postgres = True
                return
            except Exception:
                pass

        try:
            self.conn = sqlite3.connect(self.sqlite_path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            self.is_postgres = False
        except Exception:
            self.sqlite_path = os.path.join("/tmp", "cloudoon.db")
            self.conn = sqlite3.connect(self.sqlite_path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            self.is_postgres = False

    def get_cursor(self):
        try:
            if self.is_postgres:
                if not self.conn or getattr(self.conn, "closed", True) or getattr(self.conn, "broken", False):
                    self._init_connection()
            return self.conn.cursor()
        except Exception:
            try:
                if self.is_postgres:
                    self._init_connection()
                    return self.conn.cursor()
                self.conn = sqlite3.connect(self.sqlite_path, check_same_thread=False)
                self.conn.row_factory = sqlite3.Row
                self.is_postgres = False
                return self.conn.cursor()
            except Exception:
                self.sqlite_path = os.path.join("/tmp", "cloudoon.db")
                self.conn = sqlite3.connect(self.sqlite_path, check_same_thread=False)
                self.conn.row_factory = sqlite3.Row
                self.is_postgres = False
                return self.conn.cursor()

    def _create_tables(self):
        cur = self.get_cursor()
        serial_type = "SERIAL PRIMARY KEY" if self.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS users (
                id {serial_type},
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT,
                password_hash TEXT NOT NULL,
                country TEXT,
                address TEXT,
                city TEXT,
                postal TEXT,
                is_verified INTEGER DEFAULT 0,
                created_at TEXT
            )
        """)

        try:
            cur.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
        except Exception:
            pass

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS otps (
                id {serial_type},
                email TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                created_at TEXT,
                expires_at TEXT,
                is_used INTEGER DEFAULT 0
            )
        """)

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS orders (
                id {serial_type},
                order_number TEXT UNIQUE NOT NULL,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT,
                customer_country TEXT,
                customer_address TEXT,
                sale_type TEXT DEFAULT 'cash',
                status TEXT DEFAULT 'confirmed',
                payment_method TEXT NOT NULL,
                payment_status TEXT DEFAULT 'paid',
                subtotal REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                promo_code TEXT,
                tax REAL DEFAULT 0,
                total_due_today REAL NOT NULL,
                paid_amount REAL NOT NULL,
                balance REAL DEFAULT 0,
                currency TEXT NOT NULL,
                currency_symbol TEXT NOT NULL,
                billing_cycle_months INTEGER NOT NULL,
                renews_at_total REAL DEFAULT 0,
                renewal_date TEXT,
                served_by TEXT DEFAULT 'Cloudoon System',
                created_at TEXT
            )
        """)

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS order_items (
                id {serial_type},
                order_number TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT,
                monthly_base REAL,
                monthly_renewal REAL,
                is_yearly INTEGER DEFAULT 0,
                quantity INTEGER DEFAULT 1,
                item_total REAL
            )
        """)

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS domains (
                id {serial_type},
                domain TEXT UNIQUE NOT NULL,
                customer_email TEXT NOT NULL,
                order_number TEXT,
                first_year_price REAL,
                renewal_price REAL,
                status TEXT DEFAULT 'active',
                autorenew INTEGER DEFAULT 1,
                whois_privacy INTEGER DEFAULT 1,
                created_at TEXT,
                expires_at TEXT
            )
        """)

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS ip_logs (
                id {serial_type},
                ip TEXT NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                status_code INTEGER DEFAULT 200,
                user_agent TEXT,
                referrer TEXT,
                created_at TEXT
            )
        """)

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS domain_dns_records (
                id {serial_type},
                domain TEXT NOT NULL,
                record_type TEXT NOT NULL,
                name TEXT NOT NULL,
                value TEXT NOT NULL,
                ttl INTEGER DEFAULT 3600,
                priority INTEGER DEFAULT 10,
                created_at TEXT
            )
        """)

        if not self.is_postgres:
            self.conn.commit()

    def create_otp(self, email):
        clean_email = email.strip().lower()
        code = f"{random.randint(100000, 999999)}"
        created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")

        cur = self.get_cursor()
        sql = """
            INSERT INTO otps (email, otp_code, created_at, expires_at, is_used)
            VALUES (%s, %s, %s, %s, 0)
        """ if self.is_postgres else """
            INSERT INTO otps (email, otp_code, created_at, expires_at, is_used)
            VALUES (?, ?, ?, ?, 0)
        """
        cur.execute(sql, (clean_email, code, created_at, expires_at))
        if not self.is_postgres:
            self.conn.commit()
        return code

    def verify_otp(self, email, code):
        clean_email = email.strip().lower()
        clean_code = str(code).strip()
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        cur = self.get_cursor()
        sql = """
            SELECT id FROM otps
            WHERE LOWER(email) = %s AND otp_code = %s AND is_used = 0 AND expires_at >= %s
            ORDER BY id DESC LIMIT 1
        """ if self.is_postgres else """
            SELECT id FROM otps
            WHERE LOWER(email) = ? AND otp_code = ? AND is_used = 0 AND expires_at >= ?
            ORDER BY id DESC LIMIT 1
        """
        cur.execute(sql, (clean_email, clean_code, now_str))
        row = cur.fetchone()
        if not row:
            return False

        otp_id = row[0] if isinstance(row, (tuple, list)) else row["id"]
        update_sql = "UPDATE otps SET is_used = 1 WHERE id = %s" if self.is_postgres else "UPDATE otps SET is_used = 1 WHERE id = ?"
        cur.execute(update_sql, (otp_id,))

        verify_user_sql = "UPDATE users SET is_verified = 1 WHERE LOWER(email) = %s" if self.is_postgres else "UPDATE users SET is_verified = 1 WHERE LOWER(email) = ?"
        cur.execute(verify_user_sql, (clean_email,))

        if not self.is_postgres:
            self.conn.commit()
        return True

    def save_user(self, email, full_name, phone, password_hash, country, address, city, postal, is_verified=0):
        cur = self.get_cursor()
        created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        clean_email = email.strip().lower()
        existing = self.get_user(clean_email)
        if existing:
            if self.is_postgres:
                cur.execute("""
                    UPDATE users SET full_name = %s, phone = %s, password_hash = %s,
                    country = %s, address = %s, city = %s, postal = %s, is_verified = %s
                    WHERE LOWER(email) = %s
                """, (full_name, phone, password_hash, country, address, city, postal, is_verified, clean_email))
            else:
                cur.execute("""
                    UPDATE users SET full_name = ?, phone = ?, password_hash = ?,
                    country = ?, address = ?, city = ?, postal = ?, is_verified = ?
                    WHERE LOWER(email) = ?
                """, (full_name, phone, password_hash, country, address, city, postal, is_verified, clean_email))
                self.conn.commit()
        else:
            if self.is_postgres:
                cur.execute("""
                    INSERT INTO users (email, full_name, phone, password_hash, country, address, city, postal, is_verified, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (clean_email, full_name, phone, password_hash, country, address, city, postal, is_verified, created_at))
            else:
                cur.execute("""
                    INSERT INTO users (email, full_name, phone, password_hash, country, address, city, postal, is_verified, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (clean_email, full_name, phone, password_hash, country, address, city, postal, is_verified, created_at))
                self.conn.commit()
        return self.get_user(clean_email)

    def get_user(self, email):
        cur = self.get_cursor()
        sql = "SELECT * FROM users WHERE LOWER(email) = %s" if self.is_postgres else "SELECT * FROM users WHERE LOWER(email) = ?"
        cur.execute(sql, (email.strip().lower(),))
        row = cur.fetchone()
        if not row:
            return None
        if self.is_postgres:
            cols = [desc[0] for desc in cur.description]
            return dict(zip(cols, row))
        return dict(row)

    def save_order(self, order_data):
        cur = self.get_cursor()
        created_at = order_data.get("created_at") or datetime.utcnow().strftime("%d %b %Y at %H:%M")
        sql = """
            INSERT INTO orders (
                order_number, customer_name, customer_email, customer_phone, customer_country,
                customer_address, sale_type, status, payment_method, payment_status, subtotal,
                discount, promo_code, tax, total_due_today, paid_amount, balance, currency,
                currency_symbol, billing_cycle_months, renews_at_total, renewal_date, served_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """ if self.is_postgres else """
            INSERT INTO orders (
                order_number, customer_name, customer_email, customer_phone, customer_country,
                customer_address, sale_type, status, payment_method, payment_status, subtotal,
                discount, promo_code, tax, total_due_today, paid_amount, balance, currency,
                currency_symbol, billing_cycle_months, renews_at_total, renewal_date, served_by, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """
        params = (
            order_data["order_number"],
            order_data["customer"]["name"],
            order_data["customer"]["email"],
            order_data["customer"].get("phone", ""),
            order_data["customer"].get("country", ""),
            order_data["customer"].get("address", ""),
            order_data.get("sale_type", "cash"),
            order_data.get("status", "confirmed"),
            order_data["payment"]["method"],
            order_data["payment"].get("status", "paid"),
            float(order_data.get("subtotal", 0)),
            float(order_data.get("discount", 0)),
            order_data.get("promo_code", ""),
            float(order_data.get("tax", 0)),
            float(order_data["total_due_today"]),
            float(order_data.get("paid_amount", order_data["total_due_today"])),
            float(order_data.get("balance", 0)),
            order_data["currency"],
            order_data["currency_symbol"],
            int(order_data["billing_cycle_months"]),
            float(order_data.get("renews_at_total", 0)),
            order_data.get("renewal_date", ""),
            order_data.get("served_by", "Cloudoon System"),
            created_at
        )
        cur.execute(sql, params)

        for item in order_data.get("items", []):
            item_sql = """
                INSERT INTO order_items (order_number, name, category, monthly_base, monthly_renewal, is_yearly, quantity, item_total)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """ if self.is_postgres else """
                INSERT INTO order_items (order_number, name, category, monthly_base, monthly_renewal, is_yearly, quantity, item_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            is_y = 1 if item.get("is_yearly") else 0
            cur.execute(item_sql, (
                order_data["order_number"],
                item.get("name", "Service"),
                item.get("category", "hosting"),
                float(item.get("monthly_base", 0)),
                float(item.get("monthly_renewal", 0)),
                is_y,
                int(item.get("quantity", 1)),
                float(item.get("monthly_base", 0) * (12 if is_y else order_data["billing_cycle_months"]))
            ))

            if item.get("category") == "domain" or "Domain" in item.get("name", ""):
                domain_sql = """
                    INSERT INTO domains (domain, customer_email, order_number, first_year_price, renewal_price, created_at, expires_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """ if self.is_postgres else """
                    INSERT OR REPLACE INTO domains (domain, customer_email, order_number, first_year_price, renewal_price, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """
                domain_name = item.get("name", "").replace("Domain Registration (", "").replace(")", "").strip()
                cur.execute(domain_sql, (
                    domain_name,
                    order_data["customer"]["email"],
                    order_data["order_number"],
                    float(item.get("raw_first_year", item.get("monthly_base", 0))),
                    float(item.get("raw_renewal", item.get("monthly_renewal", 0))),
                    created_at,
                    order_data.get("renewal_date", "")
                ))

        if not self.is_postgres:
            self.conn.commit()

        return self.get_order(order_data["order_number"])

    def get_order(self, order_number):
        cur = self.get_cursor()
        sql = "SELECT * FROM orders WHERE order_number = %s" if self.is_postgres else "SELECT * FROM orders WHERE order_number = ?"
        cur.execute(sql, (order_number,))
        row = cur.fetchone()
        if not row:
            return None

        order_dict = dict(zip([desc[0] for desc in cur.description], row)) if self.is_postgres else dict(row)

        items_sql = "SELECT * FROM order_items WHERE order_number = %s" if self.is_postgres else "SELECT * FROM order_items WHERE order_number = ?"
        cur.execute(items_sql, (order_number,))
        item_rows = cur.fetchall()

        items = []
        for ir in item_rows:
            items.append(dict(zip([desc[0] for desc in cur.description], ir)) if self.is_postgres else dict(ir))

        order_dict["items"] = items
        return order_dict

    def get_order_by_number(self, order_number):
        return self.get_order(order_number)

    def get_order_items(self, order_id_or_number):
        cur = self.get_cursor()
        sql = "SELECT * FROM order_items WHERE order_number = %s" if self.is_postgres else "SELECT * FROM order_items WHERE order_number = ?"
        cur.execute(sql, (str(order_id_or_number),))
        rows = cur.fetchall()
        if not rows and str(order_id_or_number).isdigit():
            sql2 = "SELECT * FROM order_items WHERE order_id = %s" if self.is_postgres else "SELECT * FROM order_items WHERE order_id = ?"
            cur.execute(sql2, (int(order_id_or_number),))
            rows = cur.fetchall()
        return [dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r) for r in rows]

    def get_all_orders(self, limit=100):
        cur = self.get_cursor()
        sql = f"SELECT * FROM orders ORDER BY id DESC LIMIT {limit}"
        cur.execute(sql)
        rows = cur.fetchall()
        results = []
        for r in rows:
            results.append(dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r))
        return results

    def get_financial_summary(self):
        orders = self.get_all_orders(limit=1000)
        total_revenue = sum(float(o.get("total_due_today") or 0) for o in orders)
        total_paid = sum(float(o.get("paid_amount") or o.get("total_due_today") or 0) for o in orders)
        total_balance = sum(float(o.get("balance") or 0) for o in orders)
        return {
            "total_orders": len(orders),
            "total_revenue": total_revenue,
            "total_paid": total_paid,
            "total_balance": total_balance
        }

    def get_user_orders(self, email):
        cur = self.get_cursor()
        sql = "SELECT * FROM orders WHERE LOWER(customer_email) = %s ORDER BY id DESC" if self.is_postgres else "SELECT * FROM orders WHERE LOWER(customer_email) = ? ORDER BY id DESC"
        cur.execute(sql, (email.strip().lower(),))
        rows = cur.fetchall()
        orders = []
        for r in rows:
            order_dict = dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r)
            items_sql = "SELECT * FROM order_items WHERE order_number = %s" if self.is_postgres else "SELECT * FROM order_items WHERE order_number = ?"
            cur2 = self.get_cursor()
            cur2.execute(items_sql, (order_dict["order_number"],))
            item_rows = cur2.fetchall()
            order_dict["items"] = [dict(zip([d[0] for d in cur2.description], ir)) if self.is_postgres else dict(ir) for ir in item_rows]
            orders.append(order_dict)
        return orders

    def get_user_domains(self, email):
        cur = self.get_cursor()
        sql = "SELECT * FROM domains WHERE LOWER(customer_email) = %s ORDER BY id DESC" if self.is_postgres else "SELECT * FROM domains WHERE LOWER(customer_email) = ? ORDER BY id DESC"
        cur.execute(sql, (email.strip().lower(),))
        rows = cur.fetchall()
        results = []
        for r in rows:
            results.append(dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r))
        return results

    def get_user_purchased_items(self, email):
        orders = self.get_user_orders(email)
        purchased_items = []
        for o in orders:
            for item in o.get("items", []):
                purchased_items.append({
                    "order_number": o["order_number"],
                    "order_date": o["created_at"],
                    "currency": o["currency"],
                    "currency_symbol": o["currency_symbol"],
                    "billing_cycle_months": o["billing_cycle_months"],
                    "renewal_date": o["renewal_date"],
                    "name": item["name"],
                    "category": item.get("category", "hosting"),
                    "monthly_base": item.get("monthly_base", 0),
                    "monthly_renewal": item.get("monthly_renewal", 0),
                    "item_total": item.get("item_total", 0),
                    "status": "Active"
                })
        return purchased_items

    def get_all_domains(self):
        cur = self.get_cursor()
        sql = "SELECT * FROM domains ORDER BY id DESC"
        cur.execute(sql)
        rows = cur.fetchall()
        results = []
        for r in rows:
            results.append(dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r))
        return results

    def log_request(self, ip, method, path, status_code=200, user_agent="", referrer=""):
        try:
            p = str(path or "")
            if p.startswith("/mn") or p.startswith("/api/monitoring"):
                return
            created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            cur = self.get_cursor()
            sql = """
                INSERT INTO ip_logs (ip, method, path, status_code, user_agent, referrer, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """ if self.is_postgres else """
                INSERT INTO ip_logs (ip, method, path, status_code, user_agent, referrer, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            try:
                cur.execute(sql, (str(ip)[:64], str(method)[:10], str(path)[:255], int(status_code or 200), str(user_agent)[:255], str(referrer)[:255], created_at))
            except Exception:
                if self.is_postgres:
                    self._init_connection()
                    cur = self.get_cursor()
                    cur.execute(sql, (str(ip)[:64], str(method)[:10], str(path)[:255], int(status_code or 200), str(user_agent)[:255], str(referrer)[:255], created_at))
            if not self.is_postgres and self.conn:
                self.conn.commit()
        except Exception:
            pass

    def get_recent_ip_logs(self, limit=150, search=None):
        for attempt in range(2):
            try:
                cur = self.get_cursor()
                if search:
                    term = f"%{search.strip().lower()}%"
                    sql = """
                        SELECT * FROM ip_logs
                        WHERE LOWER(ip) LIKE %s OR LOWER(path) LIKE %s OR LOWER(method) LIKE %s
                        ORDER BY id DESC LIMIT %s
                    """ if self.is_postgres else """
                        SELECT * FROM ip_logs
                        WHERE LOWER(ip) LIKE ? OR LOWER(path) LIKE ? OR LOWER(method) LIKE ?
                        ORDER BY id DESC LIMIT ?
                    """
                    cur.execute(sql, (term, term, term, limit))
                else:
                    sql = "SELECT * FROM ip_logs ORDER BY id DESC LIMIT %s" if self.is_postgres else "SELECT * FROM ip_logs ORDER BY id DESC LIMIT ?"
                    cur.execute(sql, (limit,))

                rows = cur.fetchall()
                results = []
                for r in rows:
                    if self.is_postgres:
                        cols = [desc[0] for desc in cur.description]
                        item = dict(zip(cols, r))
                        if isinstance(item.get("created_at"), datetime):
                            item["created_at"] = item["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                        elif item.get("created_at") is not None:
                            item["created_at"] = str(item.get("created_at"))
                        results.append(item)
                    else:
                        results.append(dict(r))
                return results
            except Exception:
                if attempt == 0 and self.is_postgres:
                    self._init_connection()
                else:
                    return []
        return []

    def get_ip_stats(self):
        for attempt in range(2):
            try:
                cur = self.get_cursor()
                cur.execute("SELECT COUNT(*) FROM ip_logs")
                total = cur.fetchone()[0] or 0

                cur.execute("SELECT COUNT(DISTINCT ip) FROM ip_logs")
                unique = cur.fetchone()[0] or 0

                cur.execute("SELECT path, COUNT(*) as cnt FROM ip_logs GROUP BY path ORDER BY cnt DESC LIMIT 5")
                top_paths = [{"path": r[0], "count": r[1]} for r in cur.fetchall()]

                cur.execute("SELECT ip, COUNT(*) as cnt FROM ip_logs GROUP BY ip ORDER BY cnt DESC LIMIT 5")
                top_ips = [{"ip": r[0], "count": r[1]} for r in cur.fetchall()]

                return {
                    "total_requests": total,
                    "unique_ips": unique,
                    "top_paths": top_paths,
                    "top_ips": top_ips
                }
            except Exception:
                if attempt == 0 and self.is_postgres:
                    self._init_connection()
                else:
                    return {
                        "total_requests": 0,
                        "unique_ips": 0,
                        "top_paths": [],
                        "top_ips": []
                    }
        return {
            "total_requests": 0,
            "unique_ips": 0,
            "top_paths": [],
            "top_ips": []
        }

    def clear_ip_logs(self):
        for attempt in range(2):
            try:
                cur = self.get_cursor()
                cur.execute("DELETE FROM ip_logs")
                if not self.is_postgres and self.conn:
                    self.conn.commit()
                return
            except Exception:
                if attempt == 0 and self.is_postgres:
                    self._init_connection()

    def get_domain_dns_records(self, domain):
        try:
            domain_clean = str(domain or "").strip().lower()
            if not domain_clean:
                return []
            cur = self.get_cursor()
            sql = "SELECT * FROM domain_dns_records WHERE LOWER(domain) = %s ORDER BY id ASC" if self.is_postgres else "SELECT * FROM domain_dns_records WHERE LOWER(domain) = ? ORDER BY id ASC"
            cur.execute(sql, (domain_clean,))
            rows = cur.fetchall()
            results = []
            for r in rows:
                results.append(dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r))

            if not results:
                default_records = [
                    ("A", "@", "197.232.48.12", 3600, 10),
                    ("A", "mail", "197.232.48.55", 3600, 10),
                    ("CNAME", "www", "@", 3600, 10),
                    ("MX", "@", f"mail.{domain_clean}", 3600, 10),
                    ("TXT", "@", "v=spf1 a mx include:_spf.cloudoon.com ~all", 3600, 10),
                    ("NS", "@", "ns1.cloudoon.com", 86400, 10),
                    ("NS", "@", "ns2.cloudoon.com", 86400, 10),
                ]
                now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                for r_type, r_name, r_val, r_ttl, r_prio in default_records:
                    ins_sql = """
                        INSERT INTO domain_dns_records (domain, record_type, name, value, ttl, priority, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """ if self.is_postgres else """
                        INSERT INTO domain_dns_records (domain, record_type, name, value, ttl, priority, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """
                    cur.execute(ins_sql, (domain_clean, r_type, r_name, r_val, r_ttl, r_prio, now_str))
                if not self.is_postgres:
                    self.conn.commit()

                cur.execute(sql, (domain_clean,))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    results.append(dict(zip([desc[0] for desc in cur.description], r)) if self.is_postgres else dict(r))
            return results
        except Exception:
            return []

    def add_domain_dns_record(self, domain, record_type, name, value, ttl=3600, priority=10):
        try:
            domain_clean = str(domain or "").strip().lower()
            cur = self.get_cursor()
            now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            sql = """
                INSERT INTO domain_dns_records (domain, record_type, name, value, ttl, priority, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """ if self.is_postgres else """
                INSERT INTO domain_dns_records (domain, record_type, name, value, ttl, priority, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            cur.execute(sql, (domain_clean, str(record_type).upper().strip(), str(name).strip(), str(value).strip(), int(ttl or 3600), int(priority or 10), now_str))
            if not self.is_postgres:
                self.conn.commit()
            return True
        except Exception:
            return False

    def update_domain_dns_record(self, record_id, record_type, name, value, ttl=3600, priority=10):
        try:
            cur = self.get_cursor()
            sql = """
                UPDATE domain_dns_records
                SET record_type = %s, name = %s, value = %s, ttl = %s, priority = %s
                WHERE id = %s
            """ if self.is_postgres else """
                UPDATE domain_dns_records
                SET record_type = ?, name = ?, value = ?, ttl = ?, priority = ?
                WHERE id = ?
            """
            cur.execute(sql, (str(record_type).upper().strip(), str(name).strip(), str(value).strip(), int(ttl or 3600), int(priority or 10), int(record_id)))
            if not self.is_postgres:
                self.conn.commit()
            return True
        except Exception:
            return False

    def delete_domain_dns_record(self, record_id):
        try:
            cur = self.get_cursor()
            sql = "DELETE FROM domain_dns_records WHERE id = %s" if self.is_postgres else "DELETE FROM domain_dns_records WHERE id = ?"
            cur.execute(sql, (int(record_id),))
            if not self.is_postgres:
                self.conn.commit()
            return True
        except Exception:
            return False

db = Database()
