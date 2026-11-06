import os
import secrets
import urllib.parse
from datetime import datetime, timedelta
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, redirect, session

load_dotenv()

from services.domain_service import DomainService
from services.pricing_service import PricingService
from services.auth_service import AuthService
from services.order_service import OrderService
from services.email_service import EmailService
from services.database import db

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "cloudoon-flask-secret-2026")
app.config["SESSION_COOKIE_NAME"] = "cloudoon_session"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

domain_service = DomainService()
pricing_service = PricingService()
auth_service = AuthService()
order_service = OrderService()
email_service = EmailService()

@app.context_processor
def inject_globals():
    email = session.get("user_email")
    current_user = db.get_user(email) if email else None
    return {"current_user": current_user}

@app.route("/")
def index():
    return render_template(
        "index.html",
        currencies=pricing_service.get_currencies(),
        catalog=pricing_service.get_catalog(),
        tlds=domain_service.get_tlds()
    )

@app.route("/register")
def register():
    if session.get("user_email"):
        return redirect("/dashboard")
    return render_template("auth.html", mode="register")

@app.route("/login")
def login():
    if session.get("user_email"):
        return redirect("/dashboard")
    return render_template("auth.html", mode="login")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

@app.route("/dashboard")
def dashboard():
    email = session.get("user_email")
    if not email:
        return redirect("/login")

    user = db.get_user(email)
    if not user:
        user = {
            "email": email,
            "full_name": email.split("@")[0].replace(".", " ").title(),
            "phone": "0718080850",
            "is_verified": 1
        }

    purchased_items = db.get_user_purchased_items(email)
    orders = db.get_user_orders(email)
    domains = db.get_user_domains(email)

    return render_template(
        "dashboard.html",
        user=user,
        purchased_items=purchased_items,
        orders=orders,
        domains=domains
    )

@app.route("/checkout")
def checkout():
    initial_domain = request.args.get("domain", "")
    initial_tab = request.args.get("tab", "shared")
    initial_plan = request.args.get("plan", "")
    return render_template(
        "checkout.html",
        initial_domain=initial_domain,
        initial_tab=initial_tab,
        initial_plan=initial_plan,
        currencies=pricing_service.get_currencies(),
        catalog=pricing_service.get_catalog(),
        tlds=domain_service.get_tlds()
    )

@app.route("/invoice/<order_number>")
def invoice(order_number):
    order = db.get_order(order_number)
    if not order:
        return render_template("invoice.html", error="Order not found"), 404
    items = order.get("items", [])
    raw_date = order.get("created_at") or ""
    clean_date = ""
    if raw_date:
        raw_part = str(raw_date).split(" at ")[0].split("T")[0].split(" ")[0].strip()
        for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y"):
            try:
                clean_date = datetime.strptime(raw_part, fmt).strftime("%B %d, %Y")
                break
            except Exception:
                pass
        if not clean_date:
            clean_date = raw_part
    else:
        clean_date = datetime.utcnow().strftime("%B %d, %Y")
    return render_template(
        "invoice.html",
        order=order,
        items=items,
        invoice_date=clean_date
    )

@app.route("/sales-report")
@app.route("/invoices")
def sales_report():
    orders = db.get_all_orders(limit=100)
    for o in orders:
        raw_date = o.get("created_at") or ""
        clean_date = ""
        if raw_date:
            raw_part = str(raw_date).split(" at ")[0].split("T")[0].split(" ")[0].strip()
            for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y"):
                try:
                    clean_date = datetime.strptime(raw_part, fmt).strftime("%d %b %Y")
                    break
                except Exception:
                    pass
            o["display_date"] = clean_date or raw_part
        else:
            o["display_date"] = datetime.utcnow().strftime("%d %b %Y")
    summary = db.get_financial_summary()
    return render_template(
        "invoice.html",
        is_sales_report=True,
        orders=orders,
        summary=summary
    )

@app.route("/api/catalog")
def api_catalog():
    currency = request.args.get("currency", "KES")
    catalog = pricing_service.get_catalog(currency)
    currencies = pricing_service.get_currencies()
    return jsonify({
        "status": "success",
        "data": {
            "currency": currency,
            "catalog": catalog,
            "currencies": currencies
        }
    })

@app.route("/api/domains/search")
def api_domain_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"status": "error", "message": "Domain query is required"}), 400
    data = domain_service.search(query)
    return jsonify({"status": "success", "data": data})

@app.route("/api/domains/transfer", methods=["POST"])
def api_domain_transfer():
    payload = request.get_json(silent=True) or {}
    domain = payload.get("domain", "").strip()
    auth_code = payload.get("auth_code", "").strip()
    res = domain_service.transfer_domain(domain, auth_code)
    return jsonify({"status": "success" if res["success"] else "error", "data": res})

@app.route("/api/promo/validate", methods=["POST"])
def api_validate_promo():
    payload = request.get_json(silent=True) or {}
    code = payload.get("code", "").strip()
    subtotal = float(payload.get("subtotal", 0.0))
    res = pricing_service.validate_promo(code, subtotal)
    return jsonify({"status": "success" if res["valid"] else "error", "data": res})

@app.route("/api/auth/password-strength", methods=["POST"])
def api_password_strength():
    payload = request.get_json(silent=True) or {}
    pwd = payload.get("password", "")
    strength = auth_service.validate_password_strength(pwd)
    return jsonify({"status": "success", "data": strength})

@app.route("/api/auth/address-search")
def api_address_search():
    q = request.args.get("q", "")
    results = auth_service.search_addresses(q)
    return jsonify({"status": "success", "data": results})

@app.route("/api/auth/send-otp", methods=["POST"])
def api_send_otp():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").strip().lower()
    if not email:
        return jsonify({"status": "error", "message": "Email is required"}), 400
    code = db.create_otp(email)
    mail_result = email_service.send_otp_email(email, code)
    return jsonify({"status": "success", "data": mail_result})

@app.route("/api/auth/verify-otp", methods=["POST"])
def api_verify_otp():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").strip().lower()
    code = str(payload.get("otp", "")).strip()
    if not email or not code:
        return jsonify({"status": "error", "message": "Email and OTP code are required"}), 400

    valid = db.verify_otp(email, code)
    if valid:
        user = db.get_user(email)
        session.permanent = True
        session["user_email"] = email
        session["user_name"] = user["full_name"] if user else email.split("@")[0].title()
        return jsonify({"status": "success", "message": "OTP verified successfully."})
    return jsonify({"status": "error", "message": "Invalid or expired OTP code."}), 400

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").strip().lower()
    full_name = payload.get("full_name", "").strip()
    phone = payload.get("phone", "").strip()
    password = payload.get("password", "")
    country = payload.get("country", "")
    address = payload.get("address", "")
    city = payload.get("city", "")
    postal = payload.get("postal", "")
    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required"}), 400
    result = auth_service.register(email, full_name, phone, password, country, address, city, postal)
    if result.get("success"):
        session.permanent = True
        session["user_email"] = email
        session["user_name"] = full_name or email.split("@")[0].title()
        return jsonify({"status": "success", "data": result})
    return jsonify({"status": "error", "message": result.get("message", "Registration failed"), "data": result}), 400

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required"}), 400
    result = auth_service.login(email, password)
    if result.get("success"):
        session.permanent = True
        session["user_email"] = email
        session["user_name"] = result["user"]["name"]
        return jsonify({"status": "success", "data": result})
    return jsonify({"status": "error", "message": result.get("message", "Invalid email or password"), "data": result}), 400

@app.route("/auth/login/<provider>")
@app.route("/auth/oauth/<provider>")
def auth_oauth_redirect(provider):
    next_url = request.args.get("next") or request.referrer or "/dashboard"
    if "/login" in next_url or "/register" in next_url:
        next_url = "/dashboard"
    session["oauth_next"] = next_url

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    base_url = os.environ.get("OAUTH_REDIRECT_BASE_URL", "").strip()
    if not base_url or base_url.startswith("your-"):
        base_url = request.host_url.rstrip("/")
    redirect_uri = f"{base_url}/auth/callback/{provider}"

    auth_url = auth_service.get_oauth_login_url(provider, redirect_uri, state)
    if auth_url:
        return redirect(auth_url)

    result = auth_service.oauth_demo_login(provider)
    session.permanent = True
    session["user_email"] = result["user"]["email"]
    session["user_name"] = result["user"]["full_name"]
    return redirect(next_url)

@app.route("/auth/callback/<provider>")
def auth_oauth_callback(provider):
    err = request.args.get("error")
    if err:
        return redirect(f"/login?error={urllib.parse.quote(err)}")

    code = request.args.get("code")
    if not code:
        return redirect("/login?error=Missing+authorization+code")

    base_url = os.environ.get("OAUTH_REDIRECT_BASE_URL", "").strip()
    if not base_url or base_url.startswith("your-"):
        base_url = request.host_url.rstrip("/")
    redirect_uri = f"{base_url}/auth/callback/{provider}"

    result = auth_service.handle_oauth_callback(provider, code, redirect_uri)
    if result.get("success"):
        user = result["user"]
        session.permanent = True
        session["user_email"] = user["email"]
        session["user_name"] = user["full_name"]
        next_url = session.pop("oauth_next", "/dashboard")
        return redirect(next_url)

    err_msg = result.get("message", "Authentication failed")
    return redirect(f"/login?error={urllib.parse.quote(err_msg)}")

@app.route("/api/auth/oauth/<provider>", methods=["GET", "POST"])
def api_oauth(provider):
    next_url = request.args.get("next") or request.referrer or "/dashboard"
    if "/login" in next_url or "/register" in next_url:
        next_url = "/dashboard"
    session["oauth_next"] = next_url

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state

    base_url = os.environ.get("OAUTH_REDIRECT_BASE_URL", "").strip()
    if not base_url or base_url.startswith("your-"):
        base_url = request.host_url.rstrip("/")
    redirect_uri = f"{base_url}/auth/callback/{provider}"

    auth_url = auth_service.get_oauth_login_url(provider, redirect_uri, state)
    if auth_url:
        return jsonify({
            "status": "success",
            "data": {
                "auth_url": auth_url,
                "provider": provider
            }
        })

    result = auth_service.oauth_demo_login(provider)
    session.permanent = True
    session["user_email"] = result["user"]["email"]
    session["user_name"] = result["user"]["full_name"]
    return jsonify({
        "status": "success",
        "data": {
            "user": {
                "name": result["user"]["full_name"],
                "email": result["user"]["email"]
            },
            "redirect_url": next_url,
            "is_demo": True
        }
    })

@app.route("/api/checkout", methods=["POST"])
def api_checkout():
    payload = request.get_json(silent=True) or {}
    order = order_service.process_order(payload)
    if order.get("customer_email"):
        session.permanent = True
        session["user_email"] = order["customer_email"]
        session["user_name"] = order.get("customer_name")
    return jsonify({"status": "success" if order["status"] == "confirmed" else "error", "data": order})

@app.route("/api/order/<order_id>")
def api_get_order(order_id):
    order = db.get_order_by_number(order_id)
    if not order:
        return jsonify({"status": "error", "message": "Order not found"}), 404
    items = db.get_order_items(order["id"])
    return jsonify({"status": "success", "data": {"order": order, "items": items}})

@app.route("/api/orders")
def api_orders():
    email = session.get("user_email")
    orders = db.get_user_orders(email) if email else db.get_all_orders(limit=50)
    return jsonify({"status": "success", "data": orders})

@app.route("/api/domains")
def api_domains():
    email = session.get("user_email")
    domains = db.get_user_domains(email) if email else []
    return jsonify({"status": "success", "data": domains})

@app.route("/api/user/purchases")
def api_user_purchases():
    email = session.get("user_email")
    items = db.get_user_purchased_items(email) if email else []
    return jsonify({"status": "success", "data": items})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
